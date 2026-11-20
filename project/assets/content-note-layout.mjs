// Shared browser measurement for every registered semantic/HW content block.
// Measure visible glyph ranges, not predicted line counts or an element's
// nominal height. Notes may be nested inside the body's visual container.
export function contentNoteIssues(root){
 const visible=el=>{for(let p=el;p&&p!==root.parentElement;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}return true;};
 const boxes=(el,exclude)=>{const ranges=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode())){if(!n.textContent.trim()||!visible(n.parentElement)||exclude?.contains(n)||n.parentElement.closest('button,script,style,svg,[data-editable-skip="true"]'))continue;const r=document.createRange();r.selectNodeContents(n);ranges.push(...[...r.getClientRects()].filter(b=>b.width&&b.height));}return ranges;};
 const issues=[];
 for(const block of root.querySelectorAll('[data-content-block]')){
  const owns=el=>el.closest('[data-content-block]')===block;
  const bodies=[...block.querySelectorAll('[data-content-field="text"]')].filter(owns);
  for(const note of [...block.querySelectorAll('[data-content-field="evidence"]')].filter(owns)){
   if(!visible(note))continue;const nr=boxes(note);if(!nr.length)continue;
   const br=bodies.flatMap(body=>boxes(body,note));if(!br.length)continue;
   const related=br.filter(b=>nr.some(n=>Math.min(b.right,n.right)>Math.max(b.left,n.left)+.5));if(!related.length)continue;
   const bodyBottom=Math.max(...related.map(r=>r.bottom)),noteTop=Math.min(...nr.map(r=>r.top));
   if(noteTop<bodyBottom-.5)issues.push({code:'CONTENT_NOTE_OVERLAP',blockId:block.dataset.contentBlock,field:'evidence',bodyBottom,noteTop,message:`内容块 ${block.dataset.contentBlock} 的备注/来源与正文交叠`});
  }
 }
 return issues;
}
if(typeof window!=='undefined')window.__contentNoteIssues=contentNoteIssues;

// Legacy layouts have planned field bindings rather than semantic DOM owners.
// Only compare unambiguous visible text matches; never guess between repeats.
export function boundContentNoteIssues(bindings,leaves){
 const norm=v=>String(v||'').replace(/\s+/g,''),find=text=>{const n=norm(text);if(!n)return null;const matches=leaves.filter(v=>norm(v.text).includes(n)).sort((a,b)=>a.text.length-b.text.length);return matches.length&&(!matches[1]||matches[0].text.length<matches[1].text.length)?matches[0]:null;},issues=[];
 const rects=leaf=>leaf.textRects?.length?leaf.textRects:leaf.rect?[{left:leaf.rect.x,top:leaf.rect.y,right:leaf.rect.x+leaf.rect.w,bottom:leaf.rect.y+leaf.rect.h}]:[];
 for(const note of bindings.filter(b=>b.blockId&&!b.blockId.startsWith('meta:')&&b.source==='evidence'&&b.text)){
  const body=bindings.find(b=>b.blockId===note.blockId&&b.source==='text'&&b.text),b=body&&find(body.text),n=find(note.text);if(!b||!n||b===n)continue;
  const nr=rects(n),br=rects(b).filter(r=>nr.some(t=>Math.min(r.right,t.right)>Math.max(r.left,t.left)+.5));if(!nr.length||!br.length)continue;
  if(Math.min(...nr.map(r=>r.top))<Math.max(...br.map(r=>r.bottom))-.5)issues.push({code:'CONTENT_NOTE_OVERLAP',blockId:note.blockId,field:'evidence',message:`内容块 ${note.blockId} 的备注/来源与正文交叠`});
 }
 return issues;
}

// The legacy KPI pages intentionally use tight number line-height. Keep their
// number geometry intact; place only its caption below the actual glyphs.
export function layoutLegacyNotes(root){
 const selectors='.at-caption,.iv-anchor-note,.cn-caption,.ge-caption,.fg-caption,.mg-caption';
 for(const note of root.querySelectorAll('.imported-theme-root:has(>.theme17-body-marker) :is('+selectors+')')){
  const canvas=note.closest('.imported-theme-root'),scale=canvas.getBoundingClientRect().width/1920,body=note.previousElementSibling;if(!scale||!body||!note.getClientRects().length)continue;
  const prior=parseFloat(note.style.getPropertyValue('--note-flow-extra'))||0,base=(parseFloat(getComputedStyle(note).marginTop)||0)-prior;
  note.style.setProperty('--note-flow-extra','0px');note.style.marginTop=`calc(${base}px + var(--note-flow-extra))`;
  const ranges=el=>{const rects=[],w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let t;while((t=w.nextNode())){if(!t.textContent.trim()||t.parentElement.closest('script,style,svg,button'))continue;const s=getComputedStyle(t.parentElement);if(s.display==='none'||s.visibility==='hidden')continue;const r=document.createRange();r.selectNodeContents(t);rects.push(...[...r.getClientRects()].filter(r=>r.width&&r.height));}return rects;};
  const nr=ranges(note),br=ranges(body);if(!nr.length||!br.length)continue;
  const related=br.filter(b=>nr.some(n=>Math.min(b.right,n.right)>Math.max(b.left,n.left)+.5));if(!related.length)continue;
  const extra=Math.max(0,(Math.max(...related.map(r=>r.bottom))-Math.min(...nr.map(r=>r.top)))/scale+12);
  note.style.setProperty('--note-flow-extra',extra+'px');
 }
}
if(typeof window!=='undefined'){
 let pending=false;const run=()=>{pending=false;layoutLegacyNotes(document);},schedule=()=>{if(!pending){pending=true;requestAnimationFrame(run);}};
 const deck=document.querySelector('#deck'),observed=new WeakSet(),resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
 const attach=()=>{deck?.querySelectorAll('.at-bignum,.iv-anchor .aic-viz-bignum,.cn-bignum,.ge-bignum,.fg-bignum,.mg-bignum').forEach(el=>{if(!observed.has(el)){observed.add(el);resize?.observe(el);}});schedule();};
 if(deck)new MutationObserver(attach).observe(deck,{childList:true,subtree:true});
 document.addEventListener('input',schedule);window.addEventListener('resize',schedule);document.fonts?.ready.then(attach);
 window.__layoutContentNotes=run;attach();
}
