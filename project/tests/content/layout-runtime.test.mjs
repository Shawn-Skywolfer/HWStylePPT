import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {createLayoutRoutes} from '../../scripts/preview/layout-routes.mjs';
test('runtime handshake identifies live protocol and recovery capability, not just files on disk',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashi-runtime-')),handler=createLayoutRoutes({root:process.cwd(),serveRoot:dir,allowed:()=>true});t.after(()=>{handler.close();fs.rmSync(dir,{recursive:true,force:true});});let status,body;const req=Readable.from([]);req.method='GET';await handler(req,{writeHead:n=>status=n,end:v=>body=JSON.parse(v)},new URL('http://localhost/api/layout-runtime'));assert.equal(status,200);assert.equal(body.protocol,2);assert.ok(body.features.includes('automatic-recovery-dialog'));assert.equal(body.version,JSON.parse(fs.readFileSync('package.json')).version);
});
test('stale console cannot enqueue or call an Agent, even with an unavailable page or host',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashi-stale-ui-'));let calls=0;const handler=createLayoutRoutes({root:process.cwd(),serveRoot:dir,allowed:()=>true,bridgeRunner:async()=>{calls++;}});t.after(()=>{handler.close();fs.rmSync(dir,{recursive:true,force:true});});
 for(const layoutProtocol of [undefined,1,3]){const req=Readable.from([Buffer.from(JSON.stringify({slideId:'p22',layout:'theme17_page026',layoutProtocol}))]);req.method='POST';let status,body;await handler(req,{writeHead:n=>status=n,end:v=>body=JSON.parse(v)},new URL('http://localhost/api/layout-adapt'));assert.equal(status,409);assert.equal(body.code,'LAYOUT_CLIENT_OUTDATED');}
 assert.equal(handler.queue.list().length,0);assert.equal(calls,0);
});
