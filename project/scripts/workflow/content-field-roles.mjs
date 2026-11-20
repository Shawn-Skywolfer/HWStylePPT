const proseNames=new Set(['text','note','desc','detail','lead']);
const numericDisplay=/^[-+]?\d+(?:[.,]\d+)*(?:[%％x×])?$/;
const explicit={theme17_page009:{'cases.lead':{role:'metric',semanticType:'numeric-display',acceptsProse:false,maxChars:8,reason:'案例卡的大号数字指标位，不是正文槽'}}};
export const acceptsProse=field=>field?.type==='string'&&field.acceptsProse!==false&&field.semanticType!=='numeric-display'&&field.role!=='metric';
export function applyContentFieldRoles(layout,arrays,defaults,copyBudgets){
 for(const array of arrays){const root=array.key.split('.')[0],example=defaults[root]?.[0];for(const [key,field]of Object.entries(array.itemFields||{})){
  const numeric=proseNames.has(key)&&typeof example?.[key]==='string'&&numericDisplay.test(example[key].trim())&&('unit'in example||'metricLabel'in example);
  const rule=explicit[layout]?.[array.key+'.'+key]||(numeric?{role:'metric',semanticType:'numeric-display',acceptsProse:false,maxChars:8,reason:'独立单位对应的数字展示位'}:null);if(!rule)continue;
  Object.assign(field,rule);if(copyBudgets?.[array.key+'[].'+key])Object.assign(copyBudgets[array.key+'[].'+key],{maxChars:rule.maxChars});
 }}return arrays;
}
export function numericDisplayIssues(layout,props){const issues=[];for(const [path,rule]of Object.entries(explicit[layout]||{})){const [array,key]=path.split('.'),rows=Array.isArray(props?.[array])?props[array]:[];for(const [i,row]of rows.entries())if(row?.[key]!=null&&row[key]!==''&&!numericDisplay.test(String(row[key]).trim()))issues.push(`props.${array}[${i}].${key}: ${rule.reason}；请提供真实数字和独立单位，不要填入段落`);}return issues;}
export function contentRoleNotice(layout){return layout==='theme17_page009'?'“案例 Cases”的 lead 是大号数字指标位，没有独立正文槽，不能承载当前的论点段落。请选择图文、要点或其他正文版式；未调用 AI，原页未改变。':null;}
