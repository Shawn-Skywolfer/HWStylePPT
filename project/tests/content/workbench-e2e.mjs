import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { launchExportBrowser } from '../../scripts/preview/launch-export-browser.mjs';
import { ProjectStore } from '../../scripts/content/store.mjs';
import { createWorkbenchServer } from '../../scripts/content/server.mjs';
import { submitProposal } from '../../scripts/content/proposals.mjs';
import { exportEditablePptxFromUrl } from '../../packages/html-deck-to-pptx/src/editable.mjs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const dir=path.resolve(process.env.DASHI_E2E_DIR || `.test-tmp/workbench-e2e-${Date.now()}`);
fs.mkdirSync(dir,{recursive:true});
const demo=JSON.parse(fs.readFileSync(new URL('../../examples/content-demo.json',import.meta.url),'utf8'));
const store=new ProjectStore(dir);store.create(demo,{text:fs.readFileSync(new URL('../../examples/content-source.md',import.meta.url),'utf8')});
const app=createWorkbenchServer(dir);await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${app.server.address().port}/#token=${app.token}`;
const browser=await launchExportBrowser(chromium,{fallbackTmpDirs:[path.join(dir,'.browser-tmp')],log:()=>{}});
let previewServer;
const errors=[], checks=[];
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator('[data-slide="demo-summary"]').waitFor();
  await page.locator('[data-slide="demo-summary"]').click();
  const newTitle='确认后的交接标准带动交付改善';
  await page.locator('textarea[data-field="title"]').fill(newTitle);
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='已保存');
  await page.reload();await page.locator('[data-slide="demo-summary"]').click();
  assert.equal(await page.locator('textarea[data-field="title"]').inputValue(),newTitle);checks.push('第二页标题修改后刷新保留');
  // Exercise the real bridge protocol; this test supplies a labelled test proposal,
  // not a fake production model or a claim of live-provider generation.
  await page.locator('[data-slide="demo-risks"]').click();
  const text=await page.locator('textarea[data-block="demo-b3"][data-field="block"]').inputValue();
  await page.locator('textarea[data-block="demo-b3"][data-field="block"]').evaluate(el=>{el.focus();el.setSelectionRange(0,4);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
  await page.locator('#ai-mode').selectOption('bridge');await page.locator('#prompt').fill('把选中的四个字表达得更清楚');await page.locator('#ask-ai').click();
  await page.waitForFunction(()=>document.querySelector('#ai-state').textContent.includes('等待 Agent'));
  let p=store.read(),task=p.aiTasks.at(-1);assert.equal(task.scope.range.end,4);
  const unaffected=JSON.stringify(p.current.slides[1]);
  store.mutate(p.revision,latest=>submitProposal(latest,task.id,{summary:'E2E 桥接测试提案',operations:[{op:'replaceText',slideId:'demo-risks',target:{field:'block',blockId:'demo-b3',start:0,end:4},before:text.slice(0,4),after:'边界模糊'}]}));
  await page.locator('#view-proposal').waitFor({state:'visible'});await page.locator('#view-proposal').click();
  assert.ok((await page.locator('#modal-body').textContent()).includes('边界模糊'));
  assert.equal(store.read().current.slides[2].blocks[0].text,text);
  await page.locator('#modal-accept').click();
  await page.waitForFunction(()=>document.querySelector('textarea[data-block="demo-b3"][data-field="block"]')?.value.startsWith('边界模糊'));
  assert.equal(store.read().current.slides[2].blocks[0].text,'边界模糊'+text.slice(4));assert.equal(JSON.stringify(store.read().current.slides[1]),unaffected);
  checks.push('真实浏览器选区 → 待处理桥接任务 → 提案差异 → 接受，仅改变目标文字');
  // A whole-page proposal may be rejected without touching the draft.
  await page.locator('#scope').selectOption('slide');await page.locator('#prompt').fill('重新组织本页');await page.locator('#ask-ai').click();
  await page.waitForFunction(()=>document.querySelector('#ai-state').textContent.includes('等待 Agent'));
  p=store.read();task=p.aiTasks.at(-1);const before=JSON.stringify(p.current);
  const replacement=structuredClone(p.current.slides[2]);replacement.title='重新组织后的候选标题';
  store.mutate(p.revision,latest=>submitProposal(latest,task.id,{summary:'E2E 整页测试提案',operations:[{op:'replaceSlide',slideId:'demo-risks',slide:replacement}]}));
  await page.locator('#reject').waitFor({state:'visible'});await page.locator('#reject').click();await page.waitForTimeout(300);
  assert.equal(JSON.stringify(store.read().current),before);checks.push('整页候选拒绝后正式稿未改变');
  await page.locator('#move-up').click();await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='已保存');
  assert.equal(store.read().current.slides[1].slideId,'demo-risks');
  await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelectorAll('.slide-item')[1]?.dataset.slide==='demo-summary');
  checks.push('页面移动、保存与持久撤回');
  await page.locator('[data-slide="demo-actions"]').dragTo(page.locator('[data-slide="demo-summary"]'));
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='已保存');
  assert.equal(store.read().current.slides[1].slideId,'demo-actions');
  await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelectorAll('.slide-item')[1]?.dataset.slide==='demo-summary');
  await page.locator('[data-slide="demo-actions"]').click();await page.locator('#duplicate-slide').click();
  assert.equal(await page.locator('.slide-item').count(),5);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#delete-slide').click();
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent==='已保存');
  assert.equal(store.read().current.slides.length,4);checks.push('真实拖动排序、复制和删除页面后正确保存');
  await page.locator('#confirm-all').click();await page.locator('#generate').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#generate').disabled);
  await page.screenshot({path:path.join(dir,'workbench.png'),fullPage:true});
  await page.locator('#generate').click();
  await page.waitForFunction(()=>{const text=document.querySelector('#generation-state').textContent;return !text.includes('正在调用');},{},{timeout:120000});
  for(let i=0;i<120;i++){p=store.read();if(p.generations.at(-1)?.status!=='running')break;await page.waitForTimeout(1000);}
  p=store.read();const job=p.generations.at(-1);assert.equal(job.status,'ready',job.error);
  const goal=JSON.parse(fs.readFileSync(path.join(dir,job.relativeDir,'goal.json'),'utf8'));
  assert.equal(goal.slides.find(slide=>slide.id==='demo-summary').props.title,newTitle);
  const html=fs.readFileSync(path.join(dir,job.html),'utf8');assert.ok(html.includes(newTitle));assert.ok(html.includes('边界模糊'));
  assert.equal((html.match(/data-fixed-back-cover="true"/g)||[]).length,1);
  checks.push('已确认新文案进入真实 Theme17 HTML，固定封底仅一页');
  // Start a foreground preview for deterministic export; no dependency on daemon lifetime.
  const pptDir=path.join(dir,job.relativeDir,'ppt');
  previewServer=spawn(process.execPath,['scripts/serve-preview-https.mjs',pptDir,'5589'],{cwd:path.resolve(import.meta.dirname,'../..'),env:{...process.env,HOST:'127.0.0.1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let serverLog='';for(const stream of[previewServer.stdout,previewServer.stderr])stream.on('data',data=>{serverLog+=data;});
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5589/')).ok)break;}catch{}await page.waitForTimeout(200);}
  const deckPage=await browser.newPage();await deckPage.goto('http://127.0.0.1:5589/?page=2');await deckPage.locator('#deck > section.slide').first().waitFor();
  assert.equal(await deckPage.locator('#deck > section.slide').count(),5);
  await deckPage.screenshot({path:path.join(dir,'generated-deck.png'),fullPage:true});
  const pptx=path.join(dir,'confirmed-content.pptx');const result=await exportEditablePptxFromUrl(browser,'http://127.0.0.1:5589/',{outFile:pptx,reportFile:path.join(dir,'pptx-export-report.json'),title:demo.title});
  assert.equal(result.slideCount,5);assert.ok(fs.statSync(pptx).size>10000);checks.push('原演示控制台正常打开，并导出 5 页可编辑 PPTX');
  const require=createRequire(import.meta.url), dependencyRequire=createRequire(require.resolve('pptxgenjs')), JSZip=dependencyRequire('jszip');
  const zip=await JSZip.loadAsync(fs.readFileSync(pptx));const xml=await zip.file('ppt/slides/slide2.xml').async('string');
  assert.ok(xml.includes(newTitle));checks.push('PPTX 内部文本确认为最后审核标题，可编辑而非整页截图');
  assert.deepEqual(errors,[]);
  const report={ok:true,checks,browserErrors:errors,projectDir:dir,pptx,job:job.id,exportWarnings:result.warnings||[]};
  fs.writeFileSync(path.join(dir,'e2e-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {
  await browser.close();previewServer?.kill();
  const latest=store.read().generations.at(-1);if(latest?.previewUrl){try{const state=JSON.parse(fs.readFileSync(path.join(dir,latest.relativeDir,'ppt','.preview-server.json'),'utf8'));process.kill(state.pid);}catch{}}
  await new Promise(resolve=>app.server.close(resolve));
}
