// Maintained native Theme17 contracts; never edit generated imported metadata.
import {HW_THEME_PAGES} from './hw/contracts.mjs';
export const SEMANTIC_MODES=['columns','flow','comparison','hierarchy','free','editorial','briefing','spotlight','bento'];
export const SEMANTIC_THEME_PAGES=SEMANTIC_MODES.map((mode,index)=>({
  key:`theme17_content_${mode}`,themeKey:'theme17',pageNumber:80+index,
  layout:`HUAWEI-CONTENT-${mode.toUpperCase()}`,slot:`content-${mode==='flow'?'process':mode==='hierarchy'?'relationship':mode}-page`,
  label:({columns:'并列观点卡片',flow:'流程因果链',comparison:'对比分析',hierarchy:'层级支撑',free:'自由关系',editorial:'咨询式条目 · 无卡片框',briefing:'双栏简报 · 无卡片框',spotlight:'重点聚焦 · 主次分区',bento:'弹性 Bento · 高密度并列观点'})[mode],
  nativeContent:true,reusable:true,mode,visualPropKeys:['layout'],arrayCapacities:{cards:mode==='bento'?12:6},
  controls:[],
  defaultProps:{title:'观点标题',lead:'核心结论',closing:'来源',cards:[{label:'内容块标题',text:'正文',evidence:'证据来源'}],layout:{mode,nodes:[],edges:[]}},
  copyBudgets:{title:{maxChars:42,density:'title'},lead:{maxChars:80,density:'paragraph'},closing:{maxChars:140,density:'paragraph'},'cards[].label':{maxChars:36,density:'title'},'cards[].text':{maxChars:1200,density:'paragraph'},'cards[].evidence':{maxChars:400,density:'paragraph'}},
}));
export const semanticPage=key=>SEMANTIC_THEME_PAGES.find(page=>page.key===key);
export const HUAWEI_CHART_PAGES=['bar','column','donut','waterfall'].map((mode,index)=>({
 key:`theme17_chart_${mode}`,themeKey:'theme17',pageNumber:90+index,layout:`HUAWEI-CHART-${mode.toUpperCase()}`,slot:`chart-${mode}-page`,label:({bar:'数据条形比较',column:'数据柱形趋势',donut:'数据占比结构',waterfall:'数据贡献瀑布'})[mode],nativeContent:true,nativeChart:true,reusable:true,mode,controls:[],visualPropKeys:['analysisGeometry'],arrayCapacities:{items:mode==='donut'?6:12,analysis:6},
 defaultProps:{title:'观点标题',lead:'核心结论',caption:'数据说明',note:'补充说明',unit:'单位',closing:'来源',items:[{label:'数据标签',value:0}],analysis:[{label:'分析观点',text:'解读正文'}]},
 copyBudgets:{title:{maxChars:42},lead:{maxChars:80},caption:{maxChars:36},note:{maxChars:70},unit:{maxChars:18},closing:{maxChars:180},'items[].label':{maxChars:18},'analysis[].label':{maxChars:36,density:'title'},'analysis[].text':{maxChars:1200,density:'paragraph'}},
}));
SEMANTIC_THEME_PAGES.push(...HUAWEI_CHART_PAGES);
export const HUAWEI_ICON_PAGES=Object.entries({pillars:['能力支柱',2,3],list:['图标要点清单',2,4],risks:['分类风险分析',2,5],steps:['图标实施步骤',3,5],roadmap:['阶段演进路线图',2,4],media:['图文重点维度',2,4]}).map(([mode,[label,min,max]],index)=>({
 key:`theme17_content_icon_${mode}`,themeKey:'theme17',pageNumber:100+index,layout:`HUAWEI-ICON-${mode.toUpperCase()}`,slot:`content-icon-${mode}-page`,label,nativeContent:true,nativeIcon:true,reusable:true,mode,iconSlots:{min,max},visualPropKeys:['layout','iconConfig'],arrayCapacities:{cards:max,...(mode==='media'?{images:1}:{})},
 controls:mode==='media'?[{key:'imageCount',publicKey:'imageCount',label:'图片数量',type:'range',min:0,max:1,step:1,default:0,mediaSlots:[{field:'images',countKey:'imageCount',maxCount:1,writeMode:'initialProps',canPresetMedia:true}]}]:[],
 defaultProps:{title:'观点标题',lead:'核心结论',closing:'来源',cards:[{label:'内容标题',text:'正文',evidence:'来源'}],layout:{mode,nodes:[],edges:[]},iconConfig:{enabled:true,overrides:{}},...(mode==='media'?{images:[],imageCount:0}:{})},
 copyBudgets:{title:{maxChars:42,density:'title'},lead:{maxChars:80,density:'paragraph'},closing:{maxChars:140,density:'paragraph'},'cards[].label':{maxChars:28,density:'title'},'cards[].text':{maxChars:1200,density:'paragraph'},'cards[].evidence':{maxChars:240,density:'paragraph'}},
}));
SEMANTIC_THEME_PAGES.push(...HUAWEI_ICON_PAGES);
SEMANTIC_THEME_PAGES.push(...HW_THEME_PAGES);
