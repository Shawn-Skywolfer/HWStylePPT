// Shared deterministic capacity geometry: planning, rendering and live editing.
import {timelineVariant,timelineCount} from './hw-timeline-view.mjs';
export const HW_AREA={x:64,y:154,w:1152,h:462};
export const hwUnits=s=>[...String(s??'')].reduce((n,c)=>n+(/[\u2e80-\uffff]/.test(c)?1:.6),0);
export const hwLines=(s,w,f)=>String(s??'').split('\n').reduce((n,l)=>n+Math.max(1,Math.ceil(hwUnits(l)/Math.max(1,(w-4)/f))),0);
const rect=(id,x,y,w,h,role='card',extra={})=>({id,x,y,w,h,role,...extra});
function grid(count,cols,{x=64,y=154,w=1152,h=462,gap=16}={}){const rows=Math.ceil(count/cols),cw=(w-gap*(cols-1))/cols,ch=(h-gap*(rows-1))/rows;return Array.from({length:count},(_,i)=>rect('',x+i%cols*(cw+gap),y+Math.floor(i/cols)*(ch+gap),cw,ch));}
function rowsBySpans(spans,{x=64,y=154,w=1152,h=462,gap=16}={}){const rh=(h-gap*(spans.length-1))/spans.length;return spans.flatMap((row,r)=>{const total=row.reduce((a,b)=>a+b,0),available=w-gap*(row.length-1);let at=x;return row.map(span=>{const width=available*span/total,n=rect('',at,y+r*(rh+gap),width,rh);at+=width+gap;return n;});});}
export function hwVariant(def,count){if(['metrics'].includes(def.family))return count===4?'three':count===5?'four':count===7?'six':null;if(def.family==='chart')return def.variants.find(v=>Number(v)>=count)??null;if(def.family==='timeline')return timelineVariant(count);if(def.family==='layers'||def.family==='radial'||def.family==='process'||def.family==='transformation')return def.defaultVariant;return def.variants.find(v=>Number(v)===count)??null;}
export function hwGeometry(def,p){
 const cards=p.cards||[],n=cards.length,key=def.layout,variant=p.variant??hwVariant(def,n),k=Number(variant),images=[],chart=def.family==='chart';let nodes=[],gridMode=true;
 const maxMedia=def.family==='media'?(key.endsWith('stagger')?n:1):def.family==='mediaBento'?(key.endsWith('hero')?1:2):0;
 const saved=p.__mediaSlotVisibility?.imageCount;
 const visible=Array.from({length:maxMedia},(_,i)=>Array.isArray(saved)?saved[i]!==false:i<Number(p.imageCount||0)&&p.imageVisible?.[i]!==false),mediaCount=visible.filter(Boolean).length;
 if(variant==null||!def.variants.some(v=>String(v)===String(variant)))return null;
 if(def.family==='metrics'){
  if(n!==({three:4,threeColumns:4,four:5,six:7})[variant])return null;
  const hero=rect('',64,154,356,462),right={x:444,y:154,w:772,h:462};
  nodes=[hero,...(variant==='three'?grid(3,1,right):variant==='threeColumns'?grid(3,3,right):grid(n-1,variant==='four'?2:3,right))];
 }else if(def.family==='highlight'){
  if(n!==k||![2,3,4].includes(n))return null;
  nodes=grid(n,key.endsWith('central')&&n===4?2:n);
  if(key.endsWith('central')&&n===3)nodes=[rect('',64,185,318,400),rect('',398,154,484,462),rect('',898,185,318,400)];
 }else if(def.family==='bento'){
  if(n!==k)return null;
  if(key.endsWith('asymmetric'))nodes=n===5?[rect('',64,154,370,462),...grid(4,2,{x:450,y:154,w:766,h:462})]:rowsBySpans(n===6?[[1,1,1,1],[1,1]]:[[1,1,1,1],[1,1,1]]);
  else if(key.endsWith('dense'))nodes=n===4?grid(4,4):n===5?rowsBySpans([[1,1,1,1],[1]]):grid(6,3);
  else nodes=n===5?rowsBySpans([[1,1],[1,1,1]]):grid(n,n===6?3:4);
 }else if(def.family==='icon'){
  if(n!==k)return null;nodes=key.endsWith('list')?grid(n,1):grid(n,key.endsWith('grid')?(n===6?3:4):(n===4?4:3));
 }else if(def.family==='media'||def.family==='mediaBento'){
  const expected=def.family==='media'?k:k-maxMedia;if(n!==expected)return null;
  if(!mediaCount){nodes=grid(n,n<=3?n:n===4?2:3);}
  else if(key.endsWith('stagger')){nodes=grid(n,1);nodes=nodes.map((r,i)=>{const on=visible[i],mw=on?352:0;if(on)images.push(rect('media-'+i,r.x,r.y,mw,r.h,'media',{slot:i}));return {...r,x:r.x+(on?mw+20:0),w:r.w-(on?mw+20:0)};});}
  else if(key.endsWith('top')){images.push(rect('media-0',64,154,1152,n===6?184:246,'media',{slot:0}));nodes=grid(n,n===6?3:n,{x:64,y:n===6?354:416,w:1152,h:n===6?262:200});}
  else if(key.endsWith('matrix')){const ir=grid(2,1,{x:64,y:154,w:420,h:462});visible.forEach((on,i)=>{if(on)images.push({...ir[i],id:'media-'+i,role:'media',slot:i});});const perRow=n/2;nodes=visible.flatMap((on,row)=>grid(perRow,perRow,{x:on?504:64,y:154+row*239,w:on?712:1152,h:223}));}
  else if(key.endsWith('dual')){
   if(visible[0])images.push(rect('media-0',64,154,368,462,'media',{slot:0}));
   if(visible[1])images.push(rect('media-1',840,154,376,223,'media',{slot:1}));
   nodes=n===3?[rect('',448,154,376,223),rect('',448,393,376,223),rect('',840,393,376,223)]:[rect('',448,154,376,223),...grid(3,3,{x:448,y:393,w:768,h:223})];
   // Release only the removed image's space, never hide another slot.
   if(!visible[0])nodes=[rect('',64,154,760,223),...grid(n-1,n-1,{x:64,y:393,w:1152,h:223})];
   else if(!visible[1])nodes=grid(n,n===3?1:2,{x:448,y:154,w:768,h:462});
  }else{images.push(rect('media-'+visible.indexOf(true),64,154,420,462,'media',{slot:visible.indexOf(true)}));const right={x:504,y:154,w:712,h:462};nodes=n===3?grid(n,1,right):n===4?grid(n,2,right):rowsBySpans([[1,1],[1,1,1]],right);}
 }else if(chart){
  if(n>k-1||n>4)return null;
  if(!n){images.push(rect('chart',64,154,1152,462,'chart'));nodes=[];}
  else{
  const horizontal=['bar','line'].includes(def.chartType);images.push(rect('chart',64,154,horizontal?1152:540,horizontal?270:462,'chart'));
  nodes=horizontal?grid(n,n,{x:64,y:440,w:1152,h:176}):n===2||n===3?grid(n,1,{x:624,y:154,w:592,h:462}):grid(n,2,{x:624,y:154,w:592,h:462});
  }
 }else if(def.family==='layers'){
  if(n<2||n>6)return null;nodes=grid(n,1,{x:64,y:variant==='house'?194:154,w:1152,h:variant==='house'?382:462,gap:12});
  if(variant==='pyramid')nodes=nodes.map((r,i)=>{const w=620+(1152-620)*(i/Math.max(1,n-1));return {...r,x:64+(1152-w)/2,w};});
  if(variant==='house'&&n>=3)nodes=[rect('',64,194,1152,80),...grid(n-2,n-2,{x:64,y:290,w:1152,h:220}).map(r=>({...r,presentation:'house-pillar'})),rect('',64,526,1152,90)];
 }else if(def.family==='radial'){
  if(n<4||n>9)return null;gridMode=false;nodes=[rect('',520,320,240,132)];for(let i=1;i<n;i++){const a=-Math.PI/2+(i-1)*2*Math.PI/(n-1);nodes.push(rect('',640+450*Math.cos(a)-110,385+175*Math.sin(a)-56,220,112));}
 }else if(def.family==='timeline'){
  if(n!==timelineCount(variant))return null;gridMode=false;nodes=grid(n,n).map((r,i)=>({...r,y:i%2?428:154,h:188}));
 }else if(def.family==='process'){
  if(n<3||n>6)return null;nodes=grid(n,n,{gap:24});
 }else if(def.family==='transformation'){
  if(n<2||n>6||n%2)return null;nodes=grid(n/2,1,{w:500}).concat(grid(n/2,1,{x:716,w:500}));
 }else if(def.family==='table'){
  const rows=p.table?.rows||[];if(n!==1||rows.length<1||rows.length>({four:4,six:6})[variant]||!p.table?.headers?.length)return null;nodes=[rect('',64,154,1152,462)];
  const cw=1152/p.table.headers.length-20,c=cards[0],need=48+(c.label?28:0)+(c.text?hwLines(c.text,1152,14)*20:0)+(c.evidence?25:0)+rows.reduce((sum,row)=>sum+Math.max(...(row.cells||[]).map(v=>hwLines(v,cw,14)*19))+(row.group?16:0)+21,0);if(need>462)return null;
 }else return null;
 nodes=nodes.map((r,i)=>({...r,id:p.layout?.nodes?.[i]?.id||cards[i]?.blockId||'hw-block-'+i}));
 let fontSize;for(const f of [18,17,16,15,14]){if(nodes.every((r,i)=>hwNeededHeight(def,cards[i],r,f,variant)+(p.baselines?.some(b=>b.blockId===r.id)?34:0)<=r.h-3)){fontSize=f;break;}}
 if(!fontSize)return null;
 return {nodes,media:images,gridMode,fontSize,variant:String(variant),maxMedia};
}
export function hwNeededHeight(def,c,r,f,variant){
 if(!c)return Infinity;const w=r.w-32,label=c.label?hwLines(c.label,w,20)*27+8:0,body=c.text?hwLines(c.text,w,f)*f*1.4:0,source=c.evidence?hwLines(c.evidence,w,12)*17+6:0;
 if(def.family==='table')return 60;
 if(def.family==='layers'&&r.presentation!=='house-pillar')return 10+Math.max(c.label?hwLines(c.label,180,18)*24:0,(c.text?hwLines(c.text,r.w-240,f)*f*1.4:0)+(c.evidence?hwLines(c.evidence,r.w-240,11)*15+2:0));
 if(def.family==='radial')return 18+(c.label?hwLines(c.label,w,17)*22:0)+(c.text?hwLines(c.text,w,14)*19.6:0)+source;
 if(def.family==='metrics'){
  const hero=r.x===64,reserve=hero?150:variant==='three'?0:90;
  const textW=variant==='three'?Math.max(100,w-190):w;
  if(!hero&&variant==='three')return 22+(c.label?hwLines(c.label,textW,17)*22:0)+(c.delta?16:0)+(c.text?hwLines(c.text,textW,14)*20:0)+(c.detail?hwLines(c.detail,textW,12)*17+8:0)+source;
  if(!hero&&r.h<300&&variant!=='three')return 36+Math.max(48,c.label?hwLines(c.label,Math.max(80,w-100),18)*24:0)+(c.delta?20:0)+(c.text?hwLines(c.text,w,14)*20:0)+(c.detail?hwLines(c.detail,w,12)*17+10:0)+(c.evidence?hwLines(c.evidence,w,11)*16+4:0);
  return 58+reserve+(c.label?hwLines(c.label,textW,18)*24:0)+(c.delta?20:0)+(c.text?hwLines(c.text,textW,hero?f:14)*(hero?f*1.4:20):0)+(c.detail?hwLines(c.detail,w,13)*18+24:0)+source;
 }
 if(def.family==='highlight')return r.h<300?36+Math.max(48,label)+(c.delta?20:0)+(c.text?hwLines(c.text,w,14)*20:0)+(c.detail?hwLines(c.detail,w,12)*17+10:0)+source:70+label+96+(c.delta?20:0)+body+(c.detail?hwLines(c.detail,w,13)*18+24:0)+source;
 if(def.family==='icon'&&def.layout.endsWith('list'))return 24+Math.max(c.label?hwLines(c.label,190,18)*25:0,(c.text?hwLines(c.text,r.w-330,f)*f*1.4:0)+(c.evidence?hwLines(c.evidence,r.w-330,12)*17+4:0));
 const icon=def.family==='icon'?(def.layout.endsWith('list')?0:64):0;
 const adjusted=def.family==='icon'&&def.layout.endsWith('list')?r.w-110:w;
 return 42+icon+(def.family==='process'?24:0)+(c.label?hwLines(c.label,adjusted,20)*27+8:0)+(c.text?hwLines(c.text,adjusted,f)*f*1.4:0)+source;
}
