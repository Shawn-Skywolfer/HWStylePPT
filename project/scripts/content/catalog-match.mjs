import {THEME_PAGES,inspectLayout,normalizeProps} from '../skill-workflow-utils.mjs';
import {charLength} from '../workflow/copy-contract.mjs';
import {validateGoalSpec} from '../validate-goal-spec.mjs';
import {blankLayoutProps,emptyValue,setControl,layoutInfo,showContentRegion} from './layout-props.mjs';
import {planContentSlide,flowOrder} from './visual-plan.mjs';
import {orderedBoardBlocks,normalizeBoard} from './board-model.mjs';
import {WorkbenchError,effectiveRole} from './model.mjs';
import {originalCandidates} from './original-adapters.mjs';
import {originalProfile} from '../../src/original-layout-profiles.mjs';
import {layoutUtilization} from './layout-utilization.mjs';
import {analysisLayout} from '../../assets/huawei-analysis-layout.mjs';
import {validateChartData} from './chart-data.mjs';
import {iconCandidates} from './icon-plan.mjs';
import {hwCandidates,isHwSpecialData} from './hw-plan.mjs';
import {acceptsProse} from '../workflow/content-field-roles.mjs';
import {chooseLayoutSequence} from './layout-policy.mjs';
import {scoreVisualCandidate,explicitFocusBlockId,compareVisualCandidates} from './visual-strategy.mjs';

const TEXT_KEYS=['text','note','desc','detail','lead'];
const LABEL_KEYS=['label','title','name','zh','dim'];
const MODE_FAMILIES={columns:[9,40,50,71,36,39,42,65,69],flow:[13,43,66],comparison:[33,64],hierarchy:[55,8],table:[19,35,41,61,70]};
const familyFor=page=>Object.entries(MODE_FAMILIES).find(([,numbers])=>numbers.includes(page.pageNumber))?.[0]||'columns';
const originalPages=()=>THEME_PAGES.filter(p=>p.themeKey==='theme17'&&!p.nativeContent&&p.pageNumber>5&&![16,46,59,67,68].includes(p.pageNumber));
const fits=(text,budget)=>typeof budget?.maxChars==='number'&&charLength(text||'')<=budget.maxChars;
function putHeader(slide,blank,bindings,{quote=false}={}){const {props,inspection}=blank,b=inspection.copyBudgets;
 if(quote){const keys=['quoteLead','quoteEm','quoteEm1','quoteMid','quoteEm2','quoteTail'].filter(k=>inspection.copyKeys.includes(k));let index=0;for(const [source,value]of [['title',slide.title],['conclusion',slide.conclusion]]){let remaining=String(value||''),paths=[];while(remaining){const key=keys[index++];if(!key)throw Error('完整标题与结论超过联合引述区容量');let n=0;for(const char of remaining){if(!fits(remaining.slice(0,n)+char,b[key]))break;n+=char.length;}if(!n)throw Error('引述字段缺少字符容量');props[key]=remaining.slice(0,n);remaining=remaining.slice(n);paths.push('props.'+key);}if(value)bindings.push({source,target:paths[0],targets:paths,text:value});}
 const sources=[...new Set([slide.evidence,...slide.blocks.map(b=>b.evidence)].filter(Boolean))].join('；'),key=['source','closing'].find(k=>inspection.copyKeys.includes(k)&&fits(sources,b[k]));if(sources&&!key)throw Error('独立来源区容量不足');if(key){props[key]=sources;for(const block of [{blockId:null,evidence:slide.evidence},...slide.blocks])if(block.evidence)bindings.push({source:'evidence',blockId:block.blockId,target:'props.'+key,text:block.evidence});}return bindings.filter(v=>v.source==='title').flatMap(v=>v.targets||[v.target]);}
 const title=['title','quoteLead'].find(k=>inspection.copyKeys.includes(k)&&fits(slide.title,b[k]));if(!title)throw new Error('标题容量或契约不匹配');props[title]=slide.title;bindings.push({source:'title',target:`props.${title}`,text:slide.title});
 if(slide.conclusion){const lead=['lead','quoteTail','summary','note'].find(k=>k!==title&&inspection.copyKeys.includes(k)&&fits(slide.conclusion,b[k]));if(!lead)throw new Error('缺少可容纳完整核心结论的独立字段');props[lead]=slide.conclusion;bindings.push({source:'conclusion',target:`props.${lead}`,text:slide.conclusion});}
 const groups=new Map();for(const block of slide.blocks.filter(b=>b.evidence)){const labels=groups.get(block.evidence)||[];labels.push(block.label||block.blockId);groups.set(block.evidence,labels);}const sources=[...new Set([slide.evidence,...groups.keys()].filter(Boolean))].join('；');
 if(sources){const key=['closing','source'].find(k=>inspection.copyKeys.includes(k)&&fits(sources,b[k]));if(!key)throw new Error('独立来源区容量不足');props[key]=sources;bindings.push({source:'evidence',target:`props.${key}`,text:slide.evidence});for(const block of slide.blocks)if(block.evidence)bindings.push({blockId:block.blockId,source:'evidence',target:`props.${key}`,text:block.evidence});}
 return [`props.${title}`];
}
function attachMedia(slide,document,blank){const media=slide.media||[],slots=blank.inspection.mediaSlots;
 const wanted=media.length||Number(document.brief?.imagePolicy==='placeholders'&&slots.some(s=>s.maxCount>0&&s.canPresetMedia));
 if(!wanted)return 0;const slot=slots.find(s=>s.maxCount>=wanted&&s.canPresetMedia);if(!slot)throw new Error('媒体槽位数量不匹配');blank.props[slot.field]=media.map(m=>m.src);blank.props[slot.publicCountKey||slot.countKey]=wanted;return wanted;
}
function hideUnusedArrays(main,blank){for(const array of blank.inspection.fillPlan.arrays.filter(a=>a.key!==main&&!a.key.includes('[].'))){
 const binding=blank.inspection.countBindings.find(b=>b.arrays.includes(array.key));
 if(binding&&binding.min===0){blank.props[array.key]=[];setControl(blank.props,blank.record,binding.key,0);continue;}
 const toggle=({metrics:'showMetrics',contacts:'showContact'})[array.key];if(toggle&&blank.record.controls.some(c=>c.key===toggle)){setControl(blank.props,blank.record,toggle,false);continue;}
 if(array.key==='contacts'){blank.props.contacts=[];continue;}
 throw new Error(`辅助区 ${array.key} 无安全隐藏契约，不能填入无关碎片`);
}}
function validateCandidate(slide,candidate){const errors=normalizeProps(candidate.layout,candidate.props).errors||[];const specErrors=validateGoalSpec({title:slide.title,goal:slide.title,themePack:'theme17',slides:[{id:slide.slideId,layout:candidate.layout,props:candidate.props}]});if(errors.length||specErrors.length)throw new Error([...errors,...specErrors].slice(0,2).join(';'));return candidate;}
function textCandidate(slide,document,page,array){if(originalProfile(page.key)?.requiresGroups)throw new Error('多区域原稿必须按区域契约映射，不能用单数组探测隐藏其他区域');const blank=blankLayoutProps(page.key),{inspection,record,props}=blank;
 const label=LABEL_KEYS.find(k=>array.itemFields?.[k]?.type==='string'),body=TEXT_KEYS.find(k=>acceptsProse(array.itemFields?.[k]));if(!label||!body)throw new Error('没有独立正文槽；数字展示位不能作为段落使用');
 const blocks=flowOrder(orderedBoardBlocks(slide),slide.board?.edges||[],slide),binding=inspection.countBindings.find(b=>b.arrays.includes(array.key));if(blocks.length>(array.maxCount||0)||blocks.length<(binding?.min||1))throw new Error('内容块数量不匹配');
 const numeric=Object.entries(array.itemFields).filter(([,f])=>f.type==='number');if(numeric.length)throw new Error('此数组属于数据图表，不能用零值代替缺失的真实数值');
 const bindings=[],titlePaths=putHeader(slide,blank,bindings);hideUnusedArrays(array.key,blank);
 props[array.key]=blocks.map((block,index)=>{if(!fits(block.label,array.itemFields[label])||!fits(block.text,array.itemFields[body]))throw new Error(`完整内容块 ${block.label} 超过字段容量`);const example=record.defaultProps[array.key]?.[0]||{},item=Object.fromEntries(Object.keys(array.itemFields).map(k=>[k,emptyValue(example[k])]));item[label]=block.label;item[body]=block.text;if('no'in item)item.no=String(index+1).padStart(2,'0');if('idx'in item)item.idx=String(index+1).padStart(2,'0');bindings.push({blockId:block.blockId,source:'label',target:`props.${array.key}[${index}].${label}`,text:block.label},{blockId:block.blockId,source:'text',target:`props.${array.key}[${index}].${body}`,text:block.text});return item;});
 if(binding)setControl(props,record,binding.key,blocks.length);showContentRegion(props,record,array.key);
 const mediaCount=attachMedia(slide,document,blank),mode=slide.board?.mode==='free'?(slide.board.edges.some(e=>['sequence','causes'].includes(e.kind))?'flow':'columns'):slide.board?.mode||'columns';
 if(slide.board?.edges.some(e=>e.label))throw new Error('有自定义关系文字，需使用可完整呈现标签的关系布局');
 const family=familyFor(page);if(family==='flow'&&mode!=='flow')throw new Error('步骤版式需要明确的先后关系');if(['flow','hierarchy','comparison'].includes(mode)&&family!==mode)throw new Error('论证关系与页面信息角色不匹配');
 const edges=slide.board?.edges||[];if(edges.length&&(family!=='flow'||edges.length!==blocks.length-1||edges.some((e,i)=>!['sequence','causes'].includes(e.kind)||e.from!==`block:${blocks[i].blockId}`||e.to!==`block:${blocks[i+1].blockId}`)))throw new Error('此固定版式无法完整表达白板的非线性关系');
 if(family==='table'&&!['table','comparison'].includes(slide.role))throw new Error('非表格内容不强制套用表格');
 const score=80+(family===mode?18:0)+(inspection.roles.includes(slide.role)?8:0)+mediaCount*12-((array.maxCount||blocks.length)-blocks.length)*2;
 return validateCandidate(slide,{layout:page.key,props,titlePaths,blocks:blocks.map(b=>({blockId:b.blockId,fields:Object.fromEntries(bindings.filter(v=>v.blockId===b.blockId).map(v=>[v.source,v.target])),paths:bindings.filter(v=>v.blockId===b.blockId).map(v=>v.target)})),plan:{version:3,engine:'full-catalog-match',mode,family,reason:`匹配完整主题库中的“${page.label}”：${blocks.length} 个完整内容块${mediaCount?'，包含已授权媒体槽':''}，保留独立来源与论证关系。`,bindings,mediaCount,checks:{atomicBlocks:true,separateEvidence:true,needsRenderedValidation:true}},score});
}
function chartCandidates(slide,document){
 try{return chartCandidatesUnchecked(slide,document);}catch(error){error.details={slideId:slide.slideId,blockId:slide.blocks.find(b=>b.data!=null)?.blockId,...error.details};throw error;}
}
function chartCandidatesUnchecked(slide,document){const {block,data:d}=validateChartData(slide),analysis=slide.blocks.filter(b=>b!==block);
 const defs=d.kind==='bar'?[{n:11,key:'companies',label:'name',value:'amount',min:5,max:10},{n:27,key:'rows',label:'name',value:'val',min:4,max:7},{n:22,key:'months',label:'m',value:'amount',min:6,max:12}]:['donut','share'].includes(d.kind)?[{n:33,key:'segments',label:'label',value:'value',min:2,max:4}]:d.kind==='column'?[{n:22,key:'months',label:'m',value:'amount',min:6,max:12}]:d.kind==='waterfall'?[{n:23,key:'steps',label:'name',value:'value',min:3,max:5}]:[];
 const result=[];const kind=d.kind==='share'?'donut':d.kind,maxItems=kind==='donut'?6:12;
 if(['bar','column','donut','waterfall'].includes(kind)&&d.labels.length>=2&&d.labels.length<=maxItems&&(!(kind==='donut')||Math.abs(d.values.reduce((a,b)=>a+b,0)-100)<.001)){
  const layout=`theme17_chart_${kind}`,blank=blankLayoutProps(layout),bindings=[],titlePaths=putHeader(slide,blank,bindings),props=blank.props;
  if(!fits(block.label,blank.inspection.copyBudgets.caption)||!fits(block.text,blank.inspection.copyBudgets.note)||!fits(d.unit,blank.inspection.copyBudgets.unit)||d.labels.some(label=>charLength(String(label))>18))throw new WorkbenchError('图表的标签、说明或单位超过安全容量，请先确认精炼后的呈现方式。',422,'CHART_LAYOUT_REQUIRED');
  Object.assign(props,{items:d.labels.map((label,i)=>({label:String(label),value:d.values[i]})),caption:block.label,note:block.text,unit:d.unit||''});
  props.analysis=analysis.map(b=>({label:b.label,text:b.text}));if(!analysisLayout(analysis))throw new WorkbenchError('图表与解读区完整内容超过图文混排容量，请精炼或拆页候选确认后再生成。',422,'LAYOUT_REVIEW_REQUIRED');
  for(const [i,b]of analysis.entries())bindings.push({blockId:b.blockId,source:'label',target:`props.analysis[${i}].label`,text:b.label},{blockId:b.blockId,source:'text',target:`props.analysis[${i}].text`,text:b.text});
  bindings.push({blockId:block.blockId,source:'label',target:'props.caption',text:block.label},{blockId:block.blockId,source:'text',target:'props.note',text:block.text});
  result.push(validateCandidate(slide,{layout,props,titlePaths,blocks:[{blockId:block.blockId,paths:['props.items','props.caption','props.note'],fields:{data:'props.items',label:'props.caption',text:'props.note'}},...analysis.map((b,i)=>({blockId:b.blockId,paths:[`props.analysis[${i}].label`,`props.analysis[${i}].text`],fields:{label:`props.analysis[${i}].label`,text:`props.analysis[${i}].text`}}))],plan:{version:3,engine:'full-catalog-match',mode:'chart',family:'chart',reason:`专用华为 ${kind} 图表：完整保留 ${d.labels.length} 项真实数值、标签、单位、来源与 ${analysis.length} 块解读。`,bindings,chart:{blockId:block.blockId,kind,labels:d.labels,values:d.values,unit:d.unit||''}},score:170}));
 }
 for(const def of defs){try{
 if(d.values.some(v=>v<0))continue; // Legacy templates assume positive-only geometry.
 if(analysis.length)continue;
 // Legacy examples have hard-coded business units; only use exact semantics.
 if(!((def.n===11&&d.unit==='亿美元')||(def.n===27&&d.unit==='笔')||def.n===23))continue;
 if(d.labels.length<def.min||d.labels.length>def.max)continue;const layout=`theme17_page${String(def.n).padStart(3,'0')}`,blank=blankLayoutProps(layout),{props,inspection,record}=blank,bindings=[],titlePaths=putHeader(slide,blank,bindings),array=inspection.fillPlan.arrays.find(a=>a.key===def.key);hideUnusedArrays(def.key,blank);if(def.n===23)props.totalUnit=d.unit||'';
 props[def.key]=d.labels.map((label,index)=>{if(!fits(String(label),array.itemFields[def.label]))throw new Error('数据标签过长');const ex=record.defaultProps[def.key][0],row=Object.fromEntries(Object.keys(array.itemFields).map(k=>[k,emptyValue(ex[k])]));row[def.label]=String(label);row[def.value]=d.values[index];return row;});const count=inspection.countBindings.find(b=>b.arrays.includes(def.key));if(count)setControl(props,record,count.key,d.labels.length);
 for(const key of ['showValues','showValueLabels','showLegend','showConnectors','showTotal'])setControl(props,record,key,true);if(def.n===22)setControl(props,record,'calloutCount',0);
 const note=[block.label,block.text,d.unit].filter(Boolean).join(' · ');if(note){const key=['note','chartLabel','panelTitle','axisLabel'].find(k=>inspection.copyKeys.includes(k)&&fits(note,inspection.copyBudgets[k]));if(!key)throw new Error('图表说明/单位没有足够空间');props[key]=note;bindings.push({blockId:block.blockId,source:'text',target:`props.${key}`,text:block.text},{blockId:block.blockId,source:'label',target:`props.${key}`,text:block.label});}
 const mediaCount=attachMedia(slide,document,blank);result.push(validateCandidate(slide,{layout,props,titlePaths,blocks:[{blockId:block.blockId,paths:[`props.${def.key}`],fields:{data:`props.${def.key}`}}],plan:{version:3,engine:'full-catalog-match',mode:'chart',family:'chart',reason:`真实 ${d.kind} 数据匹配“${record.page.label}”，${d.labels.length} 项，不填入模板样例数值。`,bindings,chart:{blockId:block.blockId,kind:d.kind,labels:d.labels,values:d.values,unit:d.unit||''},mediaCount},score:150}));}catch{}}
 if(!result.length)throw new WorkbenchError('当前真实数据没有容量/单位匹配的图表契约。支持 bar、column、donut/share（百分比）、waterfall；请调整图表类型或在白板确认新的呈现方案，不会用普通文本替代图表。',422,'CHART_LAYOUT_REQUIRED');return result;
}
function existingTableCandidates(slide,document){
 const fail=()=>{throw new WorkbenchError('HW 表格模板已暂停新调用。原 Skill 表格仅在行列、字段类型和字数可完整对应时使用；请确认适合原表格的分组/拆页或其他版式，不会截断表格或重新调用隐藏模板。',422,'EXISTING_TABLE_LAYOUT_REQUIRED');};
 if(slide.blocks.length!==1||slide.media?.length)fail();const block=slide.blocks[0],data=block.data,headers=data?.headers,rows=data?.rows;
 if(!Array.isArray(headers)||headers.length<2||headers.length>4||!Array.isArray(rows)||rows.length<3||rows.length>5)fail();
 const cells=rows.map(row=>Array.isArray(row)?row:row.cells),scalar=v=>typeof v==='string'||typeof v==='number'&&Number.isFinite(v),numeric=v=>/^[+\-−]?\d+(?:[.,]\d+)*(?:[%％])?$/.test(String(v));
 if(rows.some(r=>!Array.isArray(r)&&(r.group||r.emphasis))||cells.some(row=>!Array.isArray(row)||row.length!==headers.length||row.some(v=>!scalar(v))||!numeric(row[1])||(headers.length===4&&!numeric(row[2]))))fail();
 const layout='theme17_page019',blank=blankLayoutProps(layout),{props,inspection,record}=blank,bindings=[],titlePaths=putHeader(slide,blank,bindings),fields=headers.length===4?['dim','val','chg','note']:headers.length===3?['dim','val','note']:['dim','val'],array=inspection.fillPlan.arrays.find(a=>a.key==='rows');
 if(headers.some((v,i)=>!scalar(v)||!fits(String(v),inspection.copyBudgets['colHeads.'+fields[i]]))||cells.some(row=>row.some((v,i)=>!fits(String(v),array.itemFields[fields[i]])))||!fits(block.label,inspection.copyBudgets.season)||!fits(block.text,inspection.copyBudgets.statLine))fail();
 props.colHeads=Object.fromEntries(['dim','val','chg','note'].map(k=>[k,fields.includes(k)?String(headers[fields.indexOf(k)]):'']));
 props.rows=cells.map(row=>({...Object.fromEntries(['dim','val','unit','chg','note'].map(k=>[k,''])),...Object.fromEntries(fields.map((k,i)=>[k,String(row[i])]))}));
 setControl(props,record,'rowCount',rows.length);setControl(props,record,'showChange',headers.length===4);setControl(props,record,'showJudgment',headers.length>=3);props.season=block.label;props.statLine=block.text;
 bindings.push({blockId:block.blockId,source:'label',target:'props.season',text:block.label},{blockId:block.blockId,source:'text',target:'props.statLine',text:block.text});
 return [validateCandidate(slide,{layout,props,titlePaths,blocks:[{blockId:block.blockId,fields:{label:'props.season',text:'props.statLine',data:'props.rows'},paths:['props.season','props.statLine','props.rows','props.colHeads']}],score:180,plan:{version:5,engine:'existing-table-match',family:'table',mode:'table',reason:'使用原 Skill 表格；完整映射表头与单元格，不补造数值、不丢行列。',bindings,checks:{atomicBlocks:true,tablePreserved:true,needsRenderedValidation:true}}})];
}
export function contentCandidates(slide,document,options={}){const result=rawContentCandidates(slide,document,options),rejections=[...(result.rejections||[])];const candidates=result.candidates.filter(c=>{const errors=validateGoalSpec({title:document.title,goal:document.goal||document.title,themePack:'theme17',slides:[{id:slide.slideId,layout:c.layout,props:c.props}]}).filter(e=>!/(?:repeated (?:core|visible) copy|default copy|placeholder)/i.test(e));if(errors.length)rejections.push({layout:c.layout,code:'CANDIDATE_CONTRACT_FAILED',reason:errors.join('\n')});return !errors.length;});return {...result,rejections,candidates:candidates.map(c=>scoreVisualCandidate(slide,c,document)).sort(compareVisualCandidates)};}
function rawContentCandidates(slide,document,{hwVariants={}}={}){
 if(slide.blocks.some(b=>b.media?.length))slide={...slide,media:[...(slide.media||[]),...slide.blocks.flatMap(b=>b.media||[])]};
 const rejections=[],hw=hwCandidates(slide,document,{variants:hwVariants,rejections});
 if(slide.blocks.some(b=>b.data?.kind==='table'))return {candidates:existingTableCandidates(slide,document),searched:originalPages().length,rejections:[]};
 if(isHwSpecialData(slide)){if(!hw.length)throw new WorkbenchError('真实指标/表格数据不符合 HW 数量、数据或容量契约；未补零、截断或转换为普通文字。',422,'LAYOUT_REVIEW_REQUIRED');return {candidates:hw,searched:originalPages().length,rejections:[]};}
 try{flowOrder(slide.blocks,slide.board?.edges||[],slide);}catch(error){if(hw.some(c=>c.plan.family==='radial'))return {candidates:hw.filter(c=>c.plan.family==='radial'),searched:originalPages().length,rejections:[]};throw error;}
 if(slide.blocks.some(b=>b.data!=null)){let candidates;try{candidates=chartCandidates(slide,document);}catch(error){if(!hw.length)throw error;candidates=[];}candidates.push(...hw);const data=slide.blocks.find(b=>b.data!=null)?.data;if(['bar','column'].includes(data?.kind)){const alternate=structuredClone(slide);alternate.blocks.find(b=>b.data!=null).data.kind=data.kind==='bar'?'column':'bar';try{for(const c of [...chartCandidates(alternate,document),...hwCandidates(alternate,document)])if(!candidates.some(a=>a.layout===c.layout))candidates.push({...c,score:c.score-5});}catch{}}return {candidates:candidates.sort((a,b)=>b.score-a.score),searched:originalPages().length,rejections:[]};}
 const candidates=[];for(const page of originalPages()){const {inspection}=layoutInfo(page.key);for(const array of inspection.fillPlan.arrays.filter(a=>!a.key.includes('[].'))){try{candidates.push(textCandidate(slide,document,page,array));}catch(error){rejections.push({layout:page.key,reason:error.message});}}}
 let nativeError;
 if(!slide.media?.length)for(const presentation of ['editorial','briefing','spotlight','bento',undefined]){try{const native=planContentSlide(slide,{presentation,focusBlockId:explicitFocusBlockId(slide)});candidates.push({...native,titlePaths:['props.title'],score:presentation?24:10,plan:{...native.plan,version:3,engine:'semantic-fallback',reason:presentation?`完整内容匹配${({editorial:'咨询式条目',briefing:'双栏简报',spotlight:'重点聚焦',bento:'弹性 Bento 高密度排布'})[presentation]}；保留正文、证据和来源，按实际字量检查几何容量。`:'完整主题库的自适应关系/卡片正文备选，保留全部确认内容。'}});}catch(error){nativeError=error;}}
 candidates.push(...originalCandidates(slide,document,{header:putHeader,media:attachMedia,validate:validateCandidate,rejections}));
 candidates.push(...iconCandidates(slide,document,{rejections}));
 candidates.push(...hw);
 if(!candidates.length&&nativeError){nativeError.details={...nativeError.details,rejections};throw nativeError;}
 if(!candidates.length){const error=new WorkbenchError(`第 ${slide.order} 页没有可安全容纳完整内容及图片的布局，请查看媒体数量或精炼/拆页候选。`,422,'LAYOUT_REVIEW_REQUIRED');error.details={slideId:slide.slideId,rejections};throw error;}
 return {candidates:candidates.sort((a,b)=>b.score-a.score),searched:originalPages().length,rejections};
}
export function matchDeck(document,{choices={},excluded={}}={}){
 const matched=new Map(),overview=[],rows=[];
 for(const slide of document.slides){
  if(['cover','section','transition','chapter'].includes(effectiveRole(slide))){rows.push({id:slide.slideId,special:true});continue;}
  if(slide.legacy){rows.push({id:slide.slideId,legacy:true,requested:slide.legacy.layout,candidates:[{layout:slide.legacy.layout,score:0,plan:{family:'legacy'}}]});continue;}
  const catalog=contentCandidates(slide,document),seen=new Set(),available=catalog.candidates.filter(c=>!(excluded[slide.slideId]||[]).includes(c.layout)&&!seen.has(c.layout)&&seen.add(c.layout)),requested=choices[slide.slideId];
  if(!available.length){const error=new WorkbenchError(`第 ${slide.order} 页没有通过内容与容量检查的候选。`,422,'LAYOUT_REVIEW_REQUIRED');error.details={slideId:slide.slideId};throw error;}
  if(requested&&!available.some(c=>c.layout===requested))throw new WorkbenchError(`视觉规划器选择了不可用布局 ${requested}，内容未改写。`,422,'LAYOUT_PLAN_INVALID');
  rows.push({id:slide.slideId,slide,catalog,candidates:available,requested});
 }
 const sequence=chooseLayoutSequence(rows);if(!sequence.ok){const error=new WorkbenchError('当前完整内容没有找到同时满足“相邻正文页版式不同”、容量和固定模板唯一性的排版组合。原稿未改写；请审阅指定版式选择，或确认内容适配后再生成。',422,'LAYOUT_SEQUENCE_REQUIRED');error.details={reason:sequence.reason,...sequence.blocked,states:sequence.states};throw error;}
 for(const row of rows){if(row.special||row.legacy)continue;const {slide,catalog,candidates:available}=row,selected=sequence.selected.get(row.id);
  selected.plan.catalogSearched=catalog.searched;selected.plan.candidates=available.map(c=>({layout:c.layout,score:c.score,reason:c.plan.reason,visual:c.visual}));selected.plan.visualStrategy=selected.visual;selected.plan.adjacencyRule='different-layout-on-adjacent-body-pages';selected.plan.layoutPriority=sequence.priority;if(sequence.hwPreferenceFallbackReason)selected.plan.hwPreferenceFallbackReason=sequence.hwPreferenceFallbackReason;
  matched.set(slide.slideId,selected);overview.push({slideId:slide.slideId,title:slide.title,role:slide.role,selected:selected.layout,...(row.requested?{requested:row.requested}:{}),candidates:selected.plan.candidates,fallback:selected.layout.startsWith('theme17_content_')});
 }
 return {matched,overview,brief:document.brief,utilization:layoutUtilization(rows,{selected:sequence.selected})};
}
