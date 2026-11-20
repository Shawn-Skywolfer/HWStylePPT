import test from 'node:test';import assert from 'node:assert/strict';
import library from '../../assets/hw-original-library.json' with {type:'json'};
import fixtures from './hw-original-fixtures.json' with {type:'json'};
import {hwDefinition,HW_THEME_PAGES} from '../../src/components/hw/contracts.mjs';
import {hwVariant} from '../../assets/hw-template-geometry.mjs';
import {resizeHwSlots} from '../../assets/hw-slot-resize.mjs';
import {originalDefinition,originalGeometry} from '../../assets/hw-original-view.mjs';
import {validateHwProps,hwMarkup} from '../../assets/hw-template-view.mjs';
import {TIMELINE_VARIANTS,timelineCount} from '../../assets/hw-timeline-view.mjs';
import {removeHwContentBlock} from '../../assets/hw-block-delete.mjs';
import {importHwLayoutContent} from '../../scripts/preview/hw-layout-content.mjs';
const def=hwDefinition('theme17_content_hw_timeline'),source=fixtures.find(f=>f.layout===def.layout&&f.variant==='six').props;
test('timeline supports 3–8 nodes, keeps original 4/6 entries exact, and shares capacity with planning and import',()=>{
 const original=library.templates[def.layout],before=structuredClone(original),extended=originalDefinition(def.layout);
 assert.equal(extended.variants.four,original.variants.four);assert.equal(extended.variants.six,original.variants.six);
 assert.equal(HW_THEME_PAGES.find(p=>p.key===def.layout).arrayCapacities.cards,8);
 assert.deepEqual(HW_THEME_PAGES.find(p=>p.key===def.layout).controls[0].options.map(o=>o.label),['3 个','4 个','5 个','6 个','7 个','8 个']);
 for(const v of TIMELINE_VARIANTS){const n=timelineCount(v),p=resizeHwSlots(def,source,v).props;assert.equal(p.cards.length,n);assert.equal(hwVariant(def,n),v);validateHwProps(def,p);const geometry=originalGeometry(def,p);assert.equal(geometry.nodes.length,n);assert.deepEqual(p.cards.slice(0,Math.min(n,6)),source.cards.slice(0,n));const html=hwMarkup(def,p,1);assert.equal((html.match(/data-content-block=/g)||[]).length,n);assert.equal(importHwLayoutContent({id:'timeline',layout:def.layout,props:p}).slides[0].blocks.filter(b=>b.origin?.hw?.card).length,n);for(const [i,r]of geometry.nodes.entries()){assert.ok(r.x>=80&&r.x+r.w<=1200.01);assert.equal(r.y,i%2?390:160);if(i>=2)assert.ok(r.x>=geometry.nodes[i-2].x+geometry.nodes[i-2].w);} }
 assert.deepEqual(original,before);assert.equal(hwVariant(def,2),null);assert.equal(hwVariant(def,9),null);
});
test('timeline shrinking and re-expanding keeps leading content, creates fresh editable blanks and supports whole-block deletion',()=>{
 const small=resizeHwSlots(def,source,'three'),large=resizeHwSlots(def,small.props,'eight');
 assert.equal(small.removedCards.length,3);assert.equal(large.addedCards,5);assert.ok(large.props.cards.slice(3).every(c=>c.label==='待补充'&&c.date==='待补充'&&c.text==='待补充'&&c.evidence==='待补充'));assert.ok(!large.props.cards.some(c=>c.blockId===source.cards[3].blockId));
 const deleted=removeHwContentBlock(def,source,source.cards[2].blockId);assert.equal(deleted.props.variant,'five');assert.equal(deleted.props.cards.length,5);validateHwProps(def,deleted.props);
});
