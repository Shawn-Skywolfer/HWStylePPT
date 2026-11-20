// Repair old saved column markup without replacing edited text, IDs or data.
export function repairMixedChartHeadroom(root=document){
 let repaired=0;for(const plot of root.querySelectorAll('[data-native-chart="column"] .hw-chart-canvas')){
  if(!plot.querySelector('.hm-analysis'))continue;const caption=plot.querySelector('[data-editable-path="chart-meta:caption"]');if(!caption?.textContent.trim())continue;
  const labels=[...plot.querySelectorAll('.hm-label')].filter(e=>!e.dataset.editablePath&&parseFloat(e.style.fontSize)===20&&Number(e.style.fontWeight)>=600),bars=[...plot.querySelectorAll('svg g>rect')];if(!labels.length||bars.length!==labels.length)continue;
  const rect=plot.getBoundingClientRect(),scale=rect.width/1280;if(!scale)continue;const walker=document.createTreeWalker(caption,NodeFilter.SHOW_TEXT);let text,bottom=0;while((text=walker.nextNode())){if(!text.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(text);for(const r of range.getClientRects())bottom=Math.max(bottom,(r.bottom-rect.top)/scale);}
  const first=Math.min(...labels.map(e=>parseFloat(e.style.top))),delta=bottom+8-first;if(delta<=.5)continue;const maxHeight=Math.max(...bars.map(e=>Number(e.getAttribute('height'))));if(maxHeight-delta<120)continue;const factor=(maxHeight-delta)/maxHeight;
  for(const bar of bars){const h=Number(bar.getAttribute('height'))*factor;bar.setAttribute('height',h);bar.setAttribute('y',566-h);}for(const label of labels){const h=532-parseFloat(label.style.top);label.style.top=(532-h*factor)+'px';}repaired++;
 }return repaired;
}
if(typeof window!=='undefined'){
 window.__repairMixedChartHeadroom=repairMixedChartHeadroom;
 let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>repairMixedChartHeadroom(),100);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 const start=()=>{const deck=document.querySelector('#deck');if(deck)new MutationObserver(schedule).observe(deck,{childList:true,subtree:true});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
