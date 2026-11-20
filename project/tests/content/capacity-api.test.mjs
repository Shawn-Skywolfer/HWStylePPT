import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ProjectStore} from '../../scripts/content/store.mjs';import {createWorkbenchServer} from '../../scripts/content/server.mjs';
const fixture=()=>({title:'容量接口回归',brief:{audience:'管理层',occasion:'内部汇报',priority:'完整内容',confirmed:true},slides:[{slideId:'s',role:'body',title:'八项长事实应完整保留',blocks:Array.from({length:8},(_,i)=>({blockId:'b'+i,label:'观点'+i,text:('第'+i+'项内容，完整保留具体条件和管理责任。').repeat(14)}))}]});
test('capacity preview is read-only; confirmation cannot bypass it; stale or forged plans cannot apply',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashi-capacity-api-')),store=new ProjectStore(dir);store.create(fixture());const app=createWorkbenchServer(dir);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{app.engine.close();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.server.address().port,headers={'content-type':'application/json','x-workbench-token':app.token};
 const post=async(route,data)=>{const p=store.read(),r=await fetch(base+'/api/'+route,{method:'POST',headers,body:JSON.stringify({revision:p.revision,contentRevision:p.contentRevision,...data})});return {status:r.status,body:await r.json()};};
 const bytes=fs.readFileSync(store.file),preview=await post('capacity',{action:'preview'});assert.equal(preview.status,200);assert.equal(preview.body.report.changed,true);assert.equal(Buffer.compare(bytes,fs.readFileSync(store.file)),0);
 const blocked=await post('action',{action:'confirm'});assert.equal(blocked.status,422);assert.equal(blocked.body.code,'CAPACITY_REVIEW_REQUIRED');assert.equal(blocked.body.details.slideId,'s');
 const forged=await post('capacity',{action:'apply',sourceHash:preview.body.report.sourceHash,planHash:'wrong'});assert.equal(forged.status,409);
 const old=store.read(),changed=structuredClone(old.current);changed.slides[0].blocks[0].text+='新的手工内容。';store.edit(old.revision,changed);
 const stale=await post('capacity',{action:'apply',sourceHash:preview.body.report.sourceHash,planHash:preview.body.report.planHash});assert.equal(stale.status,409);assert.equal(store.read().current.slides.length,1);
 const fresh=(await post('capacity',{action:'preview'})).body.report,applied=await post('capacity',{action:'apply',sourceHash:fresh.sourceHash,planHash:fresh.planHash});assert.equal(applied.status,200);assert.ok(store.read().current.slides.length>1);assert.ok(store.read().current.slides[0].blocks[0].text.endsWith('新的手工内容。'));
 const confirmed=await post('action',{action:'confirm'});assert.equal(confirmed.status,200);
});
