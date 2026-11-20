import {WorkbenchError} from './model.mjs';
import {chartTypeBoundary} from '../../assets/chart-item-contracts.mjs';

export function validateChartData(slide){
 const blocks=slide.blocks.filter(b=>b.data!=null),block=blocks[0];
 const fail=(message,issues=[],code='CHART_DATA_REQUIRED')=>{
  const error=new WorkbenchError(`第 ${slide.order||'?'} 页「${slide.title}」${block?` / ${block.label||block.blockId}`:''}：${message}`,422,code);
  error.details={slideId:slide.slideId,blockId:block?.blockId,issues};throw error;
 };
 if(blocks.length!==1)fail('每页需要一个独立图表；多个图表请先确认拆页或各自的呈现方式。',[],'CHART_LAYOUT_REQUIRED');
 const d=block.data;
 if(!d||typeof d!=='object'||Array.isArray(d))fail('图表数据必须是包含 kind、labels、values 的对象。',['data: expected object']);
 if(!Array.isArray(d.labels)||!Array.isArray(d.values))fail('图表必须提供 labels 和 values 两个数组。',[`labels: ${Array.isArray(d.labels)?'array':'missing/invalid'}`,`values: ${Array.isArray(d.values)?'array':'missing/invalid'}`]);
 if(d.labels.length!==d.values.length)fail(`标签与数值数量不一致（labels ${d.labels.length} 项，values ${d.values.length} 项），请逐项对应，不会补造数据。`,['labels.length != values.length']);
 const issues=[];
 for(let i=0;i<d.values.length;i++){
  if(typeof d.values[i]!=='number'||!Number.isFinite(d.values[i]))issues.push(`values[${i}]: 必须为有限数值，不能是字符串、空值或缺项`);
  if(!((typeof d.labels[i]==='string'&&d.labels[i].trim())||(typeof d.labels[i]==='number'&&Number.isFinite(d.labels[i]))))issues.push(`labels[${i}]: 标签不能为空或为对象`);
 }
 if(issues.length)fail('部分标签或数值无效，请修正下列数据项；合法负值无需修改。',issues);
 const kind=d.kind==='share'?'donut':d.kind;
 if(!['bar','column','donut','waterfall','line','area','radar'].includes(kind))fail('图表类型应为 bar、column、donut/share、waterfall、line、area 或 radar。',['kind: unsupported'],'CHART_LAYOUT_REQUIRED');
 const boundary=chartTypeBoundary(kind);
 if(d.values.length<boundary.min||d.values.length>boundary.max)fail(`${kind} 支持 ${boundary.min===boundary.max?boundary.min:boundary.min+'–'+boundary.max} 项数据，当前 ${d.values.length} 项；请确认分组、拆图或其他图表，不会截断数据。`,[`items: ${boundary.min}..${boundary.max}`],'CHART_ITEM_CAPACITY');
 if(['line','area'].includes(kind)&&d.values.some(v=>v<0||v>100))fail('当前折线/面积原稿采用 0–100 数值域；请选择适配真实单位的图表，或先审批调整坐标尺度，不能改写真实数据。',['values: original chart domain [0,100]'],'CHART_DOMAIN_REVIEW_REQUIRED');
 if(kind==='radar'&&(d.values.length!==4||d.values.some(v=>v<0||v>100)))fail('雷达图恰好四维，数值必须在 0–100。',['values: four dimensions in [0,100]']);
 if(kind==='donut'){
  const negatives=d.values.flatMap((v,i)=>v<0?[`values[${i}] (${d.labels[i]}): 占比图不能使用负值`]:[]);
  if(negatives.length)fail('占比图不能包含负值。若要展示涨跌或负电价，请选择 bar、column 或 waterfall；不要取绝对值。',negatives);
  if(Math.abs(d.values.reduce((a,b)=>a+b,0)-100)>=.001)fail('占比图数值合计必须为 100%；请核实数据或改用比较图，不会自动归一化。',['values: percentage sum must equal 100']);
 }
 if(kind==='waterfall'&&!Number.isFinite(d.values.reduce((a,b)=>a+b,0)))fail('瀑布图累计数值超出可计算范围。',['values: cumulative overflow']);
 return {block,data:d,kind};
}
