import {originalVariantCapacity,originalDefinition,normalizeOriginalProps} from './hw-original-view.mjs';

// Only approved variants may reflow a deletion. Other layouts require a choice.
export function removeHwContentBlock(def,source,blockId){
 const index=source.cards.findIndex(c=>c.blockId===blockId);
 if(index<0)throw new Error('内容块已变化，请重新选择。');
 const p=structuredClone(source),deleted=p.cards.splice(index,1)[0];
 const visibleImages=(p.images||[]).filter((image,i)=>image&&(Array.isArray(p.__mediaSlotVisibility?.imageCount)?p.__mediaSlotVisibility.imageCount[i]!==false:i<Number(p.imageCount||0)&&p.imageVisible?.[i]!==false)).length;
 const candidates=[source.variant,...def.variants.filter(v=>String(v)!==String(source.variant))].filter(v=>originalVariantCapacity(def,v,def.family==='process'?p.cards.length:undefined)?.cards===p.cards.length&&originalDefinition(def.layout).variants[String(v)].mediaFrames.filter(f=>f.role!=='chart').length>=visibleImages);
 if(!candidates.length)return null;
 p.variant=String(candidates[0]);
 if(def.family==='process'&&Number(p.original?.slot_2_5_0_0_0)===source.cards.length)p.original.slot_2_5_0_0_0=String(p.cards.length);
 // Media capacity is checked by the existing template validator; never drop images.
 const focused=source.cards[source.emphasisIndex]?.blockId;
 if(source.emphasisMode==='manual'){const focus=p.cards.findIndex(c=>c.blockId===focused);p.emphasisMode=focus<0?'none':'manual';p.emphasisIndex=focus;}
 const ids=new Set(p.cards.map(c=>c.blockId)),removed=id=>String(id).replace(/^block:/,'')===blockId;
 p.layout={...(p.layout||{}),nodes:(p.layout?.nodes||[]).filter(n=>!removed(n.id)),edges:(p.layout?.edges||[]).filter(e=>!removed(e.from)&&!removed(e.to))};
 if(p.baselines)p.baselines=p.baselines.filter(b=>ids.has(b.blockId));
 return {props:normalizeOriginalProps(def,p),deleted,visibleImages};
}
