import {HW_DEFINITIONS} from '../../src/components/hw/contracts.mjs';
import {validateHwProps,validateHwPlanningCapacity} from '../../assets/hw-template-view.mjs';
import {hwVariant} from '../../assets/hw-template-geometry.mjs';
import {orderedBoardBlocks} from './board-model.mjs';
import {normalizeIconConfig,iconCount} from '../../assets/huawei-icons.mjs';
import {explicitFocusBlockId} from './visual-strategy.mjs';
export const isHwSpecialData=slide=>slide.blocks.some(b=>['metric','table'].includes(b.data?.kind));
export function hwCandidates(slide,document,{variants={},rejections=[]}={}){
 const out=[],blocks=orderedBoardBlocks(slide),edges=(slide.board?.edges||[]).map(v=>({...v,from:v.from.replace(/^block:/,''),to:v.to.replace(/^block:/,'')})),intent=slide.visualIntent||'',metric=blocks.every(b=>b.data?.kind==='metric'),charts=blocks.filter(b=>b.data&&!['metric','table'].includes(b.data.kind)),table=blocks.length===1&&blocks[0].data?.kind==='table',independent=['columns','comparison'].includes(slide.board?.mode)&&!edges.length;
 const chart=charts.length===1?charts[0]:null,data=chart?.data,kind=data?.kind==='share'?'donut':data?.kind;
 for(const def of HW_DEFINITIONS){try{
  if(def.selectionHidden)continue;
  const f=def.family;if(metric!==['metrics','highlight'].includes(f)&&!table&&!chart)continue;
  if(table&&f!=='table'||f==='table'&&!table)continue;
  if(chart&&f!=='chart'||f==='chart'&&(!chart||def.chartType!==kind))continue;
  if(charts.length>1)continue;
  if(f==='bento'&&!independent)continue;
  if(f==='icon'&&(!independent||slide.media?.length))continue;
  if(['media','mediaBento'].includes(f)&&(!independent||!(slide.media?.length||document.brief?.imagePolicy==='placeholders')))continue;
  if(!['media','mediaBento'].includes(f)&&slide.media?.length)continue;
  if(f==='transformation'&&!(slide.board?.mode==='comparison'&&/现状|目标|转型|旧.*新|传统.*新|对照.*组织方式|组织方式.*对照|transformation/i.test(intent)))continue;
  if(f==='layers'&&!(slide.board?.mode==='hierarchy'&&/层|架构|金字塔|策略屋|layer|pyramid|house/i.test(intent)))continue;
  if(f==='radial'&&(!/径向|中心辐射|双向协同|闭环|radial|cycle/i.test(intent)||!edges.length))continue;
  if(f==='radial'){
   const ids=blocks.map(b=>b.blockId),star=edges.every(e=>e.from===ids[0]||e.to===ids[0])&&ids.slice(1).every(id=>edges.some(e=>e.from===id||e.to===id)),cycle=edges.length===ids.length&&ids.every(id=>edges.filter(e=>e.from===id).length===1&&edges.filter(e=>e.to===id).length===1);
   if(!star&&!cycle)continue;
  }
  if(['timeline','process'].includes(f)){
   if(slide.board?.mode!=='flow'||edges.length!==blocks.length-1||edges.some((edge,i)=>edge.from!==blocks[i].blockId||edge.to!==blocks[i+1].blockId||!['sequence','causes'].includes(edge.kind)))continue;
   if(f==='timeline'&&!/时间|里程|timeline|演进/.test(intent))continue;
  }
  if(!['metrics','highlight','chart','table'].includes(f)&&blocks.some(b=>b.data!=null))continue;
  const focus=explicitFocusBlockId(slide),promote=independent&&focus&&(f==='metrics'||def.layout.endsWith('bento_asymmetric')),displayBlocks=promote?[blocks.find(b=>b.blockId===focus),...blocks.filter(b=>b.blockId!==focus)]:blocks;
  const cards=(f==='chart'?blocks.filter(b=>b!==chart):displayBlocks).map(b=>({blockId:b.blockId,label:b.label,text:b.text,evidence:b.evidence,...(metric?{value:b.data.value,unit:b.data.unit||'',delta:b.data.delta||'',detail:b.data.detail||''}:{})}));
  let variant=hwVariant(def,f==='chart'?cards.length+1:f==='mediaBento'?cards.length+(def.layout.endsWith('hero')?1:2):cards.length);
  if(f==='table'){const n=blocks[0].data.rows?.length;variant=n>=1&&n<=4?'four':n<=6?'six':null;}
  if(f==='radial')variant=/闭环|cycle/i.test(intent)?'cycle':/双向|both/i.test(intent)?'both':'hub';
  if(f==='layers')variant=/金字塔|pyramid/i.test(intent)?'pyramid':/策略屋|house/i.test(intent)?'house':'stack';
  if(f==='process')variant=/价值链|value/i.test(intent)?'value':/阶段卡|cards/i.test(intent)?'cards':'chevron';
  if(variants[def.layout]!=null)variant=String(variants[def.layout]);
  // Original artwork has a dedicated page source, not an extra paragraph in
  // every fixed-height card. Keep neutral evidence and map it explicitly there.
  const sources=[...new Set([slide.evidence,...blocks.map(b=>b.evidence)].filter(Boolean))],closing=sources.join('；');
  for(const card of cards)card.evidence='';
  const props={title:slide.title,lead:slide.conclusion,closing,cards,variant:String(variant),layout:{mode:def.layout,nodes:cards.map(c=>({id:c.blockId})),edges},...(f==='icon'?{iconConfig:normalizeIconConfig(slide.visuals?.icons)}:{} )};
  if(metric)props.baselines=blocks.filter(b=>b.data.baseline!=null).map(b=>({blockId:b.blockId,value:b.data.baseline}));
  if(['media','mediaBento'].includes(f)){
   const max=f==='media'?(def.layout.endsWith('stagger')?cards.length:1):def.layout.endsWith('hero')?1:2;
   if(slide.media?.length>max)continue;props.images=(slide.media||[]).map(m=>m.src);props.imageCount=props.images.length||max;
  }
  if(f==='table')props.table={headers:blocks[0].data.headers,rows:blocks[0].data.rows.map(row=>Array.isArray(row)?{cells:row,group:'',emphasis:''}:{...row,emphasis:Array.isArray(row.emphasis)?row.emphasis.join(','):row.emphasis||''})};
  if(f==='chart'){
   if(!Array.isArray(data.labels)||!Array.isArray(data.values)||data.labels.length!==data.values.length)continue;
   props.chart={type:kind,unit:data.unit||'',items:data.labels.map((label,i)=>({label:String(label),value:data.values[i]})),series:data.series||[]};props.caption=chart.label;props.note=chart.text;
   // The faithful chart scaffold has no independent prose-note box. Use its
   // existing page footnote/source region, without adding or moving geometry.
   props.closing=[chart.text,closing].filter(Boolean).join('；');
  }
  const g=validateHwPlanningCapacity(def,props,validateHwProps(def,props));props.layout.nodes=g.nodes.map(r=>({id:r.id,x:r.x,y:r.y,w:r.w,h:r.h,type:blocks.find(b=>b.blockId===r.id)?.type||'paragraph'}));
  const bindings=[{source:'title',target:'props.title',text:slide.title},{source:'conclusion',target:'props.lead',text:slide.conclusion},{source:'evidence',target:'props.closing',text:slide.evidence}],mapped=cards.map((c,i)=>{
   const fields=Object.fromEntries(['label','text','evidence'].map(k=>[k,k==='evidence'?'props.closing':`props.cards[${i}].${k}`]));for(const [source,target]of Object.entries(fields))bindings.push({blockId:c.blockId,source,target,text:blocks.find(b=>b.blockId===c.blockId)?.[source]||''});
   if(metric)for(const k of ['value','unit','delta','detail'])fields['metric'+k[0].toUpperCase()+k.slice(1)]=`props.cards[${i}].${k}`;
   if(metric){const index=props.baselines.findIndex(b=>b.blockId===c.blockId);if(index>=0)fields.metricBaseline=`props.baselines[${index}].value`;}
   if(table)fields.data='props.table';return {blockId:c.blockId,fields,paths:Object.values(fields)};
  });
  if(chart){mapped.unshift({blockId:chart.blockId,fields:{data:'props.chart.items',label:'props.caption',text:'props.closing',evidence:'props.closing'},paths:['props.chart.items','props.caption','props.note','props.closing']});bindings.push({blockId:chart.blockId,source:'label',target:'props.caption',text:chart.label},{blockId:chart.blockId,source:'text',target:'props.closing',text:chart.text},{blockId:chart.blockId,source:'evidence',target:'props.closing',text:chart.evidence});}
  out.push({layout:def.layout,props,titlePaths:['props.title'],blocks:mapped,score:chart?140:65,plan:{version:5,engine:'hw-contract-planner',family:f,mode:f,reason:`匹配 ${def.id} · 档位 ${variant}，完整原子内容与真实数据，生成前再做浏览器实测。`,bindings,nodes:props.layout.nodes,edges,mediaCount:props.imageCount||0,...(f==='icon'?{icons:{count:iconCount(cards,props.layout.nodes,props.iconConfig),capacity:cards.length}}:{}),...(chart?{chart:{blockId:chart.blockId,kind,labels:data.labels,values:data.values,unit:data.unit||''}}:{}),checks:{atomicBlocks:true,separateEvidence:true,estimatedFit:true,needsRenderedValidation:true}}});
 }catch(error){rejections.push({layout:def.layout,code:error.code||'HW_CAPACITY_MISMATCH',reason:error.message,details:error.details}); /* Preserve exact renderer diagnostics for the repair round. */ }}
 return out;
}
