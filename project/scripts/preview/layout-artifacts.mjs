import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {neighborLayouts} from '../content/layout-policy.mjs';

export const modelPattern=/<script id="deck-view-model" type="application\/json">([\s\S]*?)<\/script>/;
export function readModel(html){const m=modelPattern.exec(html);if(!m)throw new Error('演示文件缺少页面模型');return JSON.parse(m[1]);}
export function sectionRanges(html){const tags=/<\/?section\b[^>]*>/gi,ranges=[];let depth=0,start=0,m;while((m=tags.exec(html))){if(/^<\/section/i.test(m[0])){if(--depth===0)ranges.push({start,end:tags.lastIndex,html:html.slice(start,tags.lastIndex)});}else{if(depth++===0)start=m.index;}}return ranges;}
export function findSection(html,id){return sectionRanges(html).find(r=>new RegExp(`data-vm-slide-id=["']${String(id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["']`).test(r.html));}
export function cacheArtifact(root,artifact){const id='layout-'+createHash('sha256').update(JSON.stringify(artifact)).digest('hex').slice(0,32),dir=path.join(root,'.layout-cache');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify({...artifact,id}));return {...artifact,id};}
export function readArtifact(root,id,slideId){if(!/^layout-[a-f0-9]{32}$/.test(id||''))throw new Error('版式快照标识无效');const a=JSON.parse(fs.readFileSync(path.join(root,'.layout-cache',id+'.json'),'utf8'));if(a.slideId!==slideId)throw new Error('版式快照与页面不匹配');return a;}
// Only server-produced, content-validated artifacts may alter the saved deck DOM/model.
export function applyLayoutArtifacts(html,state,root){
 if(!state.layoutOverrides)return html;
 const vm=readModel(html);for(const [slideId,id]of Object.entries(state.layoutOverrides)){
  const a=readArtifact(root,id,slideId),range=findSection(html,slideId),i=vm.slides.findIndex(s=>s.id===slideId);if(!range||i<0)throw new Error('找不到版式快照的目标页');
  if(a.modelSlide.layout!==vm.slides[i].layout&&neighborLayouts(vm.slides,slideId).has(a.modelSlide.layout)){const error=new Error('目标版式与相邻正文页相同，未应用候选；当前页面已保留。');error.code='ADJACENT_LAYOUT_REPEAT';throw error;}
  const key=vm.slides[i].key||slideId,escape=v=>String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const section=a.html.replace(/<section\b[^>]*>/i,tag=>{for(const [field,value]of Object.entries({'data-vm-slide-id':slideId,'data-vm-slide-key':key,'data-vm-index':i})){const attribute=new RegExp(`${field}=["'][^"']*["']`,'i');tag=attribute.test(tag)?tag.replace(attribute,()=>`${field}="${escape(value)}"`):tag.replace(/>$/,()=>` ${field}="${escape(value)}">`);}return tag;});
  html=html.slice(0,range.start)+section+html.slice(range.end);vm.slides[i]={...a.modelSlide,key};
 }
 return html.replace(modelPattern,()=>`<script id="deck-view-model" type="application/json">${JSON.stringify(vm).replaceAll('<','\\u003c')}</script>`);
}
