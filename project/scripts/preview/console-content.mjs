import {validateCanvasObjects} from '../../assets/console-canvas-model.mjs';
// Console edits are a current-page branch; never rewrite the planning document.
export function applyConsoleContent(document,props={}){
 const doc=structuredClone(document),slide=doc.slides[0],objects=props.editorCanvasObjects||[],removed=new Set(props.editorRemovedBlocks||[]);validateCanvasObjects(objects);
 slide.blocks=slide.blocks.filter(b=>!removed.has(b.blockId));
 for(const o of objects){
  if(['rect','line','arrow','icon'].includes(o.kind))continue;
  const b={blockId:o.id,type:'paragraph',label:o.title||'',text:o.text||'',evidence:o.source||'',origin:{console:{id:o.id,kind:o.kind}}};
  if(o.kind==='chart'){if(o.items.some(i=>i.value===null))throw new Error('新增图表仍有待补充数值，请在演示控制台的“编辑”中填写后重试。');Object.assign(b,{type:'data',data:{kind:o.chartType,labels:o.items.map(i=>i.label),values:o.items.map(i=>i.value)}});}
  if(o.kind==='table'){if(o.rows.length<2)throw new Error('新增表格至少需要一行表头和一行数据，请在当前页补充。');Object.assign(b,{type:'data',data:{kind:'table',headers:o.rows[0],rows:o.rows.slice(1).map(cells=>({cells}))}});}
  if(o.kind==='image'){if(!o.src)throw new Error('新增图片框尚无图片，请在当前页上传或生成图片，或删除此框。');if(o.src.startsWith('data:'))throw new Error('图片尚未保存完成，请稍后在当前页重试。');b.label||='配图';b.media=[{src:o.src}];}
  if(['text','module'].includes(o.kind)&&[b.label,b.text].every(v=>!v.trim()||v.trim()==='待补充'))throw new Error('新增文字或模块尚待补充，请直接在当前页编辑后重试。');
  slide.blocks.push(b);
 }
 const ids=new Set(slide.blocks.map(b=>b.blockId));if(slide.board){slide.board.edges=(slide.board.edges||[]).filter(e=>ids.has(String(e.from).replace(/^block:/,''))&&ids.has(String(e.to).replace(/^block:/,'')));slide.board.nodes=(slide.board.nodes||[]).filter(n=>!removed.has(String(n.id).replace(/^block:/,'')));}
 return doc;
}
