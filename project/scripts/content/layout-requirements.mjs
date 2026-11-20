import {THEME_PAGES} from '../workflow/theme-registry.mjs';
import {inspectLayout} from '../skill-workflow-utils.mjs';
import {hwDefinition} from '../../src/components/hw/contracts.mjs';
import {originalDefinition,originalVariantCapacity} from '../../assets/hw-original-view.mjs';
import {HW_TITLE,HW_BODY_FONT_INCREASE_PT} from '../../assets/hw-typography.mjs';

// Computed from the renderer's own contracts, never a separately maintained
// count list which can drift away from the templates.
export function layoutContentContract(layout){
 const page=THEME_PAGES.find(p=>p.key===layout),inspection=inspectLayout(layout);
 if(!page||!inspection)return null;
 const def=hwDefinition(layout),source=def&&originalDefinition(layout);
 const variants=def?def.variants.flatMap(variant=>(def.family==='process'?[3,4,5,6]:[undefined]).map(count=>({variant:String(variant),...(count?{stepCount:count}:{}),...originalVariantCapacity(def,variant,count),...(source?.variants[String(variant)]?{frames:source.variants[String(variant)].frames}:{} )}))):[];
 return {layout,label:inspection.label,selectable:!page.selectionHidden,group:def?'HW 原稿版式':'HW·设计感版式',roles:inspection.roles,contentLocked:!!inspection.contentLocked,
  required:['页面 title 非空','每个内容块 label 非空','有下级的子要点必须有标题','封面/章节 blocks 为空','所有数据来自原材料，来源独立保留'],
  copyKeys:inspection.copyKeys,copyBudgets:inspection.copyBudgets,propShapes:inspection.propShapes,fieldContracts:inspection.fieldContracts,
  fillPlan:inspection.fillPlan,countBindings:inspection.countBindings,lengthBindings:inspection.lengthBindings,mediaSlots:inspection.mediaSlots,dataSeries:inspection.dataSeries,variants,
  typography:{canvas:{width:1280,height:720},title:HW_TITLE,...(def?{bodyIncreasePt:HW_BODY_FONT_INCREASE_PT}:{})},
  enforcement:{counts:'按所选变体的精确槽数匹配，不把数组最大值当作任意变体容量',copy:'同时通过字段字数、规划空间估算、实际浏览器溢出检查；字数上限不等于实际可容纳字数',overflow:'完整拆页或经确认后调整，不截断、不补造数字、不删子节点',fixedPages:'封面、章节、封底沿用固定 HW 模板，不承载正文块'}};
}
export function layoutContractIndex(){return THEME_PAGES.map(page=>({layout:page.key,label:page.label,selectable:!page.selectionHidden,roles:page.roles||[],detailCommand:'constraints --layout '+page.key}));}
