export const TIMELINE_VARIANTS=['three','four','five','six','seven','eight'];
export const timelineCount=variant=>{const i=TIMELINE_VARIANTS.indexOf(String(variant));return i<0?null:i+3;};
export const timelineVariant=count=>Number.isInteger(count)&&count>=3&&count<=8?TIMELINE_VARIANTS[count-3]:null;
export const timelineOptions=()=>TIMELINE_VARIANTS.map(value=>({value,label:timelineCount(value)+' 个'}));

// Extend the original alternating timeline, without changing the original 4/6
// entries. At 7/8 nodes, opposite-side cards may overlap horizontally, but never
// on the same side of the track. Their original six-node width is retained.
export function timelineEntry(source,count){
 if(!timelineVariant(count))return null;
 const out=structuredClone(source),find=(nodes,cls)=>{for(const n of nodes){if(n.attrs?.class?.split(' ').includes(cls))return n;const child=find(n.children||[],cls);if(child)return child;}};
 const track=find(out.tree,'timeline-track'),pattern=track.children.find(n=>n.attrs?.class==='milestone');
 const width=Math.max((1120-12*(count-1))/count,source.frames[0].w),step=(1120-width)/(count-1);
 function bind(node,index){if(node.bind)node.bind=node.bind.replace(/^cards\.\d+\./,'cards.'+index+'.');if(node.block!=null)node.block=index;for(const c of node.children||[])bind(c,index);}
 track.children=Array.from({length:count},(_,i)=>{const n=structuredClone(pattern);n.attrs={...n.attrs,'data-index':String(i),style:`position:absolute;left:${i*step}px;top:0;width:${width}px;pointer-events:none`};bind(n,i);for(const c of n.children||[])if(c.attrs?.class==='mile-card'||c.attrs?.class==='mile-dot')c.attrs.style=(c.attrs.style||'')+';pointer-events:auto';return n;});
 out.frames=Array.from({length:count},(_,i)=>({x:80+i*step,y:i%2?390:160,w:width,h:156}));
 return out;
}
export function extendTimelineDefinition(source){
 return {...source,variants:Object.fromEntries(TIMELINE_VARIANTS.map(v=>[v,source.variants[v]||timelineEntry(source.variants.six,timelineCount(v))]))};
}
