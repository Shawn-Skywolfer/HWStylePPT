import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepareContentDraft,createCapacityPlannedProject} from '../../scripts/content/capacity-plan.mjs';
import {normalizeDocument,digest} from '../../scripts/content/model.mjs';
import {ProjectStore} from '../../scripts/content/store.mjs';
import {compileContent} from '../../scripts/content/compile.mjs';
export const capacityFixture=(long=true)=>({title:'容量匹配回归',brief:{audience:'管理层',occasion:'内部汇报',priority:'保留完整事实',workflowMode:'fine',confirmed:true},slides:[{slideId:'dense',role:'body',title:'八项事实共同支撑结论',conclusion:'各项责任必须完整保留。',evidence:'内部研究',blocks:Array.from({length:8},(_,i)=>({blockId:'b'+i,type:'insight',label:'事实'+i,text:long?('这是第'+i+'项事实，完整保留具体责任、执行条件和管理动作。').repeat(9):'第'+i+'项完整事实与行动要求。',evidence:'访谈'+i}))}]});
test('eight short blocks match a registered dense layout without splitting or truncation',()=>{
 const doc=normalizeDocument(capacityFixture(false)),before=structuredClone(doc),p=prepareContentDraft(doc);
 assert.equal(p.report.changed,false);assert.equal(p.report.reviewCount,0);assert.ok(p.report.pages[0].options.some(o=>o.layout==='theme17_content_bento'));assert.deepEqual(doc,before);
 const compiled=compileContent(p.document);assert.ok(['theme17_content_bento','theme17_content_hw_bento_2x3','theme17_content_hw_icon_grid'].includes(compiled.goal.slides[0].layout));assert.equal(compiled.goal.slides[0].props.cards.length,8);assert.deepEqual(compiled.goal.slides[0].props.cards.map(c=>c.text),doc.slides[0].blocks.map(b=>b.text));
});
test('long independent blocks paginate before preview, preserving atomic content, order, source and stable IDs',()=>{
 const input=capacityFixture(),p=prepareContentDraft(input),again=prepareContentDraft(input);
 assert.equal(p.report.changed,true);assert.equal(p.report.reviewCount,0);assert.ok(p.document.slides.length>1);assert.deepEqual(p.document.slides.flatMap(s=>s.blocks),p.original.slides[0].blocks);
 assert.equal(p.document.slides[0].slideId,'dense');assert.equal(p.document.slides[0].conclusion,input.slides[0].conclusion);assert.ok(p.document.slides.slice(1).every(s=>s.conclusion===''));assert.ok(p.document.slides.every(s=>s.evidence==='内部研究'));
 assert.equal(p.report.planHash,again.report.planHash);assert.equal(new Set(p.document.slides.map(s=>s.slideId)).size,p.document.slides.length);assert.doesNotThrow(()=>compileContent(p.document));const layouts=compileContent(p.document).goal.slides.map(s=>s.layout);assert.ok(layouts.every((v,i)=>i===0||v!==layouts[i-1]));assert.equal(input.slides.length,1);
});
test('single-page and fixed-page requirements never silently increase page count',()=>{
 for(const mode of ['single','fixed']){const input=capacityFixture();if(mode==='single')input.slides[0].pagination='single';else input.brief.pagination='fixed';const p=prepareContentDraft(input);assert.equal(p.report.changed,false);assert.equal(p.report.pages[0].status,'review');assert.equal(p.document.slides.length,1);assert.deepEqual(p.document.slides[0].blocks,p.original.slides[0].blocks);}
});
test('data, media, free placement and explicit relations are not broken by mechanical pagination',()=>{
 const variants=[s=>{s.blocks[0].data={kind:'bar',labels:['a','b'],values:[1,2]};},s=>{s.media=[{src:'assets/user-media/test.png'}];},s=>{s.board={mode:'free',edges:[]};},s=>{s.board={mode:'columns',edges:[{from:'block:b0',to:'block:b1',kind:'causes',label:'导致'}]};}];
 for(const change of variants){const input=capacityFixture();change(input.slides[0]);const p=prepareContentDraft(input);assert.equal(p.report.changed,false);assert.equal(p.report.pages[0].status,'review');assert.equal(digest(p.original),digest(p.document));}
});
test('unrenderable atomic blocks and the project page limit leave the original draft intact',()=>{
 const input=capacityFixture();input.slides[0].blocks[0].text='完整不可截断内容。'.repeat(400);let p=prepareContentDraft(input);assert.equal(p.report.changed,false);assert.equal(p.report.reviewCount,1);
 const crowded=capacityFixture();crowded.slides.push(...Array.from({length:59},(_,i)=>({slideId:'section'+i,role:'section',title:'章节'+i,blocks:[]})));p=prepareContentDraft(crowded);assert.equal(p.document.slides.length,60);assert.equal(p.report.changed,false);assert.equal(p.report.reviewCount,1);
});
test('initial automatic pagination is visible, preserves original, and supports durable undo/redo',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashi-capacity-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=new ProjectStore(dir),p=createCapacityPlannedProject(store,capacityFixture(),{input:'原始材料'});
 assert.equal(p.original.slides.length,1);assert.ok(p.current.slides.length>1);assert.equal(p.initialPlanning.changed,true);assert.equal(p.history.undo.length,1);
 const count=p.current.slides.length,undone=store.action(p.revision,'undo');assert.equal(undone.current.slides.length,1);const redone=store.action(undone.revision,'redo');assert.equal(redone.current.slides.length,count);assert.equal(store.read().source.input,'原始材料');
});

test('editorial validation is not evaded by mechanically spreading repeated copy across pages',()=>{
 const input=capacityFixture(false);for(const b of input.slides[0].blocks)b.text='同一段重复的内容不应该靠拆页绕过检查。';const p=prepareContentDraft(input);assert.equal(p.report.changed,false);assert.equal(p.report.reviewCount,1);assert.equal(p.report.pages[0].error.code,'CONTENT_REVIEW_REQUIRED');assert.deepEqual(p.document,p.original);
});
