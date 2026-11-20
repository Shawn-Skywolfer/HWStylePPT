import {originalProfile} from '../../src/original-layout-profiles.mjs';
import {THEME_PAGES} from '../skill-workflow-utils.mjs';
import {contentCandidates} from './catalog-match.mjs';
import {normalizeDocument,WorkbenchError,digest} from './model.mjs';
import {previewProposal} from './proposals.mjs';
import {inspectLayout} from '../skill-workflow-utils.mjs';
import {charLength} from '../workflow/copy-contract.mjs';
import {hwDefinition} from '../../src/components/hw/contracts.mjs';
import {originalVariantCapacity} from '../../assets/hw-original-view.mjs';
import {acceptsProse} from '../workflow/content-field-roles.mjs';
import {iconCapacityProfiles} from '../../assets/huawei-icon-layout.mjs';
import {relationChangeRequired,assertRelationApproval,sourceRelations,validateRelationMapping} from './adaptation-relations.mjs';

export function hwVariantTarget(slide,document,layout,variant){
 const def=hwDefinition(layout),capacity=def&&originalVariantCapacity(def,variant);if(!capacity)throw new WorkbenchError('HW 档位未登记。',422,'HW_VARIANT_INVALID');
 if(['table','metrics','highlight'].includes(def.family))throw new WorkbenchError('此档位涉及真实表格行或独立指标，不能靠 AI 改组删减数据。请使用能容纳全部数据的档位，或先确认拆页。',422,'HW_DATA_REVIEW_REQUIRED');
 return {id:layout,variant:String(variant),label:inspectLayout(layout,{compact:true}).label+' · 原稿档位 '+variant,family:def.family,counts:[capacity.cards+(def.family==='chart'?1:0)],requiredRole:slide.role,requiresRoleChange:false,reason:`保留原稿档位 ${variant} 的完整构图，需要 ${capacity.cards} 个${def.family==='chart'?'解读块，另保留一个不变的结构化图表数据块':'内容块'}。根据现有内容拆分或归组，不补造事实、数字、来源；候选确认后才应用。`};
}

const probes=new Map(),numbers=s=>String(s).match(/-?\d+(?:[.,]\d+)*(?:%|％)?/g)||[];
const patternNames={theme17_page009:'案例拆解 · 主次摘要',theme17_page013:'风险清单 · 传导结构',theme17_page015:'核心结论 · 引述总结',theme17_page019:'明细对照表',theme17_page035:'分层判断表',theme17_page041:'多维比较表',theme17_page043:'步骤流程 · 时间线',theme17_page050:'重点维度 · 主辅分区',theme17_page055:'三角关系 · 支撑要素',theme17_page066:'阶段演进 · 观察链',theme17_page071:'要点清单 · 方法说明'};
const copy=s=>[s.title,s.conclusion,s.evidence,...s.blocks.flatMap(b=>[b.label,b.text,b.evidence])].join('\n');
const inventory=s=>{const all=numbers(copy(s)+'\n'+s.blocks.filter(b=>b.data!=null).map(b=>JSON.stringify(b.data)).join('\n')),counts={};for(const n of all)counts[n]=(counts[n]||0)+1;return counts;};
const error=(message,details)=>{const e=new WorkbenchError(message,422,'ADAPTATION_REVIEW_REQUIRED');if(details)e.details=details;throw e;};
// Region requirements are renderer contracts, not optional probe metadata.
export function adaptationRegionGroups(layout){
 const profile=originalProfile(layout);if(!profile?.requiresGroups)return [];
 const inspection=inspectLayout(layout,{compact:true});
 return profile.regions.map((r,index)=>{const array=inspection.fillPlan.arrays.find(a=>a.key===r.key),binding=inspection.countBindings.find(b=>b.arrays.includes(r.key));return {...r,min:Math.max(1,binding?.min||1),max:array.maxCount,purpose:index===0?(profile.family==='flow'?'主流程或阶段；仅在此区域保留真实步骤连线':'主层次或能力分层'):'辅助解释、观察或支撑；不自动加入主流程链'};});
}
function withRegionContract(target){
 const regionGroups=adaptationRegionGroups(target.id);if(!regionGroups.length)return target;
 const min=regionGroups.reduce((n,r)=>n+r.min,0),max=regionGroups.reduce((n,r)=>n+r.max,0),profile=originalProfile(target.id);
 return {...target,family:profile.family,boardMode:profile.family==='flow'?'flow':'columns',preserveRelations:false,counts:Array.from({length:max-min+1},(_,i)=>min+i),regionGroups};
}
// Probe structural capacity only, never submit these synthetic words as presentation content.
export function adaptationTargets(slide,document){
 if(slide.blocks.some(b=>b.data!=null))return [];
 const key=JSON.stringify({role:slide.role,blockCount:slide.blocks.length,media:[...(slide.media||[]),...slide.blocks.flatMap(b=>b.media||[])],policy:document.brief?.imagePolicy,mode:slide.board?.mode,intent:slide.visualIntent,relations:(slide.board?.edges||[]).map(e=>({kind:e.kind,label:e.label,from:e.from.startsWith('block:')?slide.blocks.findIndex(b=>'block:'+b.blockId===e.from):e.from,to:e.to.startsWith('block:')?slide.blocks.findIndex(b=>'block:'+b.blockId===e.to):e.to}))}),cached=probes.get(key);if(cached)return evidenceSafeTargets(structuredClone(cached),slide);
 const targets=new Map();
 const modes=['columns',...(['flow','comparison','hierarchy'].includes(slide.board?.mode)?[slide.board.mode]:[]),...(slide.board?.edges?.length?['source-relations']:[])];
 for(const count of [1,2,3,4,5,6,7,8])for(const role of ['body','table'])for(const mode of new Set(modes)){
  if(mode==='source-relations'&&count!==slide.blocks.length)continue;
  const remap=id=>id.startsWith('block:')?'block:probe-'+slide.blocks.findIndex(b=>'block:'+b.blockId===id):id;
  const board=mode==='source-relations'?{mode:slide.board.mode,nodes:[],edges:slide.board.edges.map(e=>({...e,from:remap(e.from),to:remap(e.to)}))}:{mode,nodes:[],...(mode==='columns'||mode==='comparison'?{edges:[]}:{})};
  const p=normalizeDocument({...document,slides:[{slideId:'probe-page',role,visualIntent:slide.visualIntent,title:'关键判断',conclusion:'',evidence:'',media:[...(slide.media||[]),...slide.blocks.flatMap(b=>b.media||[])],board,blocks:Array.from({length:count},(_,i)=>({blockId:'probe-'+i,label:['需求','供给','价格','风险','行动','反馈','协同','复核'][i],text:['统一业务标准。','明确责任边界。','跟踪交付进度。','识别关键风险。','落实改进措施。','形成反馈闭环。','协调资源支持。','复核关键结论。'][i],evidence:''}))}]});
  try{for(const c of contentCandidates(p.slides[0],p).candidates.filter(c=>/^theme17_page|^theme17_content_(icon_|hw_)/.test(c.layout))){let item=targets.get(c.layout);const preserve=mode==='source-relations',safe=preserve||board.mode===slide.board?.mode,oldSafe=item&&(item.preserveRelations||item.boardMode===slide.board?.mode);if(!item||safe&&!oldSafe||preserve&&!item.preserveRelations){item={id:c.layout,label:inspectLayout(c.layout,{compact:true}).label,family:c.plan.family,boardMode:board.mode,...(preserve?{preserveRelations:true}:{}),mediaCount:c.plan.mediaCount||0,counts:[],reason:'需根据目标版式精炼、归组；先审阅内容与视觉候选，确认后应用。'};targets.set(c.layout,item);}if(item.boardMode===board.mode&&!!item.preserveRelations===preserve&&!item.counts.includes(count))item.counts.push(count);}}catch{}
 }
 for(const page of THEME_PAGES.filter(p=>originalProfile(p.key)?.requiresGroups)){
  targets.set(page.key,withRegionContract({...targets.get(page.key),id:page.key,label:page.label,reason:'多区域原稿：先审阅分组与关系候选，保留全部内容，不按数量静默分割。'}));
 }
 const result=[...targets.values()].map(t=>({...t,sourceLabel:t.label,label:patternNames[t.id]||t.label,requiredRole:t.family==='table'&&!['table','comparison'].includes(slide.role)?'table':slide.role,requiresRoleChange:t.family==='table'&&!['table','comparison'].includes(slide.role),requiresRelationChange:relationChangeRequired(slide,t),sourceRelationCount:sourceRelations(slide).length})).sort((a,b)=>a.id.localeCompare(b.id));if(probes.size>=256)probes.delete(probes.keys().next().value);probes.set(key,result);return evidenceSafeTargets(structuredClone(result),slide);
}
function evidenceSafeTargets(targets,slide){
 const sources=[...new Set([slide.evidence,...slide.blocks.map(b=>b.evidence)].filter(Boolean))];
 // A conservative lower bound: no labels/attribution overhead. If even this
 // cannot fit, do not spend a model call on an impossible lossless target.
 const minimum=charLength(sources.join('；'));
 return targets.filter(t=>minimum<=adaptationCapacity(t).combinedEvidenceMax);
}
export function adaptationCapacity(target){
 target=withRegionContract(target);
 const i=inspectLayout(target.id,{compact:true}),b=i.copyBudgets,max=keys=>Math.max(0,...keys.map(k=>b[k]?.maxChars||0));
 const groups=i.fillPlan.arrays.filter(a=>!a.key.includes('[].')).flatMap(a=>{const label=['label','title','name','zh','dim'].find(k=>a.itemFields?.[k]?.type==='string'),text=['text','note','desc','detail','lead'].find(k=>acceptsProse(a.itemFields?.[k]));return label&&text?[{key:a.key,labelField:label,textField:text,labelMax:a.itemFields[label].maxChars,textMax:a.itemFields[text].maxChars,maxCount:a.maxCount}]:[];});
 const iconMode=target.id.startsWith('theme17_content_icon_')?target.id.slice('theme17_content_icon_'.length):null;
 return {regionGroups:target.regionGroups,titleMax:max(['title','quoteLead']),conclusionMax:max(['lead','quoteTail','summary','note']),...(target.id==='theme17_page055'?{titlePlusConclusionMax:28}:{}),combinedEvidenceMax:max(['closing','source']),groups,...(iconMode?{geometryProfiles:iconCapacityProfiles(iconMode,{counts:target.counts,imageCount:target.mediaCount||0}),geometryRule:'必须同时满足按数量计算的实际空间；groups.textMax只是字段上限。优先选择能保留原意的较少分组，不盲目保持原块数量。若来源集中到页面 evidence，保留每条完整原始字符串。'}:{}),counting:'按中文等宽字符计；英文、数字、空格按窄字符计。结论可精炼或移入正文，需同时满足单字段与联合容量；来源字符串可去重后集中到 evidence，但必须完整保留。'};
}
export function adaptationMessages(document,target,{allowRegroup=true,allowRoleChange=false,allowRelationChange=false,prompt='',feedback=''}={}){
 target=withRegionContract(target);
 assertAdaptationPreflight(document,target,{allowRegroup,allowRoleChange,allowRelationChange});
 prompt+=(allowRelationChange?'\n本轮仅获准提出关系表达调整候选：不能删除原先后/因果/支撑含义。目标不支持连线时，必须在可见正文中逐条表达，relationMap 的 text 必须逐字出现在对应块 text 中，并包含两端原标签。最终由用户审阅关系是否等义。':'\n未授权改变关系表达，必须保留原关系；不要把流程改成并列或虚构新连线。');
 prompt=['按商务咨询、大企业内部汇报与内部提案提炼：保留观点及解释/机制、证据、业务含义和必要边界，不把完整论证过度压缩成口号或孤立关键词。优先减少重复、理清层次、选择能承载解释内容的分组；不能为了版式留白删除关键解释。确实放不下则明确提出更合适版式或拆页建议，不能编造或静默删掉原意。',prompt].filter(Boolean).join('\n');
 const slide=document.slides[0],boardMode=target.boardMode||(['process','timeline','flow'].includes(target.family)?'flow':'columns'),exampleSlide={slideId:slide.slideId,role:target.requiresRoleChange&&allowRoleChange?target.requiredRole:slide.role,title:slide.title,conclusion:slide.conclusion,evidence:slide.evidence,visualIntent:slide.visualIntent,blocks:slide.blocks.map(b=>({blockId:b.blockId,type:b.type,label:b.label,text:b.text,evidence:b.evidence,...(b.data==null?{}:{data:b.data})})),board:{mode:boardMode,nodes:[],edges:boardMode==='flow'?slide.blocks.slice(0,-1).map((b,i)=>({from:'block:'+b.blockId,to:'block:'+slide.blocks[i+1].blockId,kind:'sequence',label:''})):[]},...(slide.media?.length?{media:slide.media}:{})};
 const capacity=adaptationCapacity(target),totalText=slide.blocks.reduce((n,b)=>n+charLength(b.text),0),profiles=capacity.geometryProfiles||[],preferred=profiles.filter(p=>p.count<=slide.blocks.length&&p.count*p.textMax>=totalText).sort((a,b)=>b.count-a.count)[0];
 if(preferred)capacity.preferredBlockCount=allowRegroup?preferred.count:slide.blocks.length;
 if(target.preserveRelations)exampleSlide.board=structuredClone(slide.board);
 if(target.regionGroups){let cursor=0;for(const region of target.regionGroups){const count=region===target.regionGroups.at(-1)?exampleSlide.blocks.length-cursor:region.min;for(let i=0;i<count&&cursor<exampleSlide.blocks.length;i++)exampleSlide.blocks[cursor++].origin={presentation:{layout:target.id,region:region.key}};}if(boardMode==='flow'){const steps=exampleSlide.blocks.filter(b=>b.origin?.presentation?.region===target.regionGroups[0].key);exampleSlide.board.edges=steps.slice(0,-1).map((b,i)=>({from:'block:'+b.blockId,to:'block:'+steps[i+1].blockId,kind:'sequence',label:''}));}prompt+='\n多区域目标：每块 origin.presentation 必须声明 layout 为目标ID、region 为 capacity.regionGroups 的区域key。按业务关系分区，遵守每区min/max；不要机械平均分。辅助观点不加入主步骤链。分组和关系改动仍须用户审阅。';}
 const outputTemplate={summary:'简述适配理由，不超过80字',operations:[{op:'replaceSlide',slideId:slide.slideId,slide:exampleSlide}],originMap:slide.blocks.map(b=>({blockId:b.blockId,sourceBlockIds:[b.blockId]})),...(allowRelationChange?{relationMap:sourceRelations(slide).map(e=>({from:e.from,to:e.to,kind:e.kind,disposition:'text',blockId:slide.blocks[0]?.blockId,text:'在此填写目标块正文中的完整关系句，必须包含原标签“'+e.fromLabel+'”和“'+e.toLabel+'”'}))}:{}),changes:['用1至5条简短说明列出实际变化；没有发生的变化不要列出']};
 return [{role:'system',content:'你是商业汇报内容编辑。本轮只产出一页待审阅的中性内容 JSON，不调用工具、不写文件。目标版式由程序渲染，你只精炼标题、结论、label/text/evidence 并按实际关系分组。必须严格沿用 outputTemplate 的字段结构，operations[0].slide 必须包含 slideId、role、title、conclusion、evidence、blocks、board；blocks 每项必须有 blockId、label、text、evidence。禁止把模板 props 放入 slide：不得返回 quoteLead、quoteEm、pillars、cards、eyebrow、HTML 或 CSS 等版式字段。保留页面 slideId，禁止增删其他页。必须保留所有不同原始数值及其对象、单位、基准，禁止编造、改值或四舍五入；允许合并同一事实重复数字，不能合并不同对象的同值事实。完整结构化数据、图片引用不变，每条原始来源完整保留于可见文字。允许改写和经授权重新分组，但每个原块必须有去向，originMap 与候选 blockId 一一对应。没有必要时保留原 blockId 和数量，不为版式虚构因果。summary 和 changes 简洁，勿长篇解释推理；只返回 JSON，不要 Markdown 围栏。若上一候选被拒，按 feedback 修订，仍返回完整中性内容结构。'},
 {role:'user',content:JSON.stringify({brief:document.brief,original:slide,protectedNumbers:inventory(slide),target:{id:target.id,label:target.label,allowedBlockCounts:target.counts,requiredRole:exampleSlide.role,requiresRoleChange:target.requiresRoleChange,requiresRelationChange:target.requiresRelationChange,boardMode,reason:target.reason,capacity},allowRegroup,allowRoleChange,allowRelationChange,sourceRelations:sourceRelations(slide),instructions:prompt,feedback,outputTemplate,notes:['outputTemplate 仅展示结构，不是照抄原块数量；必须同时满足 target.capacity 的字段与 geometryProfiles 空间约束。优先参考 preferredBlockCount，保留完整原意后再分组，所有原块仍需 originMap 去向。','若已授权转为表格结构，role 必须采用 target.requiredRole；将已有维度组织为行，不得为了填表补造数值或事实。','并列支撑关系用 columns，其他真实关系在 board.edges 表达；重分组后同步端点。','来源可去重集中到页面 evidence，但每条原始来源字符串必须完整保留；未授权重分组时保留 blockId 与数量。','不够空间就提出失败理由，禁止截断、漏数值或伪造事实。']})}];
}
export function assertAdaptationPreflight(document,target,options={}){
 target=withRegionContract(target);
 assertRelationApproval(document,target,options);const slide=document.slides[0];
 if((target.requiresRoleChange||target.family==='table'&&!['table','comparison'].includes(slide.role))&&options.allowRoleChange!==true)throw new WorkbenchError('目标需要整理为表格结构，请先明确确认；尚未调用模型，原页不变。',422,'LAYOUT_ROLE_APPROVAL_REQUIRED');
 if(options.allowRegroup===false&&target.counts?.length&&!target.counts.includes(slide.blocks.length))throw new WorkbenchError('当前内容块数量不在目标范围内。请允许提出重新分组，或选择兼容版式；尚未调用模型，原页不变。',422,'LAYOUT_REGROUP_APPROVAL_REQUIRED');
}
export function validateAdaptation(document,result,target,{allowRegroup=true,allowRoleChange=false,allowRelationChange=false}={}){
 target=withRegionContract(target);
 assertRelationApproval(document,target,{allowRelationChange});
 if(result?.changes!=null&&!Array.isArray(result.changes))error('候选的修改说明 changes 必须为数组。');
 const original=document.slides[0];if(!Array.isArray(result?.operations)||result.operations.length!==1||result.operations[0].op!=='replaceSlide'||result.operations[0].slideId!==original.slideId)error('内容适配只能修改当前一页，不能顺带增删或改动其他页。');
 const candidateSlide=result.operations[0].slide;if(!candidateSlide||candidateSlide.slideId!==original.slideId||!Array.isArray(candidateSlide.blocks))error('候选必须是中性内容页，不是模板 props：slide.slideId 必须等于 '+original.slideId+'，并返回 blocks:[{blockId,label,text,evidence}]、title、conclusion、evidence 和 board。禁止返回 quoteLead/pillars/cards 等模板字段；请严格照 outputTemplate 返回。');
 const requiredRole=target.family==='table'&&!['table','comparison'].includes(original.role)?'table':original.role,roleChanged=requiredRole!==original.role;
 if(roleChanged&&!allowRoleChange)error('目标为表格版式，需要先确认将当前页整理为表格结构；尚未授权，不会调用模型或强制转换。');
 if(![original.role,requiredRole].includes(candidateSlide.role))error('候选擅自改变页面角色，必须保留原角色或已授权的目标表格角色。');
 // The approved role is layout metadata, not a content rewrite. Rebase it even
 // when the model keeps the old role, without changing any label/text/data.
 const verified=structuredClone(result);verified.operations[0].slide.role=requiredRole;
 const task={scope:{kind:'slide',slideId:original.slideId},baseDocument:document,preserveNumbers:false},adapted=previewProposal(task,verified),slide=adapted.slides[0],oldNumbers=inventory(original),newNumbers=inventory(slide),missing=Object.keys(oldNumbers).filter(n=>!newNumbers[n]),added=Object.keys(newNumbers).filter(n=>!oldNumbers[n]);
 if(original.visuals)slide.visuals=structuredClone(original.visuals);
 if(missing.length||added.length)error('候选数值不一致，已拦截。遗漏：'+(missing.join('、')||'无')+'；新增或改值：'+(added.join('、')||'无')+'。只允许合并重复表述，不能删减不同数值、改值或补造数字。');
 const numericOccurrences=Object.keys(oldNumbers).filter(n=>oldNumbers[n]!==newNumbers[n]).map(value=>({value,before:oldNumbers[value],after:newNumbers[value]}));
 if(!allowRegroup&&(slide.blocks.length!==original.blocks.length||slide.blocks.some((b,i)=>b.blockId!==original.blocks[i].blockId)))error('未授权重新分组，候选不能改变内容块数量或 ID。');
 const beforeData=original.blocks.filter(b=>b.data!=null).map(b=>b.data),afterData=slide.blocks.filter(b=>b.data!=null).map(b=>b.data);if(digest(beforeData)!==digest(afterData))error('结构化数据发生变化，候选已拦截。');
 if(digest(original.media||[])!==digest(slide.media||[]))error('候选改变了图片引用，已拦截。');
 const originalIds=new Set(original.blocks.map(b=>b.blockId)),mapped=new Set(),seen=new Set();if(!Array.isArray(result.originMap))error('候选缺少原内容去向映射。');
 for(const item of result.originMap){if(!slide.blocks.some(b=>b.blockId===item.blockId)||seen.has(item.blockId)||!Array.isArray(item.sourceBlockIds)||!item.sourceBlockIds.length||item.sourceBlockIds.some(id=>!originalIds.has(id)))error('内容块去向映射不完整或越界。');seen.add(item.blockId);for(const id of item.sourceBlockIds)mapped.add(id);}
 if(mapped.size!==originalIds.size||seen.size!==slide.blocks.length)error('存在没有去向的原内容或无来源的新内容块，已拦截。');
 if(target.regionGroups?.length){
  const issues=[],groups=target.regionGroups;
  for(const [index,b]of slide.blocks.entries()){const p=b.origin?.presentation;if(p?.layout!==target.id||!groups.some(r=>r.key===p?.region))issues.push({blockId:b.blockId,field:`blocks[${index}].origin.presentation`,expected:{layout:target.id,region:groups.map(r=>r.key)},message:'为此块指定目标区域，不要把区域写进 originMap 或模板 props'});}
  for(const region of groups){const count=slide.blocks.filter(b=>b.origin?.presentation?.layout===target.id&&b.origin.presentation.region===region.key).length;if(count<region.min||count>region.max)issues.push({region:region.key,count,min:region.min,max:region.max,message:'按业务含义归组或拆分，所有原内容仍须有去向'});}
  if(issues.length)error('目标页需要明确的主区与辅助区分组，请为每块填写 origin.presentation 并满足各区数量；不需要用户手动写字段。',{bindingIssues:issues,capacity:adaptationCapacity(target),expected:{regionGroups:groups,assignment:{origin:{presentation:{layout:target.id,region:'从 regionGroups.key 中选择'}}}}});
 }
 const relationReview=validateRelationMapping(original,slide,result,{allowRelationChange});
 const after=copy(slide);for(const source of new Set([original.evidence,...original.blocks.map(b=>b.evidence)].filter(Boolean)))if(!after.includes(source))error('候选遗漏完整原始来源：'+source);
 const capacity=adaptationCapacity(target);if(capacity.titlePlusConclusionMax&&charLength(slide.title)+charLength(slide.conclusion)>capacity.titlePlusConclusionMax)error('标题与结论合并后超过引用区联合容量，会与下方支撑区重叠。保留核心判断，可将细节移入正文，并按此容量修订：'+JSON.stringify(capacity));
 let catalog;try{catalog=contentCandidates(slide,adapted,{hwVariants:target.variant?{[target.id]:target.variant}:{}});}catch(e){error('候选内容超容或关系不匹配：'+String(e.message).slice(0,500)+'。保持中性内容结构，按此容量修订：'+JSON.stringify(adaptationCapacity(target)),e.details);}const candidate=catalog.candidates.find(c=>c.layout===target.id&&(!target.variant||String(c.props.variant)===target.variant));if(!candidate){const rejected=catalog.rejections.filter(r=>r.layout===target.id),reasons=[...new Set(rejected.map(r=>r.reason))];error('候选仍不符合目标容量：'+(reasons.slice(0,6).join('；')||`当前 ${slide.blocks.length} 块，目标支持 ${target.counts?.join('/')||'已登记'} 块；需核对角色、关系与几何容量`)+ '。请保持中性结构并按此容量精炼，数字和完整来源不变：'+JSON.stringify(adaptationCapacity(target)),{layout:target.id,slideId:slide.slideId,rejections:rejected,capacity:adaptationCapacity(target)});}
 return {document:adapted,candidate,review:{summary:String(result.summary||'内容适配候选'),changes:[...(roleChanged?['经用户授权，将原正文整理为表格结构；数字与来源仍按原规则核对。']:[]),...(relationReview.changed?['关系表达已提出调整，请逐条核对关系去向；候选尚未应用。']:[]),...(result.changes||[]).map(String)].slice(0,30),relationReview,structureChange:roleChanged?{fromRole:original.role,toRole:requiredRole,approved:true}:null,originMap:result.originMap,numericOccurrences,before:original,after:slide,target,checks:{numbersPreserved:true,sourceStringsPreserved:true,mediaPreserved:true,allOriginalBlocksMapped:true,numericCount:Object.keys(oldNumbers).length},notice:'程序已核对所有不同数值、来源和内容去向；重复数字出现次数变化单独列出。数字的对象/单位/基准、语义是否准确、关系是否成立仍需人工审阅。改写文字采用新版式样式，原稿与原样式可撤销恢复。'}};
}
