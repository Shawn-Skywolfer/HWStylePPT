import test from 'node:test';import assert from 'node:assert/strict';
import fixtures from './hw-original-fixtures.json' with {type:'json'};
import {hwDefinition} from '../../src/components/hw/contracts.mjs';
import {manualHwInfo,manualHwDraft,prepareManualHwProps,manualHwChanges} from '../../assets/hw-manual-props.mjs';

test('manual editing accepts all original 77 variant structures without changing protected visual/data props',()=>{
 assert.equal(fixtures.length,77);for(const f of fixtures){const source=structuredClone(f.props),def=hwDefinition(f.layout),draft=manualHwDraft(def,source,f.variant),next=prepareManualHwProps(def,source,draft,{acknowledged:true});assert.equal(next.variant,String(f.variant));for(const key of ['chart','images','imageCount','imageVisible','iconConfig'])assert.deepEqual(next[key],source[key],f.layout+':'+key);assert.deepEqual(source,f.props);}
});
test('a smaller target is an editable draft, not a destructive switch or an AI request',()=>{
 const f=fixtures.find(f=>f.layout==='theme17_chart_hw_column_bento'&&f.variant==='4'),source=structuredClone(f.props),def=hwDefinition(f.layout),draft=manualHwDraft(def,source,'3');assert.equal(source.cards.length,3);assert.equal(draft.cards.length,2);assert.throws(()=>prepareManualHwProps(def,source,draft),/核对/);draft.cards[0].text='用户手动改写，可以输入新判断。';const next=prepareManualHwProps(def,source,draft,{acknowledged:true});assert.equal(next.cards[0].text,draft.cards[0].text);assert.equal(manualHwChanges(source,next).omitted.length,1);assert.deepEqual(next.chart,source.chart);assert.equal(source.cards.length,3);
});
test('larger and blank targets never fill missing facts with placeholders or fabricated metric zero',()=>{
 const f=fixtures.find(f=>f.layout==='theme17_chart_hw_column_bento'&&f.variant==='3'),def=hwDefinition(f.layout),draft=manualHwDraft(def,f.props,'5');assert.equal(draft.cards.length,4);assert.equal(draft.cards[2].label,'');assert.throws(()=>prepareManualHwProps(def,f.props,draft,{acknowledged:true}),/尚未填写/);for(const c of draft.cards.slice(2)){c.label='手动补充';c.text='手动填写的真实内容。';}assert.equal(prepareManualHwProps(def,f.props,draft,{acknowledged:true}).cards.length,4);
 const metric=fixtures.find(f=>f.layout==='theme17_content_hw_metrics'),mdef=hwDefinition(metric.layout),blank=manualHwDraft(mdef,metric.props,metric.variant,{blank:true});assert.equal(blank.cards[0].value,null);blank.cards.forEach(c=>{c.label='真实指标';c.text='手动补充。';});assert.throws(()=>prepareManualHwProps(mdef,metric.props,blank,{acknowledged:true}),/真实有限数值/);
});
test('manual table reduction retains the full source and clearly identifies changed/omitted rows',()=>{
 const f=fixtures.find(f=>f.layout==='theme17_content_hw_table'&&f.variant==='six'),source=structuredClone(f.props),def=hwDefinition(f.layout),draft=manualHwDraft(def,source,'four');assert.equal(manualHwInfo(def,'four').rows,4);assert.equal(draft.table.rows.length,4);const next=prepareManualHwProps(def,source,draft,{acknowledged:true});assert.equal(manualHwChanges(source,next).omittedRows.length,2);assert.equal(source.table.rows.length,6);draft.table.rows.push(structuredClone(source.table.rows[4]));assert.throws(()=>prepareManualHwProps(def,source,draft,{acknowledged:true}),/1–4 行/);
});
test('manual input cannot replace the chart, images or icon configuration through its draft payload',()=>{
 const f=fixtures.find(f=>f.layout==='theme17_chart_hw_column_bento'),def=hwDefinition(f.layout),draft=manualHwDraft(def,f.props,f.variant);draft.chart={type:'line',items:[]};draft.images=['https://invalid.example/secret'];draft.iconConfig={enabled:false};const next=prepareManualHwProps(def,f.props,draft,{acknowledged:true});assert.deepEqual(next.chart,f.props.chart);assert.deepEqual(next.images,f.props.images);assert.deepEqual(next.iconConfig,f.props.iconConfig);
});
