import test from 'node:test';import assert from 'node:assert/strict';
import fixtures from './hw-original-fixtures.json' with {type:'json'};
import {hwDefinition} from '../../src/components/hw/contracts.mjs';
import {resizeHwSlots} from '../../assets/hw-slot-resize.mjs';
import {manualHwInfo} from '../../assets/hw-manual-props.mjs';
import {validateHwProps,hwMarkup} from '../../assets/hw-template-view.mjs';
import {importHwLayoutContent} from '../../scripts/preview/hw-layout-content.mjs';

test('all original HW variants resize leading content without mutating the source or visual assets',()=>{
 let count=0;for(const f of fixtures){const def=hwDefinition(f.layout);for(const variant of def.variants){const source=structuredClone(f.props),before=structuredClone(source),r=resizeHwSlots(def,source,variant),cap=manualHwInfo(def,variant);validateHwProps(def,r.props);hwMarkup(def,r.props,1);assert.equal(r.props.cards.length,cap.cards);assert.deepEqual(r.props.cards.slice(0,Math.min(source.cards.length,cap.cards)),source.cards.slice(0,cap.cards));assert.deepEqual(r.removedCards,source.cards.slice(cap.cards));assert.deepEqual(source,before);for(const k of ['chart','images','imageCount','imageVisible','iconConfig'])assert.deepEqual(r.props[k],source[k]);if(cap.rows){assert.equal(r.props.table.rows.length,cap.rows);assert.deepEqual(r.removedRows,source.table.rows.slice(cap.rows));}const added=r.props.cards.slice(source.cards.length);for(const c of added){assert.equal(c.label,'待补充');assert.equal(c.evidence,'待补充');assert.ok(c.text==='待补充'||c.items.includes('待补充'));if(['metrics','highlight'].includes(def.family)){assert.equal(c.value,null);assert.equal(c.pendingValue,true);assert.ok(hwMarkup(def,r.props,1).includes('待补充'));}}assert.equal(new Set(r.props.cards.map(c=>c.blockId)).size,r.props.cards.length);count++;}}
 assert.ok(count>200);
});
test('shrinking removes only tail content, invalid edges and baselines; original remains available for undo',()=>{
 const f=fixtures.find(f=>f.layout==='theme17_chart_hw_column_bento'&&f.variant==='5'),def=hwDefinition(f.layout),source=structuredClone(f.props),keep=source.cards[0].blockId,last=source.cards.at(-1).blockId;source.layout.edges=[{from:keep,to:last},{from:keep,to:'meta:title'}];const r=resizeHwSlots(def,source,'3');assert.equal(r.props.cards.length,2);assert.deepEqual(r.props.layout.edges,[{from:keep,to:'meta:title'}]);assert.equal(source.cards.length,4);assert.equal(r.removedCards.length,2);
});
test('pending metric slots remain explicit text, not made-up zero or metric data',()=>{
 const group=fixtures.filter(f=>f.layout==='theme17_content_hw_metrics'),small=group.toSorted((a,b)=>a.props.cards.length-b.props.cards.length)[0],large=group.toSorted((a,b)=>b.props.cards.length-a.props.cards.length)[0],def=hwDefinition(small.layout),r=resizeHwSlots(def,small.props,large.variant);assert.ok(r.addedCards>0);const doc=importHwLayoutContent({id:'pending-metrics',layout:def.layout,props:r.props});for(const c of r.props.cards.slice(small.props.cards.length)){const block=doc.slides[0].blocks.find(b=>b.blockId===c.blockId);assert.equal(block.type,'paragraph');assert.equal(block.data,undefined);assert.equal(block.origin.hw.card.value,null);}
});

test('only empty metric slots receive compact placeholder typography; real metrics keep source styles',()=>{
 for(const f of fixtures.filter(f=>/metrics|highlight/.test(f.layout))){
  const def=hwDefinition(f.layout),source=hwMarkup(def,f.props,1);assert.equal((source.match(/<[^>]+data-hw-metric-pending=/g)||[]).length,0);
  for(const variant of def.variants){const r=resizeHwSlots(def,f.props,variant);if(!r.addedCards)continue;const html=hwMarkup(def,r.props,1);assert.equal((html.match(/<[^>]+data-hw-metric-pending=/g)||[]).length,r.addedCards);for(const c of r.props.cards.filter(c=>c.pendingValue)){c.value=42;delete c.pendingValue;}const filled=hwMarkup(def,r.props,1);assert.equal((filled.match(/<[^>]+data-hw-metric-pending=/g)||[]).length,0);}
 }
});
