export function canonicalLayoutInput(input={}){
 const props={...(input.props||{})};delete props.renderSlot;
 for(const key of ['editorShapeStyles','editorTextStyles'])if(props[key]==null||typeof props[key]==='object'&&!Array.isArray(props[key])&&!Object.keys(props[key]).length)delete props[key];
 const edits=[...(input.edits||[])].map(e=>({before:e.before,after:e.after})).sort((a,b)=>{const x=JSON.stringify(a),y=JSON.stringify(b);return x<y?-1:x>y?1:0;});
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>[k,stable(v[k])])):v;
 return stable({slideId:input.slideId,sourceLayout:input.sourceLayout,props,edits});
}
export function layoutInputChanges(before={},after={}){
 const a=canonicalLayoutInput(before),b=canonicalLayoutInput(after),keys=new Set([...Object.keys(a.props),...Object.keys(b.props)]),changed=[...keys].filter(k=>JSON.stringify(a.props[k])!==JSON.stringify(b.props[k])),groups=[];
 if(a.sourceLayout!==b.sourceLayout)groups.push('layout');
 if(changed.some(k=>/image|media/i.test(k)))groups.push('images');
 if(changed.some(k=>/chart|series|table|rows|data/i.test(k)))groups.push('data');
 if(JSON.stringify(a.edits)!==JSON.stringify(b.edits)||changed.some(k=>!/image|media|chart|series|table|rows|data|editor|font|color|accent|decoration|emphasis|focus|show/i.test(k)))groups.push('content');
 if(changed.some(k=>/editor|font|color|accent|decoration|emphasis|focus|show/i.test(k)))groups.push('style');
 return {changed:JSON.stringify(a)!==JSON.stringify(b),groups:[...new Set(groups)],propKeys:changed};
}
if(typeof window!=='undefined')window.__layoutIdentity={canonical:canonicalLayoutInput,changes:layoutInputChanges};
