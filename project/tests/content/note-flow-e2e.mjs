import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {launchExportBrowser} from '../../scripts/preview/launch-export-browser.mjs';
import {iconMarkup} from '../../assets/huawei-icon-layout.mjs';
import {ICON_TYPES} from '../../assets/huawei-icons.mjs';
import {contentNoteIssues} from '../../assets/content-note-layout.mjs';
const browser=await launchExportBrowser(chromium),page=await browser.newPage({viewport:{width:1280,height:720}});
let cases=0;
try{
 for(const [mode,def]of Object.entries(ICON_TYPES)){
  const cards=Array.from({length:def.min},(_,i)=>({label:'业务场景'+i,text:'中文与 OfficeAce Session 混排。\n保留业务条件与输出边界。',evidence:'来源备注 V4'}));
  const props={title:'正文备注排布',cards,layout:{nodes:cards.map((_,i)=>({id:'block-'+i})),edges:[]}};
  const render=async()=>{await page.setContent('<style>body{margin:0}.hw-content .hw-card h2{border-top:3px solid #c7000b;padding-top:10px}.hw-content .hw-card p{line-height:1.45}</style><div class="hw-content hw-icon-canvas">'+iconMarkup(props,mode)+'</div>');await page.evaluate('window.__contentNoteIssues='+contentNoteIssues.toString());await page.evaluate(()=>document.fonts.ready);};
  await render();assert.deepEqual(await page.evaluate(()=>window.__contentNoteIssues(document.body)),[],mode);
  const before=await page.locator('[data-content-field="evidence"]').first().evaluate(e=>e.getBoundingClientRect().top);
  await page.evaluate(()=>{const body=document.querySelector('[data-content-field="text"]');body.style.fontSize='27px';body.innerHTML+='<br>新增内容';});
  assert.deepEqual(await page.evaluate(()=>window.__contentNoteIssues(document.body)),[],mode+'/font-edit');
  const after=await page.locator('[data-content-field="evidence"]').first().evaluate(e=>e.getBoundingClientRect().top);assert.ok(after>before,mode+' note follows actual added height');
  await render();assert.deepEqual(await page.evaluate(()=>window.__contentNoteIssues(document.body)),[],mode+'/rerender');cases++;
 }
 await page.setContent('<article data-content-block="bad" style="position:relative"><p data-content-field="text">正文第一行<br>正文最后一行</p><p data-content-field="evidence" style="position:absolute;top:0">错误备注</p></article>');await page.evaluate('window.__contentNoteIssues='+contentNoteIssues.toString());assert.equal((await page.evaluate(()=>window.__contentNoteIssues(document.body)))[0].code,'CONTENT_NOTE_OVERLAP');
}finally{await browser.close();}
console.log(JSON.stringify({ok:true,iconFamilies:cases,checks:['mixed-script','newlines','font-edit','rerender','overlap-rejection']}));
