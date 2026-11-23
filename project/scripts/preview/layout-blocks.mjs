import {normalizeDocument} from '../content/model.mjs';
import {contentCandidates} from '../content/catalog-match.mjs';
import {hwDefinition} from '../../src/components/hw/contracts.mjs';
import {manualHwInfo,prepareManualHwProps} from '../../assets/hw-manual-props.mjs';
import {importHwLayoutContent} from './hw-layout-content.mjs';
import {layoutAvailableForPage} from '../content/layout-policy.mjs';
const clone=v=>structuredClone(v);
const removable=(doc,id)=>doc.slides[0].blocks.find(b=>b.blockId===id);
function remainingDocument(document,blockId){const doc=clone(document),s=doc.slides[0];s.blocks=s.blocks.filter(b=>b.blockId!==blockId);const isDeleted=id=>id===blockId||id==='block:'+blockId;s.board={...s.board,nodes:(s.board?.nodes||[]).filter(n=>!isDeleted(n.id)),edges:(s.board?.edges||[]).filter(e=>!isDeleted(e.from)&&!isDeleted(e.to))};return normalizeDocument(doc);}
export function deleteBlockPlans({document,modelSlide,sourceProps,mediaRoot,usedLayouts=[]},blockId){
 const deleted=removable(document,blockId);if(!deleted)throw new Error('内容块不存在，可能页面刚有新编辑，请重新选择。');
 const def=hwDefinition(modelSlide.layout),plans=[];let remaining;
 if(def){
  const cards=sourceProps.cards.filter(c=>c.blockId!==blockId);if(cards.length===sourceProps.cards.length)throw new Error('这是图表数据或辅助文案，不是可独立删除的正文块；请使用对应的数据/文案编辑入口。');
  if(!cards.length)return {deleted,plans:[],recommended:null,reason:'删除后没有剩余内容块。当前原稿没有空正文档位，原页保持不变；可改用空白正文版式或删除整页。'};
  const visibleImages=(sourceProps.images||[]).filter((v,i)=>v&&(Array.isArray(sourceProps.__mediaSlotVisibility?.imageCount)?sourceProps.__mediaSlotVisibility.imageCount[i]!==false:i<Number(sourceProps.imageCount||0)&&sourceProps.imageVisible?.[i]!==false)).length;
  for(const variant of def.variants){let cap;try{cap=manualHwInfo(def,variant,{count:def.family==='process'?cards.length:undefined});}catch{continue;}if(cap.cards!==cards.length||visibleImages>cap.mediaSlots)continue;try{const draft={...clone(sourceProps),cards:clone(cards),variant:String(variant)};if(sourceProps.emphasisMode==='manual'){const focused=sourceProps.cards[sourceProps.emphasisIndex]?.blockId,index=cards.findIndex(c=>c.blockId===focused);Object.assign(draft,{emphasisMode:index<0?'none':'manual',emphasisIndex:index});}const props=prepareManualHwProps(def,sourceProps,draft,{acknowledged:true}),next=importHwLayoutContent({...modelSlide,props},{},mediaRoot);plans.push({key:def.layout+'@'+variant,layout:def.layout,variant:String(variant),document:next,candidate:{layout:def.layout,props,nativeHw:true,titlePaths:['props.title'],blocks:[]}});}catch{}}
  remaining=remainingDocument(document,blockId);
 }else{if(document.slides[0].blocks.length<=1)return {deleted,plans:[],recommended:null,reason:'当前页只剩这一个内容块；没有可验证的空正文版式，原页保持不变。'};remaining=remainingDocument(document,blockId);}
 const recommended=plans[0]?.key;let reasons=[];
 try{for(const c of contentCandidates(remaining.slides[0],remaining).candidates){if(def&&c.layout===def.layout||plans.some(p=>p.layout===c.layout)||(!layoutAvailableForPage(c.layout,usedLayouts))||(remaining.slides[0].visuals?.icons&&hwDefinition(c.layout)?.family!=='icon'&&!c.layout.startsWith('theme17_content_icon_')))continue;plans.push({key:c.layout,layout:c.layout,variant:c.props.variant==null?null:String(c.props.variant),document:remaining,candidate:c});}}catch(e){reasons.push(e.message);}
 const same=plans.find(p=>p.layout===modelSlide.layout);
 return {deleted,plans,recommended:recommended||same?.key||null,reason:recommended||same?'删除后使用可容纳剩余内容的同版式原稿档位，确认前原页不变。':'当前版式没有匹配剩余数量的档位；不会留空框或擅自重画，请选择下列已匹配版式，或取消。'+(plans.length?'':reasons.join('；'))};
}
