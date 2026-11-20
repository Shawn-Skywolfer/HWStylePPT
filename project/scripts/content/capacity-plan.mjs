import {normalizeDocument,effectiveRole,digest,clone,WorkbenchError} from './model.mjs';
import {contentCandidates} from './catalog-match.mjs';
import {defaultBoard} from './board-model.mjs';
import {validateGoalSpec} from '../validate-goal-spec.mjs';
import {chartSeriesContracts,chartTypeBoundary} from '../../assets/chart-item-contracts.mjs';
import {contentIssues,assertContentReady} from './content-requirements.mjs';
import {chooseLayoutSequence} from './layout-policy.mjs';
import {interpretationProposals} from './visual-strategy.mjs';

const fixed=s=>s.legacy||['cover','section','chapter','transition'].includes(effectiveRole(s));
function probe(slide,document){
 try{const {candidates}=contentCandidates(slide,document),issues=[];const valid=candidates.filter(c=>{const errors=validateGoalSpec({title:document.title,goal:document.goal||document.title,themePack:'theme17',slides:[{id:slide.slideId,layout:c.layout,props:c.props}]});issues.push(...errors);return !errors.length;});const editorial=issues.some(e=>/repeated|placeholder|default copy/i.test(e));return valid.length?{options:valid.map(c=>({layout:c.layout,reason:c.plan.reason,score:c.score,visual:c.visual}))}:{options:[],error:{code:editorial?'CONTENT_REVIEW_REQUIRED':'LAYOUT_REVIEW_REQUIRED',message:editorial?'本页需要内容复核，不会为绕过内容校验而机械拆页。':'本页内容未通过版式字段容量检查。',issues:issues.slice(0,5)}};}
 catch(error){return {options:[],error:{code:error.code||'CAPACITY_CHECK_FAILED',message:error.message,issues:error.details?.issues||[]}};}
}

// No model call and no summarization. Pagination moves complete atomic blocks only.
export function prepareContentDraft(input,{autoSplit=true}={}){
 const original=normalizeDocument(input,{assignIds:true}),document=clone(original),pages=[],output=[],used=new Set([...original.slides.flatMap(s=>[s.slideId,...s.blocks.map(b=>b.blockId)])]);
 for(const slide of document.slides){
  const structural=contentIssues(document,{slideId:slide.slideId});
  if(structural.length){output.push(slide);pages.push({slideId:slide.slideId,title:slide.title,status:'review',pageIds:[slide.slideId],blockCount:slide.blocks.length,options:[],reason:structural[0].message,error:{code:structural[0].code,issues:structural}});continue;}
  if(fixed(slide)){output.push(slide);pages.push({slideId:slide.slideId,title:slide.title,status:'fixed',pageIds:[slide.slideId],blockCount:slide.blocks.length,options:[]});continue;}
  const checked=probe(slide,document),record={slideId:slide.slideId,title:slide.title,blockCount:slide.blocks.length,pageIds:[slide.slideId],options:checked.options,chartBoundaries:slide.blocks.filter(b=>['bar','column','donut','share','waterfall','line','area','radar'].includes(b.data?.kind)).map(b=>({blockId:b.blockId,...chartTypeBoundary(b.data.kind)}))};
  if(checked.options.length){output.push(slide);pages.push({...record,status:'matched',...(record.chartBoundaries.length?{chartPlan:{layout:checked.options[0].layout,dataSeries:chartSeriesContracts(checked.options[0].layout)}}:{})});continue;}
  let reason;
  if(!autoSplit||slide.pagination==='single'||document.brief.pagination==='fixed')reason='已要求保留单页或固定页数，不能自动增加页面。';
  else if(slide.blocks.length<2)reason='一个完整内容块仍放不下，不能机械截断正文；请审阅拆分论证或精炼候选。';
  else if(slide.blocks.some(b=>b.data!=null||b.media?.length)||slide.media?.length)reason='涉及图表或图片归属，不自动猜测分页；请审阅数据/媒体与解读的拆页方案。';
  else if(slide.board?.edges?.length||slide.board?.mode==='free')reason='涉及显式关系或手动自由排布，不能静默截断关系；请先审阅拆页方案。';
  else if(checked.error?.code!=='LAYOUT_REVIEW_REQUIRED')reason='请先修正内容契约或数据问题，再匹配版式。';
  if(reason){output.push(slide);pages.push({...record,status:'review',reason,error:checked.error});continue;}
  const groups=[],groupRows=[],cache=new Map();let splitStates=0;
  function splitAt(at){
   if(at===slide.blocks.length)return groups.length>1;
   if(++splitStates>500)return false;
   for(let size=Math.min(12,slide.blocks.length-at);size>=1;size--){
    const key=at+':'+size,part={...slide,title:slide.title+'（99/99）',conclusion:at===0?slide.conclusion:'',blocks:slide.blocks.slice(at,at+size)};
    part.board=defaultBoard(part,slide.board?.mode||'columns');
    if(!cache.has(key))cache.set(key,probe(part,document));
    const options=cache.get(key).options;if(!options.length)continue;
    groupRows.push({id:'split-'+at,candidates:options});
    // Individual parts fitting is insufficient: the parts must also have a
    // real, non-repeating adjacent layout combination at the new text scale.
    const compatible=chooseLayoutSequence(groupRows).ok;
    if(compatible){groups.push(part.blocks);if(splitAt(at+size))return true;groups.pop();}
    groupRows.pop();
   }
   return false;
  }
  if(!splitAt(0)){output.push(slide);pages.push({...record,status:'review',reason:'无法在不删改完整内容块的情况下安全分页并满足相邻正文版式不同；请审阅长块、标题或关系。',error:checked.error});continue;}
  const parts=groups.map((blocks,i)=>{
   let id=slide.slideId;if(i){const base=slide.slideId.slice(0,90)+'-p'+(i+1)+'-'+digest(blocks.map(b=>b.blockId)).slice(0,8);id=base;let n=1;while(used.has(id))id=base+'-'+n++;used.add(id);}
   const part={...slide,slideId:id,title:`${slide.title}（${i+1}/${groups.length}）`,conclusion:i===0?slide.conclusion:'',blocks,status:'editing'};
   part.board=defaultBoard(part,slide.board?.mode||'columns');return part;
  });
  const checks=parts.map(p=>probe(p,document));
  if(checks.some(c=>!c.options.length)){output.push(slide);pages.push({...record,status:'review',reason:'分页后的完整标题或正文仍超容，已保留原页。',error:checked.error});continue;}
  output.push(...parts);pages.push({...record,status:'split',pageIds:parts.map(p=>p.slideId),parts:parts.map((p,i)=>({slideId:p.slideId,title:p.title,blockIds:p.blocks.map(b=>b.blockId),layout:checks[i].options[0].layout})),reason:`原页 ${slide.blocks.length} 个完整内容块分为 ${parts.length} 页；没有删改正文、数据或块来源。页面总论点保留在首部分，页面来源随各部分保留。`});
 }
 let planned=normalizeDocument({...document,slides:output.length<=60?output:original.slides});
 if(output.length>60)for(const p of pages.filter(p=>p.status==='split')){p.status='review';p.reason='拆页后将超过 60 页项目上限，未应用自动分页。';p.pageIds=[p.slideId];delete p.parts;}
 // Fine-mode initial review and final generation use the same whole-deck
 // matcher, including visual tiers and adjacency. Recommendations never lock
 // a user's mind map to one template or alter its confirmed content.
 let visualPlanning={ok:false,reason:'content-review-required'};
 if(!pages.some(p=>p.status==='review')){
  const rows=planned.slides.map(s=>fixed(s)?{id:s.slideId,special:true}:{id:s.slideId,candidates:contentCandidates(s,planned).candidates});
  const sequence=chooseLayoutSequence(rows);
  visualPlanning={ok:sequence.ok,policy:sequence.priority||'pictorial-or-3-icons-first-lexicographic',...(sequence.ok?{pages:[...sequence.selected].map(([slideId,c])=>({slideId,layout:c.layout,visual:c.visual}))}:{reason:sequence.reason})};
  if(sequence.ok){
   for(const p of pages){const selected=visualPlanning.pages.find(v=>v.slideId===p.slideId);if(selected){p.recommendedLayout=selected.layout;p.visualStrategy=selected.visual;}}
   const errors=validateGoalSpec({title:planned.title,goal:planned.goal||planned.title,themePack:'theme17',slides:[...sequence.selected].map(([id,c])=>({id,layout:c.layout,props:c.props}))});
   if(errors.length){visualPlanning.ok=false;visualPlanning.reason='whole-deck-contract-failed';visualPlanning.issues=errors;const p=pages.find(p=>p.status==='matched');if(p){p.status='review';p.reason=errors.join('\n');}}
  }
  else{const p=pages.find(p=>p.status==='matched');if(p){p.status='review';p.reason='整套内容尚无同时满足视觉优先级、相邻不同版式与容量的安全组合；请审阅换版或分页候选。';}}
 }
 const changed=digest(planned)!==digest(original),report={version:2,sourceHash:digest(input),planHash:digest(planned),beforePages:original.slides.length,afterPages:planned.slides.length,changed,reviewCount:pages.filter(p=>p.status==='review').length,pages,visualPlanning,visualRelationshipProposals:interpretationProposals(planned),notice:'脑图初稿与最终生成共用分档选版和全篇节奏规则；推荐不锁定模板，确认后按最新内容重新匹配并执行浏览器实测。'};
 return {original,document:planned,report};
}

export function createCapacityPlannedProject(store,input,source={}){
 assertContentReady(input);
 const prepared=prepareContentDraft(input),project=store.create(prepared.original,source,{initialPlanning:prepared.report});
 if(prepared.report.changed)return store.edit(project.revision,prepared.document,'初稿容量适配：无损自动拆页');
 return project;
}

export function assertCapacityReady(document,slideId){
 assertContentReady(document,{slideId});
 const {report}=prepareContentDraft(document),blocked=report.pages.filter(p=>(!slideId||p.slideId===slideId)&&['split','review'].includes(p.status));
 if(blocked.length){const p=blocked[0],error=new WorkbenchError(`第 ${document.slides.findIndex(s=>s.slideId===p.slideId)+1} 页「${p.title}」尚未完成容量匹配：${p.reason} 请先打开“容量匹配 / 分页”预览处理，再确认生成。`,422,'CAPACITY_REVIEW_REQUIRED');error.details={slideId:p.slideId,issues:blocked.map(p=>p.reason),suggestions:['预览并确认无损自动拆页','必须一页时保留单页要求并调整布局或审阅精炼候选']};throw error;}
 return report;
}
