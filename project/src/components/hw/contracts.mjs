import registry from '../../../assets/hw-template-registry.json' with {type:'json'};
import originalLibrary from '../../../assets/hw-original-library.json' with {type:'json'};
import {chartSeriesContracts} from '../../../assets/chart-item-contracts.mjs';
import {timelineOptions} from '../../../assets/hw-timeline-view.mjs';
import {layoutEnglishName} from '../../../assets/layout-names.mjs';
export const HW_DEFINITIONS=registry.templates.map(d=>({...d,labelEn:layoutEnglishName(d.layout)}));
export const hwDefinition=key=>HW_DEFINITIONS.find(d=>d.layout===key);
// Keep contracts available to old decks, but omit paused templates from discovery.
export const isHwSelectable=key=>hwDefinition(key)?.selectionHidden!==true;
const maxCards=d=>d.family==='metrics'?7:d.family==='highlight'?4:d.family==='layers'?6:d.family==='radial'?9:d.family==='process'?6:d.family==='transformation'?6:d.family==='table'?1:d.family==='timeline'?8:Math.max(...d.variants.map(Number))-(d.family==='chart'?1:d.family==='mediaBento'?(d.layout.endsWith('hero')?1:2):0);
const maxImages=d=>d.family==='media'?(d.layout.endsWith('stagger')?3:1):d.family==='mediaBento'?(d.layout.endsWith('hero')?1:2):0;
export const HW_THEME_PAGES=HW_DEFINITIONS.map((d,i)=>{
 const media=maxImages(d),metric=['metrics','highlight'].includes(d.family),chart=d.family==='chart',table=d.family==='table';
 return {key:d.layout,themeKey:'theme17',pageNumber:120+i,layout:'HUAWEI-HW-'+d.layout.replace(/^theme17_(content|chart)_hw_/, '').toUpperCase(),slot:'hw-'+d.family+'-'+i+'-page',label:d.id,nativeContent:true,nativeHw:true,nativeIcon:d.family==='icon',nativeChart:chart,chartType:d.chartType,reusable:true,mode:d.layout,family:d.family,iconSlots:d.family==='icon'?{min:Math.min(...d.variants),max:Math.max(...d.variants)}:undefined,
  selectionHidden:d.selectionHidden===true,purpose:d.purpose,roles:metric?['metrics','result']:chart?['metrics','data',...(['line','area'].includes(d.chartType)?['trend']:d.chartType==='donut'?['distribution']:['comparison'])]:({transformation:['comparison'],layers:['relationship','context'],table:['comparison','breakdown'],radial:['relationship'],timeline:['trend','process'],process:['process','actions'],bento:['breakdown','observation'],media:['image','case'],mediaBento:['image','case'],icon:['breakdown','case']})[d.family]||[],
  visualPropKeys:['layout','variant','iconConfig','imageVisible','baselines'],arrayCapacities:{cards:maxCards(d),...(metric?{baselines:7}:{}),...(media?{images:media}:{}),...(chart?{'chart.items':12}:{}),...(table?{'table.rows':6,'table.headers':6,'table.rows[].cells':6}: {})},
  controls:[{key:'variant',publicKey:'variant',label:'布局档位',type:'select',options:d.variants.map(v=>({value:String(v),label:String(v)})),default:String(d.defaultVariant)},...(media?[{key:'imageCount',publicKey:'imageCount',label:'图片数量',type:'range',min:0,max:media,step:1,default:0,mediaSlots:[{field:'images',countKey:'imageCount',maxCount:media,writeMode:'initialProps',canPresetMedia:true}]}]:[])],
  defaultProps:{title:'',lead:'',closing:'',variant:String(d.defaultVariant),cards:[{blockId:'',label:'',text:'',evidence:'',...(metric?{value:0,unit:'',delta:'',detail:''}:{})}],layout:{mode:d.layout,nodes:[],edges:[]},...(d.family==='icon'?{iconConfig:{enabled:true,overrides:{}}}:{}),...(media?{images:[],imageCount:0,imageVisible:[]}:{}),...(chart?{caption:'',note:'',chart:{type:d.chartType,unit:'',items:[{label:'',value:0}],series:[]}}:{}),...(table?{table:{headers:[''],rows:[{cells:[''],group:'',emphasis:''}]}}:{})},
  ...(table?{lengthBindings:[{dependent:'table.rows[].cells',anchor:'table.headers',relation:'same-length'}]}:{}),
  ...(metric?{defaultProps:{title:'',lead:'',closing:'',variant:String(d.defaultVariant),cards:[{blockId:'',label:'',text:'',evidence:'',value:0,unit:'',delta:'',detail:''}],layout:{mode:d.layout,nodes:[],edges:[]},baselines:[]}}:{}),
  copyBudgets:{title:{maxChars:48,density:'title'},lead:{maxChars:100,density:'paragraph'},closing:{maxChars:150,density:'paragraph'},'cards[].blockId':{maxChars:120},'cards[].label':{maxChars:40,density:'title'},'cards[].text':{maxChars:1200,density:'paragraph'},'cards[].evidence':{maxChars:280,density:'paragraph'},...(metric?{'cards[].unit':{maxChars:16},'cards[].delta':{maxChars:50},'cards[].detail':{maxChars:300}}:{}),...(chart?{caption:{maxChars:40},note:{maxChars:100},'chart.unit':{maxChars:18},'chart.items[].label':{maxChars:36}}:{}),...(table?{'table.headers[]':{maxChars:24},'table.rows[].cells[]':{maxChars:120},'table.rows[].group':{maxChars:24}}:{})},
 };
});
for(const page of HW_THEME_PAGES){page.copyBudgets.title.maxChars=33;if(page.nativeChart)page.arrayCapacities['chart.items']=chartSeriesContracts(page.key,page.defaultProps)[0].max;}
for(const page of HW_THEME_PAGES)if(page.nativeChart){Object.assign(page.defaultProps,{chartScaleMode:'auto',showChartAxisTicks:true,showChartValues:true});page.visualPropKeys.push('chartScaleMode','showChartAxisTicks','showChartValues');}
for(const page of HW_THEME_PAGES){
 const source=originalLibrary.templates[page.key];if(source.copyKeys.length)page.defaultProps.original=Object.fromEntries(source.copyKeys.map(k=>[k,/heroBars|baseline\d+/.test(k)?[0]:'']));
 page.defaultProps.cards[0]={...page.defaultProps.cards[0],heading:'',date:'',meta:'',output:'',items:['']};
 for(const name of ['heading','date','meta','output'])page.copyBudgets['cards[].'+name]={maxChars:name==='heading'?80:120};
 page.copyBudgets['cards[].items[]']={maxChars:120};page.arrayCapacities['cards[].items']=8;
 for(const key of source.copyKeys)if(!/heroBars|baseline\d+/.test(key))page.copyBudgets['original.'+key]={maxChars:600};
 page.variableArrays=['cards[].items',...source.copyKeys.filter(k=>/heroBars|baseline\d+/.test(k)).map(k=>'original.'+k)];
 for(const key of source.copyKeys.filter(k=>/heroBars|baseline\d+/.test(k)))page.arrayCapacities['original.'+key]=key==='heroBars'?12:2;
 page.defaultProps.emphasisIndex=0;page.defaultProps.emphasisMode='original';page.visualPropKeys.push('emphasisIndex','emphasisMode');
 if(['bento','highlight','media','mediaBento','chart'].includes(page.family)||page.key.endsWith('icon_band'))page.controls.push({key:'emphasisIndex',publicKey:'emphasisIndex',label:'重点内容（0＝不突出）',type:'range',min:-1,max:page.arrayCapacities.cards-1,displayOffset:1,step:1,default:0});
 if(page.family==='table'){const c=page.controls.find(c=>c.key==='variant');c.label='布局档位 · 表格行容量';c.options=c.options.map(o=>({...o,label:o.value==='four'?'最多 4 行':'最多 6 行'}));}
 if(page.family==='process'){page.controls[0]={...page.controls[0],label:'呈现样式',options:[{value:'cards',label:'卡片'},{value:'chevron',label:'箭头链'},{value:'value',label:'价值链'}]};page.controls.unshift({key:'editorStepCount',label:'布局档位',type:'select',options:[3,4,5,6].map(value=>({value,label:value+' 步'})),default:6});}
 if(page.family==='timeline')Object.assign(page.controls[0],{type:'segment',options:timelineOptions()});
}
