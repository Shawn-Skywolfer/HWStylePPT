import {HUAWEI_ICON_PAGES} from '../../src/components/semantic-content-contracts.mjs';
import {normalizeIconConfig,iconAssignment,iconCount} from '../../assets/huawei-icons.mjs';
import {iconGeometry,measureIconGeometry,iconCapacityProfiles} from '../../assets/huawei-icon-layout.mjs';
import {flowOrder} from './visual-plan.mjs';
import {orderedBoardBlocks} from './board-model.mjs';
import {charLength} from '../workflow/copy-contract.mjs';
import {normalizeProps} from '../skill-workflow-utils.mjs';
export function iconCandidates(slide,document,{rejections=[]}={}){
 if(slide.blocks.some(b=>b.data!=null)||slide.board?.mode==='free')return [];
 const blocks=flowOrder(orderedBoardBlocks(slide),slide.board?.edges||[],slide),cards=blocks.map(b=>({label:b.label,text:b.text,evidence:b.evidence})),ids=blocks.map(b=>b.blockId),config=normalizeIconConfig(slide.visuals?.icons),edges=(slide.board?.edges||[]).map(e=>({...e,from:e.from.replace(/^block:/,''),to:e.to.replace(/^block:/,'')})),intent=slide.title+' '+(slide.visualIntent||''),result=[];
 for(const page of HUAWEI_ICON_PAGES){const mode=page.mode;if(blocks.length<page.iconSlots.min||blocks.length>page.iconSlots.max)continue;if(slide.media?.length&&mode!=='media'||mode==='media'&&slide.media?.length>1)continue;
  if(edges.length&&(!['risks','steps','roadmap'].includes(mode)||edges.some((e,i)=>!['sequence','causes'].includes(e.kind)||e.from!==ids[i]||e.to!==ids[i+1])||edges.length!==blocks.length-1)){rejections.push({layout:page.key,reason:'当前显式关系不能由此 ICON 版式完整表达；不得丢弃连线来强行换版'});continue;}
  if(['flow','hierarchy','comparison'].includes(slide.board?.mode)&&!edges.length&&slide.board.mode!=='flow'){rejections.push({layout:page.key,reason:'此 ICON 版式需要并列 columns 结构；当前为 '+slide.board.mode});continue;}
  const props={title:slide.title,lead:slide.conclusion,closing:slide.evidence,cards,iconConfig:config,...(mode==='media'?{images:(slide.media||[]).map(m=>m.src),imageCount:slide.media?.length||(document.brief?.imagePolicy==='placeholders'?1:0)}: {})};
  if(charLength(props.title)>42||charLength(props.lead)>80||charLength(props.closing)>140||cards.some(c=>charLength(c.label)>28||charLength(c.text)>1200||charLength(c.evidence)>240)){rejections.push({layout:page.key,reason:'字段容量超出：title≤42、conclusion≤80、页面 evidence≤140；每块 label≤28、text≤1200、evidence≤240；仍须通过实际空间检查'});continue;}
  const g=iconGeometry(mode,cards,{imageCount:props.imageCount,iconConfig:config,ids});if(!g){const measured=measureIconGeometry(mode,cards,{imageCount:props.imageCount,iconConfig:config,ids});for(const n of measured?.nodes.filter(n=>n.needed>n.h)||[])rejections.push({layout:page.key,blockId:n.id,reason:`内容块 ${n.id} 的 label/text/evidence 合计需要 ${Math.ceil(n.needed)}px 高，当前 ${cards.length} 块档位只有 ${Math.floor(n.h)}px；请按几何容量重新分组或精炼，不是使用字段上限1200字。`,geometry:{requiredHeight:Math.ceil(n.needed),availableHeight:Math.floor(n.h),width:n.w},profiles:iconCapacityProfiles(mode,{imageCount:props.imageCount,iconConfig:config})});continue;}
  props.layout={mode,nodes:g.nodes.map((n,i)=>({id:n.id,x:n.x,y:n.y,w:n.w,h:n.h,type:blocks[i].type})),edges};
  if(normalizeProps(page.key,props).errors?.length)continue;
  const bindings=[{source:'title',target:'props.title',text:slide.title},{source:'conclusion',target:'props.lead',text:slide.conclusion},{source:'evidence',target:'props.closing',text:slide.evidence}],mapped=blocks.map((b,i)=>{const fields=Object.fromEntries(['label','text','evidence'].map(k=>[k,`props.cards[${i}].${k}`]));for(const[field,target]of Object.entries(fields))bindings.push({blockId:b.blockId,source:field,target,text:b[field]});return {blockId:b.blockId,fields,paths:Object.values(fields)};});
  const contextual=mode==='risks'&&['risk','risks'].includes(slide.role)||mode==='steps'&&(['actions','flow','process'].includes(slide.role)||slide.board?.mode==='flow')||mode==='roadmap'&&/阶段|演进|路线|规划/.test(intent)||mode==='pillars'&&/能力|支柱|基石|要素/.test(intent)||mode==='list'&&/清单|要点|优势|原则/.test(intent)||mode==='media'&&slide.media?.length;
  const explicit=/icon|图标/i.test(slide.visualIntent||'');const score=(explicit?140:52)+(contextual?70:0);
  result.push({layout:page.key,props,titlePaths:['props.title'],blocks:mapped,score,plan:{version:4,engine:'icon-contract-planner',mode,family:['steps','roadmap'].includes(mode)?'flow':'columns',bindings,nodes:props.layout.nodes,edges,mediaCount:props.imageCount||0,icons:{count:iconCount(cards,props.layout.nodes,config),capacity:cards.length,assignments:cards.map((c,i)=>({blockId:ids[i],...iconAssignment(c,ids[i],config)}))},reason:`完整内容匹配“${page.label}”，自动配 ${cards.length} 个离线 ICON；保留全部正文和来源。`,checks:{atomicBlocks:true,separateEvidence:true,estimatedFit:true,needsRenderedValidation:true}}});
 }return result;
}
