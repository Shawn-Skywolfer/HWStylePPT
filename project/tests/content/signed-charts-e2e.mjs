import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
import {ProjectStore} from '../../scripts/content/store.mjs';
import {createWorkbenchServer} from '../../scripts/content/server.mjs';
import {prepareGeneration,executeGeneration} from '../../scripts/content/generation.mjs';
import {launchExportBrowser} from '../../scripts/preview/launch-export-browser.mjs';
import {exportEditablePptxFromUrl} from '../../packages/html-deck-to-pptx/src/editable.mjs';
process.env.DASHI_PPT_AUTO_OPEN='0';
const dir=path.resolve('.test-tmp/signed-charts-'+Date.now()),store=new ProjectStore(dir),slides=[];
for(const kind of ['bar','column','waterfall'])for(const mixed of [false,true]){
 const id=kind+(mixed?'-mixed':''),suffix=({bar:'条形比较',column:'柱形比较',waterfall:'累计贡献'})[kind]+(mixed?'图文混排':'独立图表');
 slides.push({slideId:id,role:'metrics',title:suffix+'应保留负值方向',conclusion:suffix+'不应改变真实数值与单位。',blocks:[{blockId:id+'-data',type:'chart',label:'真实负值回归',text:'报告数值用于技术测试，不代表同口径比较',evidence:'用户报告摘值，测试用途',data:{kind,labels:['样本甲','样本乙','样本丙'],values:[78.84,-101.02,0],unit:'AUD/MWh'}},...(mixed?[{blockId:id+'-analysis',type:'insight',label:'负值解读',text:'负电价是合法数据，不能变成绝对值或被隐藏。'}]:[])]});
}
store.create({title:'有符号图表回归',brief:{workflowMode:'fine',audience:'维护者',occasion:'回归测试',priority:'保留真实数值与层级',confirmed:true},slides});
const app=createWorkbenchServer(dir),checks=[];let browser;
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
try{
 browser=await launchExportBrowser(chromium,{log:()=>{}});const page=await browser.newPage({viewport:{width:1700,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+app.server.address().port+'/#token='+app.token;
 await page.goto(url);await page.locator('[data-node="deck"]').waitFor();
 assert.equal(await page.locator('.map-node').count(),slides.length+1);assert.equal(await page.locator('[data-kind="block"]').count(),0);checks.push('首次仅展示根主题和一层页面标题');
 await page.locator('[data-slide="bar-mixed"]').click();await page.locator('[data-node="b:bar-mixed-data"]').waitFor();
 assert.equal(await page.locator('[data-node="b:column-data"]').count(),0);checks.push('选择某页只展开本页，不展开其他页面');
 await page.reload();await page.locator('[data-node="b:bar-mixed-data"]').waitFor();checks.push('刷新保留手动展开状态');
 await page.locator('#collapse-all').click();assert.equal(await page.locator('.map-node').count(),slides.length+1);checks.push('折叠分支恢复一层总览');
 const p=store.action(store.read().revision,'confirm'),prepared=prepareGeneration(store,p.revision);
 await executeGeneration(store,prepared.job.id);const job=store.read().generations.at(-1);assert.equal(job.status,'ready',job.error);
 const folder=path.join(dir,job.relativeDir),report=JSON.parse(fs.readFileSync(path.join(folder,'rendered-validation.json')));assert.equal(report.ok,true);assert.equal(report.checks.filter(c=>c.chart).length,6);checks.push('六种负值图表组合通过完整生成和页面实测');
 await page.goto(job.previewUrl+'?page=2',{waitUntil:'networkidle'});await page.screenshot({path:path.join(dir,'signed-mixed-bar.png')});
 if(await page.locator('body').evaluate(el=>el.classList.contains('editor-panels-collapsed')))await page.locator('#preview-panel-collapse').click();
 await page.locator('.preview-data-entry').click();const value=page.locator('.preview-data-grid input[type="number"]').first();await value.fill('-120.5');await value.press('Tab');await page.waitForFunction(()=>document.querySelectorAll('#deck>.slide')[1].querySelector('[data-chart-value="-120.5"]'));await page.locator('#preview-undo').click();await page.waitForFunction(()=>document.querySelectorAll('#deck>.slide')[1].querySelector('[data-chart-value="78.84"]'));checks.push('离线内联图表渲染器完整，控制台改为负数后立即重绘且可撤销');
 await page.goto(job.previewUrl+'?page=6',{waitUntil:'networkidle'});await page.screenshot({path:path.join(dir,'signed-mixed-waterfall.png')});
 const out=path.join(dir,'signed-charts.pptx');await exportEditablePptxFromUrl(browser,job.previewUrl,{outFile:out,title:'负值图表回归'});
 const require=createRequire(import.meta.url),JSZip=createRequire(require.resolve('pptxgenjs'))('jszip'),zip=await JSZip.loadAsync(fs.readFileSync(out));
 for(let i=1;i<=6;i++){const xml=await zip.file(`ppt/slides/slide${i}.xml`).async('string');assert.ok(xml.includes('-101.02'));assert.ok(xml.includes('AUD/MWh'));}
 checks.push('可编辑PPTX六页均保留负数文本和单位');assert.deepEqual(errors,[]);
 const result={ok:true,checks,projectDir:dir};fs.writeFileSync(path.join(dir,'signed-charts-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{
 await browser?.close();app.engine.close();await new Promise(r=>app.server.close(r));
 const job=store.read().generations.at(-1);if(job?.previewUrl)try{process.kill(JSON.parse(fs.readFileSync(path.join(dir,job.relativeDir,'ppt/.preview-server.json'))).pid);}catch{}
}
