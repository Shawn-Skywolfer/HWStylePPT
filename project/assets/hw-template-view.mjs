import {hwGeometry,hwLines,hwUnits} from './hw-template-geometry.mjs';
import {iconAssignment,iconSvg} from './huawei-icons.mjs';
import {originalGeometry,originalMarkup,originalVariantIssue,originalDefinition} from './hw-original-view.mjs';
import {validateOriginalChartDomain} from './hw-original-chart.mjs';
import {chartSeriesContracts} from './chart-item-contracts.mjs';
import {HW_BODY_FONT_INCREASE_PX} from './hw-typography.mjs';
export const hwEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=hwEscape,boxStyle=r=>`left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;`;
export function validateHwChart(chart,expected){
 const {min, max:maximum}=chartSeriesContracts('theme17_chart_hw_'+expected,{chart:{type:expected}})[0];
 if(!chart||chart.type!==expected||!Array.isArray(chart.items)||chart.items.length<min||chart.items.length>maximum)throw new Error(`HW_CHART_INVALID：此图表需要 ${min===maximum?min:min+'–'+maximum} 项对应的结构化数据`);
 if(chart.items.some(v=>typeof v.value!=='number'||!Number.isFinite(v.value)||typeof v.label!=='string'||!v.label.trim()||hwUnits(v.label)>36))throw new Error('HW_CHART_INVALID：数值必须有限、标签非空且不超过安全长度');
 if(chart.unit!=null&&hwUnits(chart.unit)>18)throw new Error('HW_CHART_INVALID：单位过长');
 if(expected==='donut'&&(chart.items.some(v=>v.value<0)||Math.abs(chart.items.reduce((s,v)=>s+v.value,0)-100)>.001))throw new Error('HW_CHART_INVALID：饼图须非负且合计为 100%');
 if(expected==='radar'&&(chart.items.length!==4||chart.items.some(v=>v.value<0||v.value>100)))throw new Error('HW_CHART_INVALID：雷达图恰好四维，数值为 0–100');
 if(!Number.isFinite(Math.max(0,...chart.items.map(i=>i.value))-Math.min(0,...chart.items.map(i=>i.value))))throw new Error('HW_CHART_INVALID：数值跨度超出可计算范围，请调整合法单位后重新确认');
 if(chart.series?.length>1||chart.series?.some(s=>s.values||s.data||s.items))throw new Error('HW_CHART_INVALID：当前版式为单数据系列；多系列请先确认专用版式，不丢弃其他系列');
 return chart;
}
export function validateHwProps(def,p){
 if(!p||typeof p.title!=='string'||!p.title.trim()||hwUnits(p.title)>33||hwUnits(p.lead)>100||hwUnits(p.closing)>150)throw new Error('HW_CONTENT_OVERFLOW：标题、结论或来源超出容量');
 const variantIssue=originalVariantIssue(def,p);if(variantIssue)throw new Error('HW_VARIANT_CAPACITY：'+variantIssue);const g=originalGeometry(def,p);
 if(p.emphasisIndex!=null&&(!Number.isInteger(p.emphasisIndex)||p.emphasisIndex<-1||p.emphasisIndex>=p.cards.length))throw new Error('HW_EMPHASIS_INVALID：重点内容索引超出本页内容块。');
 if(p.layout?.edges?.some(edge=>edge.label))throw new Error('HW_STYLE_APPROVAL_REQUIRED：原稿没有此关系标签的位置；请先审批标注位置，不自动新增或隐藏关系标签。');
 if(['metrics','highlight'].includes(def.family)&&p.cards.some(c=>!c.label||!(c.pendingValue===true&&c.value===null)&&(typeof c.value!=='number'||!Number.isFinite(c.value)||hwUnits(String(c.value)+c.unit)>14)))throw new Error('HW_METRIC_REQUIRED：每项必须提供真实有限数值和独立单位，不能自动补零');
 if(p.baselines&&(!Array.isArray(p.baselines)||new Set(p.baselines.map(b=>b.blockId)).size!==p.baselines.length||p.baselines.some(b=>!p.cards.some(c=>c.blockId===b.blockId)||typeof b.value!=='number'||!Number.isFinite(b.value))))throw new Error('HW_BASELINE_INVALID：基线须为现有指标对应的真实有限数值');
 if(def.family==='chart'){
  validateHwChart(p.chart,def.chartType);validateOriginalChartDomain(def,p);const r=g.media.find(n=>n.role==='chart'),n=p.chart.items.length;
  const [width,height,font]=def.chartType==='bar'?[48,(r.h-126)/n,12]:def.chartType==='donut'?[r.w*.28,42,13]:def.chartType==='radar'?[116,40,13]:def.chartType==='column'?[(r.w-100)/n-2,44,12]:[76,42,12];
  if(p.chart.items.some(v=>hwLines(v.label,width,font)*font*1.3>height+1))throw new Error('HW_CHART_LABEL_OVERFLOW：标签过长或数据项过密；请使用更宽的版式或确认精炼标签');
 }
 if(def.family==='table'){
  const t=p.table;if(t.headers.length<2||t.headers.length>6||t.headers.some(v=>!String(v).trim()||hwUnits(v)>24)||t.rows.some(r=>!Array.isArray(r.cells)||r.cells.length!==t.headers.length||r.cells.some(c=>typeof c!=='string'||hwUnits(c)>120)))throw new Error('HW_TABLE_INVALID：表头/行列数量或单元格内容不合法');
 }
 return g;
}
export function validateHwPlanningCapacity(def,p,g=validateHwProps(def,p)){
 // Original artwork remains fixed. Reject obviously over-capacity prose before
 // planning marks a page ready; estimates use the original family's body scale,
 // not by shrinking text. Browser validation remains the final authority.
 if(def.family==='mediaBento'){
  const compact=originalDefinition(def.layout)?.variants[String(p.variant)]?.className?.includes('capacity-compact'),font=(compact?11.5:13)+HW_BODY_FONT_INCREASE_PX,titleFont=(compact?13:15)+HW_BODY_FONT_INCREASE_PX;
  for(const [i,r] of g.nodes.entries()){
   const c=p.cards[i],width=Math.max(40,r.w-(compact?30:38)),bodyLines=hwLines(c.text||'',width,font)+(/[a-zA-Z]{3,}/.test(c.text||'')?1:0),titleLines=hwLines(c.label||'',Math.max(40,r.w-(compact?26:34)),titleFont),headingFont=(compact?15:18)+HW_BODY_FONT_INCREASE_PX;
   // Match the source's title band, body padding and the h3 bottom margin,
   // including an empty h3. Whole Latin words can force an extra wrap line.
   const needed=(compact?18:24)+titleLines*titleFont*1.4+(compact?24:32)+(compact?6:9)+(c.heading?hwLines(c.heading,width,headingFont)*headingFont*1.35:0)+bodyLines*font*1.55;
   if(needed>r.h-2)throw new Error('HW_CONTENT_OVERFLOW：内容块“'+(c.label||c.blockId)+'”超过原稿图文卡片的实际标题带与正文区容量；请使用更宽松档位或生成内容适配候选，不缩字、不裁切。');
  }
 }
 if(['bento','icon','media','mediaBento','chart'].includes(def.family))for(const [i,r]of g.nodes.entries()){
  const c=p.cards[i],width=Math.max(40,r.w-32),font=(def.family==='bento'&&(def.layout.endsWith('dense')||['6','7','8'].includes(String(p.variant)))?12.5:def.family==='mediaBento'?13:14)+HW_BODY_FONT_INCREASE_PX,body=hwLines(c.text||'',width,font)*font*1.55,label=c.label?hwLines(c.label,width,16+HW_BODY_FONT_INCREASE_PX)*(21+HW_BODY_FONT_INCREASE_PX*1.3):0,heading=c.heading?hwLines(c.heading,width,17+HW_BODY_FONT_INCREASE_PX)*(22+HW_BODY_FONT_INCREASE_PX*1.3):0,source=c.evidence?hwLines(c.evidence,width,12)*17:0;
  if(body+label+heading+source+24>r.h+1)throw new Error('HW_CONTENT_OVERFLOW：内容块“'+(c.label||c.blockId)+'”超过当前原稿文字区容量；请完整拆页或选择更宽松的版式，不会缩字或截断。');
 }
 // In the source artwork the four-card central-highlight variant leaves one
 // body line below the fixed-size number/delta region. Do not advertise its
 // array field's large character limit as available layout space.
 if(def.layout==='theme17_content_hw_highlight_central'&&String(p.variant)==='4')for(const [i,r]of g.nodes.entries()){
  const c=p.cards[i],text=[c.text,c.detail].filter(Boolean).join('\n');if(text&&hwLines(text,Math.max(40,Math.min(192,r.w-56)),14+HW_BODY_FONT_INCREASE_PX)>1)throw new Error('HW_CONTENT_OVERFLOW：内容块“'+(c.label||c.blockId)+'”在中央指标四块原稿档位仅有一行解释区；请使用其他指标版式或较少块数，不缩小字体、不裁切正文。');
 }
 return g;
}
const field=(tag,name,value,extra='')=>`<${tag} data-content-field="${name}" ${extra}>${e(value)}</${tag}>`;
function hwTextCard(def,c,r,f,p,i){
 const icon=def.family==='icon'?iconAssignment(c,r.id,p.iconConfig):null,list=def.layout.endsWith('icon_list'),band=/bento_2x3|icon_band/.test(def.layout);
 const padding=list?'12px 18px 12px 90px':'18px',iconHtml=icon?.visible?`<div class="hw-local-icon" data-icon-block="${e(r.id)}" style="${list?'position:absolute;left:18px;top:12px;':'height:56px;margin-bottom:8px;'}">${iconSvg(icon.id,icon)}</div>`:'';
 return `<article class="hw-pack-card${band?' hw-pack-band':''}" data-content-block="${e(r.id)}" data-block-type="${e(p.layout?.nodes?.[i]?.type||'paragraph')}" style="${boxStyle(r)}padding:${padding};font-size:${f}px;${list?'display:grid;grid-template-columns:190px 1fr;gap:0 16px;align-content:center;':''}">${iconHtml}${field('h2','label',c.label,list?'style="grid-row:1/3;margin:0;font-size:18px"':'')}${field('p','text',c.text,list?'style="grid-column:2"':'')}${field('p','evidence',c.evidence,`class="hw-pack-source" ${list?'style="grid-column:2;margin-top:4px!important"':''}`)}</article>`;
}
function hwMetrics(def,p,g){return g.nodes.map((r,i)=>{const c=p.cards[i],base=p.baselines?.find(b=>b.blockId===r.id),hero=def.family==='metrics'&&i===0,three=def.family==='metrics'&&g.variant==='three'&&i>0,columns=g.variant==='threeColumns',highlight=def.family==='highlight';let baseline='';
 if(base){const max=Math.max(Math.abs(c.value),Math.abs(base.value),1),bar=(v,y,color)=>`<rect x="${v<0?50-Math.abs(v)/max*48:50}" y="${y}" width="${Math.abs(v)/max*48}" height="4" fill="${color}"/>`;baseline=`<div class="hw-baseline" style="font-size:11px;line-height:15px;margin-top:3px">基线 ${e(base.value)}${e(c.unit)}<svg viewBox="0 0 100 14" width="100" height="14" style="display:block;position:static">${bar(base.value,1,'#aaa')}${bar(c.value,8,'#c7000b')}</svg></div>`;}
 return `<article class="hw-pack-card hw-metric${hero?' hw-metric-hero':''}${three?' hw-metric-row':''}${r.h<300&&!three?' hw-metric-compact':''}" data-content-block="${e(r.id)}" style="${boxStyle(r)}font-size:${g.fontSize}px">${field('h2','label',c.label)}<div class="hw-metric-value" style="font-size:${hero?82:three?38:highlight?58:42}px"><span data-hw-metric-value>${e(c.pendingValue===true&&c.value===null?'待补充':c.value)}</span><span class="hw-metric-unit">${e(c.unit)}</span></div>${c.delta?`<div class="hw-metric-delta">${e(c.delta)}</div>`:''}${field('p','text',c.text)}${c.detail||baseline?`<div class="hw-metric-detail${columns?' two-part':''}">${e(c.detail)}${baseline}</div>`:''}${field('p','evidence',c.evidence,'class="hw-pack-source"')}</article>`;
 }).join('');}
function hwMedia(g,p){return g.media.filter(r=>r.role==='media').map(r=>{const image=p.images?.[r.slot],src=typeof image==='string'?image:image?.src;return `<figure data-dashi-host-image-slot="true" data-dashi-image-index="${r.slot}" data-hw-media="${r.slot}" style="position:absolute;${boxStyle(r)}margin:0;cursor:pointer">${src?`<img src="${e(src)}" alt="${e(image?.alt||'')}" style="width:100%;height:100%;object-fit:cover"><button data-hw-media-clear="${r.slot}" data-editable-skip="true" data-export-exclude="true" aria-label="取消图片" class="hw-media-clear">×</button>`:'<div class="hw-media-empty">点击上传图片</div>'}</figure>`;}).join('');}
function hwCommon(def,p,g){
 if(def.family==='table'){
  const c=p.cards[0],r=g.nodes[0],t=p.table;
  return `<article data-content-block="${e(r.id)}" class="hw-table-block" style="position:absolute;${boxStyle(r)}">${field('h2','label',c.label)}${field('p','text',c.text)}<table class="hw-native-table"><thead><tr>${t.headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row=>`<tr>${row.cells.map((cell,j)=>`<td${row.emphasis?.includes(j)?' class="hw-cell-emphasis"':''}>${row.group&&j===0?`<small>${e(row.group)}</small>`:''}${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>${field('p','evidence',c.evidence,'class="hw-pack-source"')}</article>`;
 }
 return g.nodes.map((r,i)=>{const c=p.cards[i],layer=def.family==='layers'&&r.presentation!=='house-pillar',radial=def.family==='radial',process=def.family==='process',cls=layer?' hw-layer':radial?' hw-radial':process?' hw-process':'';
  return `<article class="hw-pack-card${cls}" data-content-block="${e(r.id)}" style="${boxStyle(r)}font-size:${radial?14:g.fontSize}px;${layer?'display:grid;grid-template-columns:180px 1fr;gap:0 20px;align-content:center;':''}">${field('h2','label',c.label,`style="${layer?'grid-row:1/3;background:#dbdbdb;padding:6px;font-size:18px;':radial?'font-size:17px;':process&&g.variant==='chevron'?'background:#dbdbdb;clip-path:polygon(0 0,90% 0,100% 50%,90% 100%,0 100%);padding:10px 16px 10px 8px;':''}"`)}${field('p','text',c.text)}${field('p','evidence',c.evidence,'class="hw-pack-source"')}</article>`;
 }).join('');
}
function hwRelations(def,p,g){const nodes=new Map(g.nodes.map(r=>[r.id,r]));nodes.set('meta:conclusion',{x:64,y:94,w:1152,h:44});nodes.set('meta:title',{x:64,y:40,w:1152,h:44});nodes.set('meta:evidence',{x:64,y:622,w:950,h:40});
 let paths='',labels='';for(const [i,edge]of(p.layout?.edges||[]).entries()){
  const a=nodes.get(edge.from),b=nodes.get(edge.to);if(!a||!b)throw new Error('HW_RELATION_INVALID：关系节点未映射');
  let ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2;const dx=bx-ax,dy=by-ay,ar=Math.min(a.w/2/(Math.abs(dx)||1),a.h/2/(Math.abs(dy)||1)),br=Math.min(b.w/2/(Math.abs(dx)||1),b.h/2/(Math.abs(dy)||1));ax+=dx*ar;ay+=dy*ar;bx-=dx*br;by-=dy*br;
  paths+=`<path data-relation-id="${i}" data-relation-from="${e(edge.from)}" data-relation-to="${e(edge.to)}" data-relation-kind="${e(edge.kind)}" d="M${ax} ${ay}L${bx} ${by}" fill="none" stroke="#999" stroke-width="1.3"/>`;
  if(edge.label)labels+=`<span class="hw-edge-label" data-relation-id="${i}" style="position:absolute;left:${(ax+bx)/2-44}px;top:${(ay+by)/2-8}px;width:88px;font-size:11px;background:#fff;text-align:center">${e(edge.label)}</span>`;
 }
 if(def.family==='timeline')paths+='<path d="M64 385H1216" fill="none" stroke="#c7000b" stroke-width="2"/>';
 if(def.family==='transformation')paths+='<path d="M590 385H688l-14 -10m14 10l-14 10" fill="none" stroke="#c7000b" stroke-width="3"/>';
 if(def.family==='layers'&&g.variant==='house')paths+='<path d="M64 186L640 154L1216 186M64 520H1216" fill="none" stroke="#aaa" stroke-width="2"/>';
 return `<svg class="hw-pack-links" viewBox="0 0 1280 720">${paths}</svg>${labels}`;
}
function hwChartView(def,p,g){const chart=validateHwChart(p.chart,def.chartType),r=g.media.find(n=>n.role==='chart'),items=chart.items,n=items.length,c=['#c7000b','#777','#aaa','#dbdbdb','#ededed','#555'];let svg='',labels='';const local=(x,y,w,h,value,style='')=>`<div class="hw-chart-label" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${style}">${e(value)}</div>`;
 const W=r.w,H=r.h,pad={l:52,t:def.chartType==='bar'?64:84,r:def.chartType==='bar'?102:48,b:def.chartType==='bar'?62:80},plot={x:pad.l,y:pad.t,w:W-pad.l-pad.r,h:H-pad.t-pad.b},lo=Math.min(0,...items.map(v=>v.value)),rawHi=Math.max(0,...items.map(v=>v.value)),hi=rawHi===lo?rawHi+1:rawHi,range=hi-lo,yy=v=>plot.y+(hi-v)/range*plot.h,zero=yy(0);
 if(def.chartType==='donut'){
  const cx=W*.4,cy=H*.53,rr=Math.min(W*.23,H*.28),circ=2*Math.PI*rr;let at=0;
  items.forEach((v,i)=>{const length=v.value/100*circ;svg+=`<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${c[i%c.length]}" stroke-width="${rr*.42}" stroke-dasharray="${length} ${circ-length}" stroke-dashoffset="${-at}" transform="rotate(-90 ${cx} ${cy})"/>`;at+=length;labels+=local(W*.7,68+i*(H-100)/n,W*.28,42,`${v.label} ${v.value}%`,'font-size:13px');});
 }else if(def.chartType==='radar'){
  const cx=W/2,cy=H/2+12,rr=Math.min(W*.32,H*.32),point=(i,v)=>[cx+Math.sin(i*Math.PI/2)*rr*v/100,cy-Math.cos(i*Math.PI/2)*rr*v/100];
  for(const level of[25,50,75,100])svg+=`<polygon points="${items.map((_,i)=>point(i,level).join(',')).join(' ')}" fill="none" stroke="#dbdbdb"/>`;
  svg+=`<polygon points="${items.map((v,i)=>point(i,v.value).join(',')).join(' ')}" fill="#c7000b" fill-opacity=".12" stroke="#c7000b" stroke-width="2"/>`;
  items.forEach((v,i)=>{const [x,y]=point(i,119);labels+=local(x-58,y-18,116,40,`${v.label} ${v.value}`,'text-align:center;font-size:13px');});
 }else if(def.chartType==='bar'){
  const base=plot.x+(0-lo)/range*plot.w;items.forEach((v,i)=>{const h=plot.h/n,y=plot.y+i*h,w=Math.abs(v.value)/range*plot.w,x=v.value<0?base-w:base;svg+=`<rect x="${x}" y="${y+5}" width="${w}" height="${Math.max(2,h-10)}" fill="${i===0?c[0]:c[3]}"/>`;labels+=local(0,y,48,h,v.label,'font-size:12px')+local(W-96,y,92,h,v.value,'font-size:12px');});svg+=`<path d="M${base} ${plot.y}V${plot.y+plot.h}" stroke="#888"/>`;
 }else{
  const step=plot.w/Math.max(n-1,1),points=items.map((v,i)=>[plot.x+i*step,yy(v.value)]);
  if(['line','area'].includes(def.chartType)){
   if(def.chartType==='area')svg+=`<path d="M${plot.x} ${zero}L${points.map(a=>a.join(' ')).join('L')}L${plot.x+plot.w} ${zero}Z" fill="#c7000b" fill-opacity=".12"/>`;
   svg+=`<path d="M${points.map(a=>a.join(' ')).join('L')}" fill="none" stroke="#c7000b" stroke-width="2.5"/>`;
   points.forEach(([x,y],i)=>{svg+=`<circle cx="${x}" cy="${y}" r="3" fill="#c7000b"/>`;labels+=local(x-34,y-25,68,22,items[i].value,'text-align:center;font-size:13px')+local(x-38,plot.y+plot.h+8,76,42,items[i].label,'text-align:center;font-size:12px');});
  }else{const col=plot.w/n;items.forEach((v,i)=>{const x=plot.x+i*col+col*.18,y=Math.min(zero,yy(v.value)),h=Math.abs(yy(v.value)-zero);svg+=`<rect x="${x}" y="${y}" width="${col*.64}" height="${h}" fill="${i===n-1?c[0]:c[3]}"/>`;labels+=local(x-8,yy(v.value)+(v.value<0?6:-26),col*.8,24,v.value,'font-size:13px;text-align:center')+local(plot.x+i*col,plot.y+plot.h+8,col-2,44,v.label,'font-size:12px;text-align:center');});}
  svg+=`<path d="M${plot.x} ${plot.y}V${plot.y+plot.h}M${plot.x} ${zero}H${plot.x+plot.w}" fill="none" stroke="#999"/>`;labels+=local(0,plot.y-10,48,22,hi,'font-size:12px')+local(0,plot.y+plot.h-10,48,22,lo,'font-size:12px');
 }
 if(chart.series?.[0]?.label)labels+=local(16,35,W*.55,20,chart.series[0].label,'font-size:12px;justify-content:flex-start');
 const chartHtml=`<div class="hw-chart-plot" data-hw-chart="${e(def.chartType)}" style="position:absolute;${boxStyle(r)}"><div style="font-size:17px;font-weight:700;padding:8px 16px">${e(p.caption)}</div><div style="font-size:12px;position:absolute;right:12px;top:35px">${e(chart.unit?'单位：'+chart.unit:'')}</div><svg viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;width:100%;height:100%">${svg}</svg>${labels}<div style="position:absolute;left:16px;bottom:2px;right:16px;font-size:12px">${e(p.note)}</div></div>`;
 return chartHtml+g.nodes.map((r,i)=>hwTextCard(def,p.cards[i],r,g.fontSize,p,i)).join('');
}
export function hwMarkup(def,p,pageNumber=1){const g=validateHwProps(def,p);
 return originalMarkup(def,p,pageNumber);
 /* Retained temporarily for source-history comparison; never used as a fallback.
 let content;if(['metrics','highlight'].includes(def.family))content=hwMetrics(def,p,g);else if(['transformation','layers','table','radial','timeline','process'].includes(def.family))content=hwCommon(def,p,g);else if(def.family==='chart')content=hwChartView(def,p,g);else content=g.nodes.map((r,i)=>hwTextCard(def,p.cards[i],r,g.fontSize,p,i)).join('');
 content='<style>.hw-content.hw-pack .hw-pack-card>[data-content-field]{position:static;left:auto;top:auto;max-height:none}.hw-content.hw-pack>[data-content-field]{position:absolute}.hw-pack .hw-metric-compact{grid-template-rows:48px auto 1fr auto auto}.hw-pack .hw-metric-compact>.hw-metric-delta{grid-row:2}.hw-pack .hw-metric-compact>[data-content-field=text]{grid-row:3}.hw-pack .hw-metric-compact>.hw-metric-detail{grid-row:4}.hw-pack .hw-metric-compact>[data-content-field=evidence]{grid-row:5}</style>'+content;
 const style=`.hw-pack,.hw-pack *{box-sizing:border-box;font-family:Arial,'Microsoft YaHei',sans-serif;font-style:normal!important}.hw-pack{position:relative;width:1280px;height:720px;background:#fff;color:#181818}.hw-pack h1,.hw-pack h2,.hw-pack p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.hw-pack>h1{position:absolute;left:64px;top:36px;width:1152px;height:50px;display:flex;align-items:center;font-size:34px;line-height:1.25;font-weight:700}.hw-pack>.hw-pack-lead{position:absolute;left:64px;top:94px;width:1152px;height:48px;font-size:17px;line-height:1.4;color:#555}.hw-pack>.hw-pack-evidence{position:absolute;left:64px;top:626px;width:950px;max-height:32px;font-size:12px;line-height:1.35;color:#666}.hw-pack-card{position:absolute;display:flex;flex-direction:column;border:1px solid #dbdbdb;background:#fff;padding:16px;line-height:1.4;min-width:0}.hw-pack-card h2{font-size:20px;line-height:1.35;font-weight:700;margin-bottom:8px}.hw-pack-source{font-size:12px;color:#666;margin-top:8px!important;line-height:1.4}.hw-pack-band h2{background:linear-gradient(135deg,#f2f2f2,#dbdbdb);margin:-16px -16px 14px;padding:12px 16px;min-height:44px;font-size:18px}.hw-pack-links{position:absolute;inset:0;width:1280px;height:720px;pointer-events:none}.hw-pack .hw-radial{padding:8px 16px;text-align:center;justify-content:center;border-radius:8px}.hw-pack .hw-radial h2{margin-bottom:3px}.hw-pack .hw-radial .hw-pack-source{font-size:11px;margin-top:2px!important}.hw-layer{padding:8px 16px}.hw-layer h2{margin:0}.hw-process h2{padding-bottom:12px;border-bottom:3px solid #c7000b;font-size:18px}.hw-metric-value{display:flex;align-items:baseline;gap:4px;font-weight:700;line-height:1.15;color:#c7000b;white-space:nowrap;margin:14px 0}.hw-metric-unit{font-size:.4em}.hw-metric-hero{background:linear-gradient(135deg,#f5f5f5,#dbdbdb);justify-content:center}.hw-metric-delta{font-size:13px;color:#c7000b;margin-bottom:8px}.hw-metric-detail{margin-top:auto;padding:12px;background:#f3f3f3;font-size:13px;line-height:1.4}.hw-metric-row{display:grid;grid-template-columns:180px 1fr;align-content:center;gap:3px 12px;padding:12px}.hw-metric-row .hw-metric-value{grid-column:1;grid-row:1/5;margin:auto}.hw-metric-row h2,.hw-metric-row>p,.hw-metric-row>.hw-metric-delta{grid-column:2;font-size:14px;margin:0}.hw-metric-row h2{font-size:17px}.hw-metric-row .hw-metric-detail{grid-column:2;padding:4px;font-size:12px}.hw-media-empty{display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:repeating-linear-gradient(135deg,#eee 0,#eee 9px,#e3e3e3 9px,#e3e3e3 18px);color:#555;font-size:20px}.hw-media-clear{position:absolute;right:8px;top:8px;width:25px;height:25px;border:0;border-radius:50%;background:#777;color:#fff}.hw-chart-plot{border:1px solid #dbdbdb}.hw-chart-label{position:absolute;display:flex;align-items:center;justify-content:center;line-height:1.3;white-space:pre-wrap;overflow-wrap:anywhere}.hw-native-table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:10px;font-size:14px}.hw-native-table th{background:#c7000b;color:#fff;text-align:left;padding:9px}.hw-native-table td{border:1px solid #dbdbdb;padding:10px;white-space:pre-wrap;overflow-wrap:anywhere}.hw-native-table small{display:block;color:#777}.hw-cell-emphasis{font-weight:700;color:#c7000b}.hw-table-block{line-height:1.4}.hw-table-block h2{font-size:18px}.hw-table-block p{font-size:14px}.hw-pack-footer{position:absolute;left:64px;top:680px;display:flex;gap:18px;font-size:11px;color:#777}.hw-pack figure{margin:0}`;
 const refined=`.hw-pack .hw-metric-compact{display:grid;grid-template-columns:1fr auto;gap:3px 6px;align-content:start;padding:12px}.hw-pack .hw-metric-compact h2{font-size:18px;align-self:center;margin:0}.hw-pack .hw-metric-compact .hw-metric-value{font-size:38px!important;margin:0}.hw-pack .hw-metric-compact>p,.hw-pack .hw-metric-compact>.hw-metric-delta,.hw-pack .hw-metric-compact>.hw-metric-detail{grid-column:1/-1;font-size:14px;margin:0!important}.hw-pack .hw-metric-compact>.hw-metric-detail{font-size:12px;padding:5px;align-self:end}.hw-pack .hw-metric-compact>.hw-pack-source{font-size:11px}.hw-pack .hw-layer{padding:4px 16px}.hw-pack .hw-layer>.hw-pack-source{font-size:11px;margin-top:2px!important}`;
 return `<style>${style}${refined}</style>${hwRelations(def,p,g)}${field('h1','title',p.title)}${field('p','conclusion',p.lead,'class="hw-pack-lead"')}${content}${hwMedia(g,p)}${field('p','evidence',p.closing,'class="hw-pack-evidence"')}<footer class="hw-pack-footer" data-editable-skip="true"><span data-hw-page-number data-editable-skip="true">${pageNumber}</span><span data-editable-skip="true">Huawei Proprietary - Restricted Distribution</span></footer><img class="hw-brand" src="assets/huawei-logo.png" alt="HUAWEI" style="position:absolute;left:1070.05px;top:663.46px;width:133.37px;height:29.29px;object-fit:contain">`;
*/}
