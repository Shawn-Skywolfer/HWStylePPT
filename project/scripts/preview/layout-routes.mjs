import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {contentCandidates} from '../content/catalog-match.mjs';
import {normalizeDocument,effectiveRole,digest,WorkbenchError} from '../content/model.mjs';
import {inspectLayout} from '../skill-workflow-utils.mjs';
import {validateRenderedContent} from '../content/rendered-validation.mjs';
import {stopOwnedProcess} from '../content/bridge.mjs';
import {cacheArtifact,readArtifact,readModel,findSection} from './layout-artifacts.mjs';
import {adaptationTargets,hwVariantTarget} from '../content/layout-adaptation.mjs';
import {assertRelationApproval} from '../content/adaptation-relations.mjs';
import {layoutDisplayName} from '../../assets/layout-names.mjs';
import {layoutUtilization} from '../content/layout-utilization.mjs';
import {runBridge,publicBridgeConfig,bridgeConfig} from '../content/bridge.mjs';
import {callModel,providerConfig} from '../content/provider.mjs';
import {LayoutQueue} from './layout-queue.mjs';
import {normalizeIconConfig,iconCount,ICON_TYPES} from '../../assets/huawei-icons.mjs';
import {hwDefinition} from '../../src/components/hw/contracts.mjs';
import {importHwLayoutContent} from './hw-layout-content.mjs';
import {layoutAgentOwner,layoutAgentStatus,configureLayoutAgent,requireLayoutAgent} from './layout-agent-context.mjs';
import {manualHwInfo,prepareManualHwProps,manualHwChanges} from '../../assets/hw-manual-props.mjs';
import {pageVersions,requirePageVersion,samePageContent} from './layout-history.mjs';
import {deleteBlockPlans} from './layout-blocks.mjs';
import {applyConsoleContent} from './console-content.mjs';
import {contentRoleNotice} from '../workflow/content-field-roles.mjs';
import {adaptWithRenderedValidation} from '../content/adaptation-execution.mjs';
import {layoutAvailableForPage,layoutUsageCount,layoutUsageFromSlides,neighborLayouts,neighborPageIds,FIXED_LAYOUT_MAX_USES} from '../content/layout-policy.mjs';
import {layoutRuntime,requireLayoutProtocol} from './layout-runtime.mjs';
import {canonicalLayoutInput} from '../../assets/layout-state-identity.mjs';

const require=createRequire(import.meta.url),queues=new Set();
const get=(o,p)=>p.replace(/^props\./,'').replace(/\[(\d+)\]/g,'.$1').split('.').reduce((v,k)=>v?.[k],o);
export function imageLayoutInfo(layout,props){const i=inspectLayout(layout,{compact:true}),slots=i.mediaSlots||[],hw=hwDefinition(layout),iconPage=/^theme17_content_icon_/.test(layout)||hw?.family==='icon';return {imageSlots:slots.filter(s=>s.canPresetMedia&&s.field==='images').reduce((n,s)=>n+Number(s.maxCount||0),0),...(iconPage?{iconMin:hw?Math.min(...hw.variants):ICON_TYPES[layout.split('_').at(-1)]?.min||2,iconSlots:props?.cards?.length??i.fillPlan.arrays.find(a=>a.key==='cards')?.maxCount??0,iconCount:props?iconCount(props.cards||[],props.layout?.nodes||[],props.iconConfig):undefined}: {})};}
const layoutGroup=layout=>hwDefinition(layout)?'hw':'existing';
function fail(message,code){if(code)throw new WorkbenchError(message,422,code);throw new Error(message);}
export function activeLayoutCount(){return [...queues].reduce((n,q)=>n+q.active.size,0);}
function context(root,input){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),vm=readModel(html),modelSlide=vm.slides.find(s=>s.id===input.slideId);
 if(!modelSlide)fail('页面不存在');
 const artifactId=input.artifactId||vm.state?.layoutOverrides?.[input.slideId];if(artifactId){const a=readArtifact(root,artifactId,input.slideId);return {...a,vm,mediaRoot:root};}
 // Recognized native HW pages have their own complete structured source. They
 // do not need to be regenerated through the mindmap just to enable switching.
 if(hwDefinition(modelSlide.layout)){
  const document=importHwLayoutContent(modelSlide,input,root),range=findSection(html,input.slideId);if(!range)fail('找不到 HW 页面结构');
  return {...cacheArtifact(root,{slideId:input.slideId,html:range.html,modelSlide,document,mapping:{slideId:input.slideId,layout:modelSlide.layout,nativeHw:true}}),vm,mediaRoot:root};
 }
 const dir=path.dirname(root),docFile=path.join(dir,'confirmed-content.json'),mapFile=path.join(dir,'content-mapping.json');
 if(!fs.existsSync(docFile)||!fs.existsSync(mapFile))fail('此旧页面缺少自动换版映射。可继续在当前演示页编辑、插入或删除组件；原页面保留。');
 const document=normalizeDocument(JSON.parse(fs.readFileSync(docFile,'utf8'))),slide=document.slides.find(s=>s.slideId===input.slideId);
 if(!slide)fail('固定封底不可换版');if(['cover','section','chapter','transition'].includes(effectiveRole(slide)))fail('封面与章节页使用已验收的固定模板，不在正文换版菜单中修改。');
 const mapping=JSON.parse(fs.readFileSync(mapFile,'utf8')).slides.find(s=>s.slideId===slide.slideId);
 if(mapping?.layout!==modelSlide.layout){
  // Older preview boot code dropped layoutOverrides on reload. Recover only a
  // validated artifact with this exact saved model and one unique neutral draft.
  const dir=path.join(root,'.layout-cache'),matches=[];for(const name of fs.existsSync(dir)?fs.readdirSync(dir):[]){if(!/^layout-[a-f0-9]{32}\.json$/.test(name))continue;try{const a=readArtifact(root,name.slice(0,-5),input.slideId);if(a.mapping?.layout===modelSlide.layout&&a.document?.slides?.[0]?.slideId===input.slideId&&digest(a.modelSlide?.props)===digest(modelSlide.props))matches.push(a);}catch{}}
  const unique=new Set(matches.map(a=>digest({document:a.document,mapping:a.mapping})));if(matches.length&&unique.size===1)return {...matches[0],vm};
  fail('当前页面已换版但内容快照索引缺失，未找到唯一匹配的已验证快照。为避免退回旧稿已停止，请保留当前页并重新确认内容。');
 }
 const range=findSection(html,slide.slideId);if(!range)fail('找不到页面结构');
 return {...cacheArtifact(root,{slideId:slide.slideId,html:range.html,modelSlide,document:{...document,slides:[slide]},mapping}),vm};
}
// Fold only exact scalar bindings and unambiguous text edits back into neutral content.
// Refuse ambiguous edits rather than silently reusing stale confirmed copy.
export function reconcileLayoutContent(base,input){
 if(base.mapping.nativeHw||hwDefinition(base.modelSlide.layout))return importHwLayoutContent(base.modelSlide,input,base.mediaRoot);
 const doc=structuredClone(base.document),slide=doc.slides[0],props={...base.modelSlide.props,...(input.props||{})},bindings=[];
 const add=(field,path,blockId)=>{if(path)bindings.push({field,path,blockId});};
 for(const b of base.mapping.blocks||[])for(const [field,p]of Object.entries(b.fields||{}))add(field,p,b.blockId);
 for(const b of base.mapping.visualPlan?.bindings||[])add(b.source,b.target,b.blockId);
 for(const p of base.mapping.titlePaths||[])add('title',p);
 if(base.modelSlide.props.lead===slide.conclusion)add('conclusion','props.lead');
 if(base.modelSlide.props.closing===slide.evidence)add('evidence','props.closing');
 const seen=new Set();for(const b of bindings){const key=[b.blockId,b.field,b.path].join(':');if(seen.has(key))continue;seen.add(key);const target=b.blockId?slide.blocks.find(v=>v.blockId===b.blockId):slide;if(!target)continue;
  const before=get(base.modelSlide.props,b.path),after=get(props,b.path);if(before===after||after===undefined)continue;
  if(/^metric(Value|Unit|Delta|Detail|Baseline)$/.test(b.field)&&target.data?.kind==='metric'){const key=b.field.slice(6);target.data[key[0].toLowerCase()+key.slice(1)]=after;}
  else if(b.field==='data'&&after&&target.data?.kind==='table'&&!Array.isArray(after)){target.data={kind:'table',...structuredClone(after)};}
  else if(b.field==='data'&&Array.isArray(after)&&target.data){if(after.every(r=>typeof r.label==='string'&&typeof r.value==='number')){target.data.labels=after.map(r=>r.label);target.data.values=after.map(r=>r.value);}else fail('此图表数据尚不能安全迁移，请在当前页的图表数据中检查标签与数值；原页保留。');}
  else if(typeof before==='string'&&typeof after==='string'&&target[b.field]===before)target[b.field]=after;
  else fail('当前页存在尚未建立换版映射的复杂字段。可继续在当前页直接编辑；本次自动换版未应用，原内容保留。');
 }
 for(const edit of input.edits||[]){if(edit.before===edit.after)continue;const targets=[];for(const target of [slide,...slide.blocks])for(const field of target===slide?['title','conclusion','evidence']:['label','text','evidence'])if(target[field]===edit.before)targets.push([target,field]);
  for(const block of slide.blocks)if(block.data?.kind==='metric')for(const key of ['unit','delta','detail'])if(block.data[key]===edit.before)targets.push([block.data,key]);
  if(targets.length===1)targets[0][0][targets[0][1]]=edit.after;
  else if(![slide,...slide.blocks].some(t=>Object.values(t).some(v=>v===edit.after))){
   // Quote layouts concatenate title/conclusion in one editable node. Only rebase an
   // edit if one unchanged boundary proves exactly which neutral field changed.
   const merged=[];if(slide.title&&slide.conclusion&&edit.before===slide.title+slide.conclusion){if(edit.after.startsWith(slide.title))merged.push(['conclusion',edit.after.slice(slide.title.length)]);if(edit.after.endsWith(slide.conclusion))merged.push(['title',edit.after.slice(0,-slide.conclusion.length)]);}
   if(merged.length===1)slide[merged[0][0]]=merged[0][1];else fail('有一处文字尚不能唯一映射到新版式。当前编辑已保留，可继续直接编辑或使用“插入”添加内容；未返回或修改策划稿。','LAYOUT_EDIT_AMBIGUOUS');
  }
 }
 const chartBlock=slide.blocks.find(b=>b.data!=null);if(chartBlock&&typeof props.unit==='string'&&typeof base.modelSlide.props.unit==='string')chartBlock.data.unit=props.unit;
 if(chartBlock&&typeof props.chart?.unit==='string')chartBlock.data.unit=props.chart.unit;
 if(base.modelSlide.layout.startsWith('theme17_content_icon_')||hwDefinition(base.modelSlide.layout)?.family==='icon')slide.visuals={...slide.visuals,icons:normalizeIconConfig(props.iconConfig)};
 const mediaSlots=inspectLayout(base.modelSlide.layout,{compact:true}).mediaSlots||[];
 for(const slot of mediaSlots){const value=props[slot.field];if(Array.isArray(value)){
  const refs=[...(slide.media||[]).map((item,index)=>({item,index})),...slide.blocks.flatMap(block=>(block.media||[]).map((item,index)=>({item,index,block})))];
  if(refs.some(r=>r.block)){const pageMedia=[],byBlock=new Map(slide.blocks.map(b=>[b.blockId,[]]));value.forEach((item,index)=>{const src=typeof item==='string'?item:item?.src;if(!src)return;const ref=refs[index],media={src,...(ref?.item?.caption?{caption:ref.item.caption}:{})};if(ref?.block)byBlock.get(ref.block.blockId).push(media);else pageMedia.push(media);});if(pageMedia.length)slide.media=pageMedia;else delete slide.media;for(const b of slide.blocks){const media=byBlock.get(b.blockId);if(media.length)b.media=media;else delete b.media;}}
  else{const media=value.map(item=>typeof item==='string'?item:item?.src).filter(Boolean).map(src=>({src}));if(media.length)slide.media=media;else delete slide.media;}
 }}
 return normalizeDocument(applyConsoleContent(doc,props));
}
export function available(base,input){const document=reconcileLayoutContent(base,input),usage=layoutUsageFromSlides(base.vm?.slides,{excludeId:input.slideId});let catalog;try{catalog=contentCandidates(document.slides[0],document,{hwVariants:input.layout&&input.targetVariant?{[input.layout]:String(input.targetVariant)}:{}});}catch(error){catalog={candidates:[],unavailableReason:error.message};}
 const neighbors=neighborLayouts(base.vm?.slides||[],input.slideId);
 // ICON choices are reversible visual state, not a constraint forcing all
 // future layouts to have ICON slots. Neutral snapshots retain those choices.
 return {document,unavailableReason:catalog.unavailableReason,candidates:catalog.candidates.filter(c=>!neighbors.has(c.layout)&&layoutAvailableForPage(c.layout,usage))};}
function adaptationTarget(base,input,document){
 const neighbors=neighborLayouts(base.vm?.slides||[],input.slideId),usage=layoutUsageFromSlides(base.vm?.slides,{excludeId:input.slideId}),target=input.targetVariant&&input.layout===base.modelSlide.layout?hwVariantTarget(document.slides[0],document,input.layout,input.targetVariant):adaptationTargets(document.slides[0],document).find(t=>t.id===input.layout&&!neighbors.has(t.id)&&layoutAvailableForPage(t.id,usage));
 if(!target){const notice=contentRoleNotice(input.layout);if(notice)throw new WorkbenchError(notice,422,'LAYOUT_FIELD_ROLE_MISMATCH');fail('目标版式不是当前内容、数据、媒体与 ICON 的可用适配候选。请重新读取版式；原页未改动。','LAYOUT_TARGET_UNAVAILABLE');}
 if(target.requiresRoleChange&&input.allowRoleChange!==true)fail('目标为表格版式，请明确同意转换为表格结构。未调用模型，原页保持不变。','LAYOUT_ROLE_APPROVAL_REQUIRED');
 assertRelationApproval(document,target,{allowRelationChange:input.allowRelationChange===true});
 return target;
}
function run(root,args,signal){return new Promise((resolve,reject)=>{signal.throwIfAborted();const p=spawn(process.execPath,args,{cwd:root,windowsHide:true,env:{...process.env,DASHI_PPT_AUTO_OPEN:'0'},stdio:['ignore','pipe','pipe']}),abort=()=>stopOwnedProcess(p);signal.addEventListener('abort',abort,{once:true});let text='';for(const s of[p.stdout,p.stderr])s.on('data',v=>text=(text+v).slice(-12000));p.on('error',reject);p.on('close',code=>{signal.removeEventListener('abort',abort);if(signal.aborted)reject(signal.reason);else if(code)reject(new Error(text.slice(-2500)));else resolve();});});}
function publicJob(j,root,full=false){const {input,...safe}=j;let baselineInput,baseline=input.clientBaseline;if(full){let sourceLayout=input.sourceLayout;try{sourceLayout||=readArtifact(root,input.baseArtifactId,j.slideId).modelSlide.layout;}catch{}baselineInput={slideId:j.slideId,sourceLayout,props:input.props||{},edits:input.edits||[]};if(sourceLayout)baseline='sha256:'+createHash('sha256').update(JSON.stringify(canonicalLayoutInput(baselineInput))).digest('hex');}return {...safe,...(full?{clientBaseline:input.clientBaseline,canonicalBaseline:j.approvalBaseline||baseline,baselineInput,baseArtifactId:input.baseArtifactId,targetVariant:input.targetVariant,deletedBlockId:input.blockId}:{}),result:full&&j.resultId&&['ready','proposed','conflict'].includes(j.status)?readArtifact(root,j.resultId,j.slideId):undefined};}
function ownerProject(serveRoot){return layoutAgentOwner(serveRoot);}
function checkNeighborLayout(base,input){if(input.layout!==base.modelSlide.layout&&neighborLayouts(base.vm?.slides||[],input.slideId).has(input.layout))fail('目标版式与相邻正文页相同。请选择其他版式；原页和相邻页均未改动。','ADJACENT_LAYOUT_REPEAT');}
function manualSource(base,input){const def=hwDefinition(base.modelSlide.layout);if(!def)fail('手动档位编辑适用于当前 HW 正文版式。');const p=structuredClone({...base.modelSlide.props,...input.props}),doc=importHwLayoutContent(base.modelSlide,{props:p,edits:input.edits||[]},base.mediaRoot);Object.assign(p,{title:doc.slides[0].title,lead:doc.slides[0].conclusion,closing:doc.slides[0].evidence});p.cards=p.cards.map(c=>doc.slides[0].blocks.find(b=>b.blockId===c.blockId)?.origin?.hw?.card||c);return {def,props:p,document:doc};}
function keepHistoryContent(root,base,input,target){const layout=target.modelSlide.layout;if(layout!==base.modelSlide.layout&&neighborLayouts(base.vm?.slides||[],input.slideId).has(layout))return null;let document,props;if(hwDefinition(layout)&&layout===base.modelSlide.layout){const source=manualSource(base,input);if(String(source.props.variant)===String(target.modelSlide.props.variant)){props=structuredClone(source.props);for(const k of Object.keys(props))if(k.startsWith('editor'))delete props[k];return {document:source.document,candidate:{layout,props,nativeHw:true,titlePaths:['props.title'],blocks:[]}};}}
 const current=reconcileLayoutContent(base,input),original=hwDefinition(layout)?importHwLayoutContent(target.modelSlide,{},root):target.document;if(samePageContent(current,original)){props=structuredClone(target.modelSlide.props);for(const k of Object.keys(props))if(k.startsWith('editor'))delete props[k];return {document:original,candidate:{layout,props,nativeHw:!!hwDefinition(layout),titlePaths:target.mapping.titlePaths,blocks:target.mapping.blocks,plan:target.mapping.visualPlan}};}
 const found=available(base,{...input,layout,targetVariant:target.modelSlide.props.variant}),candidate=found.candidates.find(c=>c.layout===layout&&(!hwDefinition(layout)||String(c.props.variant)===String(target.modelSlide.props.variant)));return candidate?{document:found.document,candidate}:null;
}
function historyInfo(root,base,input){const history=pageVersions(root,base);return {original:history.original,notice:history.notice,versions:history.entries.map(e=>{const s=e.artifact.modelSlide;let canKeepCurrent=false;try{canKeepCurrent=!!keepHistoryContent(root,base,input,e.artifact);}catch{}return {id:e.id,at:e.at,layout:s.layout,variant:s.props.variant??null,title:s.props.title||e.artifact.document?.slides[0]?.title||'',label:inspectLayout(s.layout,{compact:true}).label||s.layout,original:e.id===history.original,canKeepCurrent};})};}
function restorePlan(root,base,input){if(input.restoreAcknowledged!==true)fail('请先确认恢复方式；未修改当前页。');const target=requirePageVersion(root,base,input.restoreArtifactId),layout=target.modelSlide.layout;if(layout!==input.layout)fail('恢复目标与历史快照不一致。');if(/^theme17_page/.test(layout)&&layoutUsageCount(layout,layoutUsageFromSlides(base.vm.slides,{excludeId:input.slideId}))>=FIXED_LAYOUT_MAX_USES)fail('该固定版式已被其他页使用两次，不能再次恢复；其他页不会被修改。');const before=reconcileLayoutContent(base,input);let document,candidate;
 if(input.restoreMode==='keep-content'){const found=keepHistoryContent(root,base,input,target);if(!found)fail('当前内容不满足该历史版式的原稿容量，不能无损恢复。可明确选择恢复当时的页面快照，或取消后手动整理内容。');({document,candidate}=found);}
 else if(input.restoreMode==='snapshot'){const props=structuredClone(target.modelSlide.props);for(const k of Object.keys(props))if(k.startsWith('editor'))delete props[k];document=hwDefinition(layout)?importHwLayoutContent({...target.modelSlide,props},{},root):structuredClone(target.document);candidate={layout,props,nativeHw:!!hwDefinition(layout),titlePaths:target.mapping.titlePaths,blocks:target.mapping.blocks,plan:target.mapping.visualPlan};}
 else fail('请选择保留当前内容换版，或恢复当时页面快照。');
 return {document,candidate,review:{type:'restore',summary:input.restoreMode==='snapshot'?'恢复历史版式及当时内容快照':'恢复历史版式，保留当前完整内容',changes:[input.restoreMode==='snapshot'?'版式和内容一起回到所选快照，不宣称保留当前内容。':'当前文字、数据及来源保留，仅换回所选版式。','当前页已保留，可撤销/重做；原始快照继续保留。'],originMap:[],numericOccurrences:[],before:before.slides[0],after:document.slides[0],target:{id:layout,label:inspectLayout(layout,{compact:true}).label+' · '+(target.modelSlide.props.variant||'历史版式')},notice:input.restoreMode==='snapshot'?'确认后将替换当前页的版式及内容。请对照完整前后稿核对；当前编辑保留在撤销与本机快照中。不会修改其他页，不调用模型。':'保留当前内容，仅恢复所选历史版式；已检查容量，仍需确认视觉效果。不会修改其他页，不调用模型。',restoreArchive:{artifactId:target.id,mode:input.restoreMode,sourceDocument:target.document}}};
}
function deletionPlans(base,input,root){const hw=hwDefinition(base.modelSlide.layout),source=hw?manualSource(base,input):{document:reconcileLayoutContent(base,input),props:null};return deleteBlockPlans({document:source.document,modelSlide:base.modelSlide,sourceProps:source.props,mediaRoot:root,usedLayouts:base.vm.slides.filter(s=>s.id!==input.slideId).map(s=>s.layout)},input.blockId);}
function deletionPlan(base,input,root){if(input.deleteAcknowledged!==true)fail('请明确确认删除整个内容块。');const found=deletionPlans(base,input,root),plan=found.plans.find(p=>p.key===input.deleteTarget);if(!plan||plan.layout!==input.layout)fail(found.reason||'删除后没有可用的原稿档位，原页保持不变。');return {...plan,review:{type:'delete-block',summary:'删除整个内容块，并重新排版剩余内容',changes:['明确删除内容块：'+(found.deleted.label||found.deleted.blockId),'剩余内容按已登记的版式重新排布，不保留空框，不重新绘制原稿。','确认前原页不变；删除内容保留在本机快照，可撤销。'],originMap:[],numericOccurrences:[],before:reconcileLayoutContent(base,input).slides[0],after:plan.document.slides[0],target:{id:plan.layout,label:inspectLayout(plan.layout,{compact:true}).label+(plan.variant?' · '+plan.variant:'')},notice:'这是整块删除，不是清空文字。所选块内文字、数据及其内容关系会从当前页移除；其余内容重新排版。请核对候选，确认后才应用；可撤销，不调用模型。',deletedArchive:found.deleted}};}
export function createLayoutRoutes({root,serveRoot,allowed,bridgeRunner=runBridge,modelRunner=callModel,renderedValidator=validateRenderedContent}){
 const runtime=layoutRuntime(root);
 const readinessOverrides={bridgeInjected:bridgeRunner!==runBridge,providerInjected:modelRunner!==callModel},executorStatus=()=>layoutAgentStatus(serveRoot,readinessOverrides);
 const queue=new LayoutQueue(serveRoot,execute);queues.add(queue);
 const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json;charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
 async function body(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>4*1024*1024)fail('版式编辑请求超过 4 MB');parts.push(part);}return JSON.parse(Buffer.concat(parts).toString()||'{}');}
 async function execute(j,{signal,progress,diagnostic,log}){
  const runId=j.runId;let tempDir;
  try{
   progress(8,'正在核对当前内容、数据与可用版式','content-check');const base=context(serveRoot,j.input);checkNeighborLayout(base,j.input);if(reserved(j.slideId,j.input.layout,base.vm?.slides))fail('此目标已被相邻页或其他固定版式任务预留，请重新选择。','LAYOUT_RESERVED');let document,candidate,review;
   if(j.kind==='restore'){({document,candidate,review}=restorePlan(serveRoot,base,j.input));}
   else if(j.kind==='delete-block'){({document,candidate,review}=deletionPlan(base,j.input,serveRoot));}
   else if(j.kind==='manual'){
    const source=manualSource(base,j.input);if(j.input.layout!==base.modelSlide.layout||String(j.input.manualDraft?.variant)!==String(j.input.targetVariant))fail('手动目标档位与当前版式不一致。');const props=prepareManualHwProps(source.def,source.props,j.input.manualDraft,{acknowledged:j.input.manualAcknowledged===true}),changes=manualHwChanges(source.props,props);document=importHwLayoutContent({...base.modelSlide,props},{},serveRoot);candidate={layout:j.input.layout,props,nativeHw:true,titlePaths:['props.title'],blocks:[]};review={type:'manual',summary:'手动整理到原稿档位 '+props.variant,changes:['此候选由用户手动编辑，未调用 AI。','修改或新填 '+changes.changedBlocks+' 个内容块；'+changes.omitted.length+' 个原块未沿用原标识，内容可能已合并或未纳入。',...(changes.omittedRows.length?['有 '+changes.omittedRows.length+' 行原表格发生修改或未纳入，请核对。']:[])],originMap:props.cards.map(c=>({blockId:c.blockId,sourceBlockIds:source.props.cards.some(s=>s.blockId===c.blockId)?[c.blockId]:[]})),numericOccurrences:[],before:source.document.slides[0],after:document.slides[0],target:{id:j.input.layout,label:inspectLayout(j.input.layout,{compact:true}).label+' · 手动档位 '+props.variant},manualArchive:{sourceProps:source.props,...changes},notice:'这是手动编辑，不受 AI 无损改写规则限制。请逐项核对文字、数字、来源和未纳入的原内容。确认后才替换当前页；原页和完整原内容保存在本机快照中，支持撤销，不改脑图原稿。'};
   }else{const found=available(base,j.input);document=found.document;candidate=found.candidates.find(c=>c.layout===j.input.layout);}
   let rendered;
   async function renderCurrent(){
   if(!candidate)fail('所选版式不再适合当前内容，原页面保持不变。');
   if(j.input.targetVariant&&j.input.props?.emphasisMode==='none')Object.assign(candidate.props,{emphasisMode:'none',emphasisIndex:-1});
   // This is a one-page artifact: validate its own claim, not the whole deck's keywords.
   const pageTitle=document.slides[0].title;
   const goal={title:pageTitle,goal:pageTitle,themePack:'theme17',contentPlan:{mediaPlaceholders:document.brief?.imagePolicy==='placeholders'},slides:[{id:j.slideId,key:j.slideId,layout:candidate.layout,props:candidate.props}]},mapping={slides:[{slideId:j.slideId,layout:candidate.layout,titlePaths:candidate.titlePaths,blocks:candidate.blocks,visualPlan:candidate.plan,...(candidate.nativeHw?{nativeHw:true}:{})}]};
   const dir=path.join(serveRoot,'.layout-jobs',j.id,runId,'attempt-'+(j.aiAttempt||1)),ppt=path.join(dir,'ppt'),goalFile=path.join(dir,'goal.json');tempDir=path.join(serveRoot,'.layout-jobs',j.id,runId);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(goalFile,JSON.stringify(goal));
   progress(j.kind==='adapt'?45:25,'正在重新生成当前页，其余页面保持不变','rendering');const tsx=pathToFileURL(require.resolve('tsx/esm')).href;await run(root,['--import',tsx,'scripts/render-goal-deck.jsx',goalFile,path.join(ppt,'index.html')],signal);
   for(const m of document.slides[0].media||[]){if(!/^(assets|images)\//.test(m.src)||m.src.split(/[\\/]/).includes('..'))fail('图片路径不安全');const from=path.resolve(serveRoot,m.src),to=path.resolve(ppt,m.src);if(!from.startsWith(path.resolve(serveRoot)+path.sep)||!to.startsWith(ppt+path.sep))fail('图片路径越界');fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
   progress(55,'正在校验页面结构与完整文字','structure-check');await run(root,['scripts/validate-swiss-deck.mjs',path.join(ppt,'index.html')],signal);await run(root,['scripts/validate-goal-copy.mjs',goalFile,path.join(ppt,'index.html')],signal);
   progress(75,'正在浏览器检查溢出、来源、数据及关系','browser-check');let captured,previewStyles;await renderedValidator(ppt,document,goal,{signal,mapping,onCapture:(html,_i,styles)=>{captured=html;previewStyles=styles;}});

    return {ppt,goal,mapping,captured,previewStyles};
   }
   if(j.kind==='adapt'){
    const target=adaptationTarget(base,j.input,document);
    const owner=requireLayoutAgent(serveRoot,j.input.mode,readinessOverrides),runner=j.input.mode==='provider'?modelRunner:bridgeRunner;
    const planned=await adaptWithRenderedValidation({document,target,signal,options:{allowRegroup:j.input.allowRegroup!==false,allowRoleChange:j.input.allowRoleChange===true,allowRelationChange:j.input.allowRelationChange===true,prompt:j.input.prompt||''},
     onAttempt:attempt=>{j.aiAttempt=attempt+1;progress(12+attempt*8,attempt?'正在依据内容/页面校验反馈修订候选（第 2 次）':'正在调用原项目的 Agent 精炼内容、分组并适配目标版式','agent-wait');},
     request:messages=>{const opts={signal,timeoutMs:j.timeoutMs,reasoningEffort:j.input.reasoningEffort||'inherit',onDiagnostic:diagnostic,onProgress:p=>progress(Math.min(38,12+Number(p.percent||0)*.25),p.detail||'等待原执行器的最终候选',p.stage||'agent-wait')};return j.input.mode==='provider'?runner(owner,messages,opts):runner(owner,{id:j.id,scope:{kind:'layout-adaptation',slideId:j.slideId}},messages,opts);},
     render:async planned=>{document=planned.document;candidate=planned.candidate;review=planned.review;progress(40,'候选数字、来源与去向已核对，正在检查真实页面','candidate-check');return renderCurrent();},
     onRejected:(error,attempt)=>log(error.code==='RENDERED_CONTENT_FAILED'?'RENDERED_CANDIDATE_REJECTED':'CANDIDATE_REJECTED','第 '+(attempt+1)+' 轮候选未通过'+(error.code==='RENDERED_CONTENT_FAILED'?'浏览器页面':'内容')+'校验，原页保留',{attempt:attempt+1,code:error.code,repairRemaining:1-attempt},'warning')
    });rendered=planned.rendered;
   }
   if(!rendered)rendered=await renderCurrent();
   const {ppt,goal,mapping,captured,previewStyles}=rendered;
   signal.throwIfAborted();const html=fs.readFileSync(path.join(ppt,'index.html'),'utf8'),vm=readModel(html),artifact=cacheArtifact(serveRoot,{slideId:j.slideId,html:findSection(html,j.slideId).html,modelSlide:vm.slides[0],document,mapping:mapping.slides[0],liveHtml:captured,previewStyles,...(review?{review}: {})});
   return {resultId:artifact.id,status:review?'proposed':'ready',detail:review?'候选实测通过，等待审阅；不占执行名额':'页面实测通过，等待浏览器安全应用'};
  }finally{if(tempDir){const base=path.resolve(serveRoot,'.layout-jobs'),target=path.resolve(tempDir);if(target.startsWith(base+path.sep)&&target!==base)try{fs.rmSync(target,{recursive:true,force:true});}catch{}}}
 }
 const reserved=(slideId,layout,slides=[])=>{const neighbors=neighborPageIds(slides,slideId);return queue.list().some(j=>j.slideId!==slideId&&j.input.layout===layout&&['queued','running','paused','proposed','ready'].includes(j.status)&&(/^theme17_page/.test(layout)||neighbors.has(j.slideId)));};
 const control=(id,action,approval={})=>{if(action==='resume'&&['failed','cancelled','conflict'].includes(queue.get(id).status))fail('历史任务不能直接继续。请刷新控制台并点击重新尝试，重新读取当前页面和确认 AI 适配。');return queue.control(id,action,approval);};const brief=j=>({...publicJob(j,serveRoot),canDelete:queue.canDelete(j.id),queuePosition:j.status==='queued'?queue.list().filter(t=>t.status==='queued').findIndex(t=>t.id===j.id)+1:null});
 const handler=async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/layout-'))return false;
  if(!allowed(req)){json(res,403,{error:'仅允许从本演示控制台发起版式操作'});return true;}
  try{
   if(req.method==='GET'&&url.pathname==='/api/layout-runtime'){json(res,200,runtime);
   }else if(req.method==='GET'&&url.pathname==='/api/layout-agent-status'){json(res,200,executorStatus());
   }else if(req.method==='POST'&&url.pathname==='/api/layout-agent-config'){
    if(queue.list().some(j=>['queued','running','paused','proposed','ready'].includes(j.status)))fail('请先处理当前预览未完成的任务，再修改 Agent 连接。');json(res,200,configureLayoutAgent(serveRoot,await body(req)));
   }else if(req.method==='GET'&&url.pathname==='/api/layout-tasks'){
    json(res,200,{revision:queue.revision,settings:queue.settings,activeSlots:queue.active.size,jobs:queue.list().map(brief)});
   }else if(req.method==='POST'&&url.pathname==='/api/layout-delete'){json(res,200,queue.remove((await body(req)).ids));
   }else if(req.method==='POST'&&url.pathname==='/api/layout-config'){json(res,200,{settings:queue.configure(await body(req))});
   }else if(req.method==='POST'&&url.pathname==='/api/layout-task-config'){const {id,timeoutMs}=await body(req);json(res,200,brief(queue.configureTask(id,timeoutMs)));
   }else if(req.method==='POST'&&url.pathname==='/api/layout-order'){queue.reorder((await body(req)).ids);json(res,200,{ok:true});
   }else if(req.method==='POST'&&url.pathname==='/api/layout-batch-control'){
    const {ids,action}=await body(req);if(!Array.isArray(ids)||ids.length>100||!['pause','resume','cancel'].includes(action))fail('批量操作参数无效');const results=ids.map(id=>{try{return {ok:true,job:brief(control(id,action))};}catch(e){return {ok:false,id,error:e.message};}});json(res,200,{results});
   }else if(req.method==='GET'&&url.pathname==='/api/layout-logs'){
    const ids=url.searchParams.getAll('id'),selected=ids.length?ids.map(id=>queue.get(id)):queue.list(),report={version:1,exportedAt:new Date().toISOString(),settings:queue.settings,tasks:selected.map(brief),records:Object.fromEntries(selected.map(j=>[j.id,queue.logs(j.id)])),privacy:'日志不含提示词、模型正文或凭据；候选内容仅保存在本机审阅快照。'};
    if(url.searchParams.get('download')==='1'){res.writeHead(200,{'content-type':'application/json;charset=utf-8','content-disposition':'attachment; filename="layout-task-logs.json"','cache-control':'no-store'});res.end(JSON.stringify(report,null,2));}else json(res,200,report);
   }else if(req.method==='POST'&&url.pathname==='/api/layout-client-event'){
    const {id,event,message}=await body(req);json(res,200,brief(queue.clientEvent(id,event,message||event)));
   }else if(req.method==='POST'&&url.pathname==='/api/layout-utilization'){
    const input=await body(req),base=context(serveRoot,input),document=reconcileLayoutContent(base,input),catalog=contentCandidates(document.slides[0],document);json(res,200,layoutUtilization([{id:input.slideId,catalog,candidates:catalog.candidates}],{selected:new Map([[input.slideId,{layout:base.modelSlide.layout}]])}));
   }else if(req.method==='POST'&&url.pathname==='/api/layout-history'){
    const input=await body(req),base=context(serveRoot,input);json(res,200,{baseId:base.id,...historyInfo(serveRoot,base,input)});
   }else if(req.method==='POST'&&url.pathname==='/api/layout-delete-block-options'){
    const input=await body(req),base=context(serveRoot,input),found=deletionPlans(base,input,serveRoot);json(res,200,{baseId:base.id,deleted:found.deleted,recommended:found.recommended,reason:found.reason,options:found.plans.map(p=>({key:p.key,layout:p.layout,variant:p.variant,label:inspectLayout(p.layout,{compact:true}).label||p.layout,sameLayout:p.layout===base.modelSlide.layout}))});
   }else if(req.method==='POST'&&url.pathname==='/api/layout-manual-options'){
    const input=await body(req),base=context(serveRoot,input),source=manualSource(base,input),info=manualHwInfo(source.def,input.variant);json(res,200,{baseId:base.id,layout:base.modelSlide.layout,label:inspectLayout(base.modelSlide.layout,{compact:true}).label,variant:String(input.variant),source:source.props,info});
   }else if(req.method==='POST'&&url.pathname==='/api/layout-variant-options'){
    const input=await body(req),base=context(serveRoot,input),document=reconcileLayoutContent(base,input),target=hwVariantTarget(document.slides[0],document,base.modelSlide.layout,input.variant);
    json(res,200,{baseId:base.id,current:base.modelSlide.layout,target,content:document.slides[0],executor:executorStatus()});
   }else if(req.method==='POST'&&url.pathname==='/api/layout-options'){
    const input=await body(req),base=context(serveRoot,input),found=available(base,input),document=found.document,candidates=found.candidates.filter(c=>!reserved(input.slideId,c.layout,base.vm?.slides)),neighbors=neighborLayouts(base.vm?.slides||[],input.slideId),used=new Set(base.vm?.slides.filter(s=>s.id!==input.slideId).map(s=>s.layout)),adaptations=adaptationTargets(document.slides[0],document).filter(t=>!neighbors.has(t.id)&&layoutAvailableForPage(t.id,used)&&!reserved(input.slideId,t.id,base.vm?.slides)&&!candidates.some(c=>c.layout===t.id)),executor=executorStatus();
    json(res,200,{excludedTargets:{theme17_page009:contentRoleNotice('theme17_page009')},baseId:base.id,current:base.modelSlide.layout,currentGroup:layoutGroup(base.modelSlide.layout),currentLabel:inspectLayout(base.modelSlide.layout,{compact:true}).label||base.modelSlide.layout,currentLabelEn:layoutDisplayName(base.modelSlide.layout,'en'),unavailableReason:found.unavailableReason,...imageLayoutInfo(base.modelSlide.layout,{...base.modelSlide.props,...input.props}),options:candidates.map(c=>({id:c.layout,group:layoutGroup(c.layout),label:inspectLayout(c.layout,{compact:true}).label||c.layout,labelEn:layoutDisplayName(c.layout,'en'),reason:c.plan.reason,...imageLayoutInfo(c.layout,c.props)})),adaptations:adaptations.map(a=>({...a,labelEn:layoutDisplayName(a.id,'en',a.label),group:layoutGroup(a.id),...imageLayoutInfo(a.id)})),settings:queue.settings,activeTask:queue.list().filter(j=>j.slideId===input.slideId&&['queued','running','paused','proposed','ready'].includes(j.status)).map(brief).at(-1),executor,content:document.slides[0],mapping:base.mapping});
   }else if(req.method==='POST'&&['/api/layout-render','/api/layout-adapt','/api/layout-manual','/api/layout-restore','/api/layout-delete-block'].includes(url.pathname)){
    const input=await body(req),kind=url.pathname.endsWith('delete-block')?'delete-block':url.pathname.endsWith('restore')?'restore':url.pathname.endsWith('manual')?'manual':url.pathname.endsWith('adapt')?'adapt':'direct';if(kind==='adapt'){requireLayoutProtocol(input);requireLayoutAgent(serveRoot,input.mode,readinessOverrides);}const base=context(serveRoot,input);checkNeighborLayout(base,input);if(kind==='adapt')adaptationTarget(base,input,reconcileLayoutContent(base,input));pageVersions(serveRoot,base);if(kind==='restore')restorePlan(serveRoot,base,input);if(kind==='delete-block')deletionPlan(base,input,serveRoot);if(kind==='manual'){const source=manualSource(base,input);if(input.layout!==base.modelSlide.layout||String(input.manualDraft?.variant)!==String(input.targetVariant))fail('手动目标档位不一致。');prepareManualHwProps(source.def,source.props,input.manualDraft,{acknowledged:input.manualAcknowledged===true});}if(reserved(input.slideId,input.layout,base.vm?.slides))fail('目标版式已被相邻页或其他固定版式任务预留，请选择其他版式。','LAYOUT_RESERVED');
    const timeoutMs=Number(input.timeoutMs||queue.settings.timeoutMs||(kind==='adapt'?(input.mode==='provider'?providerConfig(ownerProject(serveRoot)).timeoutMs:bridgeConfig(ownerProject(serveRoot)).timeoutMs):180000));if(!Number.isFinite(timeoutMs)||timeoutMs<1000||timeoutMs>600000)fail('等待上限需为 1–600 秒');
    const pageNumber=base.vm.slides.findIndex(s=>s.id===input.slideId)+1,j=queue.enqueue(input,{kind,title:base.document.slides[0].title,pageNumber,layout:input.layout,layoutLabel:inspectLayout(input.layout,{compact:true}).label,timeoutMs});json(res,202,brief(j));
   }else if(req.method==='GET'&&url.pathname==='/api/layout-progress'){
    const j=queue.get(url.searchParams.get('id'));json(res,200,publicJob(j,serveRoot,true));
   }else if(req.method==='POST'&&url.pathname==='/api/layout-control'){
    const {id,action,baseline,replaceCurrent}=await body(req);json(res,200,publicJob(control(id,action,{baseline,replaceCurrent}),serveRoot,true));
   }else json(res,405,{error:'不支持的版式操作'});
  }catch(error){json(res,error.status||422,{error:error.message,code:error.code||'LAYOUT_ERROR'});}return true;
 };
 handler.queue=queue;handler.close=()=>{queue.close();queues.delete(queue);};return handler;
}
