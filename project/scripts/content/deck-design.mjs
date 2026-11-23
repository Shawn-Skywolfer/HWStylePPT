import {compileContent} from './compile.mjs';
import {runBridge} from './bridge.mjs';
import {callModel} from './provider.mjs';
import {WorkbenchError} from './model.mjs';
import {adjacentLayoutIssues,layoutAvailableForPage} from './layout-policy.mjs';
import {interpretationProposals,DEFAULT_VISUAL_PREFERENCES} from './visual-strategy.mjs';

// The designer may choose a layout, never author or replace confirmed copy.
export function designMessages(document,compiled){
 const priority='按表达适合度、阅读路径、解释密度和整篇视觉家族节奏选版。相近质量时优先 HW 原稿；不设 HW 页数配额，不为套 HW 删改正文或启用暂停模板。candidates.visual 提供表达能力、构图家族、适用场景、禁用场景及选择理由；estimated 标识是规划估算，不是假称已看过渲染画面。';
 return [{role:'system',content:'你是咨询级演示文稿的视觉策划师。对整套确认稿统一匹配版式，考虑受众、场合、核心诉求、叙事节奏和论证关系。默认是商务咨询、大企业内部汇报/提案，不是极简Keynote；应让确认稿的观点、解释、证据、业务含义与边界清晰呈现，不为留白删内容。只能从每页 candidates 选择一个布局，theme17_content_ 和 theme17_chart_ 可非相邻复用，其余固定布局全篇最多使用两次。硬规则：物理相邻的两页正文必须使用不同的已登记layout ID；封面、章节、封底豁免并中断相邻关系。改颜色、字数、槽数或别名不算换版。优先合适的原主题专用布局，语义布局仅作容量/关系兜底。不得修改、精炼、删除任何确认内容，不得虚构数据或图片。只返回 JSON：{"summary":"整体设计理由","operations":[{"op":"chooseLayout","slideId":"...","layout":"...","reason":"..."}]}。每个正文页恰好一个操作。'},
 {role:'user',content:JSON.stringify({priority,visualPreferences:{...DEFAULT_VISUAL_PREFERENCES,...document.brief?.visualPreferences},preferenceRule:'硬性分档：图文并茂＝至少3个实际可见业务ICON > 其他ICON版式＝真实数据图表＝Highlight > 普通文字版式。同档不按功能数量累加分数；先保留第一档页面数，再保留第二档页面数，再比较内容适配、HW和节奏。用户手选版式优先。不得伪造素材/数据或自动付费生图。',brief:document.brief,relationshipProposals:interpretationProposals(document),proposalRule:'关系修订仅列为待确认，不得借选版静默应用；当前只选内容和关系均兼容的布局。',narrative:document.slides.map(s=>({slideId:s.slideId,title:s.title,role:s.role,conclusion:s.conclusion,visualIntent:s.visualIntent,blocks:s.blocks,relations:s.board?.edges,media:s.media||[]})),pages:compiled.design})}];
}
export function validateDesignChoices(result,compiled){
 if(!Array.isArray(result?.operations))throw new WorkbenchError('视觉策划缺少布局选择。',422,'LAYOUT_PLAN_INVALID');
 const choices={},reasons={},usage=new Map();
 for(const op of result.operations){
  const page=compiled.design.find(s=>s.slideId===op.slideId);
  if(op.op!=='chooseLayout'||!page||choices[op.slideId]||!page.candidates.some(c=>c.layout===op.layout)||(!layoutAvailableForPage(op.layout,usage)))throw new WorkbenchError('视觉策划选择不符合安全候选，已保留完整主题库规则匹配。',422,'LAYOUT_PLAN_INVALID');
  choices[op.slideId]=op.layout;reasons[op.slideId]=String(op.reason||'').slice(0,600);usage.set(op.layout,(usage.get(op.layout)||0)+1);
 }
 if(Object.keys(choices).length!==compiled.design.length)throw new WorkbenchError('视觉策划未覆盖全部正文页。',422,'LAYOUT_PLAN_INVALID');
 const counts=field=>compiled.design.reduce((n,p)=>{const tier=p.candidates.find(c=>c.layout===field(p))?.visual?.priorityTier;if(!p.requested&&tier<2)n[tier]++;return n;},[0,0]),before=counts(p=>p.selected),after=counts(p=>choices[p.slideId]);
 if(compiled.design.some(p=>p.requested&&choices[p.slideId]!==p.requested)||after[0]<before[0]||after[0]===before[0]&&after[1]<before[1])throw new WorkbenchError('视觉策划降低了已可实现的图文／多ICON优先级，或覆盖了手选版式；保留原安全方案。',422,'VISUAL_PRIORITY_DOWNGRADE');
 const rhythm=adjacentLayoutIssues(compiled.goal.slides.map(s=>({...s,layout:choices[s.id]||s.layout})));if(rhythm.length)throw new WorkbenchError(rhythm.map(i=>i.message).join('\n'),422,'LAYOUT_PLAN_INVALID');
 return {choices,reasons,summary:String(result.summary||'')};
}
export async function designDeck(dir,document,options,{planner='rules',signal,onProgress=()=>{},bridgeRunner=runBridge,modelRunner=callModel}={}){
 const initial=compileContent(document,options);
 if(planner==='rules'||!initial.design.length)return {compiled:initial,report:{mode:'full-catalog-rules',pages:initial.design}};
 onProgress({stage:'deck-design',percent:8,detail:'正在结合受众、场景与整套内容，统一选择主题版式；不改写确认稿'});
 try{
  const messages=designMessages(document,initial),progress=p=>onProgress({...p,stage:'deck-design',percent:Math.min(24,5+Number(p.percent||0)/5)});
  const result=planner==='bridge'?await bridgeRunner(dir,{id:'deck-design',scope:{kind:'deck-design'}},messages,{signal,onProgress:progress}):await modelRunner(dir,messages,{signal,onProgress:progress});
  signal?.throwIfAborted();const selected=validateDesignChoices(result,initial),compiled=compileContent(document,{...options,choices:selected.choices});
  return {compiled,report:{mode:planner,summary:selected.summary,reasons:selected.reasons,pages:compiled.design}};
 }catch(error){
  signal?.throwIfAborted();
  onProgress({stage:'deck-design',percent:24,detail:'AI 版式选择未通过或执行器不可用，已切换到完整主题库规则匹配（内容不变）'});
  return {compiled:initial,report:{mode:'full-catalog-rules',fallbackReason:error.code||'DESIGNER_UNAVAILABLE',pages:initial.design}};
 }
}
