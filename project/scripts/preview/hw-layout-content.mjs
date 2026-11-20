import {hwDefinition} from '../../src/components/hw/contracts.mjs';
import {validateHwProps} from '../../assets/hw-template-view.mjs';
import {normalizeOriginalProps,originalDefinition} from '../../assets/hw-original-view.mjs';
import {normalizeDocument} from '../content/model.mjs';
import {normalizeIconConfig} from '../../assets/huawei-icons.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {applyConsoleContent} from './console-content.mjs';

// Native HW pages are already structured, including rich source-only fields.
// This is deliberately NOT an arbitrary legacy HTML/text scraper.
export function importHwLayoutContent(modelSlide, {props={},edits=[]}={},mediaRoot) {
 const def=hwDefinition(modelSlide.layout);if(!def)return null;
 const p=normalizeOriginalProps(def,structuredClone({...modelSlide.props,...props}));
 // Exact text edits not represented by the live field snapshot are folded into
 // one unique source scalar. Never assign a fragment to an unrelated card.
 const scalars=[];const walk=(v,parent,key)=>{if(typeof v==='string')scalars.push({parent,key,value:v});else if(v&&typeof v==='object')for(const [k,item]of Object.entries(v))if(!['blockId','id','src'].includes(k))walk(item,v,k);};walk(p);
 for(const edit of edits){if(edit.before===edit.after||scalars.some(s=>s.parent[s.key]===edit.after))continue;const matches=scalars.filter(s=>s.parent[s.key]===edit.before);if(matches.length!==1)throw new Error('HW 页有一处文字修改无法唯一归属，已保留原页。请保存或完成当前文字编辑后重试。');matches[0].parent[matches[0].key]=edit.after;}
 validateHwProps(def,p);
 const id=modelSlide.id,join=parts=>parts.filter(v=>v!=null&&String(v).trim()).map(String).join('\n');
 const cards=p.cards.map(c=>({blockId:c.blockId,type:'paragraph',label:c.label||'',
  text:join([c.heading,c.date,c.text,...(c.items||[]),c.meta,c.output]),evidence:c.evidence||'',
  origin:{hw:{layout:def.layout,card:structuredClone(c)}},
  ...(['metrics','highlight'].includes(def.family)&&!(c.pendingValue===true&&c.value===null)?{type:'data',data:{kind:'metric',value:c.value,unit:c.unit||'',delta:c.delta||'',detail:c.detail||'',...(p.baselines?.some(b=>b.blockId===c.blockId)?{baseline:p.baselines.find(b=>b.blockId===c.blockId).value}:{})}}:{})}));
 if(def.family==='table')cards[0].data={kind:'table',...structuredClone(p.table)};
 if(def.family==='chart')cards.unshift({blockId:id.slice(0,100)+'-chart',type:'data',label:p.caption||'',text:p.note||'',evidence:'',data:{kind:p.chart.type,unit:p.chart.unit||'',labels:p.chart.items.map(i=>i.label),values:p.chart.items.map(i=>i.value),...(p.chart.series?.length?{series:structuredClone(p.chart.series)}:{})}});
 // Optional copy is part of the original composition, not automatically a
 // citation. Retain every used textual source slot as ordinary supplementary
 // content, separately from the page's actual source field.
 const entry=originalDefinition(def.layout).variants[String(p.variant)],keys=new Set();
 const used=node=>{if(node.bind?.startsWith('original.'))keys.add(node.bind.slice(9));for(const child of node.children||[])used(child);};entry.tree.forEach(used);
 if(def.family==='chart')for(const k of ['chartCenterLabel','chartLegend'])if(p.original?.[k])keys.add(k);
 const extras=[...keys].map(k=>p.original?.[k]).filter(v=>typeof v==='string'&&v.trim());
 if(extras.length)cards.push({blockId:id.slice(0,96)+'-supplement',type:'paragraph',label:'',text:extras.join('\n'),evidence:'',origin:{hw:{copyKeys:[...keys]}}});
 const ids=cards.map(c=>c.blockId),rawEdges=p.layout?.edges||[],edges=rawEdges.map((e,i)=>({edgeId:e.edgeId||'source-'+i,from:'block:'+e.from.replace(/^block:/,''),to:'block:'+e.to.replace(/^block:/,''),kind:e.kind||'sequence',label:e.label||''}));
 const mode=['timeline','process'].includes(def.family)?'flow':def.family==='transformation'?'comparison':def.family==='layers'?'hierarchy':def.family==='radial'?'free':'columns';
 if(!edges.length&&mode==='flow')for(let i=0;i<p.cards.length-1;i++)edges.push({edgeId:'source-'+i,from:'block:'+ids[i],to:'block:'+ids[i+1],kind:'sequence',label:''});
 if(!edges.length&&def.family==='radial')for(let i=1;i<p.cards.length;i++)edges.push({edgeId:'source-'+i,from:'block:'+ids[0],to:'block:'+ids[i],kind:'supports',label:''});
 const media=(p.images||[]).flatMap((v,i)=>{const visible=Array.isArray(p.__mediaSlotVisibility?.imageCount)?p.__mediaSlotVisibility.imageCount[i]!==false:i<Number(p.imageCount||0)&&p.imageVisible?.[i]!==false;if(!v||!visible)return [];let src=typeof v==='string'?v:v.src;
  if(src?.startsWith('data:')){const m=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(src);if(!m||!mediaRoot)throw new Error('请先将本次上传保存为本地图片，再切换版式。');const bytes=Buffer.from(m[2],'base64');if(bytes.length>12*1024*1024)throw new Error('图片超过单张 12 MB 的换版限制。');src='assets/user-media/layout-'+createHash('sha256').update(bytes).digest('hex').slice(0,24)+'.'+(m[1]==='jpeg'?'jpg':m[1]);const file=path.join(mediaRoot,src);fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file))fs.writeFileSync(file,bytes);}
  return [{src}];});
 return normalizeDocument(applyConsoleContent({title:p.title,goal:p.title,slides:[{slideId:id,role:def.family==='table'?'table':'body',title:p.title,conclusion:p.lead||'',evidence:def.family==='chart'&&p.note&&(p.closing===p.note||p.closing?.startsWith(p.note+'；'))?p.closing.slice(p.note.length).replace(/^；/,''):p.closing||'',status:'confirmed',blocks:cards,board:{mode,edges},visualIntent:def.family,...(def.family==='icon'?{visuals:{icons:normalizeIconConfig(p.iconConfig)}}:{}),...(media.length?{media}:{})}]},p));
}
