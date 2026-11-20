// Shared structural contract. Drafts remain editable; confirmation and generation
// must reject these issues without dropping children or inventing headings.
export function contentIssues(document,{slideId}={}){
 const issues=[],blank=v=>!String(v??'').trim();
 for(const [index,slide] of (document.slides||[]).entries()){
  if(slideId&&slide.slideId!==slideId)continue;
  const add=(code,message,extra={})=>issues.push({code,message:`第 ${index+1} 页：${message}`,slideId:slide.slideId,...extra});
  if(blank(slide.title))add('PAGE_TITLE_REQUIRED','页面标题不能为空。',{field:'title',nodeId:'s:'+slide.slideId});
  if(['cover','chapter','section','transition'].includes(slide.role)&&(slide.blocks||[]).length&&!slide.legacy)add('CONTENT_ROLE_CONFLICT','封面/章节页不能包含正文块；请选择正文角色，或将完整正文块移到正文页。',{field:'role',nodeId:'s:'+slide.slideId});
  for(const block of slide.blocks||[]){
   if(blank(block.label))add('BLOCK_TITLE_REQUIRED','内容块标题为空，正文及子内容已保留；请补充一个准确的标题。',{blockId:block.blockId,field:'label',nodeId:'b:'+block.blockId});
   const visit=(node,root=false)=>{if(!node)return;if(!root&&blank(node.text))add('CONTENT_NODE_TITLE_REQUIRED','子要点为空，不能用无标题节点包裹下级内容。',{blockId:block.blockId,field:'contentTree',nodeId:node.id});for(const child of node.children||[])visit(child);};
   visit(block.contentTree,true);
  }
 }
 return issues;
}
export function assertContentReady(document,options){const issues=contentIssues(document,options);if(!issues.length)return;const first=issues[0],error=new Error(first.message);error.code=first.code;error.status=422;error.details={slideId:first.slideId,...(first.blockId?{blockId:first.blockId}:{}),field:first.field,nodeId:first.nodeId,issues:issues.map(i=>i.message),suggestions:['定位并补齐缺失标题或修正页面角色','保留正文、子内容、数字和来源，不要删除内容来绕过检查']};throw error;}
