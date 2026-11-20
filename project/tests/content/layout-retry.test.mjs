import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createLayoutRoutes} from '../../scripts/preview/layout-routes.mjs';
test('delete endpoint enforces eligible states atomically and removes stopped tasks from durable state',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashi-delete-route-')),handler=createLayoutRoutes({root:process.cwd(),serveRoot:dir,allowed:()=>true});const send=async ids=>{let status,output;const req=Readable.from([Buffer.from(JSON.stringify({ids}))]);req.method='POST';const res={writeHead:n=>status=n,end:v=>output=JSON.parse(v)};await handler(req,res,new URL('http://localhost/api/layout-delete'));return {status,output};};
 try{const a=handler.queue.enqueue({slideId:'a',layout:'theme17_page050'},{kind:'direct'}),b=handler.queue.enqueue({slideId:'b',layout:'theme17_page041'},{kind:'adapt'});a.status='failed';b.status='running';handler.queue.persist();assert.equal((await send([a.id,b.id])).status,422);assert.equal(handler.queue.list().length,2);b.status='cancelled';const result=await send([a.id,b.id]);assert.equal(result.status,200);assert.deepEqual(result.output.deleted,[a.id,b.id]);assert.equal(JSON.parse(fs.readFileSync(handler.queue.file)).jobs.length,0);assert.equal(fs.existsSync(path.join(handler.queue.root,a.id+'.jsonl')),false);}
 finally{handler.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('legacy single and batch resume cannot replay ended task input; audit state is unchanged',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashi-retry-')),handler=createLayoutRoutes({root:process.cwd(),serveRoot:dir,allowed:()=>true});
 const request=async(route,body)=>{let status,output;const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method='POST';const res={writeHead:n=>status=n,end:v=>output=JSON.parse(v)};await handler(req,res,new URL('http://localhost/api/layout-'+route));return {status,output};};
 try{for(const status of ['failed','cancelled','conflict']){const j=handler.queue.enqueue({slideId:status,layout:'theme17_page050',edits:[{before:'old',after:'stale'}]},{kind:'direct'});j.status=status;handler.queue.persist();const before=structuredClone(j),logs=handler.queue.logs(j.id);const single=await request('control',{id:j.id,action:'resume'});assert.equal(single.status,422);assert.match(single.output.error,/历史任务不能直接继续/);const batch=await request('batch-control',{ids:[j.id],action:'resume'});assert.equal(batch.status,200);assert.equal(batch.output.results[0].ok,false);assert.deepEqual(handler.queue.get(j.id),before);assert.deepEqual(handler.queue.logs(j.id),logs);}}
 finally{handler.close();fs.rmSync(dir,{recursive:true,force:true});}
});
