import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {launchExportBrowser} from '../../scripts/preview/launch-export-browser.mjs';
import {chartMarkup} from '../../assets/huawei-chart-view.mjs';import {originalMarkup,originalGeometry} from '../../assets/hw-original-view.mjs';import {HW_DEFINITIONS} from '../../src/components/hw/contracts.mjs';
const browser=await launchExportBrowser(chromium),page=await browser.newPage(),out=process.argv[2],fixture=process.argv[3];let circles=0,media=0;
try{
 for(const mixed of [false,true])for(const count of [2,3,4,5,6]){
  const items=Array.from({length:count},(_,i)=>({label:'项目'+(i+1),value:i===0?100-(count-1)*5:5})),p={title:'收益构成',lead:'区分收入来源',items,analysis:mixed?[{label:'口径',text:'同一时点的百分比构成。'}]:[]};
  await page.setContent('<style>body{margin:0}</style><div class="hw-chart-canvas">'+chartMarkup(p,'donut')+'</div>');
  const geometry=await page.locator('circle').evaluateAll(list=>list.map(e=>{const m=e.getScreenCTM(),r=e.getBoundingClientRect();return {sx:Math.hypot(m.a,m.b),sy:Math.hypot(m.c,m.d),w:r.width,h:r.height};}));
  for(const g of geometry){assert.ok(Math.abs(g.sx-g.sy)<.001);assert.ok(Math.abs(g.w-g.h)<.1);}circles++;
 }
 const def=HW_DEFINITIONS.find(d=>d.layout==='theme17_content_hw_media_stagger'),base=fixture?JSON.parse(fs.readFileSync(fixture)).slides.find(s=>s.layout===def.layout&&s.props.cards.length===3)?.props:null;assert.ok(base,'实际业务验收稿必须提供三组交错图文内容');
 for(const count of [2,3]){const p={...base,variant:String(count),cards:base.cards.slice(0,count),imageCount:count,images:[],layout:{nodes:base.cards.slice(0,count).map(c=>({id:c.blockId})),edges:[]}};const geometry=originalGeometry(def,p);assert.ok(geometry.nodes.every(n=>n.h===(count===3?144:226)));
  await page.setContent('<style>body{margin:0}</style><div class="hw-content hw-pack">'+originalMarkup(def,p,25)+'</div>');await page.evaluate(()=>document.fonts.ready);
  const rows=await page.locator('.media-row:not(.capacity-hidden)').evaluateAll(list=>list.map(row=>{const r=row.getBoundingClientRect();return {top:r.top,bottom:r.bottom,children:[...row.children].map(c=>{const b=c.getBoundingClientRect();return {top:b.top,bottom:b.bottom};})};}));
  assert.equal(rows.length,count);for(let i=0;i<count;i++){for(const c of rows[i].children)assert.ok(c.top>=rows[i].top-.1&&c.bottom<=rows[i].bottom+.1);if(i)assert.ok(rows[i].top-rows[i-1].bottom>=19.9);}assert.equal(await page.locator('.media-note').count(),0);media++;
  if(out&&count===3){fs.mkdirSync(out,{recursive:true});await page.locator('.hw-content').screenshot({path:path.join(out,'stagger-fixed.png')});}
 }
}finally{await browser.close();}
console.log(JSON.stringify({ok:true,donutVariants:circles,actualBusinessMediaVariants:media}));
