import {HW_DEFINITIONS} from '../../src/components/hw/contracts.mjs';
import {hwGeometry} from '../../assets/hw-template-geometry.mjs';
import {normalizeDocument} from '../../scripts/content/model.mjs';
import {originalVariantCapacity,originalGeometry} from '../../assets/hw-original-view.mjs';
export function hwFixture(def,variant=def.defaultVariant,countOverride){
 const f=def.family,n=originalVariantCapacity(def,variant,f==='process'?countOverride:undefined)?.cards;
 if(!n)throw new Error('Unsupported fixture capacity: '+def.layout+' '+variant);
 const index=HW_DEFINITIONS.indexOf(def),id='hw-'+index+'-'+variant+'-'+(countOverride||0),cards=Array.from({length:n},(_,i)=>({blockId:id+'-b'+i,label:['需求判断','供给约束','交付保障','组织协作','风险治理','反馈改进','价值运营','能力建设','持续迭代'][i],text:`第${i+1}项：明确责任与验收标准。`,evidence:`测试来源${i+1}`,...(['metrics','highlight'].includes(f)?{value:i===0?-32:21+i,unit:i%2?'天':'%',delta:'对照既定基线',detail:'独立说明：以业务实际效果衡量收益。'}:{})}));
 cards.forEach((c,i)=>{if(c.detail)c.detail=`第${i+1}项独立说明：以业务实际效果衡量收益。`;});
 const edges=[];if(['process','timeline'].includes(f))for(let i=0;i<n-1;i++)edges.push({from:cards[i].blockId,to:cards[i+1].blockId,kind:'sequence',label:''});
 if(f==='layers')for(let i=0;i<n-1;i++)edges.push({from:cards[i].blockId,to:cards[i+1].blockId,kind:'supports',label:''});
 if(f==='radial')for(let i=1;i<n;i++){edges.push({from:cards[0].blockId,to:cards[i].blockId,kind:'supports',label:''});if(variant==='both')edges.push({from:cards[i].blockId,to:cards[0].blockId,kind:'supports',label:''});}if(f==='radial'&&variant==='cycle'){edges.length=0;for(let i=0;i<n;i++)edges.push({from:cards[i].blockId,to:cards[(i+1)%n].blockId,kind:'supports',label:''});}
 const props={title:`${def.id.replace(/^HW-/,'')}：第${index+1}类验收`,lead:`测试档位 ${variant}${countOverride?' / '+countOverride:''}，保留正文、来源与真实数值。`,closing:'隔离验收样稿，数据仅用于测试。',cards,variant:String(variant),layout:{mode:def.layout,nodes:cards.map(c=>({id:c.blockId})),edges}};
 props.lead=`第${index+1}类 · `+props.lead;
 if(f==='icon')props.iconConfig={enabled:true,overrides:{}};
 const maxImages=f==='media'?(def.layout.endsWith('stagger')?n:1):f==='mediaBento'?(def.layout.endsWith('hero')?1:2):0;
 if(maxImages){props.imageCount=maxImages;props.images=Array.from({length:maxImages},(_,i)=>'assets/user-media/hw-'+i+'.png');}
 if(f==='chart'){props.caption='真实数值对照';props.note='遵循原稿0–100数值域';props.chart={type:def.chartType,unit:def.chartType==='radar'?'分':def.chartType==='donut'?'%':'万元',items:['一季度','二季度','三季度','四季度'].map((label,i)=>({label,value:def.chartType==='donut'?[20,30,25,25][i]:def.chartType==='radar'?[65,72,81,59][i]:[24,12,48,36][i]})),series:[]};}
 if(f==='table')props.table={headers:['领域','责任','里程碑'],rows:Array.from({length:variant==='four'?4:6},(_,i)=>({cells:[`领域${i+1}`,`团队${i+1}`,`第${i+1}阶段`],group:i<2?'第一组':'第二组',emphasis:i===0?'1':''}))};
 const g=originalGeometry(def,props);if(g)props.layout.nodes=g.nodes.map(r=>({...r,type:'paragraph'}));
 const slide={slideId:id,role:f==='chart'?'data':f==='transformation'?'comparison':f==='table'?'table':'body',title:props.title,conclusion:props.lead,evidence:props.closing,visualIntent:f==='layers'?'分层架构 '+variant:f==='radial'?'径向中心辐射 '+variant:f==='timeline'?'时间线里程碑':f==='process'?'端到端流程 '+variant:f==='transformation'?'现状到目标转型':def.id,blocks:cards.map(c=>({blockId:c.blockId,label:c.label,text:c.text,evidence:c.evidence,...(['metrics','highlight'].includes(f)?{data:{kind:'metric',value:c.value,unit:c.unit,delta:c.delta,detail:c.detail}}:{}),...(f==='table'?{data:{kind:'table',...props.table}}:{})})),board:{mode:['process','timeline'].includes(f)?'flow':f==='layers'?'hierarchy':f==='transformation'?'comparison':'columns',nodes:[],edges:edges.map(v=>({...v,from:'block:'+v.from,to:'block:'+v.to}))},...(maxImages?{media:props.images.map(src=>({src}))}:{})};
 if(f==='chart')slide.blocks.unshift({blockId:id+'-chart',label:props.caption,text:props.note,evidence:'独立图表来源',data:{kind:def.chartType,unit:props.chart.unit,labels:props.chart.items.map(v=>v.label),values:props.chart.items.map(v=>v.value)}});
 return {id,def,variant:String(variant),props,slide};
}
export function hwCapacityFixtures(){return HW_DEFINITIONS.flatMap(d=>d.variants.flatMap(v=>(d.family==='process'?[3,4,5,6]:[undefined]).map(n=>hwFixture(d,v,n))));}
export const hwDocument=slides=>normalizeDocument({title:'HW 模板整合验收',goal:'检验全部模板档位和完整内容',brief:{workflowMode:'fine',audience:'内部验收',occasion:'功能验收',priority:'无损和稳定',confirmed:true},slides});
