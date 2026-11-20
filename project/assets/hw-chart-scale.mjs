export function hwChartDisplay(p={}){
 if(p.chartScaleMode!=null&&!['auto','original'].includes(p.chartScaleMode))throw new Error('HW_CHART_SCALE_INVALID：请选择自动范围或固定 0–100');
 for(const key of ['showChartAxisTicks','showChartValues'])if(p[key]!=null&&typeof p[key]!=='boolean')throw new Error('HW_CHART_DISPLAY_INVALID：显示开关必须为布尔值');
 return {mode:p.chartScaleMode||'auto',ticks:p.showChartAxisTicks!==false,values:p.showChartValues!==false};
}
export function hwChartScale(values,mode='auto'){
 const max=Math.max(0,...values);let upper=100;
 if(mode==='auto'){if(max===0)upper=1;else{const power=10**Math.floor(Math.log10(max)),fraction=max/power,nice=[1,2,2.5,5,10].find(v=>v>=fraction-1e-12)||10;upper=nice*power;if(!Number.isFinite(upper)||upper<max)upper=max;}}
 return {min:0,max:upper,ticks:[0,.25,.5,.75,1].map(f=>Number((upper*f).toPrecision(12)))};
}
export const hwChartTick=v=>Number(v.toPrecision(8)).toString();
export function layoutHwChartLabels(scope=document){for(const chart of scope.querySelectorAll('[data-hw-chart]')){const svg=chart.querySelector('svg'),matrix=svg?.getScreenCTM(),box=chart.getBoundingClientRect(),sx=box.width/chart.offsetWidth,sy=box.height/chart.offsetHeight;if(!matrix||!sx||!sy)continue;for(const label of chart.querySelectorAll('[data-hw-chart-anchor]')){const point=new DOMPoint(Number(label.dataset.x),Number(label.dataset.y)).matrixTransform(matrix);label.style.left=(point.x-box.left)/sx+'px';label.style.top=(point.y-box.top)/sy+'px';}}}
