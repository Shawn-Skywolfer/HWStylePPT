import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import { ProjectStore,storageError } from '../../scripts/content/store.mjs';
import { clone, statusOf, digest } from '../../scripts/content/model.mjs';
import { makeTask, previewProposal, submitProposal, decideProposal, modelMessages } from '../../scripts/content/proposals.mjs';
import { compileContent, migrateGoal } from '../../scripts/content/compile.mjs';
import { prepareGeneration } from '../../scripts/content/generation.mjs';
import { createWorkbenchServer } from '../../scripts/content/server.mjs';
import { saveProviderConfig, publicProviderConfig, callModel } from '../../scripts/content/provider.mjs';

const demo = JSON.parse(fs.readFileSync(new URL('../../examples/content-demo.json', import.meta.url), 'utf8'));
function setup(t) { const root = path.resolve(process.env.DASHI_TEST_TMP || '.test-tmp'); fs.mkdirSync(root,{recursive:true}); const dir = fs.mkdtempSync(path.join(root, 'dashi-content-test-')); t.after(() => fs.rmSync(dir,{recursive:true,force:true})); const store = new ProjectStore(dir); store.create(clone(demo), {text:'原始材料'}); return store; }
const edit = (store, fn) => { const p = store.read(), doc = clone(p.current); fn(doc); return store.edit(p.revision, doc); };
test('goal-copy validates public count aliases without bypassing genuine count or keyword errors',t=>{
 const dir=path.resolve('.test-tmp/count-alias-'+crypto.randomUUID());fs.mkdirSync(dir,{recursive:true});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const spec=path.join(dir,'goal.json'),html=path.join(dir,'index.html'),title='专业知识需要持续积累';fs.writeFileSync(spec,JSON.stringify({title,goal:title,slides:[{layout:'theme17_page015'}]}));
 const check=(itemCount,internal)=>{const props={itemCount,conclusions:[{label:'积累',text:'持续积累'},{label:'复用',text:'反复复用'}],...(internal==null?{}:{conclusionCount:internal})},controls=JSON.stringify([{key:'conclusionCount',publicKey:'itemCount',countArrays:['conclusions'],min:1,max:4}]).replaceAll('"','&quot;');fs.writeFileSync(html,`<section data-vm-slide-id="p06" data-prop-controls="${controls}">${title}</section><script id="deck-view-model" type="application/json">${JSON.stringify({slides:[{id:'p06',layout:'theme17_page015',props}]})}</script>`);return spawnSync(process.execPath,['scripts/validate-goal-copy.mjs',spec,html],{cwd:process.cwd(),encoding:'utf8',windowsHide:true});};
 const valid=check(2);assert.equal(valid.status,0,valid.stderr);assert.notEqual(check(9).status,0);assert.match(check(2,1).stderr,/数量不一致/);fs.writeFileSync(spec,JSON.stringify({title:'全球原油期货变化',goal:'布伦特风险溢价'}));assert.match(check(2).stderr,/没有命中用户目标关键词/);
});

test('Unicode project locks release without recursive rm, including stale lock recovery',t=>{
 const dir=path.resolve('.test-tmp/中文保存-'+crypto.randomUUID());fs.mkdirSync(dir,{recursive:true});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=new ProjectStore(dir),rm=fs.rmSync;
 fs.rmSync=(...args)=>{if(args[1]?.recursive&&String(args[0]).includes('中文保存'))return;return rm(...args);};
 try{store.create(clone(demo));for(let i=0;i<3;i++){store.mutate(null,()=>{});assert.equal(fs.existsSync(store.lock),false);}fs.mkdirSync(store.lock);fs.writeFileSync(path.join(store.lock,'owner.json'),JSON.stringify({pid:2147483647}));store.mutate(null,()=>{});assert.equal(fs.existsSync(store.lock),false);}finally{fs.rmSync=rm;}
});
test('storage failures are actionable and never clear read-only protections automatically',()=>{const e=storageError(Object.assign(new Error('private raw failure'),{code:'EEXIST',syscall:'mkdir',path:'C:/private/project/.content.lock'}));assert.equal(e.code,'PROJECT_STORAGE_FAILED');assert.equal(e.details.target,'.content.lock');assert.equal(e.details.systemCode,'EEXIST');assert.ok(!e.message.includes('C:/private'));assert.match(e.message,/保留当前页面/);});
test('unexpected save errors are logged without document, prompts or authorization token',async t=>{
 const store=setup(t),app=createWorkbenchServer(store.dir,{token:'private-test-token',runtimeProbe:async()=>({canSpawn:false})});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.server.close(r)));app.store.mutate=()=>{throw Object.assign(new Error('raw'),{code:'EEXIST',syscall:'mkdir',path:path.join(store.dir,'.content.lock')});};
 const res=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/document',{method:'POST',headers:{'content-type':'application/json','x-workbench-token':'private-test-token'},body:JSON.stringify({revision:1,document:demo})}),out=await res.json();assert.equal(res.status,503);assert.equal(out.code,'PROJECT_STORAGE_FAILED');assert.equal(out.details.systemCode,'EEXIST');const log=fs.readFileSync(path.join(store.dir,'.private/workbench-errors.jsonl'),'utf8');assert.ok(log.includes('EEXIST'));assert.ok(!log.includes('private-test-token'));assert.ok(!log.includes(demo.slides[1].blocks[0].text));
});
function textResult(task, after = '责任边界清晰才能缩短处理链条。') { return { summary:'精炼段落', operations:[{op:'replaceText',slideId:'demo-risks',target:{field:'block',blockId:'demo-b3'},before:task.baseDocument.slides[2].blocks[0].text,after}] }; }

test('atomic persistence, stable IDs, original restoration and durable undo/redo', t => {
  const store = setup(t), original = store.read().original;
  let p = edit(store, doc => { doc.slides[1].title = '新标题持久保留'; });
  assert.equal(new ProjectStore(store.dir).read().current.slides[1].title,'新标题持久保留');
  assert.deepEqual(p.original, original); assert.equal(p.current.slides[1].slideId,'demo-summary');
  assert.equal(p.current.slides[1].version,2);
  p = store.action(p.revision,'undo'); assert.equal(p.current.slides[1].title,original.slides[1].title);
  p = new ProjectStore(store.dir).action(p.revision,'redo'); assert.equal(p.current.slides[1].title,'新标题持久保留');
  p = store.action(p.revision,'restore',{id:'original'}); assert.equal(p.current.slides[1].title,original.slides[1].title);
  assert.equal(fs.readdirSync(store.dir).some(name=>name.includes('.tmp-')),false);
});
test('optimistic conflict and cross-process lock protect saved content', t => {
  const store=setup(t), before=store.read(); edit(store,doc=>{doc.slides[1].title='窗口甲';});
  assert.throws(()=>store.edit(before.revision,before.current),error=>error.code==='VERSION_CONFLICT');
  fs.mkdirSync(store.lock); fs.writeFileSync(path.join(store.lock,'owner.json'),JSON.stringify({pid:process.pid}));
  assert.throws(()=>store.action(null,'confirm'),error=>error.code==='PROJECT_BUSY');
  fs.rmSync(store.lock,{recursive:true}); assert.equal(store.read().current.slides[1].title,'窗口甲');
});
test('confirmation gate, content edits invalidate only changed pages and keep confirmed snapshots', t => {
  const store=setup(t);
  assert.throws(()=>prepareGeneration(store,1),error=>error.code==='CONFIRMATION_REQUIRED');
  let p=store.action(1,'confirm',{slideId:'demo-summary'}); assert.equal(statusOf(p).canGenerate,false);
  p=store.action(p.revision,'confirm'); assert.equal(statusOf(p).canGenerate,true);
  const confirmed=clone(p.confirmed);
  p=edit(store,doc=>{doc.slides[1].blocks[0].text='变更后的正式内容';});
  assert.equal(p.current.slides[1].status,'editing'); assert.equal(p.current.slides[2].status,'confirmed');
  assert.equal(statusOf(p).canGenerate,false); assert.deepEqual(p.confirmed,confirmed);
});
test('reorder and deletion persist, order normalized, original unchanged', t => {
  const store=setup(t); const p=edit(store,doc=>{[doc.slides[1],doc.slides[2]]=[doc.slides[2],doc.slides[1]];doc.slides.pop();});
  assert.deepEqual(p.current.slides.map(s=>s.slideId),['demo-cover','demo-risks','demo-summary']);
  assert.deepEqual(p.current.slides.map(s=>s.order),[1,2,3]); assert.equal(p.original.slides.length,4);
});
test('selection proposal changes only UTF-16 range and is never applied before acceptance', t => {
  const store=setup(t), base=store.read(); const value=base.current.slides[2].blocks[0].text;
  const task=makeTask(base,{scope:{kind:'selection',slideId:'demo-risks',range:{field:'block',blockId:'demo-b3',start:0,end:4}},prompt:'精炼',bridge:true});
  const result={summary:'局部修改',operations:[{op:'replaceText',slideId:'demo-risks',target:{field:'block',blockId:'demo-b3',start:0,end:4},before:value.slice(0,4),after:'界面清晰'}]};
  let proposal;
  let p=store.mutate(base.revision,project=>{project.aiTasks.push(task);proposal=submitProposal(project,task.id,result);});
  assert.deepEqual(p.current,base.current); assert.equal(proposal.candidate.slides[2].blocks[0].text,'界面清晰'+value.slice(4));
  p=store.mutate(p.revision,project=>decideProposal(project,proposal.id,true));
  assert.equal(p.current.slides[2].blocks[0].text,'界面清晰'+value.slice(4));
  assert.deepEqual(p.current.slides[1],base.current.slides[1]); assert.equal(p.original.slides[2].blocks[0].text,value);
});
test('scope boundaries reject range widening, other block/page and structural edits', t => {
  const p=setup(t).read(); const task=makeTask(p,{scope:{kind:'selection',slideId:'demo-risks',blockIds:['demo-b3']},prompt:'精炼'});
  const result=textResult(task);
  for(const operation of [{...result.operations[0],slideId:'demo-summary'},{...result.operations[0],target:{field:'block',blockId:'demo-b4'}},{op:'deleteSlide',slideId:'demo-risks'}]) assert.throws(()=>previewProposal(task,{operations:[operation]}),error=>error.code==='SCOPE_VIOLATION');
  const range=makeTask(p,{scope:{kind:'selection',slideId:'demo-risks',range:{field:'block',blockId:'demo-b3',start:0,end:4}},prompt:'精炼'});
  assert.throws(()=>previewProposal(range,result),error=>error.code==='SCOPE_VIOLATION');
  assert.throws(()=>previewProposal(task,{operations:[{...result.operations[0],before:'错的原文'}]}));
});
test('number protection, stale proposal and whole-page review/reject', t => {
  const store=setup(t);let p=edit(store,doc=>{doc.slides[2].blocks[0].text='交付周期为12天。';});
  const task=makeTask(p,{scope:{kind:'slide',slideId:'demo-risks'},prompt:'重组本页'});
  assert.throws(()=>previewProposal(task,textResult(task,'交付周期为10天。')),error=>error.code==='FACT_GUARD');
  let proposal;p=store.mutate(p.revision,project=>{project.aiTasks.push(task);const next=clone(task.baseDocument.slides[2]);next.title='统一标准能改善交付效率';proposal=submitProposal(project,task.id,{summary:'重组本页',operations:[{op:'replaceSlide',slideId:'demo-risks',slide:next}]});});
  assert.notEqual(p.current.slides[2].title,proposal.candidate.slides[2].title);
  p=store.mutate(p.revision,project=>decideProposal(project,proposal.id,false));assert.equal(p.proposals[0].status,'rejected');
  const task2=makeTask(p,{scope:{kind:'slide',slideId:'demo-risks'},prompt:'精炼'});
  p=store.mutate(p.revision,project=>{project.aiTasks.push(task2);proposal=submitProposal(project,task2.id,textResult(task2,'统一责任后，交付周期为12天。'));});
  p=edit(store,doc=>{doc.slides[1].title='另一个页面修改';});
  assert.throws(()=>store.mutate(p.revision,project=>decideProposal(project,proposal.id,true)),error=>error.code==='STALE_PROPOSAL');
});
test('deck-level delete/reorder proposal is previewed and preserves original', t => {
  const p=setup(t).read(),task=makeTask(p,{scope:{kind:'deck'},prompt:'删重复页并重排'});
  const candidate=previewProposal(task,{operations:[{op:'deleteSlide',slideId:'demo-summary'},{op:'reorderSlides',slideIds:['demo-cover','demo-actions','demo-risks']}]});
  assert.equal(p.current.slides.length,4);assert.deepEqual(candidate.slides.map(s=>s.slideId),['demo-cover','demo-actions','demo-risks']);
});
test('confirmed copy maps to semantic Theme17 contracts without fragmentation or truncation', t => {
  const store=setup(t);let p=edit(store,doc=>{doc.slides[1].title='确认后的标题准确进入幻灯片';});p=store.action(p.revision,'confirm');
  const compiled=compileContent(p.confirmed.document,{projectId:p.projectId,confirmedId:p.confirmed.id});
  assert.equal(compiled.goal.themePack,'theme17');assert.equal(compiled.goal.slides[1].props.title,'确认后的标题准确进入幻灯片');
  assert.ok(compiled.goal.slides.slice(1).every(s=>/^theme17_page|^theme17_content_(icon_|hw_)/.test(s.layout)));assert.equal(new Set(compiled.goal.slides.slice(1).map(s=>s.layout)).size,3);
  assert.ok(compiled.design.every(p=>p.candidates.length>1));
  assert.equal(compiled.mapping.slides[1].blocks[0].blockId,'demo-b1');
  const long=clone(p.current);long.slides[1].title='超长'.repeat(30);
  assert.throws(()=>compileContent(long),error=>error.code==='LAYOUT_REVIEW_REQUIRED');
  assert.equal(p.current.slides[1].title,'确认后的标题准确进入幻灯片');
});
test('legacy migration roundtrip keeps values, media and original goal', t => {
  const original=compileContent(setup(t).read().current).goal; const migrated=migrateGoal(original);
  const roundtrip=compileContent(migrated.document,{legacyGoal:migrated.migration.originalGoal}).goal;
  assert.deepEqual(roundtrip.slides.map(s=>s.props),original.slides.map(s=>s.props));
  assert.deepEqual(migrated.migration.originalGoal,original);assert.ok(migrated.migration.warnings.length);
});
test('20-page content plan searches rich contracts before safe reusable fallback', t => {
  const doc=clone(demo);doc.slides=[doc.slides[0],...Array.from({length:19},(_,i)=>({slideId:`s-${i}`,role:'body',title:`管理动作${i+1}需要形成闭环`,conclusion:`以责任和验收标准推动第${i+1}项任务落地。`,blocks:[{blockId:`b-${i}`,label:'推进动作',type:'paragraph',text:'明确负责人，并持续追踪完成情况。'}]}))];
  const result=compileContent(doc);assert.equal(result.goal.slides.length,20);assert.ok(result.design.some(p=>!p.fallback));assert.ok(result.design.some(p=>p.fallback));
  assert.ok(result.mapping.slides.slice(1).every(s=>s.blocks.length===1));
  for(const s of doc.slides.slice(1))assert.ok(JSON.stringify(result.goal.slides.find(g=>g.id===s.slideId).props).includes(s.blocks[0].text));
  assert.equal(JSON.stringify(result.goal.slides).includes('AI Capital'),false);
});
test('explicit real chart data is preserved and never replaced by fabricated defaults', t => {
  const doc=clone(demo);doc.slides=[doc.slides[0],{slideId:'chart-1',role:'metrics',title:'重点区域贡献主要收入',conclusion:'资源应优先覆盖高贡献区域。',blocks:[{blockId:'chart-data',type:'chart',label:'收入',text:'按确认口径',data:{kind:'bar',labels:['区域甲','区域乙','区域丙','区域丁','区域戊'],values:[32,18,9,6,3],unit:'万元'},evidence:'内部台账'}]}];
  const compiled=compileContent(doc);assert.deepEqual(compiled.goal.slides[1].props.items.map(row=>row.value),[32,18,9,6,3]);assert.equal(compiled.goal.slides[1].props.unit,'万元');assert.ok(compiled.mapping.slides[1].blocks.some(block=>block.blockId==='chart-data'));
});
test('HTTP access checks, version conflicts and private model keys', async t => {
  const store=setup(t),app=createWorkbenchServer(store.dir);await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>app.server.close(resolve)));
  const base=`http://127.0.0.1:${app.server.address().port}`,headers={'x-workbench-token':app.token,'content-type':'application/json'};
  assert.equal((await fetch(base+'/api/project')).status,401);
  assert.equal((await fetch(base+'/.private/model.json')).status,404);
  assert.equal((await fetch(base+'/api/project',{headers:{...headers,origin:'http://malicious.invalid'}})).status,403);
  const get=await(await fetch(base+'/api/project',{headers})).json();
  const response=await fetch(base+'/api/action',{method:'POST',headers,body:JSON.stringify({revision:get.project.revision,action:'confirm'})});assert.equal(response.status,200);
  const conflict=await fetch(base+'/api/action',{method:'POST',headers,body:JSON.stringify({revision:get.project.revision,action:'confirm'})});assert.equal(conflict.status,409);
  await fetch(base+'/api/model',{method:'POST',headers,body:JSON.stringify({baseUrl:'http://127.0.0.1:8000/v1',model:'internal',apiKey:'test-secret-not-a-real-key'})});
  const safe=await(await fetch(base+'/api/model',{headers})).text();assert.equal(safe.includes('test-secret'),false);assert.ok(JSON.parse(safe).hasApiKey);
});
test('OpenAI-compatible live HTTP protocol fixture and explicit connection errors', async t => {
  const store=setup(t);let captured;
  const fixture=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;captured={path:req.url,body:JSON.parse(body),key:req.headers.authorization};res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'protocol fixture',operations:[]})}}]}));});
  await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>fixture.close(resolve)));
  saveProviderConfig(store.dir,{baseUrl:`http://127.0.0.1:${fixture.address().port}/v1`,model:'fixture-model',apiKey:'fixture-only'});
  const result=await callModel(store.dir,[{role:'user',content:'协议测试'}]);assert.equal(result.summary,'protocol fixture');assert.equal(captured.path,'/v1/chat/completions');assert.equal(captured.body.model,'fixture-model');assert.equal(captured.key,'Bearer fixture-only');assert.equal(publicProviderConfig(store.dir).apiKey,undefined);
  saveProviderConfig(store.dir,{baseUrl:'http://127.0.0.1:1/v1',model:'fixture-model'});
  await assert.rejects(callModel(store.dir,[]),error=>error.code==='MODEL_CONNECTION_FAILED');
});
