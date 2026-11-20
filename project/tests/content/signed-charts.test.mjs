import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDocument} from '../../scripts/content/model.mjs';
import {compileContent} from '../../scripts/content/compile.mjs';
import {validateChartData} from '../../scripts/content/chart-data.mjs';
import {diagnosticOf} from '../../scripts/content/diagnostics.mjs';
import {chartMarkup} from '../../assets/huawei-chart-view.mjs';
import {signedChartMarkup} from '../../assets/huawei-chart-signed.mjs';
import {documentToTree,defaultCollapsed,layoutMindmap} from '../../scripts/content/mindmap-model.mjs';
const slide=(kind='bar',values=[78.84,-101.02,0],labels=['正电价','负电价','零电价'])=>({slideId:'signed',order:3,role:'body',title:'负电价应保留方向与幅度',blocks:[{blockId:'prices',type:'data',label:'价格比较',text:'真实价格',data:{kind,labels,values,unit:'AUD/MWh'}}]});
const documentFor=s=>normalizeDocument({title:'负值回归',brief:{audience:'管理层',occasion:'内部汇报',priority:'保留数值',confirmed:true},slides:[s]});
test('one-level default shows only root and slide titles, without mutating content',()=>{
 const doc=documentFor(slide()),before=structuredClone(doc),tree=documentToTree(doc),collapsed=defaultCollapsed(tree),layout=layoutMindmap(tree,collapsed);
 assert.deepEqual(layout.nodes.map(n=>n.kind),['deck','slide']);assert.deepEqual(doc,before);
 collapsed.delete('s:signed');assert.ok(layoutMindmap(tree,collapsed).nodes.some(n=>n.kind==='block'));
});
for(const kind of ['bar','column','waterfall'])for(const mixed of [false,true])test(`${kind} ${mixed?'mixed':'full'} preserves signed values and only uses HTML labels`,()=>{
 const doc=documentFor(slide(kind));if(mixed)doc.slides[0].blocks.push({blockId:'analysis',type:'insight',label:'波动解读',text:'负电价反映供需短时错配。',evidence:''});
 const result=compileContent(doc),s=result.goal.slides[0];assert.equal(s.layout,`theme17_chart_${kind}`);assert.deepEqual(s.props.items.map(i=>i.value),[78.84,-101.02,0]);
 const html=chartMarkup(s.props,kind);assert.match(html,/data-chart-zero=/);assert.ok(html.includes('-101.02'));assert.ok(!html.includes('+-101.02'));assert.doesNotMatch(html,/<text\b|NaN|Infinity/);if(kind==='waterfall')assert.ok(html.includes('>-22.18</div>'));
 for(const m of html.matchAll(/<rect\b[^>]*\b(width|height)="([^"]+)"/g))assert.ok(Number(m[2])>=0);
});
test('signed bars extend in opposite directions from the same zero and retain proportional size',()=>{
 const {svg}=signedChartMarkup([{label:'a',value:-10},{label:'b',value:20}],'bar',()=>''),rects=[...svg.matchAll(/<rect[^>]*x="([^"]+)"[^>]*width="([^"]+)"/g)].map(m=>[+m[1],+m[2]]),zero=+svg.match(/data-chart-zero="([^"]+)"/)[1];
 assert.equal(rects[0][0]+rects[0][1],zero);assert.equal(rects[1][0],zero);assert.equal(rects[1][1]/rects[0][1],2);
});
test('waterfall domain includes intermediate cumulative peaks and troughs, including negative totals',()=>{
 for(const values of [[100,-250,100],[-101.02,-7.79,-1.538],[0,-1,1]]){
  const {svg}=signedChartMarkup(values.map((value,i)=>({label:String(i),value})),'waterfall',()=> '');
  for(const m of svg.matchAll(/<rect[^>]*y="([^"]+)"[^>]*height="([^"]+)"/g)){assert.ok(+m[1]>=294);assert.ok(+m[1]+(+m[2])<=544.51);}
 }
});
test('malformed arrays, string numbers and negative shares explain exact page and block',()=>{
 const cases=[slide('bar',[1],['a','b']),slide('bar',[1,'-2'],['a','b']),slide('donut',[110,-10],['a','b']),slide('donut',[10,20],['a','b'])];
 for(const s of cases){assert.throws(()=>validateChartData(s),error=>{const d=diagnosticOf(error,{document:{slides:[s]}});assert.equal(d.code,'CHART_DATA_REQUIRED');assert.deepEqual(d.slideIds,['signed']);assert.equal(d.details.blockId,'prices');assert.ok(d.details.issues.length);assert.match(d.help,/不要取绝对值/);return true;});}
});
test('donut percentages and positive chart behavior remain valid; zero is valid',()=>{
 assert.equal(validateChartData(slide('share',[25,75],['a','b'])).kind,'donut');
 for(const kind of ['bar','column','waterfall'])assert.doesNotThrow(()=>compileContent(documentFor(slide(kind,[0,0],['a','b']))));
});
