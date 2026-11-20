// Shared, dependency-free Markdown/tree adapter. No HTML from user input is run.
import {defaultBoard} from './board-model.mjs';
const clone=x=>structuredClone(x),newId=prefix=>prefix+'-'+crypto.randomUUID();
export const NODE_NAMES={deck:'主题',slide:'页面论点',block:'内容块',body:'正文',detail:'子要点',conclusion:'核心结论',evidence:'证据 / 来源',visualIntent:'视觉建议',data:'结构化数据'};
// Start with the topic and slide titles only. Descendants remain available on demand.
export function defaultCollapsed(tree){return new Set(indexTree(tree).order.filter(n=>n.kind!=='deck').map(n=>n.id));}
const omit=(value,keys)=>Object.fromEntries(Object.entries(value||{}).filter(([key])=>!keys.includes(key)));
export function bodyText(node,depth=0){
 const own=String(node.text||''),child=(node.children||[]).map(n=>'  '.repeat(depth)+'- '+bodyText(n,depth+1)).join('\n');
 return own+(own&&child?'\n':'')+child;
}
export function cleanContentTree(value,depth=0,seen=new Set()){
 if(!value||depth>12||seen.size>500||typeof value.text!=='string'||!Array.isArray(value.children))throw new Error('正文分支格式无效，或超过 12 层 / 500 节点。');
 const id=String(value.id||'');if(!/^[a-zA-Z0-9_:-]{1,160}$/.test(id)||seen.has(id))throw new Error('正文分支 ID 无效或重复。');seen.add(id);
 return {id,text:value.text,children:value.children.map(n=>cleanContentTree(n,depth+1,seen))};
}
export function reconcileContentTree(value,text){
 if(!value)return null;const original=cleanContentTree(value);if(bodyText(original)===text)return original;
 const suffix=bodyText(original).slice(original.text.length);if(suffix&&text.endsWith(suffix)){const next={...original,text:text.slice(0,text.length-suffix.length)};if(bodyText(next)===text)return next;}
 const root={id:original.id,text:'',children:[],_old:original},stack=[root];let listing=false;
 for(const line of text.split('\n')){
  const m=line.match(/^( *)- (.*)$/);
  if(m){listing=true;const depth=m[1].length/2;if(!Number.isInteger(depth)||depth>12||!stack[depth])return null;const old=stack[depth]._old?.children[stack[depth].children.length],n={id:old?.id||newId('note'),text:m[2],children:[],_old:old};stack[depth].children.push(n);stack[depth+1]=n;stack.length=depth+2;}
  else if(!listing)root.text+=(root.text?'\n':'')+line;else return null;
 }
 const strip=n=>({id:n.id,text:n.text,children:n.children.map(strip)});const next=strip(root);return bodyText(next)===text?next:null;
}
export function documentToTree(doc){
 const root={id:'deck',kind:'deck',text:doc.title||'',meta:omit(doc,['title','slides']),children:[]};
 for(const s of doc.slides){
  const page={id:'s:'+s.slideId,kind:'slide',slideId:s.slideId,text:s.title,meta:{...omit(s,['title','conclusion','evidence','visualIntent','blocks']),mindmapBlockOrder:s.blocks.map(b=>b.blockId)},children:[]};
  for(const field of ['conclusion','evidence','visualIntent'])if(s[field])page.children.push({id:'f:'+s.slideId+':'+field,kind:field,slideId:s.slideId,text:s[field],children:[]});
  for(const b of s.blocks){
   const node={id:'b:'+b.blockId,kind:'block',slideId:s.slideId,blockId:b.blockId,text:b.label,meta:omit(b,['label','text','evidence','data','contentTree']),children:[]};
   const body=b.contentTree&&bodyText(b.contentTree)===b.text?clone(b.contentTree):{id:'t:'+b.blockId,text:b.text,children:[]};
   const hydrate=n=>({...n,kind:n===body?'body':'detail',slideId:s.slideId,blockId:b.blockId,children:n.children.map(hydrate)});
   node.children.push(hydrate(body));
   if(b.evidence)node.children.push({id:'e:'+b.blockId,kind:'evidence',slideId:s.slideId,blockId:b.blockId,text:b.evidence,children:[]});
   if(b.data!=null)node.children.push({id:'d:'+b.blockId,kind:'data',slideId:s.slideId,blockId:b.blockId,text:JSON.stringify(b.data,null,2),children:[]});
   page.children.push(node);
  }
  root.children.push(page);
 }
 return root;
}
export function indexTree(root){
 const nodes=new Map(),parents=new Map(),order=[];const walk=(n,p,depth)=>{if(depth>20||order.length>8000||!n||nodes.has(n.id))throw new Error('脑图包含循环、重复 ID 或节点过多。');nodes.set(n.id,n);if(p)parents.set(n.id,p);order.push(n);for(const c of n.children||[])walk(c,n,depth+1);};walk(root,null,0);return {nodes,parents,order};
}
export function treeToDocument(root){
 indexTree(root);if(root.kind!=='deck'||!root.children.length||root.children.some(n=>n.kind!=='slide'))throw new Error('中心主题下必须有至少一个页面分支。');
 const doc={...clone(root.meta||{}),title:root.text,slides:[]};
 for(const p of root.children){
  const s={...clone(omit(p.meta||{},['mindmapBlockOrder'])),slideId:p.slideId,title:p.text,conclusion:'',evidence:'',visualIntent:'',blocks:[]};
  const seen=new Set();
  for(const n of p.children){
   if(['conclusion','evidence','visualIntent'].includes(n.kind)){if(seen.has(n.kind)||n.children.length)throw new Error('页面字段重复或包含不支持的子层级。');seen.add(n.kind);s[n.kind]=n.text;continue;}
   if(n.kind!=='block')throw new Error('页面下只允许内容块、结论、来源和视觉建议。');
   const b={...clone(n.meta||{}),blockId:n.blockId,label:n.text,type:n.meta?.type||'paragraph',text:'',evidence:''};const fields=new Set();
   for(const f of n.children){
    if(!['body','evidence','data'].includes(f.kind)||fields.has(f.kind))throw new Error('内容块字段重复或类型无效。');fields.add(f.kind);
    if(f.kind==='body'){const strip=v=>({id:v.id,text:v.text,children:v.children.map(strip)});const tree=cleanContentTree(strip(f));b.text=bodyText(tree);if(tree.children.length)b.contentTree=tree;}
    else if(f.kind==='evidence'){if(f.children.length)throw new Error('证据节点请使用正文编辑，不支持子分支。');b.evidence=f.text;}
    else{if(f.children.length)throw new Error('数据节点不能增加子分支。');try{b.data=JSON.parse(f.text);}catch{throw new Error('结构化数据不是有效 JSON，未保存。');}}
   }
   s.blocks.push(b);
  }
  if(p.children.filter(n=>n.kind==='block').length>100)throw new Error('单页内容块超过 100 个。');
  if(JSON.stringify(p.meta?.mindmapBlockOrder)!==JSON.stringify(s.blocks.map(b=>b.blockId))){
   const original=s.board,board=defaultBoard(s,original?.mode);const allowed=new Set(s.blocks.map(b=>'block:'+b.blockId));
   if(original?.edges.some(e=>e.label||e.kind!=='sequence'||!e.edgeId?.startsWith('sequence-')))board.edges=original.edges.filter(e=>(!e.from.startsWith('block:')||allowed.has(e.from))&&(!e.to.startsWith('block:')||allowed.has(e.to)));
   s.board=board;
  }
  doc.slides.push(s);
 }
 return doc;
}
export function createChild(root,id){
 const {nodes,parents}=indexTree(root),n=nodes.get(id);if(!n)throw new Error('节点不存在。');let child;
 if(n.kind==='deck'){const slideId=newId('slide');child={id:'s:'+slideId,kind:'slide',slideId,text:'新页面观点',meta:{slideId,role:'body',status:'editing',version:1},children:[]};}
 else if(n.kind==='slide'){const blockId=newId('block');child={id:'b:'+blockId,kind:'block',slideId:n.slideId,blockId,text:'新内容块',meta:{blockId,type:'paragraph'},children:[{id:'t:'+blockId,kind:'body',slideId:n.slideId,blockId,text:'',children:[]}]};}
 else if(n.kind==='block'){let body=n.children.find(c=>c.kind==='body');if(!body){body={id:'t:'+n.blockId,kind:'body',slideId:n.slideId,blockId:n.blockId,text:'',children:[]};n.children.unshift(body);}return createChild(root,body.id);}
 else if(['body','detail'].includes(n.kind))child={id:newId('note'),kind:'detail',slideId:n.slideId,blockId:n.blockId,text:'新子要点',children:[]};
 else throw new Error('此字段不支持子主题；请选择页面、内容块或正文节点。');
 n.children.push(child);return child.id;
}
export function createSibling(root,id){
 const {nodes,parents}=indexTree(root),n=nodes.get(id),p=parents.get(id);if(!p)return createChild(root,id);
 if(!['slide','block','detail'].includes(n.kind))return createChild(root,p.kind==='block'?p.id:n.slideId?'s:'+n.slideId:'deck');
 const newId=createChild(root,p.id),after=p.children.pop();p.children.splice(p.children.indexOf(n)+1,0,after);return newId;
}
export function addField(root,id,kind){
 const {nodes,parents}=indexTree(root);let n=nodes.get(id);while(n&&!['slide','block'].includes(n.kind))n=parents.get(n.id);
 if(!n||!(n.kind==='slide'?['conclusion','evidence','visualIntent']:['body','evidence','data']).includes(kind))throw new Error('此节点不支持该字段。');
 const old=n.children.find(c=>c.kind===kind);if(old)return old.id;
 const f={id:newId('field'),kind,slideId:n.slideId,...(n.blockId?{blockId:n.blockId}:{}),text:kind==='data'?'{"kind":"bar","labels":[],"values":[],"unit":""}':'',children:[]};n.children.push(f);return f.id;
}
export function removeNode(root,id){
 const {nodes,parents}=indexTree(root),n=nodes.get(id),p=parents.get(id);if(!p)throw new Error('不能删除中心主题。');if(n.kind==='slide'&&root.children.length===1)throw new Error('至少保留一页。');p.children.splice(p.children.indexOf(n),1);return p.id;
}
export function moveNode(root,id,targetId,position='child'){
 const {nodes,parents}=indexTree(root),n=nodes.get(id),target=nodes.get(targetId),old=parents.get(id);if(!n||!target||!old||id===targetId)throw new Error('不能移动到该位置。');
 for(let p=target;p;p=parents.get(p.id))if(p.id===id)throw new Error('不能把节点移动到自己的后代。');
 let parent=position==='child'?target:parents.get(targetId);if(!parent)throw new Error('目标层级无效。');
 if(!((n.kind==='slide'&&parent.kind==='deck')||(n.kind==='block'&&parent.kind==='slide')||(n.kind==='detail'&&['body','detail'].includes(parent.kind))))throw new Error('页面只可排序，内容块可跨页移动，子要点可在正文内调整层级。');
 old.children.splice(old.children.indexOf(n),1);const at=position==='child'?parent.children.length:parent.children.indexOf(target)+(position==='after'?1:0);parent.children.splice(at,0,n);
 const slide=parent.kind==='slide'?parent:parents.get(parent.id);const slideId=parent.slideId||slide?.slideId;const blockId=parent.kind==='block'?parent.blockId:parent.blockId;
 const refresh=x=>{if(slideId)x.slideId=slideId;if(n.kind==='detail'&&blockId)x.blockId=blockId;for(const c of x.children)refresh(c);};refresh(n);return n.id;
}
export function shiftNode(root,id,delta){
 const {parents}=indexTree(root),p=parents.get(id);if(!p)throw new Error('中心主题不能排序。');const i=p.children.findIndex(n=>n.id===id),to=i+delta;if(to<0||to>=p.children.length)return id;const [n]=p.children.splice(i,1);p.children.splice(to,0,n);return id;
}
export function duplicateBranch(root,id){
 const idx=indexTree(root),n=idx.nodes.get(id),p=idx.parents.get(id);if(!p||!['slide','block','detail'].includes(n?.kind))throw new Error('请选择页面、内容块或子要点进行复制。');
 const copy=clone(n),slides=new Map(),blocks=new Map();const scan=x=>{if(x.kind==='slide')slides.set(x.slideId,newId('slide'));if(x.kind==='block')blocks.set(x.blockId,newId('block'));x.children.forEach(scan);};scan(copy);
 const mapped=s=>{if(!s?.startsWith('block:'))return s;return 'block:'+(blocks.get(s.slice(6))||s.slice(6));};
 const renew=x=>{
  x.slideId=slides.get(x.slideId)||x.slideId;if(x.blockId)x.blockId=blocks.get(x.blockId)||x.blockId;
  x.id=x.kind==='slide'?'s:'+x.slideId:x.kind==='block'?'b:'+x.blockId:x.kind==='body'?'t:'+x.blockId:x.kind==='detail'?newId('note'):x.kind==='evidence'&&x.blockId?'e:'+x.blockId:x.kind==='data'?'d:'+x.blockId:'f:'+x.slideId+':'+x.kind;
  if(x.meta){if(x.meta.slideId)x.meta.slideId=slides.get(x.meta.slideId)||x.meta.slideId;if(x.meta.blockId)x.meta.blockId=blocks.get(x.meta.blockId)||x.meta.blockId;if(x.meta.mindmapBlockOrder)x.meta.mindmapBlockOrder=x.meta.mindmapBlockOrder.map(id=>blocks.get(id)||id);if(x.meta.board){x.meta.board.nodes.forEach(n=>n.nodeId=mapped(n.nodeId));x.meta.board.edges.forEach(e=>{e.from=mapped(e.from);e.to=mapped(e.to);});}}
  x.children.forEach(renew);
 };renew(copy);p.children.splice(p.children.indexOf(n)+1,0,copy);return copy.id;
}
export function indentNode(root,id,out=false){
 const {nodes,parents}=indexTree(root),n=nodes.get(id),p=parents.get(id);if(n?.kind!=='detail')throw new Error('只有正文子要点支持缩进 / 取消缩进。');
 if(out){const g=parents.get(p.id);if(!g||!['body','detail'].includes(g.kind))throw new Error('已经是最外层子要点。');return moveNode(root,id,p.id,'after');}
 const i=p.children.indexOf(n),previous=p.children[i-1];if(!previous||previous.kind!=='detail')throw new Error('前面没有可作为父主题的子要点。');return moveNode(root,id,previous.id,'child');
}
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const encode=s=>html(s).replace(/\r/g,'&#13;').replace(/\n/g,'<br>');
const decode=s=>s.replace(/<br>/g,'\n').replace(/&#13;/g,'\r').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
export function treeToMarkdown(root){
 indexTree(root);const lines=['<!-- dashi-mindmap:1; metadata preserves stable IDs and PPT content roles -->'];
 const walk=(n,depth)=>{const meta=omit(n,['text','children']);const marker=JSON.stringify(meta).replace(/</g,'\\u003c').replace(/>/g,'\\u003e');lines.push((depth===0?'# ':'  '.repeat(depth-1)+'- ')+encode(n.text)+` <!-- dashi:${marker} -->`);n.children.forEach(c=>walk(c,depth+1));};walk(root,0);return lines.join('\n')+'\n';
}
export const documentToMarkdown=doc=>treeToMarkdown(documentToTree(doc));
export function markdownToTree(markdown,base){
 if(typeof markdown!=='string'||markdown.length>4*1024*1024)throw new Error('Markdown 为空或超过 4 MB。');
 if(!markdown.includes('<!-- dashi:'))return plainMarkdownTree(markdown,base);
 let root;const stack=[];
 for(const [i,line]of markdown.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  if(!line.trim()||line.startsWith('<!-- dashi-mindmap:'))continue;
  const match=line.match(/^(# |( *)- )(.*?) <!-- dashi:(\{.*\}) -->$/);if(!match)throw new Error(`第 ${i+1} 行不符合脑图 Markdown 结构，请保留节点元数据注释。`);
  const depth=match[1]==='# '?0:(match[2].length/2)+1;if(!Number.isInteger(depth))throw new Error('Markdown 缩进必须使用两个空格。');
  let meta;try{meta=JSON.parse(match[4]);}catch{throw new Error(`第 ${i+1} 行元数据无效。`);}if(!NODE_NAMES[meta.kind]||typeof meta.id!=='string'||!/^[\w:-]{1,160}$/.test(meta.id))throw new Error('Markdown 节点类型或 ID 无效。');
  const node={...meta,text:decode(match[3]),children:[]};if(depth===0){if(root)throw new Error('只允许一个中心主题。');root=node;}else{if(!stack[depth-1])throw new Error(`第 ${i+1} 行层级跳跃。`);stack[depth-1].children.push(node);}stack[depth]=node;stack.length=depth+1;
 }
 if(!root)throw new Error('缺少中心主题。');treeToDocument(root);return root;
}
function plainMarkdownTree(md,base){
 const root=documentToTree(base||{title:'新汇报',slides:[]});root.children=[];let page,block,body;const stack=[];
 for(const line of md.split(/\r?\n/)){
  if(/^# /.test(line)){root.text=line.slice(2);continue;}
  if(/^## /.test(line)){const id=createChild(root,'deck');page=indexTree(root).nodes.get(id);page.text=line.slice(3);block=body=null;continue;}
  if(/^### /.test(line)){if(!page)throw new Error('内容块之前需要 ## 页面标题。');const id=createChild(root,page.id);block=indexTree(root).nodes.get(id);block.text=line.slice(4);body=block.children[0];stack.length=0;continue;}
  if(!line.trim())continue;if(!page)throw new Error('请使用 # 主题、## 页面、### 内容块及缩进列表。');
  if(!body){const id=createChild(root,page.id);block=indexTree(root).nodes.get(id);block.text='正文';body=block.children[0];}
  const m=line.match(/^( *)(?:[-*] )(.+)$/);if(m){const depth=Math.floor(m[1].length/2),parent=depth?stack[depth-1]:body;if(!parent)throw new Error('列表缩进跳跃。');const id=createChild(root,parent.id),n=indexTree(root).nodes.get(id);n.text=m[2];stack[depth]=n;stack.length=depth+1;}
  else body.text+=(body.text?'\n':'')+line;
 }
 treeToDocument(root);return root;
}
export function layoutMindmap(root,collapsed=new Set()){
 const index=indexTree(root),positions=[],links=[],gap=22,col=350;
 const measure=n=>{const w=n.kind==='deck'?250:n.kind==='slide'?286:276,font=n.kind==='deck'?18:n.kind==='slide'?16:14,units=[...String(n.text||NODE_NAMES[n.kind])].reduce((v,c)=>v+(c.charCodeAt(0)>255?1:.6),0),lines=Math.min(4,Math.max(1,Math.ceil(units*font/(w-32)))),h=Math.max(50,26+lines*font*1.5);return {w,h};};
 const size=new Map();function span(n){const own=measure(n),children=collapsed.has(n.id)?[]:n.children;const height=Math.max(own.h,children.reduce((v,c)=>v+span(c),0)+Math.max(0,children.length-1)*gap);size.set(n.id,{...own,span:height});return height;}span(root);
 function place(n,depth,top){const s=size.get(n.id),box={id:n.id,kind:n.kind,text:n.text,x:60+depth*col,y:top+(s.span-s.h)/2,w:s.w,h:s.h,depth,childCount:n.children.length};positions.push(box);let y=top;for(const c of collapsed.has(n.id)?[]:n.children){place(c,depth+1,y);const b=positions.find(p=>p.id===c.id);links.push({from:n.id,to:c.id,x1:box.x+box.w,y1:box.y+box.h/2,x2:b.x,y2:b.y+b.h/2});y+=size.get(c.id).span+gap;}}place(root,0,50);
 return {nodes:positions,links,width:Math.max(...positions.map(p=>p.x+p.w))+80,height:size.get(root.id).span+100,index};
}
export function mindmapSvg(layout){
 const lines=layout.links.map(l=>`<path d="M${l.x1} ${l.y1}C${(l.x1+l.x2)/2} ${l.y1},${(l.x1+l.x2)/2} ${l.y2},${l.x2} ${l.y2}" fill="none" stroke="#b8b8b8" stroke-width="2"/>`).join('');
 const nodes=layout.nodes.map(n=>{const words=[...String(n.text||NODE_NAMES[n.kind])],rows=[],perLine=Math.floor((n.w-32)/15);for(let i=0;i<Math.min(words.length,perLine*4);i+=perLine)rows.push(words.slice(i,i+perLine).join(''));if(!rows.length)rows.push(NODE_NAMES[n.kind]);return `<g><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="9" fill="${n.kind==='deck'?'#c7000b':'#fff'}" stroke="${n.kind==='slide'?'#c7000b':'#dbdbdb'}"/><text font-family="Arial,Microsoft YaHei,sans-serif" font-size="15" fill="${n.kind==='deck'?'#fff':'#222'}">${rows.slice(0,4).map((s,i)=>`<tspan x="${n.x+16}" y="${n.y+25+i*20}">${html(s)}</tspan>`).join('')}</text></g>`;}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><rect width="100%" height="100%" fill="#fafafa"/>${lines}${nodes}</svg>`;
}
