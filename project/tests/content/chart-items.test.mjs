import test from 'node:test';import assert from 'node:assert/strict';
import {chartSeriesContracts,validateChartSeries,changeChartItems,seriesItems} from '../../assets/chart-item-contracts.mjs';
import {THEME_PAGES,getLayoutRecord,inspectLayout} from '../../scripts/skill-workflow-utils.mjs';
import {prepareContentDraft} from '../../scripts/content/capacity-plan.mjs';
import {normalizeDocument} from '../../scripts/content/model.mjs';
import {validateChartData} from '../../scripts/content/chart-data.mjs';
import {hwDefinition} from '../../src/components/hw/contracts.mjs';
import {validateHwProps,hwMarkup} from '../../assets/hw-template-view.mjs';
import fixtures from './hw-original-fixtures.json' with {type:'json'};

test('every registered chart data series exposes explicit shared boundaries; legacy defaults satisfy them',()=>{
 let count=0;for(const p of THEME_PAGES.filter(p=>p.themeKey==='theme17')){const values=getLayoutRecord(p.key).defaultProps,specs=chartSeriesContracts(p.key,values);if(!specs.length)continue;assert.deepEqual(inspectLayout(p.key,{compact:true}).dataSeries,specs);for(const s of specs){assert.ok(Number.isInteger(s.min)&&s.min>=1&&s.max>=s.min);assert.ok(s.max<=12);count++;}if(p.pageNumber<=70)validateChartSeries(p.key,values);}assert.ok(count>=40);
});
test('HW charts add/remove data at every capacity and original variant without touching cards, geometry, sources, icons or media',()=>{
 let count=0;for(const f of fixtures.filter(f=>hwDefinition(f.layout).family==='chart')){const def=hwDefinition(f.layout),spec=chartSeriesContracts(f.layout,f.props)[0],original=structuredClone(f.props);for(const n of new Set([spec.min,spec.max])){let p=structuredClone(original);while(seriesItems(p,spec).length>n)p=changeChartItems(p,spec,{remove:seriesItems(p,spec).length-1});while(seriesItems(p,spec).length<n){p=changeChartItems(p,spec);const v=p.chart.items.at(-1);assert.equal(v.value,null);v.label='项'+p.chart.items.length;v.value=20;}if(spec.sum100)p.chart.items.forEach(v=>v.value=100/n);validateChartSeries(f.layout,p);validateHwProps(def,p);const g=validateHwProps(def,original);assert.deepEqual(validateHwProps(def,p).nodes,g.nodes);for(const k of Object.keys(original).filter(k=>k!=='chart'))assert.deepEqual(p[k],original[k],f.layout+':'+k);const html=hwMarkup(def,p,1);assert.ok(!/\bNaN\b|\bInfinity\b/.test(html));count++;}assert.throws(()=>changeChartItems({...original,chart:{...original.chart,items:Array.from({length:spec.max},(_,i)=>({label:'项'+i,value:20}))}},spec),/最多/);}assert.ok(count>=30);
});
test('add and delete affect only the selected series and its dedicated visible-count binding',()=>{
 const layout='theme17_page011',p=getLayoutRecord(layout).defaultProps,s=chartSeriesContracts(layout,p)[0],r=changeChartItems(p,s,{remove:0});assert.equal(r.companies.length,p.companies.length-1);assert.equal(r.rowCount,r.companies.length);for(const k of Object.keys(p).filter(k=>!['companies','rowCount'].includes(k)))assert.deepEqual(r[k],p[k]);assert.equal(p.companies.length,10);let low=structuredClone(p);low.companies=low.companies.slice(0,s.min);assert.throws(()=>changeChartItems(low,s,{remove:0}),/最少/);
});
test('new draft values are not fabricated and shares are never automatically normalized',()=>{
 const p={items:[{label:'甲',value:60},{label:'乙',value:40}],analysis:[{label:'结论',text:'保持不变'}]},s=chartSeriesContracts('theme17_chart_donut',p)[0],draft=changeChartItems(p,s);assert.equal(draft.items[2].value,null);assert.throws(()=>validateChartSeries('theme17_chart_donut',draft),/真实有限数值/);draft.items[2].value=10;assert.throws(()=>validateChartSeries('theme17_chart_donut',draft),/合计/);assert.equal(draft.items[0].value,60);assert.deepEqual(draft.analysis,p.analysis);
});
test('chart count/domain failures are found during initial brain-map capacity planning without losing any data',()=>{
 const doc=n=>normalizeDocument({title:'图表边界',slides:[{slideId:'chart',role:'body',title:'业务量持续增长',blocks:[{blockId:'data',type:'data',label:'业务量',text:'真实数据',data:{kind:'column',labels:Array.from({length:n},(_,i)=>'期'+i),values:Array.from({length:n},(_,i)=>i+1),unit:'项'}}]}]});const valid=prepareContentDraft(doc(6));assert.equal(valid.report.pages[0].status,'matched');assert.deepEqual(valid.report.pages[0].chartBoundaries[0],{blockId:'data',type:'column',min:2,max:12});assert.ok(valid.report.pages[0].chartPlan.layout);for(const n of [1,13]){const input=doc(n),r=prepareContentDraft(input);assert.equal(r.report.pages[0].status,'review');assert.equal(r.report.pages[0].error.code,'CHART_ITEM_CAPACITY');assert.deepEqual(r.document.slides[0].blocks[0].data,input.slides[0].blocks[0].data);}const line=doc(3).slides[0];line.blocks[0].data.kind='line';line.blocks[0].data.values[1]=101;assert.throws(()=>validateChartData(line),e=>e.code==='CHART_DOMAIN_REVIEW_REQUIRED');
});
