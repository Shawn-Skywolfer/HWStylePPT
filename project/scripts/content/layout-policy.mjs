// One reuse policy for deck planning, menus, reservations and execution.
// Fixed (non-reusable) original layouts may appear at most FIXED_LAYOUT_MAX_USES
// times per deck; adjacent body pages must still use different layout IDs.
export const FIXED_LAYOUT_MAX_USES=2;
export const reusableLayout=layout=>/^theme17_(?:content_|chart_)/.test(String(layout||''));

// Usage may be a Map of counts, a legacy Set (treated as "used once"), an array
// of layouts, or a plain object keyed by layout.
export function layoutUsageCount(layout,usage){
  if(usage instanceof Map)return Number(usage.get(layout)||0);
  if(usage instanceof Set)return usage.has(layout)?1:0;
  if(Array.isArray(usage))return usage.reduce((n,item)=>n+(item===layout?1:0),0);
  if(usage&&typeof usage==='object')return Number(usage[layout]||0);
  return 0;
}
export const layoutAvailableForPage=(layout,usage,maxUses=FIXED_LAYOUT_MAX_USES)=>reusableLayout(layout)||layoutUsageCount(layout,usage)<maxUses;
export function layoutUsageFromSlides(slides,{excludeId}={}){
  const counts=new Map();
  for(const slide of slides||[]){
    const layout=slide?.layout;if(!layout)continue;
    if(excludeId!=null&&(slide.id||slide.slideId)===excludeId)continue;
    counts.set(layout,(counts.get(layout)||0)+1);
  }
  return counts;
}
export const hwPreferredLayout=layout=>/^theme17_(content|chart)_hw_/.test(String(layout||''));

export const specialLayoutPage=slide=>['cover','section','transition','chapter','back-cover'].includes(slide?.role)||slide?.layout==='theme17_back_cover'||/^theme17_page00[1-5]$/.test(slide?.layout||'')||['theme17_page016','theme17_page046','theme17_page059','theme17_page068'].includes(slide?.layout);
export function adjacentLayoutIssues(slides){const issues=[];for(let i=1;i<slides.length;i++){const a=slides[i-1],b=slides[i];if(!specialLayoutPage(a)&&!specialLayoutPage(b)&&a.layout&&a.layout===b.layout)issues.push({code:'ADJACENT_LAYOUT_REPEAT',pages:[i,i+1],slideIds:[a.slideId||a.id,b.slideId||b.id],layout:b.layout,message:`第 ${i}、${i+1} 页正文使用了相同版式 ${b.layout}；相邻正文页必须采用不同的已登记版式。`});}return issues;}
export function neighborLayouts(slides,id){const index=slides.findIndex(s=>(s.id||s.slideId)===id),blocked=new Set();if(index<0||specialLayoutPage(slides[index]))return blocked;for(const i of [index-1,index+1])if(slides[i]&&!specialLayoutPage(slides[i])&&slides[i].layout)blocked.add(slides[i].layout);return blocked;}
export function neighborPageIds(slides,id){const index=slides.findIndex(s=>(s.id||s.slideId)===id);if(index<0||specialLayoutPage(slides[index]))return new Set();return new Set([slides[index-1],slides[index+1]].filter(s=>s&&!specialLayoutPage(s)).map(s=>s.id||s.slideId));}

function reserveFixedChoices(rows,maxUses){
  const requested=new Map();
  for(const row of rows)if(row.requested&&!reusableLayout(row.requested)){
    const next=(requested.get(row.requested)||0)+1;
    if(next>maxUses)return {ok:false,row,requested};
    requested.set(row.requested,next);
  }
  return {ok:true,requested};
}

// Whole-deck lookahead: a greedy choice can consume the only valid next layout.
// Keep facts/capacity fixed and backtrack over real registered alternatives only.
export function chooseLayoutSequence(rows,{maxStates=50000,visualAware=true,maxUses=FIXED_LAYOUT_MAX_USES}={}){
 if(visualAware&&rows.some(r=>r.candidates?.some(c=>c.visual)))return chooseVisualSequence(rows,{maxStates,maxUses});
 const reservation=reserveFixedChoices(rows,maxUses);
 if(!reservation.ok)return {ok:false,reason:'duplicate-fixed-choice',row:reservation.row,states:0};
 const requested=reservation.requested;
 const selected=new Map(),counts=new Map(),assigned=new Map();let states=0,blocked=null,preferOnly=true,ceiling=Math.max(1,Math.floor(maxStates/2));
 const reservedFor=layout=>Math.max(0,(requested.get(layout)||0)-(assigned.get(layout)||0));
 const usable=(candidate,row)=>{
  if(reusableLayout(candidate.layout))return true;
  const total=counts.get(candidate.layout)||0;
  if(total>=maxUses)return false;
  if(row?.requested===candidate.layout)return true;
  return maxUses-total-reservedFor(candidate.layout)>0;
 };
 const take=(candidate,row)=>{counts.set(candidate.layout,(counts.get(candidate.layout)||0)+1);if(row?.requested===candidate.layout)assigned.set(candidate.layout,(assigned.get(candidate.layout)||0)+1);};
 const untake=(candidate,row)=>{counts.set(candidate.layout,(counts.get(candidate.layout)||0)-1);if(row?.requested===candidate.layout)assigned.set(candidate.layout,(assigned.get(candidate.layout)||0)-1);};
 function visit(index,previous=null){if(index===rows.length)return true;if(++states>ceiling)return false;const row=rows[index];if(row.special)return visit(index+1,null);
  const all=row.requested?row.candidates.filter(c=>c.layout===row.requested):row.candidates,hw=all.filter(c=>hwPreferredLayout(c.layout)),pool=preferOnly&&!row.requested&&hw.length?hw:all;
  const available=pool.filter(c=>c.layout!==previous?.layout&&usable(c,row)).sort((a,b)=>Number(hwPreferredLayout(b.layout))-Number(hwPreferredLayout(a.layout))||((b.score||0)-(counts.get(b.layout)||0)*24-(previous?.plan?.family===b.plan?.family?8:0)-((a.score||0)-(counts.get(a.layout)||0)*24-(previous?.plan?.family===a.plan?.family?8:0))));
  if(!available.length)blocked={index,id:row.id,previous:previous?.layout,layouts:pool.map(c=>c.layout)};
  for(const c of available){selected.set(row.id,c);take(c,row);if(visit(index+1,c))return true;untake(c,row);selected.delete(row.id);if(states>ceiling)break;}
  return false;
 }
 if(visit(0))return {ok:true,selected,states,priority:'hw-preferred-combination'};
 const hwPreferenceFallbackReason=states>ceiling?'hw-combination-search-limit':'hw-combination-unavailable';
 preferOnly=false;ceiling=maxStates;blocked=null;
 return visit(0)?{ok:true,selected,states,priority:'hw-first-with-required-alternatives',hwPreferenceFallbackReason}:{ok:false,reason:states>maxStates?'search-limit':'no-compatible-sequence',blocked,states};
}

function chooseVisualSequence(rows,{maxStates,maxUses=FIXED_LAYOUT_MAX_USES}){
 const reservation=reserveFixedChoices(rows,maxUses);
 if(!reservation.ok)return {ok:false,reason:'duplicate-fixed-choice',row:reservation.row,states:0};
 const requested=reservation.requested;
 const maxCandidates=Math.max(1,...rows.map(r=>r.candidates?.length||1)),width=Math.max(8,Math.min(64,Math.floor(maxStates/Math.max(1,rows.length*maxCandidates))));
 const initial={selected:new Map(),counts:new Map(),assigned:new Map(),previous:null,recent:[],score:0,tiers:[0,0]};
 let beam=[initial],states=0;
 const reservedFor=(assigned,layout)=>Math.max(0,(requested.get(layout)||0)-(assigned.get(layout)||0));
 const usable=(state,candidate,row)=>{
  if(candidate.layout===state.previous?.layout)return false;
  if(reusableLayout(candidate.layout))return true;
  const total=state.counts.get(candidate.layout)||0;
  if(total>=maxUses)return false;
  if(row.requested===candidate.layout)return true;
  return maxUses-total-reservedFor(state.assigned,candidate.layout)>0;
 };
 for(let i=0;i<rows.length;i++){
  const row=rows[i],next=[];
  for(const state of beam){
   if(row.special){next.push({...state,previous:null,recent:[]});continue;}
   const pool=row.requested?row.candidates.filter(c=>c.layout===row.requested):row.candidates;
   const available=pool.filter(c=>usable(state,c,row));
   for(const c of available){states++;const family=c.visual?.composition||c.plan?.family||c.layout,previous=state.previous?.visual?.composition||state.previous?.plan?.family;
    const penalty=(state.counts.get(c.layout)||0)*26+(previous===family?32:0)+state.recent.filter(v=>v===family).length*14;
    const novelty=state.counts.has(c.layout)?0:10;
    const selected=new Map(state.selected),counts=new Map(state.counts),assigned=new Map(state.assigned);selected.set(row.id,c);counts.set(c.layout,(counts.get(c.layout)||0)+1);if(row.requested===c.layout)assigned.set(c.layout,(assigned.get(c.layout)||0)+1);
    // Reading/semantic suitability dominates rhythm. Diversity must never
    // turn an ordinary causal chain into a spurious timeline just to vary.
    const tiers=[...state.tiers],tier=c.visual?.priorityTier??2;if(!row.requested&&tier<2)tiers[tier]++;
    next.push({selected,counts,assigned,previous:c,recent:[...state.recent,family].slice(-3),score:state.score+(c.score||0)+(c.visual?.quality||0)*2+novelty-penalty,tiers});
   }
  }
  if(!next.length)return {ok:false,reason:'no-compatible-sequence',blocked:{index:i,id:row.id,layouts:row.candidates?.map(c=>c.layout)},states};
  next.sort((a,b)=>b.tiers[0]-a.tiers[0]||b.tiers[1]-a.tiers[1]||b.score-a.score);beam=next.slice(0,width);
 }
 return {ok:true,selected:beam[0].selected,states,priority:'pictorial-or-3-icons-first-lexicographic',priorityCounts:beam[0].tiers,estimatedVisualScore:beam[0].score};
}
