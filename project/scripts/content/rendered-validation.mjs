import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright-core';
import {launchExportBrowser} from '../preview/launch-export-browser.mjs';
import {WorkbenchError} from './model.mjs';
import {iconCount} from '../../assets/huawei-icons.mjs';
import {validateRichHwFields} from './hw-rendered-fields.mjs';
import {adjacentLayoutIssues} from './layout-policy.mjs';
import {boundContentNoteIssues} from '../../assets/content-note-layout.mjs';
import {inspectContentCollisions} from '../../assets/content-collision-check.mjs';

// Inspect the real rendered DOM, not JSON strings serialized alongside it.
export async function validateRenderedContent(pptDir,document,goal,{signal,screenshotDir,mapping,onCapture,onProgress=()=>{},launchBrowser=launchExportBrowser}={}){
 const root=path.resolve(pptDir),errors=adjacentLayoutIssues(goal.slides).map(issue=>issue.message),bindingIssues=[];let browser,currentPage=0;
 const wait=promise=>new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason||new DOMException('Cancelled','AbortError'));if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal?.removeEventListener('abort',abort));});
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}const type=({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'content-type':type});fs.createReadStream(file).pipe(res);});
 const abort=()=>{browser?.close().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try{
  signal?.throwIfAborted();browser=await wait(launchBrowser(chromium,{fallbackTmpDirs:[path.join(root,'.browser-tmp')],log:()=>{}}).then(b=>{if(signal?.aborted){b.close().catch(()=>{});signal.throwIfAborted();}return b;}));const page=await wait(browser.newPage({viewport:{width:1440,height:900}}));page.on('pageerror',error=>errors.push(`浏览器异常：${error.message}`));
  await wait(page.goto(`http://127.0.0.1:${server.address().port}/?layoutEditor=0`,{waitUntil:'networkidle',timeout:30000}));await wait(page.evaluate(()=>document.fonts.ready));await wait(page.waitForTimeout(650));signal?.throwIfAborted();
  const select=async index=>{signal?.throwIfAborted();const moved=await wait(page.evaluate(index=>{if(typeof window.go!=='function')return false;window.go(index,{animate:false,force:true});return true;},index));if(!moved)await wait(page.goto(`http://127.0.0.1:${server.address().port}/?page=${index+1}&layoutEditor=0`,{waitUntil:'networkidle',timeout:30000}));};
  const pages=[];
  for(let selected=0;selected<document.slides.length;selected++){
  currentPage=selected;onProgress({stage:'rendered-validation',percent:85+Math.floor(4*selected/document.slides.length),detail:`浏览器校验 ${selected+1}/${document.slides.length} 页`});await select(selected);
  try{await wait(page.waitForFunction(({selected,title})=>{const s=document.querySelectorAll('#deck > .slide')[selected],norm=v=>String(v||'').replace(/\s+/g,'');return s&&norm(s.innerText).includes(norm(title));},{selected,title:document.slides[selected].title},{timeout:7000}));}catch(error){signal?.throwIfAborted();if(!/Timeout/i.test(error.name||''))throw error; /* Missing copy is reported below. */ }
  await wait(page.evaluate(()=>document.fonts.ready));await wait(page.waitForTimeout(250));
  const measured=await wait(page.evaluate(selected=>{window.__layoutContentNotes?.();const slide=document.querySelectorAll('#deck > .slide')[selected];if(!slide)return null;
   const rect=el=>{const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};};
   // The faithful HW templates keep their nested original DOM. A direct-child
   // reader falsely reports all header fields and nested card copy as absent.
   // Stay within each semantic owner so a card's evidence cannot replace the
   // page source (or another nested card's text), and preserve explicit BRs.
   const read=node=>!node?'':node.nodeType===3?node.textContent:node.nodeType!==1?'':node.tagName==='BR'?'\n':[...node.childNodes].map(read).join('');
   const shown=el=>{for(let p=el;p&&p!==slide.parentElement;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return false;}return true;};
   const shapeFailures=[];
   for(const circle of slide.querySelectorAll('.hw-chart-canvas circle')){const m=circle.getScreenCTM();if(!m)continue;const x=Math.hypot(m.a,m.b),y=Math.hypot(m.c,m.d);if(Math.abs(x-y)>Math.max(x,y)*.01)shapeFailures.push('圆环图发生非等比拉伸');}
   const fields=scope=>{const owner=scope.matches('[data-content-block]')?scope:null;return Object.fromEntries([...scope.querySelectorAll('[data-content-field]')].filter(el=>el.closest('[data-content-block]')===owner&&shown(el)).map(el=>[el.dataset.contentField,read(el)]));};
   if(!slide.hasAttribute('data-content-plan')&&!slide.querySelector('[data-native-hw]')){
    const visible=el=>{for(let p=el;p&&p!==slide.parentElement;p=p.parentElement){const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden')return false;}return !el.closest('script,style,template');};
    const clipped=el=>{const range=document.createRange();range.selectNodeContents(el);const boxes=[...range.getClientRects()];for(let p=el;p&&p!==slide.parentElement;p=p.parentElement){const c=getComputedStyle(p),r=p.getBoundingClientRect();if(boxes.some(t=>(c.overflowX!=='visible'&&(t.left<r.left-3||t.right>r.right+3))||(c.overflowY!=='visible'&&(t.top<r.top-3||t.bottom>r.bottom+3))))return true;}return false;};
    const leaves=[...slide.querySelectorAll('*')].filter(el=>visible(el)&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(el=>{const textRects=[];for(const n of el.childNodes){if(n.nodeType!==3||!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);textRects.push(...[...range.getClientRects()].map(r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom})));}return {text:el.textContent,clipped:clipped(el),rect:rect(el),textRects};});
    const failures=[...shapeFailures],headline=slide.querySelector('.tri-text'),pillars=slide.querySelector('.tri-pillars');if(headline&&pillars&&visible(headline)&&visible(pillars)){const a=rect(headline),b=rect(pillars);if(a.y+a.h>b.y+2)failures.push('主标题/结论与支撑要素区发生重叠，请精炼联合标题或选择其他版式');}
    return {native:false,text:leaves.map(e=>e.text).join('\n'),leaves,failures,images:[...slide.querySelectorAll('img')].filter(visible).map(el=>({src:el.getAttribute('src'),ready:el.naturalWidth>0}))};
   }
   const boxes=[...slide.querySelectorAll('[data-content-block]')];
   const noteIssues=window.__contentNoteIssues?.(slide)||[];
   const failures=[...shapeFailures,...noteIssues.map(i=>i.message)],nativeIssues=noteIssues.map(i=>({...i,reason:'note-overlaps-body'})),original=!!slide.querySelector('[data-native-hw]');
   for(const row of slide.querySelectorAll('.media-stagger .media-row')){if(!shown(row))continue;const r=rect(row);for(const child of row.children){if(!shown(child))continue;const c=rect(child);if(c.y<r.y-1||c.y+c.h>r.y+r.h+1)failures.push('交错图文子框撑出原稿行高，可能与相邻行交叠');}}
   for(const box of boxes){
    if(!original&&box.scrollHeight>box.clientHeight+2)failures.push(`内容块 ${box.dataset.contentBlock} 垂直溢出 ${box.scrollHeight-box.clientHeight}px`);
    if(original){const bounds=rect(box),walker=document.createTreeWalker(box,NodeFilter.SHOW_TEXT);let text;while((text=walker.nextNode())){const parent=text.parentElement;if(!text.textContent.trim()||!shown(parent)||parent.closest('button,svg,[data-editable-skip="true"]'))continue;const range=document.createRange();range.selectNodeContents(text);if([...range.getClientRects()].some(r=>r.left<bounds.x-2||r.right>bounds.x+bounds.w+2||r.top<bounds.y-2||r.bottom>bounds.y+bounds.h+2)){const field=parent.closest('[data-content-field]')?.dataset.contentField||'text';failures.push(`内容块 ${box.dataset.contentBlock} 的 ${field} 文字越过原稿边界`);nativeIssues.push({blockId:box.dataset.contentBlock,field,reason:'text-outside-original-frame',rect:bounds});break;}}}
    for(const el of box.querySelectorAll('[data-content-field]')){if(el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2)failures.push(`内容块 ${box.dataset.contentBlock} 的 ${el.dataset.contentField} 被裁切`);}}
   const content=slide.querySelector('.hw-content');for(const el of content.querySelectorAll('[data-content-field]'))if(!el.closest('[data-content-block]')&&(el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2))failures.push(`页面 ${el.dataset.contentField} 文字溢出`);
   const s=rect(slide);for(let i=0;i<boxes.length;i++){const a=rect(boxes[i]);if(a.x<s.x-2||a.y<s.y-2||a.x+a.w>s.x+s.w+2||a.y+a.h>s.y+s.h+2)failures.push('内容块越过画布边界');for(let j=i+1;j<boxes.length;j++){const b=rect(boxes[j]);if(Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)+2&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y)+2)failures.push('内容块发生重叠');}}
   const businessIcons=[...slide.querySelectorAll('[data-business-icon]')];for(const svg of businessIcons){const icon=rect(svg),box=svg.closest('[data-content-block]');if(!box)continue;for(const field of box.querySelectorAll('[data-content-field]')){const text=rect(field);if(Math.min(icon.x+icon.w,text.x+text.w)>Math.max(icon.x,text.x)+2&&Math.min(icon.y+icon.h,text.y+text.h)>Math.max(icon.y,text.y)+2)failures.push('业务 ICON 与正文重叠');}}
   let chart=null;const plot=slide.querySelector('[data-hw-chart]');if(plot){const type=plot.dataset.hwChart,svg=plot.querySelector('svg'),points=el=>String(el?.getAttribute('points')||'').trim().split(/\s+/).filter(Boolean).map(v=>v.split(',').map(Number));const maximum=Number(plot.dataset.hwScaleMax)||100,span=Number(plot.dataset.hwPlotSpan);let values=[],labels=[];
    if(type==='column'){values=[...svg.querySelectorAll('rect')].map(r=>Number(r.getAttribute('height'))/(span||260)*maximum);labels=[...plot.querySelectorAll('.chart-x-labels span')].map(read);}
    if(type==='bar'){values=[...plot.querySelectorAll('.hbar-track i')].map(r=>parseFloat(r.style.width)/100*maximum);labels=[...plot.querySelectorAll('.hbar-row:not([data-hw-bar-axis])>span:first-child')].map(read);}
    if(type==='line'||type==='area'){values=points(svg.querySelector('polyline')).map(v=>(280-v[1])/(span||240)*maximum);labels=[...plot.querySelectorAll('.chart-x-labels span')].map(read);}
    if(type==='donut'){values=[...svg.querySelectorAll('circle[stroke-dasharray]')].map(r=>parseFloat(r.getAttribute('stroke-dasharray'))/(2*Math.PI*80)*100);labels=[...plot.querySelectorAll('.chart-legend span')].map(read);}
    if(type==='radar'){const p=points(svg.querySelector('polygon[fill="#c7000b"]'));if(p.length===4)values=[150-p[0][1],p[1][0]-200,p[2][1]-150,200-p[3][0]].map(v=>v/128*maximum);labels=[...plot.querySelectorAll('.radar-label')].map(read);}
    chart={type,values,labels,caption:read(plot.querySelector('.chart-title')),text:plot.innerText};
   }
   const visibleRead=node=>node.nodeType===3?node.textContent:node.nodeType!==1||!shown(node)?'':node.tagName==='BR'?'\n':[...node.childNodes].map(visibleRead).join('');
   const visibleText=scope=>[...scope.querySelectorAll('*')].filter(el=>shown(el)&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(visibleRead).join('\n');
   const measureCard=box=>{const metric=box.querySelector('[data-hw-metric-value]');return {id:box.dataset.contentBlock,type:box.dataset.blockType,fields:fields(box),visibleText:visibleText(box),items:[...box.querySelectorAll('.layer-item')].filter(shown).map(visibleRead),metricValue:metric?visibleRead(metric).replace(/−/g,'-').replaceAll(',',''):'',table:box.querySelector('table')?{headers:[...box.querySelectorAll('thead th')].filter(shown).map(visibleRead),rows:[...box.querySelectorAll('tbody tr:not(.group-row)')].filter(shown).map(tr=>[...tr.querySelectorAll('td')].filter(shown).map(visibleRead))}:null};};
   return {native:true,chart,visibleText:visibleText(content),sourceCopy:Object.fromEntries([...content.querySelectorAll('[data-hw-copy-key]')].filter(shown).map(el=>[el.dataset.hwCopyKey,visibleRead(el)])),mode:slide.dataset.planMode,iconCount:businessIcons.length,imagesReady:[...slide.querySelectorAll('img')].every(im=>im.naturalWidth>0),geometry:{slide:s,cards:boxes.map(rect)},fields:fields(content),cards:boxes.map(measureCard),edges:[...slide.querySelectorAll('[data-relation-from]')].map(el=>({from:el.dataset.relationFrom,to:el.dataset.relationTo,kind:el.dataset.relationKind,label:[...slide.querySelectorAll('.hw-edge-label')].find(label=>label.dataset.relationId===el.dataset.relationId)?.textContent||''})),failures,nativeIssues,brandReady:slide.querySelector('.hw-brand')?.naturalWidth>0};
  },selected));
  const collisions=await wait(page.evaluate(inspectContentCollisions,{selected}));if(measured){measured.failures.push(...collisions.map(i=>i.message));measured.nativeIssues=[...(measured.nativeIssues||[]),...collisions];}
  pages.push(measured);
  if(onCapture)onCapture(await wait(page.evaluate(index=>document.querySelectorAll('#deck > .slide')[index]?.outerHTML,selected)),selected,await wait(page.evaluate(()=>[...document.head.querySelectorAll('style,link[rel=stylesheet]')].map(el=>el.outerHTML).join('\n'))));
  }
  const checks=[],failedPages=new Set();mapping||=fs.existsSync(path.join(root,'..','content-mapping.json'))?JSON.parse(fs.readFileSync(path.join(root,'..','content-mapping.json'),'utf8')):null;
  for(let index=0;index<document.slides.length;index++){
   const slide=document.slides[index],rendered=pages[index],authored=goal.slides[index];if(!rendered){errors.push(`第 ${index+1} 页未渲染`);continue;}
   const errorCount=errors.length;
   if(authored.layout.startsWith('theme17_content_')||authored.layout.startsWith('theme17_chart_hw_')){
    if(!rendered.native){errors.push(`第 ${index+1} 页没有语义渲染节点`);continue;}
    const pageMapping=mapping?.slides.find(s=>s.slideId===slide.slideId),consolidated=/^theme17_(content|chart)_hw_/.test(authored.layout)&&pageMapping?.blocks?.some(b=>b.fields?.evidence==='props.closing');
    for(const[field,value]of Object.entries({title:slide.title,conclusion:slide.conclusion,evidence:authored.layout.startsWith('theme17_chart_hw_')||consolidated?authored.props.closing:slide.evidence}))if((rendered.fields[field]||'')!==value)errors.push(`第 ${index+1} 页 ${field} 与确认稿不一致`);
    if(consolidated)for(const source of new Set([slide.evidence,...slide.blocks.map(b=>b.evidence)].filter(Boolean)))if(!String(rendered.fields.evidence||'').includes(source))errors.push(`第 ${index+1} 页完整来源未在独立来源区呈现`);
    const chartBlock=authored.layout.startsWith('theme17_chart_hw_')?slide.blocks.find(b=>b.data!=null):null,body=slide.blocks.filter(b=>b!==chartBlock);
    if(mapping?.slides.find(s=>s.slideId===slide.slideId)?.nativeHw&&body.some(b=>b.origin?.hw?.card))errors.push(...validateRichHwFields(slide,rendered,authored.props));
    else{if(rendered.cards.length!==body.length)errors.push(`第 ${index+1} 页内容块数量改变`);
    for(const block of body){const matches=rendered.cards.filter(card=>card.id===block.blockId);if(matches.length!==1){errors.push(`内容块 ${block.blockId} 未唯一呈现`);continue;}for(const field of ['label','text','evidence']){if(field==='evidence'&&consolidated&&pageMapping.blocks.find(b=>b.blockId===block.blockId)?.fields?.evidence==='props.closing'){if(block.evidence&&!String(rendered.fields.evidence||'').includes(block.evidence))errors.push(`内容块 ${block.blockId} 的完整来源缺失`);}else if((matches[0].fields[field]||'')!==block[field])errors.push(`内容块 ${block.blockId} 的 ${field} 丢失、改写或串位`);}}}
    if(chartBlock){const c=rendered.chart,d=chartBlock.data,norm=v=>String(v||'').replace(/\s+/g,'');if(!c||c.type!==authored.props.chart.type||c.caption!==chartBlock.label)errors.push(`第 ${index+1} 页图表类型或标题不一致`);if(!c||c.values.length!==d.values.length||c.values.some((v,i)=>!Number.isFinite(v)||Math.abs(v-d.values[i])>.005))errors.push(`第 ${index+1} 页图表可见几何与真实数值不一致`);if(!c||d.labels.some((label,i)=>!norm(c.labels[i]).includes(norm(label))))errors.push(`第 ${index+1} 页图表标签缺失或串位`);if(chartBlock.text&&(!c||!norm(pageMapping?.blocks?.find(b=>b.blockId===chartBlock.blockId)?.fields?.text==='props.closing'?rendered.fields.evidence:c.text).includes(norm(chartBlock.text))))errors.push(`第 ${index+1} 页图表说明未在原稿可见区域呈现`);if(d.unit&&(!c||!c.text.includes(d.unit)))errors.push(`第 ${index+1} 页图表单位未显示`);}
    const expected=authored.props.layout.edges;if(JSON.stringify(rendered.edges)!==JSON.stringify(expected.map(e=>({from:e.from,to:e.to,kind:e.kind,label:e.label}))))errors.push(`第 ${index+1} 页关系连线未完整呈现`);
    if((authored.layout.startsWith('theme17_content_icon_')||authored.layout.includes('_hw_icon_'))&&rendered.iconCount!==iconCount(authored.props.cards,authored.props.layout.nodes,authored.props.iconConfig))errors.push(`第 ${index+1} 页 ICON 数量与版式配置不一致`);
    if(rendered.imagesReady===false)errors.push(`第 ${index+1} 页存在未加载的图片`);
    errors.push(...rendered.failures.map(value=>`第 ${index+1} 页：${value}`));bindingIssues.push(...(rendered.nativeIssues||[]).map(issue=>({page:index+1,...issue})));if(!rendered.brandReady)errors.push(`第 ${index+1} 页华为 LOGO 未加载`);
    checks.push({slideId:slide.slideId,layout:authored.layout,blockCount:rendered.cards.length,relationshipCount:rendered.edges.length,exactCopy:true,separateEvidence:true});
   }else if((mapping?.slides.find(s=>s.slideId===slide.slideId)?.visualPlan?.special||!['cover','section','transition','chapter'].includes(slide.role))&&!slide.legacy){
    const plan=mapping?.slides.find(s=>s.slideId===slide.slideId)?.visualPlan;
    const noteIssues=boundContentNoteIssues(plan?.bindings||[],rendered.leaves||[]);
    errors.push(...noteIssues.map(i=>`第 ${index+1} 页：${i.message}`));bindingIssues.push(...noteIssues.map(i=>({page:index+1,...i,reason:'note-overlaps-body'})));
    if(!plan?.bindings)errors.push(`第 ${index+1} 页缺少可核对的完整内容映射`);
    const norm=s=>String(s||'').replace(/\s+/g,'');
    for(const binding of plan?.bindings||[]){
     if(!binding.text)continue;
     const matching=rendered.leaves.filter(el=>norm(el.text).includes(norm(binding.text)));
     if(!matching.length)errors.push(`第 ${index+1} 页 ${binding.blockId||'页面'}/${binding.source} 在可见页面中缺失、被改写或被隐藏`);
     else{const smallest=matching.sort((a,b)=>a.text.length-b.text.length)[0];if(smallest.clipped){errors.push(`第 ${index+1} 页 ${binding.blockId||'页面'}/${binding.source} 文字容器溢出`);bindingIssues.push({page:index+1,blockId:binding.blockId||null,field:binding.source,target:binding.target,reason:'text-overflow',rect:smallest.rect});}}
    }
    if(plan?.chart){for(const label of plan.chart.labels)if(!norm(rendered.text).includes(norm(label)))errors.push(`第 ${index+1} 页图表标签 ${label} 未显示`);for(const value of plan.chart.values)if(!rendered.text.includes(String(value)))errors.push(`第 ${index+1} 页图表数值 ${value} 未显示`);if(plan.chart.unit&&!rendered.text.includes(plan.chart.unit))errors.push(`第 ${index+1} 页图表单位未显示`);}
    if(rendered.images.some(im=>!im.ready))errors.push(`第 ${index+1} 页存在未加载图片`);
    errors.push(...(rendered.failures||[]).map(e=>`第 ${index+1} 页：${e}`));bindingIssues.push(...(rendered.nativeIssues||[]).map(issue=>({page:index+1,...issue})));
    checks.push({slideId:slide.slideId,layout:authored.layout,blockCount:slide.blocks.length,relationshipCount:slide.board?.edges.length||0,exactCopy:true,separateEvidence:true,catalogMatched:true,chart:!!plan?.chart});
   }
   if(errors.length>errorCount)failedPages.add(index);
  }
  if(screenshotDir){fs.mkdirSync(screenshotDir,{recursive:true});for(let i=0;i<document.slides.length;i++){await select(i);await wait(page.screenshot({path:path.join(screenshotDir,`slide-${String(i+1).padStart(2,'0')}.png`)}));}}
  const result={version:3,ok:!errors.length,checks,errors,bindingIssues,geometry:pages.map(p=>p.geometry||null)};fs.writeFileSync(path.join(root,'..','rendered-validation.json'),JSON.stringify(result,null,2));if(errors.length){const error=new WorkbenchError(`页面实测未通过，未发布为成功：\n${errors.slice(0,8).join('\n')}\n确认稿未改变；请调整内容或布局后重新生成。`,422,'RENDERED_CONTENT_FAILED');error.details={failedPages:[...failedPages],bindingIssues};throw error;}return result;
 }catch(error){signal?.throwIfAborted();if(/Page crashed|Target.*closed|browser.*closed|Navigation.*failed|Timeout/i.test(error.message||'')&&!error.code){const failure=new WorkbenchError(`第 ${currentPage+1} 页浏览器校验中断，确认稿未改变。请关闭多余预览后重试；这不是内容不合格。`,503,/crash/i.test(error.message)?'RENDER_BROWSER_CRASH':'RENDER_BROWSER_UNAVAILABLE');failure.details={phase:'rendered-validation',failedPages:[currentPage],suggestions:['保留当前确认稿并重试生成','如重复发生，导出诊断记录；不要修改正文来绕过浏览器故障']};throw failure;}throw error;
 }finally{signal?.removeEventListener('abort',abort);let timer;try{await Promise.race([Promise.resolve(browser?.close()).catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,2000);})]);}finally{clearTimeout(timer);server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}}
}
