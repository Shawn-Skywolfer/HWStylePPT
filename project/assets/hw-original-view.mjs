import library from './hw-original-library.json' with {type:'json'};
import {iconAssignment,iconSvg} from './huawei-icons.mjs';
import {originalChart} from './hw-original-chart.mjs';
import {processEntry,processCountValid} from './hw-process-view.mjs';
import {extendTimelineDefinition} from './hw-timeline-view.mjs';
import {enlargeHwBodyCss} from './hw-typography.mjs';
const originalTypographyCss=enlargeHwBodyCss(library.css);
const metricText=c=>c?.pendingValue===true&&c.value===null?'待补充':String(c?.value).replace(/^-/,'−');
const pendingMetric=c=>c?.pendingValue===true&&c.value===null;
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const extendedTimeline=extendTimelineDefinition(library.templates.theme17_content_hw_timeline);
export const originalDefinition=key=>key==='theme17_content_hw_timeline'?extendedTimeline:library.templates[key];
export function normalizeOriginalProps(def,p){const entry=originalDefinition(def.layout)?.variants[String(p.variant)],copy={...(p.original||{})};for(const [legacy,key]of Object.entries(entry?.legacyCopyMap||{})){if(legacy in copy){if(!(key in copy))copy[key]=copy[legacy];delete copy[legacy];}}const emphasisMode=p.emphasisMode||((p.emphasisIndex??-1)<0?'original':'manual'),emphasisIndex=emphasisMode==='none'?-1:emphasisMode==='original'?Math.max(0,Number(p.emphasisIndex)||0):p.emphasisIndex;return {...p,emphasisMode,emphasisIndex,...(Object.keys(copy).length?{original:copy}:{})};}
export function originalVariantCapacity(def,variant,count){const entry=originalDefinition(def.layout)?.variants[String(variant)];if(def.family==='process'&&count!=null&&!processCountValid(count))return null;return entry?{cards:def.family==='process'?(count??6):entry.frames.length,rows:def.family==='table'?(String(variant)==='four'?4:6):null}:null;}
export function originalVariantIssue(def,p){const n=p.cards?.length||0,capacity=originalVariantCapacity(def,p.variant,def.family==='process'?n:undefined);if(!capacity)return def.family==='process'?'流程支持 3–6 个步骤，请在当前页调整步骤数量；原页保留。':'此档位未登记，已保留原页面。';if(def.family==='table'&&(p.table?.rows?.length||0)>capacity.rows)return `当前有 ${p.table.rows.length} 行表格，所选档位最多容纳 ${capacity.rows} 行。可直接手动编辑目标布局、合并或移除目标行，再确认应用；原表格完整保留。`;if(n>capacity.cards)return `当前有 ${n} 个内容块，所选档位最多容纳 ${capacity.cards} 个。可直接手动编辑目标布局，或用 AI 生成适配候选；不必返回脑图，原内容完整保留。`;if(n<capacity.cards)return `此原稿档位需要 ${capacity.cards} 个${def.family==='chart'?'解读':'内容'}块，当前只有 ${n} 个。可进入目标布局手动补充，或使用 AI 适配；原页不变，不自动补写。`;return '';}
export function originalGeometry(def,p){const source=originalDefinition(def.layout)?.variants[String(p.variant)],entry=source&&def.family==='process'?processEntry(source,p.cards.length):source;if(!entry||originalVariantIssue(def,p))return null;
 // The source CSS uses a 472px content grid with 20px gaps. The imported
 // three-row measurements included intrinsic-content overflow (149.53px),
 // not the actual 144px track. Capacity must use the original track size.
 const rowHeight=def.layout==='theme17_content_hw_media_stagger'?(472-20*(Number(p.variant)-1))/Number(p.variant):null,frame=r=>({...r,...(rowHeight!=null?{h:rowHeight}:{})});
 return {nodes:entry.frames.slice(0,p.cards.length).map((r,i)=>({...frame(r),id:p.cards[i].blockId,role:'card'})),media:entry.mediaFrames.map((r,i)=>({...frame(r),id:r.role==='chart'?'chart':'media-'+i,role:r.role||'media'})),fontSize:14,variant:String(p.variant),capacity:entry.frames.length,gridMode:true,maxMedia:entry.mediaFrames.filter(r=>r.role!=='chart').length};}
const get=(p,path)=>path.split('.').reduce((v,k)=>v?.[k],p);
export function originalMarkup(def,p,pageNumber){
 p=normalizeOriginalProps(def,p);const source=originalDefinition(def.layout)?.variants[String(p.variant)],entry=source&&def.family==='process'?processEntry(source,p.cards.length):source,issue=originalVariantIssue(def,p);if(issue)throw new Error('HW_VARIANT_CAPACITY：'+issue);
 const focus=Number(p.emphasisIndex??0),mode=p.emphasisMode,manual=mode==='manual',reset=mode!=='original';if(focus>=p.cards.length)throw new Error('HW_EMPHASIS_INVALID：重点内容索引超出本页内容块。');
 const visible=i=>Array.isArray(p.__mediaSlotVisibility?.imageCount)?p.__mediaSlotVisibility.imageCount[i]!==false:i<Number(p.imageCount||0)&&p.imageVisible?.[i]!==false;
 const captions=p.original||{},voids=new Set(['img','br','hr','input','col','source']);let timelineDotIndex=0;
 const attr=a=>Object.entries(a).filter(([,v])=>v!=null).map(([k,v])=>` ${k}="${e(v)}"`).join('');
 const evidence=(c,cls='')=>c.evidence?`<p class="${cls}" data-content-field="evidence">${e(c.evidence)}</p>`:'';
 function special(s,node,index){const c=p.cards[s.index]||{},id=c.blockId;
  if(s.index!=null&&!p.cards[s.index])return `<${node.tag}${attr({...node.attrs,style:(node.attrs.style||'')+';visibility:hidden;', 'data-hw-unused-slot':'true','aria-hidden':'true'})}></${node.tag}>`;
  if(s.kind==='brand')return `<img class="brand hw-brand" src="assets/huawei-logo.png" alt="HUAWEI">`;
  if(s.kind==='footer')return `<footer class="slide-footer" data-editable-skip="true"><span class="page-number" data-hw-page-number data-editable-skip="true">${pageNumber}</span><span class="copyright" data-editable-skip="true">Huawei Proprietary - Restricted Distribution</span></footer>`;
  if(s.kind==='chart')return originalChart(def,p).replace('<article ',`<article${attr(Object.fromEntries(Object.entries(node.attrs).filter(([k])=>k!=='class')))} `);
  if(s.kind==='icon'){const assignment=iconAssignment(c,id,p.iconConfig);return `<div${attr({...node.attrs,'data-icon-block':id})}>${assignment.visible?iconSvg(assignment.id,assignment):''}</div>`;}
  if(s.kind==='metric')return `<div${attr(node.attrs)}><span data-hw-metric-value${pendingMetric(c)?' data-hw-metric-placeholder="true" data-hw-metric-pending="true"':''}>${e(metricText(c))}</span><small>${e(c.unit)}</small></div>`;
  if(s.kind==='detail'){const main=c.text||'',detail=c.detail||'',name=s.label||'';return `<div${attr(node.attrs)}>${name?`<strong>${e(name)}</strong>`:''}${def.family==='highlight'?`<span data-content-field="text">${e(main)}</span>${detail?'<br>':''}`:''}${e(detail)}${evidence(c)}</div>`;}
  if(s.kind==='heroBars'){const values=p.original?.heroBars;if(!Array.isArray(values)||!values.length)return '';return `<div${attr(node.attrs)}>${values.map(v=>`<i style="height:${Math.max(0,Math.min(100,Number(v)||0))}%"></i>`).join('')}</div>`;}
  if(s.kind==='comparisonBars'){
   const baseline=p.baselines?.find(b=>b.blockId===id);
   if(baseline){
    const values=[baseline.value,...(Number.isFinite(c.value)?[c.value]:[])],max=Math.max(1,...values.map(Math.abs));
    const bars=values.map((v,i)=>`<i class="${i?'new':''}" data-baseline-value="${e(v)}" style="position:absolute;left:calc(50% ${i?'+ 5px':'- 30px'});${v<0?'top':'bottom'}:50%;height:${Math.abs(v)/max*17}px"></i>`).join('');
    return `<div${attr({...node.attrs,style:(node.attrs.style||'')+';position:relative'})}><span class="hw-baseline" data-editable-skip="true" data-hw-baseline-block="${e(id)}" style="position:absolute;left:0;top:0;font-size:10px;line-height:12px;color:#666">基线 ${e(baseline.value)}${e(c.unit)}</span><b style="position:absolute;left:35%;right:35%;top:50%;height:1px;background:#999"></b>${bars}</div>`;
   }
   const values=p.original?.['baseline'+s.index];if(!Array.isArray(values))return '';
   return `<div${attr(node.attrs)}>${values.map((v,i)=>`<i class="${i?'new':''}" style="height:${Math.max(0,Number(v)||0)}%"></i>`).join('')}</div>`;
  }
  if(s.kind==='layerItems'){const items=Array.isArray(c.items)?c.items.filter(v=>String(v).trim()):[],values=items.length?items:[c.text||''];return `<div${attr(node.attrs)}>${values.map((v,i)=>`<div class="layer-item"${i===0?' data-content-field="text"':''}>${e(v)}</div>`).join('')}${evidence(c)}</div>`;}
  if(s.kind==='paragraphs'){const values=String(c.text||'').split('\n\n');return `<span data-content-field="text" style="display:contents;white-space:normal">${values.map(v=>`<p${attr(node.attrs)}>${e(v)}</p>`).join('\n\n')}</span>`;}
  if(s.kind==='media'){const slot=s.index;if(!visible(slot))return '';const image=p.images?.[slot],src=typeof image==='string'?image:image?.src;return `<${node.tag}${attr({...node.attrs,'data-dashi-host-image-slot':'true','data-dashi-image-index':slot,'data-hw-media':slot,style:(node.attrs.style||'')+';margin:0;cursor:pointer'})}>${src?`<img src="${e(src)}" alt="${e(image?.alt||'')}" style="display:block;width:100%;height:100%;object-fit:cover"><button class="hw-media-clear" data-hw-media-clear="${slot}" data-export-exclude="true" data-editable-skip="true" aria-label="取消图片">×</button>`:'<div class="hw-media-empty">点击上传图片</div>'}</${node.tag}>`;}
  if(s.kind==='table'){const t=p.table;let group=null;return `<table${attr(node.attrs)}><colgroup>${t.headers.map((_,i)=>`<col style="width:${t.headers.length===5?[18,25,22,23,12][i]:100/t.headers.length}%">`).join('')}</colgroup><thead><tr>${t.headers.map((v,j)=>`<th data-hw-table-header="${j}">${e(v)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((row,i)=>{let heading='';if(row.group&&row.group!==group){group=row.group;heading=`<tr class="group-row"><td colspan="${t.headers.length}">${e(group)}</td></tr>`;}return heading+`<tr data-hw-table-row="${i}">${row.cells.map((v,j)=>`<td data-hw-table-cell="${j}">${j===0?String(v).split('\n').map((part,k)=>`<span class="${k?'cell-sub':'cell-title'}">${e(part)}</span>`).join(''):j===t.headers.length-1&&/^P\d$/.test(v)?`<span class="status${row.emphasis?.split(',').includes(String(j))?' high':''}">${e(v)}</span>`:String(v).split('\n').map((part,k,a)=>row.emphasis?.split(',').includes(String(j))&&k===a.length-1?`<strong class="red">${e(part)}</strong>`:e(part)).join('<br>')}</td>`).join('')}</tr>`;}).join('')}</tbody></table>`;}
  return '';
 }
 function render(node,blockIndex=null){if(node.text!=null)return e(node.text);if(!node.tag&&node.bind)return e(get(p,node.bind));if(node.block!=null)blockIndex=node.block;const c=p.cards[blockIndex],attrs={...node.attrs};if(node.block!=null&&!c)return `<${node.tag}${attr({...attrs,style:(attrs.style||'')+';visibility:hidden;', 'data-hw-unused-slot':'true','aria-hidden':'true'})}></${node.tag}>`;if(node.block!=null){attrs['data-content-block']=c.blockId;attrs['data-block-type']='paragraph';}
  const cls=attrs.class||'',titleBand=/^(bento-title|highlight-title|media-bento-title|chart-text-title|icon-head)( |$)/.test(cls)||def.family==='media'&&node.tag==='h3';
  if(def.family==='media'&&cls==='media-note'&&node.field==='evidence'&&!String(c?.evidence||'').trim())return '';
  // Bind semantic identity to the original visible chevrons / timeline dots.
  // No new shapes or connector geometry are introduced.
  const relationIndex=def.family==='process'&&cls==='step-head'?blockIndex:def.family==='timeline'&&cls==='mile-dot'?timelineDotIndex++:null;
  if(relationIndex!=null&&relationIndex<p.cards.length-1){const edge=p.layout?.edges?.find(v=>v.from===p.cards[relationIndex].blockId&&v.to===p.cards[relationIndex+1].blockId);if(edge)Object.assign(attrs,{'data-relation-id':String(relationIndex),'data-relation-from':edge.from,'data-relation-to':edge.to,'data-relation-kind':edge.kind});}
  if(titleBand){attrs['data-hw-emphasis-title']='true';if(reset)attrs['data-hw-emphasis-active']=manual&&blockIndex===focus?'true':'false';}
  if(reset&&cls.includes('emphasis'))attrs.class=cls.replace(/\bemphasis\b/g,'');if(manual&&node.block===focus&&def.family==='highlight')attrs.class=(attrs.class||'')+' emphasis';
  if(node.field)attrs['data-content-field']=node.field;
  if(def.family==='process'&&c&&node.field)attrs['data-editable-path']='hw-'+c.blockId+'-'+node.field;
  if(def.family==='process'&&cls==='step-no')attrs['data-editable-skip']='true';
  if(node.bind?.startsWith('cards.')&&node.bind.endsWith('.value')){attrs['data-hw-metric-value']='true';if(pendingMetric(p.cards[Number(node.bind.split('.')[1])])){attrs['data-hw-metric-placeholder']='true';attrs['data-hw-metric-pending']='true';}}
  if(node.bind?.startsWith('cards.')&&node.bind.endsWith('.unit'))attrs['data-hw-metric-unit']='true';
  const copyChildren=(node.children||[]).filter(child=>child.bind?.startsWith('original.'));if(copyChildren.length===1&&(node.children||[]).every(child=>child===copyChildren[0]||child.text!=null&&!child.text.trim()))attrs['data-hw-copy-key']=copyChildren[0].bind.slice(9);
  const prefix='hw-'+String(p.cards[0]?.blockId||def.layout).replace(/[^\w-]/g,'')+'-';
  if(attrs['data-hw-source-id']&&['marker','lineargradient','radialgradient','clippath','filter','pattern'].includes(node.tag))attrs.id=prefix+attrs['data-hw-source-id'];
  for(const key of Object.keys(attrs))if(typeof attrs[key]==='string')attrs[key]=attrs[key].replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#${prefix+id})`);
  if(node.special)return special(node.special,{...node,attrs},blockIndex);
  let contents=node.bind?(node.bind.endsWith('.value')?e(metricText(p.cards[Number(node.bind.split('.')[1])])):node.field?e(get(p,node.bind)).replaceAll('\n','<br>'):e(get(p,node.bind))):(node.children||[]).map(n=>render(n,blockIndex)).join('');
  if(node.block!=null&&attrs['data-hw-needs-evidence']==='true'&&c.evidence&&!contents.includes('data-content-field="evidence"'))contents+=evidence(c);
  if(voids.has(node.tag))return `<${node.tag}${attr(attrs)}>`;return `<${node.tag}${attr(attrs)}>${contents}</${node.tag}>`;
 }
 const extra=`.hw-content.hw-pack{position:relative;width:1280px;height:720px;background:#fff}.hw-original{position:absolute!important;left:0!important;top:0!important;transform:none!important;box-shadow:none!important;display:block!important;box-sizing:border-box;font-family:Arial,'Microsoft YaHei',sans-serif;font-size:16px;color:#181818;--font-factor:1;--row-gap:16px}.hw-original *{font-style:normal!important}.hw-original [data-hw-emphasis-title]{position:static}.hw-original[data-hw-focus="manual"] [data-hw-emphasis-title]{background:linear-gradient(135deg,#f2f2f2,#d9d9d9)!important;color:#4d4d4d!important}.hw-original[data-hw-focus="manual"] [data-hw-emphasis-active="true"]{background:#c7000b!important;color:#fff!important}.hw-original[data-hw-focus="manual"] [data-hw-emphasis-active="true"] h3{color:#fff!important}.hw-original[data-hw-focus="manual"] [data-hw-emphasis-active="false"] h3{color:#4d4d4d!important}.hw-original .hw-media-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(135deg,#eee 0,#eee 9px,#e3e3e3 9px,#e3e3e3 18px);color:#555;font-size:20px}.hw-original .hw-media-clear{position:absolute;right:8px;top:8px;width:25px;height:25px;border:0;border-radius:50%;background:#777;color:white}.hw-original figure{margin:0}`;
 const noFocus='.hw-original[data-hw-focus="none"] [data-hw-emphasis-title]{background:linear-gradient(135deg,#f2f2f2,#d9d9d9)!important;color:#4d4d4d!important}.hw-original[data-hw-focus="none"] [data-hw-emphasis-title] h3{color:#4d4d4d!important}';
 const pendingStyle='.hw-original [data-hw-metric-pending="true"]{font-size:20px!important;line-height:1.2!important;letter-spacing:0!important;white-space:nowrap}';
 const mediaRows='.hw-original .media-stagger .media-row{grid-template-rows:minmax(0,1fr)}.hw-original .media-stagger .media-copy{min-height:0}.hw-original .media-stagger .media-copy>h3,.hw-original .media-stagger .media-copy>p,.hw-original .media-stagger .media-copy>.media-note{flex-shrink:0}';
 return `<style>${originalTypographyCss}\n${extra}\n.hw-original{font-size:calc(16px + 2pt)}\n${noFocus}\n${pendingStyle}\n${mediaRows}</style><div class="hw-original active ${e(entry.className)}" data-hw-body-font-increase="2pt" data-hw-source-slide="${entry.sourceIndex}" data-count="${e(p.variant)}" data-hw-focus="${e(mode)}">${entry.tree.map(n=>render(n)).join('')}</div>`;
}
