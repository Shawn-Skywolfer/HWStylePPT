import fs from 'node:fs';import path from 'node:path';
import {atomicJson} from '../content/store.mjs';
import {readArtifact} from './layout-artifacts.mjs';
const file=root=>path.join(root,'.layout-history/index.json');
const read=root=>fs.existsSync(file(root))?JSON.parse(fs.readFileSync(file(root),'utf8')):{version:1,pages:{}};
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export function samePageContent(a,b){const project=d=>{const s=d.slides[0];return {title:s.title,conclusion:s.conclusion||'',evidence:s.evidence||'',media:s.media||[],blocks:s.blocks.map(v=>({id:v.blockId,label:v.label,text:v.text,evidence:v.evidence,data:v.data??null,media:v.media||[]})),edges:(s.board?.edges||[]).map(e=>({from:e.from,to:e.to,kind:e.kind,label:e.label||''}))};};return JSON.stringify(stable(project(a)))===JSON.stringify(stable(project(b)));}
function valid(root,id,slideId){try{return readArtifact(root,id,slideId);}catch{return null;}}
export function preserveCompletedTaskHistory(root,jobs){
 for(const job of jobs.filter(j=>j.status==='applied')){
  const base=valid(root,job.resultId,job.slideId)||valid(root,job.input?.baseArtifactId||job.input?.artifactId,job.slideId);
  if(base)pageVersions(root,{...base,vm:{state:{layoutOverrides:{[job.slideId]:base.id}}}});
 }
}
export function pageVersions(root,base){
 const slideId=base.slideId||base.modelSlide.id,state=read(root),saved=state.pages[slideId]||{original:null,entries:[]},jobsFile=path.join(root,'.layout-tasks/state.json'),jobs=fs.existsSync(jobsFile)?JSON.parse(fs.readFileSync(jobsFile,'utf8')).jobs||[]:[];
 const applied=jobs.filter(j=>j.slideId===slideId&&j.status==='applied').sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))),add=(id,at)=>{if(id&&valid(root,id,slideId)&&!saved.entries.some(e=>e.id===id))saved.entries.push({id,at:at||new Date().toISOString()});};
 for(const j of applied){const before=j.input?.baseArtifactId||j.input?.artifactId;add(before,j.createdAt);add(j.resultId,j.appliedAt||j.completedAt);}
 if(!saved.original){const first=applied.map(j=>j.input?.baseArtifactId||j.input?.artifactId).find(id=>valid(root,id,slideId));if(first)saved.original=first;else if(!base.vm?.state?.layoutOverrides?.[slideId]&&base.id)saved.original=base.id;}
 add(saved.original);add(base.id);state.pages[slideId]=saved;atomicJson(file(root),state);
 return {original:saved.original,entries:saved.entries.map(e=>({...e,artifact:valid(root,e.id,slideId)})).filter(e=>e.artifact),notice:saved.original?'原始快照独立保留，不受当前推荐版式过滤。':'旧预览未找到可验证的最初快照；只列已有快照，不猜测原稿。'};
}
export function requirePageVersion(root,base,id){const history=pageVersions(root,base),entry=history.entries.find(e=>e.id===id);if(!entry)throw new Error('此版本不属于当前页面的可验证历史，未修改页面。');return entry.artifact;}
