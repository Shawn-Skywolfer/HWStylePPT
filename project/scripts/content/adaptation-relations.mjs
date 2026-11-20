import {WorkbenchError} from './model.mjs';
const key=id=>String(id||'').replace(/^block:/,'');
const endpoint=(slide,id)=>id==='meta:conclusion'?slide.conclusion:id==='meta:title'?slide.title:slide.blocks.find(b=>b.blockId===key(id))?.label||'';
export function sourceRelations(slide){return (slide.board?.edges||[]).map(e=>({from:key(e.from),to:key(e.to),kind:e.kind,label:e.label||'',fromLabel:endpoint(slide,e.from),toLabel:endpoint(slide,e.to)}));}
export function relationChangeRequired(slide,target){
 const mode=slide.board?.mode||'columns',next=target.boardMode||(['process','timeline','flow'].includes(target.family)?'flow':'columns');
 const relations=sourceRelations(slide),counts=target.counts||[];
 // A one-card probe has no edges: sharing the word "flow" does not prove that
 // five connected source steps can survive inside that one card.
 return !target.preserveRelations&&(['flow','comparison','hierarchy','free'].includes(mode)&&mode!==next||relations.length>0&&(next==='columns'||target.regionGroups?.length>1||counts.length>0&&!counts.includes(slide.blocks.length)));
}
export function assertRelationApproval(document,target,{allowRelationChange=false}={}){
 if((target.requiresRelationChange===true||relationChangeRequired(document.slides[0],target))&&!allowRelationChange){const e=new WorkbenchError('目标版式需要调整当前关系表达。请先明确确认“允许提出关系表达调整”，或选择兼容的流程／关系版式；尚未调用模型，原页不变。',422,'LAYOUT_RELATION_APPROVAL_REQUIRED');e.details={from:document.slides[0].board?.mode,to:target.boardMode||'columns',relations:sourceRelations(document.slides[0]),target:target.id};throw e;}
}
export function validateRelationMapping(original,slide,result,{allowRelationChange=false}={}){
 const sources=sourceRelations(original),edges=sourceRelations(slide),mapping=result.originMap||[],groups=id=>id.startsWith('meta:')?[id]:mapping.filter(m=>m.sourceBlockIds?.includes(id)).map(m=>m.blockId),unmapped=[];
 for(const e of sources){const from=groups(e.from),to=groups(e.to);if(!edges.some(n=>n.kind===e.kind&&n.label===e.label&&from.includes(n.from)&&to.includes(n.to)))unmapped.push(e);}
 const addedRelations=edges.filter(n=>!sources.some(e=>e.kind===n.kind&&e.label===n.label&&groups(e.from).includes(n.from)&&groups(e.to).includes(n.to)));
 const modeChanged=original.board?.mode!==slide.board?.mode&&['flow','comparison','hierarchy','free'].includes(original.board?.mode),newRelations=addedRelations.length>0;
 if((unmapped.length||modeChanged||newRelations)&&!allowRelationChange){
  const error=new WorkbenchError('候选改变了未授权的关系表达。请保留原先后／因果／层级关系，或先确认关系适配；不是字数容量问题。',422,'LAYOUT_RELATION_APPROVAL_REQUIRED');
  error.details={recovery:'review-relations',relationChange:{fromMode:original.board?.mode,toMode:slide.board?.mode,sourceBlockCount:original.blocks.length,targetBlockCount:slide.blocks.length,removed:unmapped.map(({from,to,kind})=>({from,to,kind})),added:addedRelations.map(({from,to,kind})=>({from,to,kind}))}};throw error;
 }
 if(result.relationMap!=null&&!Array.isArray(result.relationMap))throw new WorkbenchError('关系映射 relationMap 必须为数组。',422,'ADAPTATION_RELATION_UNRESOLVED');
 for(const e of unmapped){const matches=(result.relationMap||[]).filter(m=>key(m.from)===e.from&&key(m.to)===e.to&&m.kind===e.kind),m=matches[0],block=slide.blocks.find(b=>b.blockId===m?.blockId),text=String(m?.text||'');
  if(matches.length!==1||m.disposition!=='text'||!block||!text||!e.fromLabel||!e.toLabel||!block.text.includes(text)||!text.includes(e.fromLabel)||!text.includes(e.toLabel)||(e.label&&!text.includes(e.label))){
   const error=new WorkbenchError('关系尚未落实到目标页：'+e.fromLabel+' → '+e.toLabel+'。请在可见正文中完整表达这条关系，并提供 relationMap；不能只删连线。',422,'ADAPTATION_RELATION_UNRESOLVED');error.details={relations:unmapped,expected:{from:e.from,to:e.to,kind:e.kind,disposition:'text',blockId:'目标内容块ID',text:'包含两端原标签并明确表达关系的可见正文'}};throw error;
  }
 }
 return {changed:!!(unmapped.length||modeChanged||newRelations),fromMode:original.board?.mode,toMode:slide.board?.mode,sourceRelations:sources,addedRelations,relationMap:result.relationMap||[],requiresHumanReview:!!(unmapped.length||modeChanged||newRelations)};
}
