// Isomorphic planning geometry. This is semantic planning, not Theme17 props.
export const BOARD_WIDTH = 1280;
export const BOARD_HEIGHT = 720;
export const nodeIdForBlock = id => `block:${id}`;
const clamp = (value, min, max, fallback) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback));
export function inferBoardMode(slide) {
  if (slide.role === 'cover' || ['section','transition','chapter'].includes(slide.role)) return 'title';
  if (['comparison','table'].includes(slide.role)) return 'comparison';
  const intent=String(slide.visualIntent||'').replace(/(?:不要|不能|不得|不应|不把|避免|而非|不是)[^。；;\n]*/g,'');
  if(/(?:不要|不得|不能|不把)[^。；;\n]*(?:先后|流程|连成|顺序)/.test(slide.visualIntent||''))return /对比|比较|矩阵/.test(intent)?'comparison':/层级|支撑|金字塔/.test(intent)?'hierarchy':'columns';
  if(/对照的是|双流程对照|两阶段流程对照|传统与新路径/.test(intent))return 'comparison';
  if (['process','actions','trend','risks'].includes(slide.role) || /流程|因果|链条|路径|步骤/.test(intent)) return 'flow';
  if (/对比|比较|矩阵/.test(intent)) return 'comparison';
  if (/层级|支撑|金字塔|上下/.test(intent)) return 'hierarchy';
  return 'columns';
}
export function defaultBoard(slide, mode = inferBoardMode(slide)) {
  const nodes = [
    { nodeId:'meta:title', x:64, y:34, w:1152, h:92, z:1 },
    { nodeId:'meta:conclusion', x:64, y:142, w:1152, h:66, z:1 },
    { nodeId:'meta:evidence', x:64, y:660, w:1152, h:30, z:1 },
  ];
  const count = slide.blocks?.length || 0;
  const columns = mode === 'comparison' ? 2 : mode === 'hierarchy' ? Math.min(3,Math.max(1,count)) : Math.min(3,Math.max(1,count));
  const rows = Math.max(1,Math.ceil(count / columns));
  const gap = mode === 'flow' ? 44 : 24;
  const w = (1152 - gap * (columns - 1)) / columns;
  const h = Math.min(348, (402 - 24 * (rows - 1)) / rows);
  for (let index=0; index<count; index++) nodes.push({ nodeId:nodeIdForBlock(slide.blocks[index].blockId), x:64+(index%columns)*(w+gap), y:236+Math.floor(index/columns)*(h+24), w, h:Math.max(90,h), z:2 });
  const edges=[];
  if (mode==='flow') for(let i=0;i<count-1;i++) edges.push({edgeId:`sequence-${i}`,from:nodeIdForBlock(slide.blocks[i].blockId),to:nodeIdForBlock(slide.blocks[i+1].blockId),label:'',kind:'sequence'});
  if (mode==='hierarchy') for(const block of slide.blocks || []) edges.push({edgeId:`supports-${block.blockId}`,from:'meta:conclusion',to:nodeIdForBlock(block.blockId),label:'支撑',kind:'supports'});
  return {version:1,width:BOARD_WIDTH,height:BOARD_HEIGHT,mode,nodes,edges};
}
export function normalizeBoard(value, slide) {
  const defaults=defaultBoard(slide, value?.mode || inferBoardMode(slide));
  if (!value) return defaults;
  const allowed=new Set(defaults.nodes.map(node=>node.nodeId));
  const incoming=new Map((Array.isArray(value.nodes)?value.nodes:[]).filter(node=>allowed.has(node.nodeId)).map(node=>[node.nodeId,node]));
  const nodes=defaults.nodes.map(fallback=>{
    const node=incoming.get(fallback.nodeId) || fallback;
    const w=clamp(node.w,120,1280,fallback.w),h=clamp(node.h,28,720,fallback.h);
    return {nodeId:fallback.nodeId,x:clamp(node.x,0,1280-w,fallback.x),y:clamp(node.y,0,720-h,fallback.y),w,h,z:clamp(node.z,0,100,fallback.z)};
  });
  const seen=new Set();
  const edges=(Array.isArray(value.edges)?value.edges:defaults.edges).filter(edge=>edge && allowed.has(edge.from) && allowed.has(edge.to) && edge.from!==edge.to && !seen.has(`${edge.from}:${edge.to}`) && seen.add(`${edge.from}:${edge.to}`)).slice(0,200).map((edge,i)=>({edgeId:String(edge.edgeId || `edge-${i}`).slice(0,160),from:edge.from,to:edge.to,label:String(edge.label || '').slice(0,60),kind:['supports','sequence','causes','contrasts'].includes(edge.kind)?edge.kind:'supports'}));
  return {...defaults,mode:['columns','flow','comparison','hierarchy','free','title'].includes(value.mode)?value.mode:defaults.mode,nodes,edges};
}
export function orderedBoardBlocks(slide) {
  if (!slide.board) return slide.blocks || [];
  const positions=new Map(normalizeBoard(slide.board,slide).nodes.map(node=>[node.nodeId,node]));
  return [...(slide.blocks || [])].sort((a,b)=>{
    const left=positions.get(nodeIdForBlock(a.blockId)),right=positions.get(nodeIdForBlock(b.blockId));
    return Math.abs(left.y-right.y)>80 ? left.y-right.y : left.x-right.x;
  });
}
