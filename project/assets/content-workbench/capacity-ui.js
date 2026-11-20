export function installCapacityUi({api,getProject,saveEditor,operation,locate,setPolicy}){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const entry=document.createElement('button');entry.id='capacity-check';entry.textContent='容量匹配 / 分页';document.querySelector('#compile-check').before(entry);
 const summary=document.createElement('p');summary.id='capacity-summary';summary.className='hint';summary.setAttribute('aria-live','polite');entry.after(summary);
 const dialog=document.createElement('dialog');dialog.id='capacity-dialog';dialog.innerHTML='<header><h2>内容与版式容量匹配</h2><button id="capacity-close" aria-label="关闭容量匹配">关闭</button></header><div id="capacity-body"></div>';document.body.append(dialog);
 const body=dialog.querySelector('#capacity-body');let report=null,signature='',timer,checking=false,rerun=false,sequence=0;
 dialog.querySelector('#capacity-close').onclick=()=>{sequence++;dialog.close();};dialog.addEventListener('cancel',()=>sequence++);
 const request=()=>{const p=getProject();return api('capacity',{action:'preview',revision:p.revision,contentRevision:p.contentRevision});};
 function label(r){const split=r.pages.filter(p=>p.status==='split').length;return `${r.beforePages} 页容量估算：${r.pages.filter(p=>p.status==='matched'||p.status==='fixed').length} 页已匹配${split?'；'+split+' 页建议无损拆分为 '+r.afterPages+' 页':''}${r.reviewCount?'；'+r.reviewCount+' 页需处理':''}。估算不代替生成后的实测。`;}
 function summaryText(r){const initial=getProject()?.initialPlanning;return (initial?.changed?`初次容量规划：${initial.beforePages} → ${initial.afterPages} 页（原稿可恢复）。`:'')+label(r);}
 function render(r){
  const project=getProject(),names={fixed:'固定模板',matched:'可用版式已匹配',split:'建议无损拆页',review:'需处理'};
  body.innerHTML=`<p>${esc(label(r))}</p><p class="hint">${esc(r.notice)} 独立内容块完整搬移，不删字、不取摘要、不调用 AI。图表、图片归属和显式关系不做猜测性拆分。</p>${project.initialPlanning?.changed?'<p class="capacity-notice">创建脑图前已做过无损分页；可通过撤销或恢复最初稿查看原始内容。</p>':''}<div class="capacity-pages">${r.pages.map((p,i)=>{const s=project.current.slides.find(s=>s.slideId===p.slideId);return `<article class="capacity-row" data-capacity-page="${esc(p.slideId)}"><h3>第 ${i+1} 页 · ${esc(p.title)} <small>${names[p.status]}</small></h3><p>${p.blockCount} 个内容块${p.options.length?' · '+p.options.length+' 个候选版式':''}</p>${p.status!=='fixed'?`<label>分页要求 <select data-capacity-policy="${esc(p.slideId)}"><option value="auto" ${s?.pagination!=='single'?'selected':''}>允许无损自动拆页</option><option value="single" ${s?.pagination==='single'?'selected':''}>本页必须一页</option></select></label>`:''}${p.reason?'<p>'+esc(p.reason)+'</p>':''}${p.error?'<details><summary>具体原因</summary><pre>'+esc([p.error.message,...(p.error.issues||[])].join('\n'))+'</pre></details>':''}${p.parts?'<ol>'+p.parts.map(part=>'<li>'+esc(part.title)+'：'+part.blockIds.length+' 块<details><summary>查看完整内容与来源</summary>'+part.blockIds.map(id=>{const b=s.blocks.find(b=>b.blockId===id);return '<h4>'+esc(b.label)+'</h4><pre>'+esc(b.text)+'</pre>'+(b.evidence?'<p>来源：'+esc(b.evidence)+'</p>':'');}).join('')+'</details></li>').join('')+'</ol>':''}<button data-capacity-locate="${esc(p.slideId)}">定位本页</button></article>`;}).join('')}</div><footer><button id="capacity-apply" class="primary" ${!r.changed||project.workspacePaused?'disabled':''}>确认无损拆页（${r.beforePages} → ${r.afterPages} 页）</button><button id="capacity-refresh">重新检查</button><span id="capacity-message" role="status"></span></footer>`;
  body.querySelector('#capacity-refresh').onclick=()=>open();
  body.querySelector('#capacity-apply').onclick=async()=>{
   const button=body.querySelector('#capacity-apply');button.disabled=true;body.querySelector('#capacity-message').textContent='正在应用；原稿与历史将保留…';
   try{await operation('capacity',{action:'apply',sourceHash:r.sourceHash,planHash:r.planHash});await open();}
   catch(error){body.querySelector('#capacity-message').textContent=error.message;body.querySelector('#capacity-refresh').focus();}
  };
  for(const el of body.querySelectorAll('[data-capacity-locate]'))el.onclick=()=>{dialog.close();locate('s:'+el.dataset.capacityLocate);};
  for(const el of body.querySelectorAll('[data-capacity-policy]'))el.onchange=async()=>{
   el.disabled=true;try{await setPolicy(el.dataset.capacityPolicy,el.value);await open();}catch(error){body.querySelector('#capacity-message').textContent=error.message;el.disabled=false;}
  };
 }
 async function open(){
  const seq=++sequence;entry.disabled=true;
  try{await saveEditor();if(!dialog.open)dialog.showModal();body.innerHTML='<p role="status">正在检索主题库并估算容量…关闭窗口不会修改内容。</p>';const result=await request();report=result.report;summary.textContent=summaryText(report);if(seq===sequence&&dialog.open)render(report);}
  catch(error){if(seq===sequence){if(!dialog.open)dialog.showModal();body.innerHTML='<p role="alert">'+esc(error.message)+'</p><button id="capacity-retry">重试</button>';body.querySelector('button').onclick=open;}}
  finally{entry.disabled=false;}
 }
 async function check(){
  if(checking){rerun=true;return;}checking=true;summary.textContent='正在估算内容与版式容量…';
  try{report=(await request()).report;summary.textContent=summaryText(report);}catch(error){summary.textContent='容量估算未完成：'+error.message+'。点击“容量匹配 / 分页”可重试。';}
  finally{checking=false;if(rerun){rerun=false;check();}}
 }
 entry.onclick=open;
 return {async beforeConfirm(slideId){const r=(await request()).report;const pages=slideId?r.pages.filter(p=>p.slideId===slideId):r.pages;if(pages.some(p=>['review','split'].includes(p.status))){await open();return false;}return true;},sync(){const p=getProject();if(!p)return;const next=p.contentRevision+':'+p.current.slides.filter(s=>s.status==='confirmed').length;if(next===signature)return;signature=next;clearTimeout(timer);timer=setTimeout(check,400);}};
}
