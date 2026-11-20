import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {normalizeDocument,statusOf} from '../../scripts/content/model.mjs';
import {compileContent} from '../../scripts/content/compile.mjs';
import {contentCandidates} from '../../scripts/content/catalog-match.mjs';
import {designDeck,validateDesignChoices,designMessages} from '../../scripts/content/deck-design.mjs';
import {ProjectStore} from '../../scripts/content/store.mjs';
import {prepareGeneration} from '../../scripts/content/generation.mjs';
import {briefReady} from '../../scripts/content/brief.mjs';
const demo=()=>normalizeDocument(JSON.parse(fs.readFileSync(new URL('../../examples/content-demo.json',import.meta.url),'utf8')));
test('intake requires audience, occasion, priority and explicit confirmation',t=>{
 const dir=path.resolve('.test-tmp/intake-'+Date.now());const store=new ProjectStore(dir);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const d=demo();delete d.brief;store.create(d);const p=store.action(1,'confirm');assert.equal(statusOf(p).briefReady,false);assert.throws(()=>prepareGeneration(store,p.revision),e=>e.code==='BRIEF_REQUIRED');assert.equal(store.read().generations.length,0);assert.equal(briefReady(d),false);
});
test('changing a confirmed brief invalidates generation snapshot and is undoable',t=>{
 const dir=path.resolve('.test-tmp/brief-undo-'+Date.now());const store=new ProjectStore(dir);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));store.create(demo());let p=store.action(1,'confirm'),d=structuredClone(p.current);d.brief.priority='优先解释经营风险';p=store.edit(p.revision,d);assert.equal(statusOf(p).canGenerate,false);p=store.action(p.revision,'undo');assert.equal(statusOf(p).canGenerate,true);
});
test('whole-deck match includes full original library and complete atomic mappings',()=>{
 const d=demo(),before=structuredClone(d),c=compileContent(d);assert.equal(new Set(c.design.map(s=>s.selected)).size,3);assert.ok(c.mapping.slides[1].visualPlan.catalogSearched>50);for(const s of d.slides.slice(1))for(const block of s.blocks){const bindings=c.mapping.slides.find(m=>m.slideId===s.slideId).visualPlan.bindings;for(const field of ['label','text'])assert.ok(bindings.some(v=>v.blockId===block.blockId&&v.source===field&&v.text===block[field]));}assert.deepEqual(d,before);
});
test('visual Agent chooses only safe layouts and never rewrites confirmed content',async()=>{
 const d=demo(),before=structuredClone(d);let called=false;
 const result=await designDeck('.',d,{}, {planner:'bridge',bridgeRunner:async(_dir,task,messages)=>{called=true;assert.equal(task.scope.kind,'deck-design');const input=JSON.parse(messages[1].content);assert.deepEqual(input.brief,d.brief);return {summary:'围绕管理决策组织叙事',operations:input.pages.map(p=>({op:'chooseLayout',slideId:p.slideId,layout:p.selected,reason:'保留关系和容量'}))};}});
 assert.equal(called,true);assert.equal(result.report.mode,'bridge');assert.deepEqual(d,before);assert.equal(result.compiled.goal.slides.length,d.slides.length);
});
test('invalid AI props/content mutations fall back transparently without publishing them',async()=>{
 const d=demo(),r=await designDeck('.',d,{}, {planner:'provider',modelRunner:async()=>({operations:[{op:'replaceSlide',slideId:d.slides[1].slideId,layout:'theme17_page009'}]})});assert.equal(r.report.mode,'full-catalog-rules');assert.equal(r.report.fallbackReason,'LAYOUT_PLAN_INVALID');assert.ok(r.compiled.goal.slides[1].props.title===d.slides[1].title);
 const c=compileContent(d);assert.throws(()=>validateDesignChoices({operations:[]},c));assert.ok(designMessages(d,c)[0].content.includes('不得虚构'));
});
test('cancelled layout planning cannot fall back and continue generation',async()=>{
 const controller=new AbortController();await assert.rejects(()=>designDeck('.',demo(),{}, {planner:'bridge',signal:controller.signal,bridgeRunner:async()=>{controller.abort();throw controller.signal.reason;}}),e=>e.name==='AbortError');
});
test('real chart types match dedicated contracts without adding samples',()=>{
 const d=demo();for(const[kind,values,expected]of[['bar',[12,20,8,6,3],'theme17_chart_bar'],['column',[1,2,3,4,5,6],'theme17_chart_column'],['donut',[20,30,50],'theme17_chart_donut'],['waterfall',[10,20,5,15],'theme17_chart_waterfall']]){
  const s=structuredClone(d.slides[1]);s.blocks=[{blockId:'data',type:'chart',label:'实际数值',text:'确认口径',evidence:'内部数据',data:{kind,labels:values.map((_,i)=>'类别'+i),values,unit:kind==='donut'?'%':'万元'}}];const c=contentCandidates(s,d).candidates;assert.equal(c[0].layout,expected);assert.deepEqual(c[0].plan.chart.values,values);assert.ok(!c.some(v=>v.layout.startsWith('theme17_content_')));
 }
});
test('unsafe data and unauthorized media cannot turn into decorative sample content',()=>{
 const d=demo(),s=structuredClone(d.slides[1]);s.blocks[0].data={kind:'pie',labels:['甲'],values:[5]};assert.throws(()=>contentCandidates(s,d));assert.throws(()=>normalizeDocument({...d,slides:[{...s,media:[{src:'../secret.png'}]}]}));
});
test('provided staged images keep media-aware rich candidates instead of being dropped',()=>{
 const d=demo(),s=d.slides[1];s.media=[{src:'assets/user-media/provided.png',kind:'image',caption:'用户素材'}];const candidates=contentCandidates(s,d).candidates;assert.ok(candidates.length);assert.ok(candidates.every(c=>c.plan.mediaCount===1&&(!c.layout.startsWith('theme17_content_')||c.layout==='theme17_content_icon_media'||c.layout.startsWith('theme17_content_hw_media_'))));assert.ok(candidates.every(c=>c.props.images.includes('assets/user-media/provided.png')));
});
