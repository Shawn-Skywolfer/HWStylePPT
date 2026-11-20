export function normalizeBrief(value={},audience=''){
 const text=key=>String(value[key]||'').trim();
  return {audience:text('audience')||String(audience||''),occasion:text('occasion'),priority:text('priority'),decisionGoal:text('decisionGoal'),duration:text('duration'),imagePolicy:['none','upload','placeholders'].includes(value.imagePolicy)?value.imagePolicy:'none',workflowMode:['fine','direct'].includes(value.workflowMode)?value.workflowMode:'',confirmed:value.confirmed===true,...(value.pagination==='fixed'?{pagination:'fixed'}:{}),...(value.visualPreferences&&typeof value.visualPreferences==='object'?{visualPreferences:Object.fromEntries(['media','icons','highlight','charts'].filter(k=>typeof value.visualPreferences[k]==='boolean').map(k=>[k,value.visualPreferences[k]]))}:{})};
}
export function briefReady(document){const brief=normalizeBrief(document.brief,document.audience);return brief.confirmed&&!!brief.audience&&!!brief.occasion&&!!brief.priority;}
