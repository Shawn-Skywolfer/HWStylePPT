import {THEME_PAGES} from '../skill-workflow-utils.mjs';
import {originalLayoutCapability,originalProfile} from '../../src/original-layout-profiles.mjs';
export function layoutUtilization(rows,{selected=new Map()}={}){
 const entries=THEME_PAGES.filter(p=>!/^theme17_page00[1-5]$/.test(p.key)).map(page=>{
  const original=/^theme17_page/.test(page.key),cap=original?originalLayoutCapability(page):null,fixed=cap?.fixed;
  const pages=rows.filter(r=>!r.special).map(row=>{const candidates=row.candidates||[],candidate=candidates.find(c=>c.layout===page.key),picked=selected.get(row.id)?.layout===page.key,rejections=(row.catalog?.rejections||[]).filter(r=>r.layout===page.key),reasons=[...new Set(rejections.map(r=>r.reason))];
   const adaptable=originalProfile(page.key)&&reasons.some(r=>/容量|分区|分组|标题|来源|关系|正文/.test(r));
   return {slideId:row.id,status:picked?'selected':candidate?'available':adaptable?'needs-adaptation':'not-applicable',reasons:picked?candidate?.visual?.reasons||[]:candidate?['内容与字段检查通过；整套排序未选用']:reasons.length?reasons:['当前内容不满足此版式的数据、角色或结构条件'],...(candidate?{score:candidate.score,tier:candidate.visual?.priorityTier}:{}),requiresApproval:!candidate&&!!adaptable};});
  return {layout:page.key,label:page.label,labelEn:page.labelEn,group:original?'original':page.key.includes('_hw_')?'hw':'design',fixed:!!fixed,hidden:!!page.selectionHidden,...(cap?{capability:cap}:{}),status:fixed?'fixed':page.selectionHidden?'hidden':pages.some(p=>p.status==='selected')?'selected':pages.some(p=>p.status==='available')?'available':pages.some(p=>p.status==='needs-adaptation')?'needs-adaptation':'not-applicable',pages};
 });
 const eligible=entries.filter(e=>!e.fixed&&!e.hidden);return {version:1,summary:{registered:entries.length,fixedExcluded:true,selected:eligible.filter(e=>e.status==='selected').length,availableNotSelected:eligible.filter(e=>e.status==='available').length,needsAdaptation:eligible.filter(e=>e.status==='needs-adaptation').length,notApplicable:eligible.filter(e=>e.status==='not-applicable').length,originalSelected:eligible.filter(e=>e.group==='original'&&e.status==='selected').length},entries};
}
