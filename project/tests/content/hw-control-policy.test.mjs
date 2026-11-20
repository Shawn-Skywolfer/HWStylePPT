import test from 'node:test';import assert from 'node:assert/strict';
import fixtures from './hw-original-fixtures.json' with {type:'json'};
import {hwDefinition,HW_THEME_PAGES} from '../../src/components/hw/contracts.mjs';
import {normalizeOriginalProps,originalMarkup} from '../../assets/hw-original-view.mjs';
import {originalChart} from '../../assets/hw-original-chart.mjs';
import {hwVariantTarget} from '../../scripts/content/layout-adaptation.mjs';

test('legacy original emphasis stays original, while explicit zero clears every title band',()=>{
 const f=fixtures.find(f=>f.layout==='theme17_content_hw_bento_2x3'&&f.variant==='5'),def=hwDefinition(f.layout),legacy=normalizeOriginalProps(def,{...f.props,emphasisIndex:-1});assert.equal(legacy.emphasisMode,'original');assert.equal(legacy.emphasisIndex,0);assert.match(originalMarkup(def,legacy,1),/data-hw-focus="original"/);
 const none=originalMarkup(def,{...f.props,emphasisMode:'none',emphasisIndex:-1},1);assert.match(none,/data-hw-focus="none"/);assert.equal((none.match(/<[^>]+data-hw-emphasis-active="true"/g)||[]).length,0);
 const selected=originalMarkup(def,{...f.props,emphasisMode:'manual',emphasisIndex:1},1);assert.equal((selected.match(/<[^>]+data-hw-emphasis-active="true"/g)||[]).length,1);
 const c=HW_THEME_PAGES.find(p=>p.key===f.layout).controls.find(c=>c.key==='emphasisIndex');assert.match(c.label,/0＝不突出/);assert.equal(c.default+c.displayOffset,1);
});
test('line and area point glyphs are independent of the source non-uniform SVG transform',()=>{
 for(const f of fixtures.filter(f=>/chart_hw_(line|area)$/.test(f.layout))){const html=originalChart(hwDefinition(f.layout),f.props);assert.ok(!html.includes('<circle'));assert.equal((html.match(/data-hw-chart-point /g)||[]).length,f.props.chart.items.length);assert.ok(html.includes('width:12px;height:12px'));assert.ok(html.includes('preserveAspectRatio="none"'));assert.ok(html.includes('<polyline'));}
});
test('variant adaptation requests the exact original card count and never regroups real table rows or metrics',()=>{
 const target=hwVariantTarget({role:'body'}, {},'theme17_chart_hw_column_bento','5');assert.equal(target.variant,'5');assert.deepEqual(target.counts,[5]);assert.match(target.reason,/4 个解读块/);
 assert.throws(()=>hwVariantTarget({role:'body'}, {},'theme17_content_hw_table','four'),/不能靠 AI/);assert.throws(()=>hwVariantTarget({role:'body'}, {},'theme17_content_hw_metrics','six'),/不能靠 AI/);
});
