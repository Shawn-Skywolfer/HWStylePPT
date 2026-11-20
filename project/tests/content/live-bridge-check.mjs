// Optional real Agent test; intentionally excluded from the ordinary test suite.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {ProjectStore,recordHistory} from '../../scripts/content/store.mjs';
import {makeTask} from '../../scripts/content/proposals.mjs';
import {createTaskEngine} from '../../scripts/content/task-engine.mjs';
import {publicBridgeConfig} from '../../scripts/content/bridge.mjs';
if(process.env.DASHI_LIVE_BRIDGE!=='1')throw new Error('Explicitly set DASHI_LIVE_BRIDGE=1 to run a real configured Agent.');
const dir=path.resolve(`.test-tmp/live-bridge-${Date.now()}`);fs.mkdirSync(dir,{recursive:true});const store=new ProjectStore(dir);store.create(JSON.parse(fs.readFileSync(new URL('../../examples/content-demo.json',import.meta.url),'utf8')));
console.log(JSON.stringify({executor:publicBridgeConfig(dir).detectedKind,projectDir:dir}));
store.mutate(null,p=>{recordHistory(p,'真实桥接验收');p.aiTasks.push(makeTask(p,{bridge:true,execution:'auto',applyMode:'auto',scope:{kind:'selection',slideId:'demo-risks',blockIds:['demo-b3']},prompt:'请将这个内容块的正文改得更精炼，保留原有因果判断，只返回 operations JSON。不要改小标题或其他块。'}));});
const engine=createTaskEngine(store);engine.pump();
try{for(let i=0;i<180;i++){const p=store.read(),task=p.aiTasks.at(-1);if(['accepted','failed'].includes(task.status)){assert.equal(task.status,'accepted',task.error);assert.notEqual(p.current.slides[2].blocks[0].text,p.original.slides[2].blocks[0].text);fs.writeFileSync(path.join(dir,'live-report.json'),JSON.stringify({ok:true,executor:task.progress?.executor || publicBridgeConfig(dir).detectedKind,before:p.original.slides[2].blocks[0].text,after:p.current.slides[2].blocks[0].text},null,2));console.log(fs.readFileSync(path.join(dir,'live-report.json'),'utf8'));process.exitCode=0;break;}if(i===179)throw new Error('Live Agent test timed out');await new Promise(resolve=>setTimeout(resolve,1000));}}finally{engine.close();}
