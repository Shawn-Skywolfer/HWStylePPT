import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {atomicWriteFile} from '../../scripts/persist-deck-state.mjs';
test('brief Windows destination-handle contention retries atomically without deleting the original',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashi-atomic-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'index.html');fs.writeFileSync(file,'old');let calls=0;
 await atomicWriteFile(file,'new',{rename:async(a,b)=>{calls++;assert.equal(fs.readFileSync(file,'utf8'),'old');if(calls<3)throw Object.assign(new Error('busy'),{code:'EPERM'});await fs.promises.rename(a,b);}});assert.equal(calls,3);assert.equal(fs.readFileSync(file,'utf8'),'new');assert.deepEqual(fs.readdirSync(dir),['index.html']);
});
test('permanent save failure preserves original and cleans only its own temporary file',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dashi-atomic-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'index.html');fs.writeFileSync(file,'old');let calls=0;
 await assert.rejects(atomicWriteFile(file,'new',{rename:async()=>{calls++;throw Object.assign(new Error('disk full'),{code:'ENOSPC'});}}),/disk full/);assert.equal(calls,1);assert.equal(fs.readFileSync(file,'utf8'),'old');assert.deepEqual(fs.readdirSync(dir),['index.html']);
});
