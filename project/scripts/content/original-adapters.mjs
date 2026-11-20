import {THEME_PAGES} from '../skill-workflow-utils.mjs';
import {originalProfile} from '../../src/original-layout-profiles.mjs';
import {blankLayoutProps,setControl,emptyValue,showContentRegion} from './layout-props.mjs';
import {orderedBoardBlocks} from './board-model.mjs';
import {charLength} from '../workflow/copy-contract.mjs';

const fit=(s,b)=>typeof b?.maxChars==='number'&&charLength(s||'')<=b.maxChars;
export function originalCandidates(slide,document,{header,media,validate,rejections}){
 const result=[];
 for(const page of THEME_PAGES.filter(p=>originalProfile(p.key))){const profile=originalProfile(page.key);try{
  if(slide.blocks.some(b=>b.data!=null))throw Error('此正文适配器不接收数据对象；需要真实指标/图表适配器');
  const blank=blankLayoutProps(page.key),{inspection,record,props}=blank,bindings=[],all=orderedBoardBlocks(slide),groups=new Map();
  if(profile.requiresGroups){for(const b of all){const region=b.origin?.presentation?.layout===page.key?b.origin.presentation.region:null;if(!profile.regions.some(r=>r.key===region))throw Error('多区域版式需要明确的内容分区；可审阅分组候选，不自动按数量分割');if(!groups.has(region))groups.set(region,[]);groups.get(region).push(b);}}
  else groups.set(profile.regions[0].key,all);
  const edges=slide.board?.edges||[],mode=slide.board?.mode||'columns';
  if(edges.length){const chain=groups.get(profile.regions[0].key)||[];if(profile.family!=='flow'||edges.length!==chain.length-1||edges.some((e,i)=>!['sequence','causes'].includes(e.kind)||e.label||e.from!=='block:'+chain[i].blockId||e.to!=='block:'+chain[i+1].blockId))throw Error('原稿构图不能完整表达这些连线；需关系适配确认');}
  if(['flow','comparison','hierarchy','free'].includes(mode)&&profile.family!==mode)throw Error('目标版式不能保留当前流程/对比/层级/自由关系');
  if(profile.family==='flow'&&mode!=='flow')throw Error('步骤版式需要原稿明确的先后关系，不把独立观点硬连为流程');
  const titlePaths=header(slide,blank,bindings,{quote:profile.header==='quote'});
  const used=new Set(profile.regions.map(r=>r.key));
  for(const array of inspection.fillPlan.arrays.filter(a=>!a.key.includes('[].')&&!used.has(a.key))){
   const binding=inspection.countBindings.find(b=>b.arrays.includes(array.key));
   const toggle=({metrics:'showMetrics',contacts:'showContact',tags:'showTags'})[array.key];
   if(binding?.min===0){props[array.key]=[];setControl(props,record,binding.key,0);}else if(toggle&&record.controls.some(c=>c.key===toggle)){props[array.key]=[];setControl(props,record,toggle,false);}else throw Error('辅助区域 '+array.key+' 需要明确内容映射，不保留样例或自动删区');
  }
  for(const region of profile.regions){const blocks=groups.get(region.key)||[],array=inspection.fillPlan.arrays.find(a=>a.key===region.key),binding=inspection.countBindings.find(b=>b.arrays.includes(region.key));
   if(!array||blocks.length<Math.max(1,binding?.min||1)||blocks.length>array.maxCount)throw Error(region.key+' 容量不匹配：当前 '+blocks.length+'，支持 '+Math.max(1,binding?.min||1)+'–'+array?.maxCount);
   props[region.key]=blocks.map((b,index)=>{if(!fit(b.label,array.itemFields[region.label]))throw Error('内容块标题超出 '+region.key+' 标题容量');if(!region.body&&b.text)throw Error('此目录只有标题槽，不能丢弃正文');if(region.body&&!fit(b.text,array.itemFields[region.body]))throw Error('完整正文超出 '+region.key+' 容量，需要审阅精炼/拆页候选');const item=Object.fromEntries(Object.keys(array.itemFields).map(k=>[k,emptyValue(record.defaultProps[region.key]?.[0]?.[k])]));item[region.label]=b.label;if(region.body)item[region.body]=b.text;if(region.duplicateLabel)item[region.duplicateLabel]=b.label;for(const k of ['no','idx'])if(k in item)item[k]=String(index+1).padStart(2,'0');bindings.push({blockId:b.blockId,source:'label',target:`props.${region.key}[${index}].${region.label}`,text:b.label});if(region.body)bindings.push({blockId:b.blockId,source:'text',target:`props.${region.key}[${index}].${region.body}`,text:b.text});return item;});if(binding)setControl(props,record,binding.key,blocks.length);
  }
  for(const region of profile.regions)if(groups.get(region.key)?.length)showContentRegion(props,record,region.key);
  for(const toggle of ['showConclusions','showPillars','showSource','showLabels'])setControl(props,record,toggle,true);
  let mediaCount=media(slide,document,blank);if(page.pageNumber===26){if(document.brief?.imagePolicy!=='placeholders'&&(slide.media?.length||0)<all.length)throw Error('图谱要求每块对应图片，或明确授权空图片槽');mediaCount=all.length;setControl(props,record,'imageCount',all.length);}
  const blocks=all.map(b=>({blockId:b.blockId,fields:Object.fromEntries(bindings.filter(v=>v.blockId===b.blockId).map(v=>[v.source,v.target])),paths:bindings.filter(v=>v.blockId===b.blockId).map(v=>v.target)}));
  result.push(validate(slide,{layout:page.key,props,titlePaths,blocks,score:105,plan:{version:4,engine:'original-dedicated-adapter',family:profile.family,mode,bindings,mediaCount,regions:[...groups].map(([key,bs])=>({key,blockIds:bs.map(b=>b.blockId)})),reason:'原始版式专用字段映射；保留完整标题、正文、来源和显式关系，不修改原稿构图。',checks:{atomicBlocks:true,separateEvidence:true,needsRenderedValidation:true}}}));
 }catch(error){rejections.push({layout:page.key,code:'ORIGINAL_ADAPTER_REQUIREMENT',reason:error.message});}}
 return result;
}
