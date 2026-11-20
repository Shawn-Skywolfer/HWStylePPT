import {hwChartDisplay,hwChartScale,hwChartTick} from './hw-chart-scale.mjs';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const anchor=(x,y,text,kind='value',transform='translate(-50%,-120%)')=>`<span data-hw-chart-anchor data-hw-chart-${kind} data-x="${x}" data-y="${y}" data-editable-skip="true" style="position:absolute;left:0;top:0;transform:${transform};font:12px/1.2 Arial,'Microsoft YaHei',sans-serif;color:#4d4d4d;white-space:nowrap;pointer-events:none">${e(text)}</span>`;
export function chartWithDisplay(def,p,artwork){
 const type=def.chartType,data=p.chart.items,options=hwChartDisplay(p),scale=type==='donut'?{min:0,max:100,ticks:[]}:hwChartScale(data.map(d=>d.value),options.mode),span=type==='column'?240:type==='line'||type==='area'?220:100,normalized=type==='donut'?data:data.map(d=>({...d,value:d.value/scale.max*(type==='column'?240/2.6:type==='line'||type==='area'?220/2.4:100)}));
 let html=artwork(def,{...p,chartScaleMode:'original',chart:{...p.chart,items:normalized}}).replace('data-hw-chart="'+type+'"','data-hw-chart="'+type+'" data-hw-scale-max="'+scale.max+'" data-hw-plot-span="'+span+'" data-hw-scale-mode="'+options.mode+'"'),extra='';
 if(['column','line','area'].includes(type)){
  const bottom=type==='column'?290:280;
  if(options.ticks)extra+=scale.ticks.map(v=>anchor(30,bottom-v/scale.max*span,hwChartTick(v),'tick','translate(-100%,-50%)')).join('');
  if(options.values)extra+=data.map((d,i)=>{const step=500/data.length,x=type==='column'?40+i*step+step*.2+Math.min(48,step*.6)/2:50+i*500/(data.length-1);return anchor(x,bottom-d.value/scale.max*span,d.value);}).join('');
 }
 if(type==='bar'){
  let at=0;html=html.replace(/<span class="hbar-value">[^<]*<\/span>/g,()=>{const d=data[at++];return `<span class="hbar-value">${options.values?'<b data-hw-chart-value style="font-weight:inherit">'+e(d.value)+'</b>':''}</span>`;});html=html.replace('<div class="hbar-list">','<span data-editable-skip="true" style="position:absolute;right:20px;top:48px;font:10px Arial;color:#666">'+(p.chart.unit?'单位：'+e(p.chart.unit):'')+'</span><div class="hbar-list">');let barIndex=0;html=html.replace(/(<div class="hbar-track"><i style=")([^"]+)(")/g,(_,a,s,c)=>a+s+(barIndex++===data.length-1?';background:#c7000b':'')+c);
  if(options.ticks){const ticks=`<div class="hbar-row" data-hw-bar-axis><span></span><div style="height:18px;position:relative">${scale.ticks.map((v,i)=>`<span data-hw-chart-tick data-editable-skip="true" style="position:absolute;left:${v/scale.max*100}%;transform:translateX(${i===0?0:i===4?-100:-50}%);font:11px Arial;white-space:nowrap">${e(hwChartTick(v))}</span>`).join('')}</div><span></span></div>`;html=html.replace('</div><div class="chart-legend">',ticks+'</div><div class="chart-legend">');}
 }
 if(type==='donut'){
  html=html.replace('<strong>100%</strong>',options.values?'<strong data-hw-chart-value>100%</strong>':'');
  html=html.replace(/(<span><i style="background:[^"]+"><\/i>)([\s\S]*?) ([\d.]+)%<\/span>/g,(_,start,label,value)=>start+label+(options.values?' <b data-hw-chart-value style="font-weight:inherit">'+value+'%</b>':'')+'</span>');
 }
 if(type==='radar'){
  if(options.ticks)extra+=scale.ticks.slice(1).map(v=>anchor(200,150-v/scale.max*128,hwChartTick(v),'tick','translate(-110%,0)')).join('');
  if(options.values)extra+=data.map((d,i)=>{const r=128*d.value/scale.max,xy=[[200,150-r],[200+r,150],[200,150+r],[200-r,150]][i];return anchor(...xy,d.value);}).join('');
 }
 if(['donut','radar'].includes(type)&&p.chart.unit)html=html.replace('<div class="chart-plot">','<div class="chart-plot"><span class="chart-unit">单位：'+e(p.chart.unit)+'</span>');
 const end=html.lastIndexOf('</article>');return html.slice(0,end)+extra+html.slice(end);
}
