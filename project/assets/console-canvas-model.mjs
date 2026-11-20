export const CANVAS_TYPES={text:'文字',module:'内容模块',rect:'矩形',line:'连线',arrow:'箭头',image:'图片',icon:'ICON',chart:'图表',table:'表格'};
const clone=v=>structuredClone(v);
export function createCanvasObject(kind,id,existing=[]){
 if(!CANVAS_TYPES[kind])throw new Error('不支持的组件类型');
 const o={id,kind,x:100+(existing.length%5)*24,y:170+(existing.length%5)*24,w:kind==='icon'?64:kind==='text'?360:kind==='line'||kind==='arrow'?300:480,h:kind==='icon'?64:kind==='text'?64:kind==='line'||kind==='arrow'?48:260,color:'#181818',fill:kind==='rect'?'#dbdbdb':'#ffffff',fontSize:24};
 if(kind==='text')o.text='待补充';
 if(kind==='module')Object.assign(o,{title:'待补充',text:'待补充',source:'待补充'});
 if(kind==='image'){o.src='';o.mediaIndex=100;const used=new Set(existing.filter(v=>v.kind==='image').map(v=>v.mediaIndex));while(used.has(o.mediaIndex))o.mediaIndex++;}
 if(kind==='icon'){o.icon='stack';o.color='#555555';}
 if(kind==='chart')Object.assign(o,{chartType:'column',title:'待补充',items:[{label:'待补充',value:null},{label:'待补充',value:null},{label:'待补充',value:null}]});
 if(kind==='table')o.rows=[['待补充','待补充','待补充'],['待补充','待补充','待补充'],['待补充','待补充','待补充']];
 return o;
}
export function validateCanvasObjects(objects){
 if(!Array.isArray(objects)||objects.length>100)throw new Error('每页最多 100 个新增组件');
 const ids=new Set(),media=new Set();for(const o of objects){
  if(!o||!CANVAS_TYPES[o.kind]||!/^[a-zA-Z0-9_-]{1,120}$/.test(o.id)||ids.has(o.id))throw new Error('组件标识无效或重复');ids.add(o.id);
  for(const k of ['x','y','w','h'])if(!Number.isFinite(o[k]))throw new Error('组件位置与尺寸无效');
  if(o.w<24||o.h<16||o.w>1280||o.h>720||o.x<0||o.y<0||o.x+o.w>1280.1||o.y+o.h>720.1)throw new Error('组件须位于 16:9 画布内');
  for(const k of ['color','fill'])if(!/^#[0-9a-f]{6}$/i.test(o[k]))throw new Error('颜色须为六位十六进制');
  if(!Number.isFinite(o.fontSize)||o.fontSize<10||o.fontSize>144)throw new Error('组件基础字号支持 10–144');
  for(const k of ['text','title','source'])if(o[k]!=null&&(typeof o[k]!=='string'||o[k].length>20000))throw new Error('组件文字过长');
  if(o.kind==='image'){if(!Number.isInteger(o.mediaIndex)||o.mediaIndex<100||o.mediaIndex>199||media.has(o.mediaIndex))throw new Error('图片框编号无效或重复');media.add(o.mediaIndex);if(typeof o.src!=='string'||o.src.length>24*1024*1024||o.src&&(!/^(?:data:image\/(?:png|jpeg|webp|gif);base64,|assets\/[a-z0-9_./-]+$)/i.test(o.src)||o.src.split('/').includes('..')))throw new Error('请先上传或通过图片服务导入图片');}
  if(o.kind==='chart'){if(!['column','line'].includes(o.chartType)||!Array.isArray(o.items)||o.items.length<2||o.items.length>12)throw new Error('图表支持 2–12 项');for(const item of o.items)if(typeof item.label!=='string'||item.label.length>60||item.value!==null&&(typeof item.value!=='number'||!Number.isFinite(item.value)||Math.abs(item.value)>1e12))throw new Error('请填写有效标签及有限数值');}
  if(o.kind==='table'){if(!Array.isArray(o.rows)||o.rows.length<1||o.rows.length>20||!o.rows[0]?.length||o.rows[0].length>8||o.rows.some(r=>!Array.isArray(r)||r.length!==o.rows[0].length||r.some(v=>typeof v!=='string'||v.length>2000)))throw new Error('表格支持 1–20 行、1–8 列');}
 }return true;
}
export function canvasScene(props={}){const removed=props.editorRemovedBlocks||[];if(!Array.isArray(removed)||removed.length>500||removed.some(v=>typeof v!=='string'||v.length>120))throw new Error('页面删除记录无效');return {objects:clone(props.editorCanvasObjects||[]),removed:clone(removed)};}
export function duplicateCanvasObject(object,id,objects){const copy=clone(object);Object.assign(copy,{id,x:Math.min(1280-copy.w,copy.x+24),y:Math.min(720-copy.h,copy.y+24)});if(copy.kind==='image')copy.mediaIndex=createCanvasObject('image',id,objects).mediaIndex;return copy;}
