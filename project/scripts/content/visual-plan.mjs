import {listLayouts,inspectLayout,normalizeProps} from '../skill-workflow-utils.mjs';
import {charLength} from '../workflow/copy-contract.mjs';
import {orderedBoardBlocks,normalizeBoard,nodeIdForBlock} from './board-model.mjs';
import {WorkbenchError} from './model.mjs';

const lines=(text,width,font)=>String(text||'').split('\n').reduce((sum,line)=>sum+(line?Math.ceil(charLength(line)/Math.max(1,(width-8)/font)):1),0);
function heightFor(block,node){const w=node.w-36;if(node.variant==='compact'){const f=node.fontSize||18;return 24+(block.label?lines(block.label,w,19)*24+5:0)+(block.text?lines(block.text,w,f)*f*1.42:0)+(block.evidence?lines(block.evidence,w,12)*17+5:0);}return 36+(block.label?lines(block.label,w,22)*29.7+13:0)+(block.text?lines(block.text,w,20)*29:0)+(block.evidence?lines(block.evidence,w,14)*20.3+10:0)+Math.max(0,[block.label,block.text,block.evidence].filter(Boolean).length-1)*12;}
function fail(slide,issues){const error=new WorkbenchError(`第 ${slide.order} 页“${slide.title}”需要调整内容编排，未生成 PPT：\n${issues.slice(0,5).join('\n')}\n原确认稿未改变。请在脑图中调整内容，或在诊断控制台点击“AI 精炼候选 / AI 拆页候选”，确认后再生成。`,422,'LAYOUT_REVIEW_REQUIRED');error.details={slideId:slide.slideId,issues,suggestions:['定位问题页并调整脑图内容或关系','点击 AI 精炼候选，先预览确认','点击 AI 拆页候选，先确认页数变化']};throw error;}
export function flowOrder(blocks,edges,slide){const ids=new Set(blocks.map(b=>b.blockId)),pairs=edges.filter(e=>['sequence','causes'].includes(e.kind)&&e.from.startsWith('block:')&&e.to.startsWith('block:')).map(e=>[e.from.slice(6),e.to.slice(6)]);if(!pairs.length)return blocks;const incoming=new Map([...ids].map(id=>[id,0]));for(const[,to]of pairs)incoming.set(to,incoming.get(to)+1);const queue=blocks.filter(b=>!incoming.get(b.blockId)),result=[];while(queue.length){const b=queue.shift();result.push(b);for(const[from,to]of pairs)if(from===b.blockId){incoming.set(to,incoming.get(to)-1);if(!incoming.get(to))queue.push(blocks.find(b=>b.blockId===to));}}if(result.length!==blocks.length)fail(slide,['流程/因果连线包含循环，不能自动推断阅读顺序；请先调整关系。']);return result;}
export function planContentSlide(slide,{presentation,focusBlockId}={}){
 const board=normalizeBoard(slide.board,slide),mode=board.mode==='title'?'columns':board.mode;
 let blocks=orderedBoardBlocks(slide);if(mode==='flow')blocks=flowOrder(blocks,board.edges,slide);
 if(presentation==='spotlight'&&focusBlockId&&blocks.some(b=>b.blockId===focusBlockId)&&!board.edges.length)blocks=[blocks.find(b=>b.blockId===focusBlockId),...blocks.filter(b=>b.blockId!==focusBlockId)];
 if(!blocks.length)fail(slide,['正文页没有内容块；请添加内容或改为封面/章节页。']);
 const capacity=presentation==='bento'?12:6;
 if(blocks.length>capacity)fail(slide,[`正文共有 ${blocks.length} 个独立内容块，此版式最多 ${capacity} 块；请先匹配弹性 Bento 或预览自动拆页，不删减原文。`]);
 if(blocks.some(b=>b.data!=null))fail(slide,['此页含结构化数据，不能将 JSON 当正文填入。请使用专用图表页或先确认数据的图表呈现方案。']);
 if(presentation&&(!['editorial','briefing','spotlight','bento'].includes(presentation)||!['columns','comparison'].includes(mode)||board.edges.length))fail(slide,['此版式不适用于当前显式关系，请使用关系专用版式。']);
 const candidates=listLayouts({theme:'theme17',keyword:'content-',limit:50}).filter(row=>row.layout===`theme17_content_${presentation||mode}`);
 const candidate=candidates[0];if(!candidate)fail(slide,[`没有登记的 ${mode} 内容布局。`]);
 const inspection=inspectLayout(candidate.layout,{compact:true});
 const budgetIssues=[];
 for(const[field,value,key]of[['主标题',slide.title,'title'],['核心结论',slide.conclusion,'lead'],['页面来源',slide.evidence,'closing']])if(charLength(value)>inspection.copyBudgets[key].maxChars)budgetIssues.push(`${field}超过该版式的安全容量。`);
 if(budgetIssues.length)fail(slide,budgetIssues);
 const geometries=[];
 if(presentation){
  for(const fontSize of [20,18,17,16]){
   const cols=presentation==='bento'?(blocks.length>6?4:3):presentation==='editorial'?1:2,gapX=presentation==='bento'?16:40,gapY=presentation==='bento'?14:18,w=(1152-gapX*(cols-1))/cols;
   let base;
   if(presentation==='spotlight'){
    if(blocks.length<2||blocks.length>4)continue;
    const heights=blocks.slice(1).map(b=>heightFor(b,{w:660,variant:'compact',fontSize})+8),sum=heights.reduce((a,b)=>a+b,0)+gapY*(heights.length-1);if(sum>400)continue;
    let y=236;base=[{id:blocks[0].blockId,x:64,y:236,w:452,h:400}];for(let i=1;i<blocks.length;i++){const h=heights[i-1]+(400-sum)/heights.length;base.push({id:blocks[i].blockId,x:556,y,w:660,h});y+=h+gapY;}
   }else{
    const rows=[];for(let i=0;i<blocks.length;i+=cols)rows.push(blocks.slice(i,i+cols));
    const heights=rows.map(row=>Math.max(...row.map(b=>heightFor(b,{w,variant:'compact',fontSize})))+8),sum=heights.reduce((a,b)=>a+b,0)+gapY*(rows.length-1);if(sum>400)continue;
    let y=236;base=rows.flatMap((row,r)=>{const h=heights[r]+(400-sum)/rows.length,result=row.map((b,c)=>({id:b.blockId,x:64+c*(w+gapX),y,w,h}));y+=h+gapY;return result;});
   }
   geometries.push(base.map(n=>({...n,variant:'compact',fontSize,presentation})));
  }
 }
 if(!presentation){
 if(['columns','flow','hierarchy'].includes(mode)&&blocks.length<=3){const gap=mode==='flow'?44:24,available=1152-gap*(blocks.length-1),minimum=220,weights=blocks.map(b=>Math.sqrt(Math.max(1,charLength(b.text)+charLength(b.evidence)*.7))),sum=weights.reduce((a,b)=>a+b,0);let x=64;geometries.push(blocks.map((b,i)=>{const w=minimum+(available-minimum*blocks.length)*weights[i]/sum,node={id:b.blockId,x,y:236,w,h:400};x+=w+gap;return node;}));}
 if(mode==='free')geometries.push(blocks.map(b=>{const n=board.nodes.find(n=>n.nodeId===nodeIdForBlock(b.blockId));return {id:b.blockId,x:n.x,y:n.y,w:n.w,h:n.h};}));
 else for(const cols of [...new Set([mode==='comparison'?Math.min(2,blocks.length):Math.min(3,blocks.length),1,2,3])].filter(n=>n<=blocks.length)){
   const rows=Math.ceil(blocks.length/cols),gapX=mode==='flow'?44:24,gapY=24,w=(1152-gapX*(cols-1))/cols,h=(400-gapY*(rows-1))/rows;
   geometries.push(blocks.map((b,i)=>{const row=Math.floor(i/cols),col=mode==='flow'&&row%2?cols-1-i%cols:i%cols;return {id:b.blockId,x:64+col*(w+gapX),y:236+row*(h+gapY),w,h};}));
 }
 // Dense content keeps its full copy. Try compact and content-weighted rows before requesting edits.
 if(mode!=='free')for(const fontSize of [18,17,16])for(const cols of [...new Set([Math.min(2,blocks.length),Math.min(3,blocks.length),1])]){
  const gapX=mode==='flow'?44:24,gapY=14,w=(1152-gapX*(cols-1))/cols,rows=[];
  for(let i=0;i<blocks.length;i+=cols){const group=blocks.slice(i,i+cols);rows.push(group.map(b=>({id:b.blockId,x:0,y:0,w,h:0,variant:'compact',fontSize})));}
  const heights=rows.map((row,r)=>Math.max(...row.map((n,c)=>heightFor(blocks[r*cols+c],n)))+6),sum=heights.reduce((a,b)=>a+b,0)+gapY*(rows.length-1);if(sum>400)continue;
  let y=236;geometries.push(rows.flatMap((row,r)=>{const h=heights[r]+(400-sum)/rows.length;const result=row.map((n,c)=>({...n,x:64+c*(w+gapX),y,h}));y+=h+gapY;return result;}));
 }
 }
 let nodes=geometries.find(nodes=>nodes.every((n,i)=>heightFor(blocks[i],n)<=n.h-5&&n.y>=230&&n.y+n.h<=638&&n.w>=200));
 if(!nodes){const closest=geometries[0];fail(slide,blocks.filter((b,i)=>!closest||heightFor(b,closest[i])>closest[i].h-6).map(b=>`“${b.label||b.blockId}”的正文/来源在当前版面放不下（正文 ${b.text.length} 字，来源 ${b.evidence.length} 字），不能拆散为无标题碎片。`).concat(mode==='free'?['自由排布可能越过标题或页脚保留区；可选择“重新排布”后再检查。']:[]));}
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];if(Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y)+1)fail(slide,['白板中的内容块互相重叠，请先调整排布。']);}
 const translated=new Map(blocks.map(b=>[nodeIdForBlock(b.blockId),b.blockId]));translated.set('meta:conclusion','meta:conclusion');translated.set('meta:title','meta:title');translated.set('meta:evidence','meta:evidence');
 const edges=board.edges.map(e=>({...e,from:translated.get(e.from),to:translated.get(e.to)}));
 const layoutNodes=[...nodes.map((n,i)=>({...n,type:blocks[i].type})),{id:'meta:conclusion',x:64,y:150,w:1152,h:64},{id:'meta:title',x:64,y:42,w:1152,h:96},{id:'meta:evidence',x:64,y:644,w:960,h:54}];
 const props={title:slide.title,lead:slide.conclusion,closing:slide.evidence,cards:blocks.map(b=>({label:b.label,text:b.text,evidence:b.evidence})),layout:{mode,nodes:layoutNodes,edges}};
 const normalized=normalizeProps(candidate.layout,props);if(normalized.errors?.length)fail(slide,normalized.errors);
 const bindings=[{source:'title',target:'props.title',text:slide.title},{source:'conclusion',target:'props.lead',text:slide.conclusion},{source:'evidence',target:'props.closing',text:slide.evidence},...blocks.flatMap((b,i)=>['label','text','evidence'].map(source=>({blockId:b.blockId,source,target:`props.cards[${i}].${source}`,text:b[source]||''})))];
 return {layout:candidate.layout,props,blocks:blocks.map((b,i)=>({blockId:b.blockId,paths:[`props.cards[${i}].label`,`props.cards[${i}].text`,`props.cards[${i}].evidence`],fields:{label:`props.cards[${i}].label`,text:`props.cards[${i}].text`,evidence:`props.cards[${i}].evidence`}})),plan:{version:2,mode,engine:'semantic-contract-planner',reason:'按已确认内容块、显式关系、空间顺序与实测容量选取登记的华为正文布局；不改写、不切分确认稿。',candidates:candidates.map(c=>c.layout),bindings,nodes:layoutNodes,edges,checks:{atomicBlocks:true,separateEvidence:true,estimatedFit:true,needsRenderedValidation:true}}};
}
