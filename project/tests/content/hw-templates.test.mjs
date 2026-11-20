import test from 'node:test';import assert from 'node:assert/strict';
import {HW_DEFINITIONS,HW_THEME_PAGES} from '../../src/components/hw/contracts.mjs';
import {hwGeometry} from '../../assets/hw-template-geometry.mjs';
import {hwMarkup,validateHwProps,validateHwChart} from '../../assets/hw-template-view.mjs';
import {hwCandidates} from '../../scripts/content/hw-plan.mjs';
import {contentCandidates} from '../../scripts/content/catalog-match.mjs';
import {validateGoalSpec} from '../../scripts/validate-goal-spec.mjs';
import {compileContent} from '../../scripts/content/compile.mjs';
import {listLayouts} from '../../scripts/skill-workflow-utils.mjs';
import {hwFixture,hwCapacityFixtures,hwDocument} from './hw-fixtures.mjs';
test('28 HW names and keys exactly match the supplied registry, every capacity has actual nonoverlapping geometry',()=>{
 assert.equal(HW_THEME_PAGES.length,28);assert.equal(new Set(HW_THEME_PAGES.map(p=>p.key)).size,28);
 for(const fixture of hwCapacityFixtures()){const {def,props}=fixture,g=validateHwProps(def,props);assert.ok(g,def.id+' '+props.variant);const all=[...g.nodes,...g.media];for(const r of all){assert.ok(r.x>=0&&r.x+r.w<=1281&&r.y>=0&&r.y+r.h<=721,def.id+' source-page bounds');for(const b of all)if(b!==r)assert.ok(Math.min(r.x+r.w,b.x+b.w)-Math.max(r.x,b.x)<1||Math.min(r.y+r.h,b.y+b.h)-Math.max(r.y,b.y)<1,def.id+' overlap');}
  const html=hwMarkup(def,props);assert.ok(!/<text\b/.test(html));assert.ok(html.includes('Huawei Proprietary'));assert.ok(!/<[^>]+\bclass="[^"]*\btemplate-tag\b/.test(html));
 }
});
test('all families enter real content matching with complete block IDs, sources, data, media and relations',()=>{
 for(const def of HW_DEFINITIONS){const fixture=hwFixture(def),doc=hwDocument([fixture.slide]),s=doc.slides[0],before=structuredClone(doc),candidate=hwCandidates(s,doc).find(c=>c.layout===def.layout);if(def.selectionHidden){assert.equal(candidate,undefined);assert.deepEqual(doc,before);continue;}assert.ok(candidate,def.id);assert.deepEqual(new Set(candidate.blocks.map(b=>b.blockId)),new Set(s.blocks.map(b=>b.blockId)));assert.deepEqual(doc,before);const errors=validateGoalSpec({title:doc.title,goal:doc.goal,themePack:'theme17',slides:[{id:s.slideId,layout:def.layout,props:candidate.props}]});assert.deepEqual(errors,[],def.id);assert.ok(contentCandidates(s,doc).candidates.some(c=>c.layout===def.layout));}
});
test('no fabricated metrics, invalid charts, unapproved media or arbitrary parallel content may become relation diagrams',()=>{
 for(const type of ['column','bar','line','area'])assert.doesNotThrow(()=>validateHwChart({type,items:[{label:'A',value:-12},{label:'B',value:0}]},type));
 for(const [type,values]of [['donut',[30,20]],['donut',[-10,110]],['radar',[20,30,40]],['radar',[20,30,40,101]]])assert.throws(()=>validateHwChart({type,items:values.map((value,i)=>({label:'维度'+i,value}))},type));
 const f=hwFixture(HW_DEFINITIONS[0]);delete f.props.cards[0].value;assert.throws(()=>validateHwProps(f.def,f.props));
 const doc=hwDocument([hwFixture(HW_DEFINITIONS[7]).slide]);assert.ok(!hwCandidates(doc.slides[0],doc).some(c=>['radial','layers','transformation'].includes(c.plan.family)));
 const media=hwFixture(HW_DEFINITIONS[10]);delete media.slide.media;const md=hwDocument([media.slide]);assert.ok(!hwCandidates(md.slides[0],md).some(c=>c.layout===media.def.layout));
});
test('media choices are independent; hiding all media returns a real full-width text grid without surrogate art',()=>{
 for(const def of HW_DEFINITIONS.filter(d=>['media','mediaBento'].includes(d.family))){const f=hwFixture(def),initial=hwGeometry(def,f.props);assert.ok(initial.media.length);const p={...f.props,imageCount:0,__mediaSlotVisibility:{imageCount:Array(initial.maxMedia).fill(false)}},g=hwGeometry(def,p);assert.equal(g.media.length,0);assert.equal(Math.max(...g.nodes.map(n=>n.x+n.w)),1216);assert.ok(!hwMarkup(def,p).includes('data-hw-media='));if(initial.maxMedia>1)for(let i=0;i<initial.maxMedia;i++){const v=Array(initial.maxMedia).fill(false);v[i]=true;const m=hwGeometry(def,{...p,__mediaSlotVisibility:{imageCount:v}}).media;assert.deepEqual(m.map(x=>x.slot),[i]);}}
});
test('HW registrations are body-only; cover, chapter and appended back cover remain the established originals',()=>{
 assert.ok(HW_THEME_PAGES.every(p=>p.pageNumber>=120&&!/cover|chapter|section/.test(p.slot)));
 const f=hwFixture(HW_DEFINITIONS[7]),d=hwDocument([{slideId:'fixed-cover',role:'cover',title:'华为风格保持不变',blocks:[]},{slideId:'fixed-chapter',role:'section',title:'正文模板拓展',blocks:[]},f.slide]);
 const goal=compileContent(d,{choices:{[f.id]:f.def.layout}}).goal;assert.equal(goal.slides[0].layout,'theme17_page004');assert.equal(goal.slides[1].layout,'theme17_page016');assert.equal(goal.slides[2].layout,f.def.layout);
});
test('block-owned authorized media is retained and matched, never silently omitted or detached from its block',()=>{
 const f=hwFixture(HW_DEFINITIONS[10]),media=f.slide.media;delete f.slide.media;f.slide.blocks[0].media=media;const doc=hwDocument([f.slide]);assert.deepEqual(doc.slides[0].blocks[0].media.map(m=>m.src),media.map(m=>m.src));const candidate=contentCandidates(doc.slides[0],doc).candidates.find(c=>c.layout===f.def.layout);assert.ok(candidate);assert.deepEqual(candidate.props.images,media.map(m=>m.src));
});
test('optional metric baselines use actual supplied data, preserve signs and remain independently mapped',()=>{
 const f=hwFixture(HW_DEFINITIONS[14]);f.slide.blocks[0].data.baseline=-21;const doc=hwDocument([f.slide]),c=hwCandidates(doc.slides[0],doc).find(c=>c.layout===f.def.layout);assert.ok(c);assert.equal(c.props.baselines[0].value,-21);assert.ok(hwMarkup(f.def,c.props).includes('基线 -21'));assert.ok(c.blocks[0].fields.metricBaseline);assert.ok(!hwMarkup(f.def,{...c.props,baselines:[]}).includes('class="hw-baseline"'));assert.deepEqual(validateGoalSpec({title:'指标验收',goal:'基线验证',themePack:'theme17',slides:[{layout:c.layout,props:c.props}]}),[]);
});
test('Agent role and media queries expose HW families instead of leaving them undiscoverable',()=>{
 assert.equal(listLayouts({theme:'theme17',role:'metrics',keyword:'_hw_',limit:99}).length,10);
 assert.ok(listLayouts({theme:'theme17',role:'image',keyword:'_hw_',plannedImages:2,limit:99}).some(c=>c.layout==='theme17_content_hw_media_bento_dual'));
});
test('table and chart capacities are upper bounds, never an invitation to invent rows or commentary',()=>{
 const table=hwFixture(HW_DEFINITIONS[3]);table.slide.blocks[0].data.rows=table.slide.blocks[0].data.rows.slice(0,3);let d=hwDocument([table.slide]),before=structuredClone(d);assert.throws(()=>contentCandidates(d.slides[0],d),e=>e.code==='EXISTING_TABLE_LAYOUT_REQUIRED');assert.deepEqual(d,before);
 for(const def of HW_DEFINITIONS.filter(d=>d.family==='chart'))for(const count of[0,1]){const f=hwFixture(def);f.slide.blocks=f.slide.blocks.slice(0,count+1);d=hwDocument([f.slide]);before=structuredClone(d);assert.ok(!hwCandidates(d.slides[0],d).some(c=>c.layout===def.layout),'original HW chart needs its real commentary slots');if(['bar','column','donut'].includes(def.chartType)){const candidates=contentCandidates(d.slides[0],d).candidates;assert.ok(candidates.some(c=>c.layout==='theme17_chart_'+def.chartType));for(const c of candidates)assert.equal(c.blocks.length,count+1);}else assert.throws(()=>contentCandidates(d.slides[0],d),e=>['CHART_LAYOUT_REQUIRED','LAYOUT_REVIEW_REQUIRED'].includes(e.code));assert.deepEqual(d,before);}
});
