export const PROCESS_COUNTS=[3,4,5,6];
export const processCountValid=n=>Number.isInteger(n)&&PROCESS_COUNTS.includes(n);
export function processEntry(entry,count){
 if(!processCountValid(count))return null;
 if(count===6)return entry; // Keep every original six-step coordinate and style.
 const out=structuredClone(entry),gap=entry.tree.some(function has(n){return n.attrs?.['data-variant']==='chevron'||(n.children||[]).some(has);})?5:entry.tree.some(function has(n){return n.attrs?.['data-variant']==='value'||(n.children||[]).some(has);})?0:12;
 function walk(n){if(n.attrs?.class?.split(' ').includes('process-chain')){n.attrs.style=(n.attrs.style||'')+';grid-template-columns:repeat('+count+',minmax(0,1fr));';n.children=(n.children||[]).filter(c=>c.block==null||c.block<count);}for(const c of n.children||[])walk(c);}
 out.tree.forEach(walk);const first=entry.frames[0],width=(1152-gap*(count-1))/count;out.frames=Array.from({length:count},(_,i)=>({...first,x:64+i*(width+gap),w:width}));return out;
}
