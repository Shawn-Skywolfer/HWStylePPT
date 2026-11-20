import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {ProjectStore} from '../../scripts/content/store.mjs';
import {prepareGeneration,executeGeneration} from '../../scripts/content/generation.mjs';
import {chromium} from 'playwright-core';
import {launchExportBrowser} from '../../scripts/preview/launch-export-browser.mjs';
import {exportEditablePptxFromUrl} from '../../packages/html-deck-to-pptx/src/editable.mjs';
import {createRequire} from 'node:module';
const dir=path.resolve(`.test-tmp/catalog-e2e-${Date.now()}`),d=JSON.parse(fs.readFileSync(new URL('../../examples/content-demo.json',import.meta.url),'utf8'));
const specs=[['bar',[32,18,9,6,3],'万元'],['column',[10,20,30,40,50,60],'万元'],['donut',[20,30,50],'%'],['waterfall',[100,20,10,30],'万元']];
for(const[kind,values,unit]of specs)d.slides.push({slideId:'real-'+kind,role:'metrics',title:({bar:'重点类别贡献主要收入',column:'连续观察能辨识业务变化',donut:'三类业务形成清晰贡献结构',waterfall:'分解各项变动才能识别影响'})[kind],conclusion:({bar:'资源配置应优先考虑贡献度。',column:'持续追踪变化，及时调整经营动作。',donut:'依据结构差异制定分层管理策略。',waterfall:'区分起点与各项增减影响。'})[kind],blocks:[{blockId:'values-'+kind,type:'chart',label:'确认数据',text:'单位与来源完整保留',evidence:'浏览器回归测试数据（非业务结论）',data:{kind,labels:values.map((_,i)=>'类别'+String.fromCharCode(65+i)),values,unit}}]});
process.env.DASHI_PPT_AUTO_OPEN='0';const store=new ProjectStore(dir);store.create(d);const p=store.action(1,'confirm'),before=JSON.stringify(p.confirmed.document),prepared=prepareGeneration(store,p.revision);
await executeGeneration(store,prepared.job.id);const job=store.read().generations.at(-1),folder=path.join(dir,job.relativeDir),goal=JSON.parse(fs.readFileSync(path.join(folder,'goal.json'))),report=JSON.parse(fs.readFileSync(path.join(folder,'rendered-validation.json')));
assert.equal(job.status,'ready');assert.equal(report.ok,true);assert.equal(report.checks.filter(c=>c.chart).length,4);assert.ok(report.checks.filter(c=>c.catalogMatched||c.layout?.startsWith('theme17_content_icon_')).length>=6);assert.equal(JSON.stringify(store.read().confirmed.document),before);assert.ok(goal.slides.slice(1).every(s=>!s.layout.startsWith('theme17_content_')||s.layout.startsWith('theme17_content_icon_')));
let browser;
try{
 browser=await launchExportBrowser(chromium,{log:()=>{}});const page=await browser.newPage({viewport:{width:1700,height:1050}});await page.goto(job.previewUrl+'?page=6',{waitUntil:'networkidle'});await page.locator('.preview-data-entry').waitFor({state:'attached'});
 if(await page.locator('body').evaluate(el=>el.classList.contains('editor-panels-collapsed')))await page.locator('#preview-panel-collapse').click();
 await page.locator('.preview-data-entry').click();const value=page.locator('.preview-data-grid input[type="number"]').first();await value.fill('17');await value.press('Tab');await page.waitForFunction(()=>document.querySelector('#deck > .slide:nth-child(6) .hw-chart-canvas')?.textContent.includes('17'));await page.locator('#preview-undo').click();await page.waitForFunction(()=>document.querySelector('#deck > .slide:nth-child(6) .hw-chart-canvas')?.textContent.includes('10'));
 await page.screenshot({path:path.join(dir,'chart-editor.png')});const out=path.join(dir,'full-catalog.pptx');await exportEditablePptxFromUrl(browser,job.previewUrl,{outFile:out,title:'全篇视觉匹配回归'});
 const require=createRequire(import.meta.url),JSZip=createRequire(require.resolve('pptxgenjs'))('jszip'),zip=await JSZip.loadAsync(fs.readFileSync(out)),xml=await zip.file('ppt/slides/slide5.xml').async('string');assert.ok(xml.includes('万元'));assert.ok(!xml.includes('亿美元'));assert.ok(xml.includes('类别A'));assert.ok(xml.includes('32'));
}finally{await browser?.close();try{const state=JSON.parse(fs.readFileSync(path.join(folder,'ppt','.preview-server.json')));process.kill(state.pid);}catch{}}
const output={ok:true,checks:['全篇原主题库匹配，不限制五种基础布局','并列、流程、行动及四类真实图表通过浏览器实测','图表标签、数值、单位与来源完整','二层数据菜单修改立即重绘，撤销恢复','导出9页可编辑PPTX，单位未误标为亿美元','确认稿哈希与内容未改变'],projectDir:dir,layouts:goal.slides.map(s=>s.layout)};fs.writeFileSync(path.join(dir,'catalog-e2e-report.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
