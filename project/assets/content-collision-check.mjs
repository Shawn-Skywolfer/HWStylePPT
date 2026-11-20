// Runs in a browser; keep self-contained for Playwright evaluation as well.
export function inspectContentCollisions({selected,slide:givenSlide}={}){
 const slide=givenSlide||document.querySelectorAll('#deck>.slide')[selected??0];if(!slide)return [];
 const issues=[],seen=new Set(),rect=r=>({x:r.left,y:r.top,w:r.width,h:r.height}),overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+2&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+2;
 const ignored=el=>!!el.closest('script,style,template,svg,button,[data-editable-skip="true"],[data-console-only],.hw-edge-label,.shape-editor-overlay');
 const visible=el=>{for(let p=el;p&&p!==slide.parentElement;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<.02)return false;}return true;};
 const owner=el=>{const classes=[...el.classList].filter(k=>!k.startsWith('editor-')).slice(0,3);return {blockId:el.closest('[data-content-block]')?.dataset.contentBlock||null,field:el.closest('[data-content-field]')?.dataset.contentField||el.dataset.editablePath||'text',selector:el.tagName.toLowerCase()+(classes.length?'.'+classes.join('.'):'')};};
 const add=(reason,a,b,bounds)=>{const identity=reason+':'+a.selector+':'+b.selector+':'+a.blockId+':'+b.blockId;if(seen.has(identity))return;seen.add(identity);issues.push({...a,reason,other:b.selector,rect:rect(bounds),message:reason==='content-regions-overlap'?'正文区域与卡片区域发生交叠':reason==='content-text-overlap'?'不同内容的文字发生交叠':'正文被其他内容区域遮挡'});};
 // Separate authored regions are never allowed to cover each other, even if
 // their short example strings happen not to touch.
 for(const cards of slide.querySelectorAll('.aic-mth .mth-cards'))for(const text of slide.querySelectorAll('.aic-mth .mth-steps,.aic-mth .mth-lead,.aic-mth .mth-closing'))if(visible(cards)&&visible(text)&&text.textContent.trim()&&overlap(cards.getBoundingClientRect(),text.getBoundingClientRect()))add('content-regions-overlap',owner(text),owner(cards),text.getBoundingClientRect());
 const texts=[],walker=document.createTreeWalker(slide,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){const el=node.parentElement;if(!node.textContent.trim()||ignored(el)||!visible(el))continue;const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.width>2&&r.height>2)texts.push({el,r,owner:owner(el)});}
 for(let i=0;i<texts.length;i++){const a=texts[i];for(let j=i+1;j<texts.length;j++){const b=texts[j];if(a.el===b.el||!overlap(a.r,b.r))continue;add('content-text-overlap',a.owner,b.owner,a.r);}
  for(const portion of [.2,.5,.8]){const x=a.r.left+a.r.width*portion,y=a.r.top+a.r.height*.5;if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;for(const top of document.elementsFromPoint(x,y)){if(!slide.contains(top))continue;if(top===a.el||top.contains(a.el))break;if(a.el.contains(top)||ignored(top)||!visible(top))continue;const style=getComputedStyle(top),color=style.backgroundColor,alpha=color==='transparent'?0:color.startsWith('rgba')?Number(color.match(/,\s*([\d.]+)\)$/)?.[1]||0):1,painted=alpha>.85||style.backgroundImage!=='none';if(painted){add('content-occluded',a.owner,owner(top),a.r);break;}}}
 }
 return issues;
}
if(typeof window!=='undefined')window.__inspectContentCollisions=inspectContentCollisions;
