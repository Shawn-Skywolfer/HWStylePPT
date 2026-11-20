import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ProjectStore} from '../../scripts/content/store.mjs';
import {createTaskEngine} from '../../scripts/content/task-engine.mjs';
import {createWorkbenchServer} from '../../scripts/content/server.mjs';
import {contentIssues,assertContentReady} from '../../scripts/content/content-requirements.mjs';
import {normalizeDocument} from '../../scripts/content/model.mjs';
import {prepareContentDraft,createCapacityPlannedProject} from '../../scripts/content/capacity-plan.mjs';
import {compileContent} from '../../scripts/content/compile.mjs';
import {layoutContentContract,layoutContractIndex} from '../../scripts/content/layout-requirements.mjs';
import {validateRenderedContent} from '../../scripts/content/rendered-validation.mjs';
const demo=JSON.parse(fs.readFileSync(new URL('../../examples/content-demo.json',import.meta.url)));
function setup(t){const root=path.resolve('.test-tmp');fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'generation-safe-')),store=new ProjectStore(dir);store.create(structuredClone(demo));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return store;}
const tick=()=>new Promise(r=>setTimeout(r,30));
const denial=()=>Object.assign(new Error('rename EPERM'),{code:'EPERM',syscall:'rename',path:'content-plan.json.tmp'});
function queue(store,id='g1'){store.mutate(null,p=>p.generations.push({id,status:'queued',runId:'r1',progress:{stage:'queued',percent:0}}));}

test('cancel aborts generation even when saving fails; late completion cannot publish and recovery persists cancellation',async t=>{
 const store=setup(t);queue(store);let signal,finish;
 const engine=createTaskEngine(store,{generationRunner:(_s,_id,options)=>{signal=options.signal;return new Promise(r=>finish=r);}});t.after(()=>engine.close());engine.pump();await tick();assert.ok(signal);
 const mutate=store.mutate.bind(store);store.mutate=()=>{throw denial();};const stopped=engine.stop('generations','g1','cancel');assert.equal(signal.aborted,true);assert.equal(stopped.volatile,true);assert.equal(stopped.project.generations[0].status,'cancelled');assert.match(stopped.warning,/尚未保存/);finish('late-result');await tick();assert.equal(engine.view(store.read()).generations[0].status,'cancelled');
 store.mutate=mutate;engine.flush();assert.equal(store.read().generations[0].status,'cancelled');engine.pump();await tick();assert.equal(store.read().generations[0].status,'cancelled');
});
test('progress, pump and terminal-save errors stay contained instead of crashing the server',async t=>{
 const store=setup(t);queue(store);let fail,onProgress;const engine=createTaskEngine(store,{generationRunner:(_s,_id,options)=>{onProgress=options.onProgress;return new Promise((_r,reject)=>fail=reject);}});t.after(()=>engine.close());engine.pump();await tick();const mutate=store.mutate.bind(store);store.mutate=()=>{throw denial();};assert.doesNotThrow(()=>onProgress({stage:'rendered-validation',percent:85}));fail(new Error('fixture browser failed'));await tick();assert.equal(engine.view(store.read()).generations[0].status,'failed');assert.doesNotThrow(()=>engine.pump());store.mutate=mutate;engine.flush();assert.equal(store.read().generations[0].status,'failed');
});
test('priority cancel API accepts stale revision and remains available during project save denial',async t=>{
 const store=setup(t);queue(store);let signal;const app=createWorkbenchServer(store.dir,{runtimeProbe:async()=>({canSpawn:true}),onError:()=>{},engineOptions:{generationRunner:(_s,_id,o)=>{signal=o.signal;return new Promise((_r,reject)=>o.signal.addEventListener('abort',()=>reject(o.signal.reason),{once:true}));}}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{app.engine.close();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));});app.engine.pump();await tick();const mutate=app.store.mutate.bind(app.store);app.store.mutate=()=>{throw denial();};
 const origin='http://127.0.0.1:'+app.server.address().port,headers={'content-type':'application/json','x-workbench-token':app.token};const response=await fetch(origin+'/api/task/control',{method:'POST',headers,body:JSON.stringify({revision:1,collection:'generations',id:'g1',action:'cancel'})}),body=await response.json();assert.equal(response.status,200);assert.equal(signal.aborted,true);assert.equal(body.project.generations[0].status,'cancelled');assert.equal(body.volatile,true);assert.equal((await fetch(origin+'/api/project',{headers})).status,200);app.store.mutate=mutate;app.engine.flush();
});
test('blank parent titles preserve descendants but block confirmation, compile and initial project creation',t=>{
 const store=setup(t),doc=structuredClone(store.read().current),block=doc.slides[2].blocks[0];block.label=' ';block.text='- 事实和数字 42 保留';block.contentTree={id:'root-safe',text:'',children:[{id:'note-safe',text:'事实和数字 42 保留',children:[]}]};const before=structuredClone(doc);assert.equal(contentIssues(doc)[0].code,'BLOCK_TITLE_REQUIRED');assert.throws(()=>assertContentReady(doc),e=>e.details.blockId===block.blockId);assert.throws(()=>compileContent(doc),e=>e.code==='BLOCK_TITLE_REQUIRED');assert.equal(prepareContentDraft(doc).report.pages[2].status,'review');store.edit(store.read().revision,doc);assert.throws(()=>store.action(store.read().revision,'confirm'),e=>e.code==='BLOCK_TITLE_REQUIRED');assert.deepEqual(doc,before);
 const other=new ProjectStore(path.join(store.dir,'new-project'));assert.throws(()=>createCapacityPlannedProject(other,doc),e=>e.code==='BLOCK_TITLE_REQUIRED');assert.equal(fs.existsSync(other.file),false);
});
test('cover/body conflicts are caught before generation, omitted first-page role with blocks infers body',()=>{
 const doc=structuredClone(demo);doc.slides[0].blocks=[{blockId:'cover-bad',label:'正文标题',text:'完整事实'}];assert.throws(()=>assertContentReady(doc),e=>e.code==='CONTENT_ROLE_CONFLICT');assert.equal(prepareContentDraft(doc).report.pages[0].status,'review');delete doc.slides[0].role;assert.equal(normalizeDocument(doc).slides[0].role,'body');
 const nested={slides:[{slideId:'s',role:'body',title:'论点',blocks:[{blockId:'b',label:'标题',contentTree:{id:'r',text:'',children:[{id:'n',text:'',children:[{id:'c',text:'保留子事实',children:[]}]}]}}]}]};assert.equal(contentIssues(nested)[0].code,'CONTENT_NODE_TITLE_REQUIRED');
});
test('all registered layouts expose renderer-backed constraints, chart bounds and exact HW variants',()=>{
 const index=layoutContractIndex();assert.ok(index.length>90);for(const {layout} of index){const c=layoutContentContract(layout);assert.equal(c.layout,layout);assert.ok(c.copyBudgets);assert.ok(Array.isArray(c.fillPlan.arrays));assert.ok(c.enforcement.copy);}
 const timeline=layoutContentContract('theme17_content_hw_timeline');assert.deepEqual(timeline.variants.map(v=>v.cards).sort((a,b)=>a-b),[3,4,5,6,7,8]);assert.equal(layoutContentContract('theme17_content_hw_table').selectable,false);const chart=layoutContentContract('theme17_chart_hw_line');assert.ok(chart===null||chart.dataSeries.length);
});
test('browser crashes have an infrastructure code; cancellation interrupts a stalled browser call',async t=>{
 const store=setup(t),ppt=path.join(store.dir,'ppt');fs.mkdirSync(ppt);fs.writeFileSync(path.join(ppt,'index.html'),'<html></html>');const doc={slides:[{slideId:'s',title:'论点',role:'cover',blocks:[]}]},goal={slides:[{layout:'theme17_page001'}]};let closed=0;
 const crash={newPage:async()=>({on(){},goto:async()=>{throw new Error('page.goto: Page crashed');}}),close:async()=>{closed++;}};
 await assert.rejects(()=>validateRenderedContent(ppt,doc,goal,{launchBrowser:async()=>crash}),e=>e.code==='RENDER_BROWSER_CRASH'&&e.details.failedPages[0]===0);assert.ok(closed);
 const controller=new AbortController(),stall={newPage:async()=>({on(){},goto:()=>new Promise(()=>{})}),close:async()=>{closed++;}};const pending=validateRenderedContent(ppt,doc,goal,{signal:controller.signal,launchBrowser:async()=>stall});setTimeout(()=>controller.abort(),50);await assert.rejects(()=>pending,e=>e.name==='AbortError');
});
