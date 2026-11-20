// Declarative adapters. These describe existing fields, not new template geometry.
const text=(family,regions,extra={})=>({family,regions,kind:'prose',...extra});
const definitions={
 7:text('agenda',[{key:'chapters',label:'zh',body:null}],{requires:'labels-only'}),
 8:text('hierarchy',[{key:'layers',label:'zh',body:'desc'},{key:'steps',label:'label',body:'detail'}],{requiresGroups:true}),
 13:text('flow',[{key:'risks',label:'title',body:'desc',duplicateLabel:'node'}]),
 15:text('conclusion',[{key:'conclusions',label:'title',body:'note'}],{header:'quote'}),
 26:text('media',[{key:'slots',label:'name',body:'role'}]),
 43:text('flow',[{key:'steps',label:'name',body:'note'}],{hidden:['metrics']}),
 55:text('hierarchy',[{key:'pillars',label:'zh',body:'note'}],{header:'quote'}),
 65:text('flow',[{key:'steps',label:'name',body:'note'},{key:'cards',label:'name',body:'note'}],{requiresGroups:true}),
 66:text('flow',[{key:'nodes',label:'name',body:'note'},{key:'metrics',label:'name',body:'note'}],{requiresGroups:true}),
 71:text('columns',[{key:'cards',label:'label',body:'note'}],{hidden:['contacts']}),
};
const budget=(density,maxChars)=>({density,maxChars});
export const originalProfile=layout=>definitions[Number(String(layout).match(/page(\d+)$/)?.[1])]||null;
export function originalCopyBudgets(layout){
 const p=originalProfile(layout);if(!p||p.requires==='labels-only')return {};
 const b={};
 // Old inferred limits followed the length of demo copy (often 36 chars).
 // Keep exact approved CSS; every candidate still requires DOM overflow checks.
 if(p.header!=='quote')b.title=budget('display',32);
 for(const region of p.regions)if(region.body)b[region.key+'[].'+region.body]=budget('body',72);
 return b;
}
export function originalLayoutCapability(page){
 const n=page.pageNumber,p=originalProfile(page.key),fixed=n<=5||[16,46,59,67,68].includes(n);
 return {layout:page.key,label:page.label,group:'original',family:p?.family||'data',adapter:p?'dedicated-regions':'typed-data',fixed,
  regions:p?.regions||[],requiresGroups:!!p?.requiresGroups,
  requirements:fixed?['fixed-brand-page']:p?[...(p.requires?[p.requires]:[]),...(p.requiresGroups?['explicit-region-groups']:[]),'complete-copy','visible-sources','browser-fit']:['real-typed-data','matching-units','complete-copy','browser-fit']};
}
