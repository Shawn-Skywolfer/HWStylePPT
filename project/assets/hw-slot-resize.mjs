import {manualHwInfo,blankManualCard} from './hw-manual-props.mjs';
import {normalizeOriginalProps} from './hw-original-view.mjs';
const clone=v=>structuredClone(v),pending='待补充';

// A user-requested slot-count edit, not lossless content adaptation. Keep the
// leading cards intact and make missing values explicit rather than invent data.
export function resizeHwSlots(def,source,variant,{count}={}){
 const info=manualHwInfo(def,variant,{count}),p=clone(source),removedCards=clone(p.cards.slice(info.cards)),removedRows=info.rows?clone((p.table?.rows||[]).slice(info.rows)):[];
 const used=new Set(p.cards.map(c=>c.blockId));let serial=0;
 const freshId=()=>{let value;do{value=['process','timeline'].includes(def.family)?'pending-'+crypto.randomUUID():'pending-'+(++serial);}while(used.has(value));used.add(value);return value;};
 p.variant=String(variant);p.cards=Array.from({length:info.cards},(_,i)=>{if(source.cards[i])return clone(source.cards[i]);const c=blankManualCard(def,freshId());for(const field of info.cardFields)if(field!=='value'&&field!=='items')c[field]=pending;c.label||=pending;c.evidence||=pending;if(info.cardFields.includes('items')){c.items=[pending];c.text='';}else c.text||=pending;if(['metrics','highlight'].includes(def.family)){c.value=null;c.pendingValue=true;c.unit=pending;}return c;});
 if(info.rows){if(!p.table?.headers?.length)throw new Error('表格缺少表头，未切换布局。');p.table.rows=Array.from({length:info.rows},(_,i)=>source.table.rows[i]?clone(source.table.rows[i]):{cells:p.table.headers.map(()=>pending),group:'',emphasis:''});}
 p.original={...(p.original||{})};for(const key of info.copyKeys)if(p.original[key]==null||p.original[key]==='')p.original[key]=pending;
 if(def.family==='process')for(const c of p.cards.slice(source.cards.length))c.evidence='';
 if(def.family==='process'&&source.cards.length!==info.cards)p.original.slot_2_5_0_0_0=String(info.cards);
 const ids=new Set(p.cards.map(c=>c.blockId)),removed=new Set(removedCards.map(c=>c.blockId));
 p.layout={...(p.layout||{}),mode:def.layout,nodes:p.cards.map(c=>({...clone(source.layout?.nodes?.find(n=>n.id===c.blockId)||{}),id:c.blockId,type:source.layout?.nodes?.find(n=>n.id===c.blockId)?.type||'paragraph'})),edges:(p.layout?.edges||[]).filter(e=>![e.from,e.to].some(id=>removed.has(String(id).replace(/^block:/,''))))};
 if(p.baselines)p.baselines=p.baselines.filter(b=>ids.has(b.blockId));
 if(p.emphasisIndex>=p.cards.length)Object.assign(p,{emphasisMode:'none',emphasisIndex:-1});
 return {props:normalizeOriginalProps(def,p),removedCards,removedRows,addedCards:Math.max(0,info.cards-source.cards.length),addedRows:info.rows?Math.max(0,info.rows-(source.table?.rows?.length||0)):0};
}
