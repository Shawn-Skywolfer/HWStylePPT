// Some legacy quotation templates transform a wrapper around their heading.
// Compensate only the heading, keeping every other descendant in place.
(()=>{
 let queued=false;
 function normalize(){
  queued=false;
  document.querySelectorAll('.imported-theme-root[data-theme-key="theme17"]:has(>.theme17-body-marker)').forEach(root=>{
   const canvas=root.getBoundingClientRect(),scale=canvas.width/1920;if(!scale||!canvas.height)return;
   root.querySelectorAll('h2').forEach(title=>{
    if(title.style.getPropertyPriority('transform')==='important')return; // explicit user shape edit
    title.style.setProperty('--hw-title-offset-x','0px');title.style.setProperty('--hw-title-offset-y','0px');
    const r=title.getBoundingClientRect();
    title.style.setProperty('--hw-title-offset-x',`${96-(r.left-canvas.left)/scale}px`);
    title.style.setProperty('--hw-title-offset-y',`${60-(r.top-canvas.top)/scale}px`);
   });
  });
 }
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(normalize);}};
 const deck=document.querySelector('#deck');
 if(deck)new MutationObserver(schedule).observe(deck,{subtree:true,childList:true});
 window.addEventListener('resize',schedule);
 document.fonts?.ready.then(schedule);
 window.__normalizeHwDesignTitles=normalize;
 schedule();
})();
