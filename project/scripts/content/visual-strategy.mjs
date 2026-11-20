// Presentation capabilities, not a slot-count lookup. Shared by initial
// authoring, the rules planner and the Agent's whole-deck design brief.
import {originalLayoutCapability} from '../../src/original-layout-profiles.mjs';
const patterns={
 pillars:{label:'能力支柱',use:'几个相互独立、共同支撑结论的维度',reading:'横向并列',avoid:'不要暗示先后或因果'},
 list:{label:'解释型清单',use:'需要逐项解释的任务、问题、方法',reading:'自上而下',avoid:'不要把必要解释压成标签'},
 risks:{label:'分类风险',use:'问题分类、约束、不同风险及其应对',reading:'分类扫描',avoid:'没有证据不标风险等级或评分'},
 steps:{label:'步骤链',use:'有真实先后顺序的动作和产出',reading:'沿箭头推进',avoid:'独立场景不能硬连成流程'},
 timeline:{label:'时间演进',use:'真实时间、阶段与里程碑',reading:'沿时间轴推进',avoid:'没有日期时不可补造日期'},
 comparison:{label:'对照解释',use:'两条路径、两种组织方式、现状与目标的对应比较',reading:'左右对读',avoid:'不可虚构改进幅度或强行制造优劣'},
 hierarchy:{label:'层级与支撑',use:'有依据的上下层级、主张与支撑关系',reading:'先主后次',avoid:'不要把不同职责编造成同一层级'},
 radial:{label:'中心与关系',use:'中心平台、生态角色、双向协同或真实闭环',reading:'中心向外围或沿环',avoid:'连线必须有业务含义'},
 asymmetric:{label:'主次聚焦',use:'一个核心论点或重点，配若干支撑解释',reading:'先主块后辅块',avoid:'没有主次依据时不随意拔高某项'},
 matrix:{label:'场景矩阵',use:'多个等权场景、能力组合或案例',reading:'按行列扫描',avoid:'不是量化矩阵时不补评分坐标'},
 metricsHero:{label:'主辅指标',use:'一个主指标，配口径不同的辅助指标',reading:'先主数字，再读口径和边界',avoid:'不同单位不可强画成共用纵轴'},
 metrics:{label:'平行指标',use:'多个需平等比较的真实业务指标',reading:'同层比较',avoid:'不能捏造指标、单位或基线'},
 chart:{label:'数据与解读',use:'真实结构化数据、趋势、构成或差异',reading:'先图后解释',avoid:'无数据不画数据图表'},
 media:{label:'图文证据',use:'真实截图、产品图、现场图和配套解释',reading:'图像与解释对应',avoid:'没有真实证据时保留可替换槽，不伪造截图'},
 bento:{label:'解释型分区',use:'信息较多、需要保留机制、案例和边界的独立模块',reading:'按主次和分区阅读',avoid:'不能只放口号，也不能用卡片掩盖关系'},
 briefing:{label:'双栏简报',use:'文字较多但不适合图示的论证',reading:'按栏顺读',avoid:'不要把完整论证打散到无关装饰位'},
 quote:{label:'核心判断',use:'一句强判断和少数支撑结论',reading:'先核心判断',avoid:'不适合高密度解释材料'},
 specialized:{label:'专用叙事',use:'按已登记字段与业务场景使用',reading:'遵循原稿阅读路径',avoid:'不要把数字字段用于长段落'}
};
const old={pillars:[55],list:[7,13,40,71],steps:[23,43,65,66],timeline:[14],comparison:[33,64],hierarchy:[8],metricsHero:[25,28,53,57,62],metrics:[6,30,50,56,58],chart:[10,11,17,18,19,20,21,22,24,27,29,31,32,34,35,37,38,41,42,44,45,47,48,49,51,52,54,60,61,63,69,70],media:[9,12,26,36,39],quote:[15,67]};
export function layoutExpression(layout,plan={}){
 let key='specialized';
 if(/_hw_metrics$/.test(layout))key='metricsHero';
 else if(/highlight_/.test(layout))key='metrics';
 else if(/_hw_transformation$/.test(layout))key='comparison';
 else if(/_hw_radial$/.test(layout))key='radial';
 else if(/_hw_layers$|_hierarchy$/.test(layout))key='hierarchy';
 else if(/timeline|icon_roadmap/.test(layout))key='timeline';
 else if(/_process$|_flow$|icon_steps/.test(layout))key='steps';
 else if(/icon_pillars/.test(layout))key='pillars';
 else if(/icon_risks/.test(layout))key='risks';
 else if(/icon_list/.test(layout))key='list';
 else if(/icon_grid|media_bento_matrix/.test(layout))key='matrix';
 else if(/bento_asymmetric|_spotlight$/.test(layout))key='asymmetric';
 else if(/_chart_/.test(layout))key='chart';
 else if(/media/.test(layout))key='media';
 else if(/_editorial$/.test(layout))key='list';
 else if(/_briefing$/.test(layout))key='briefing';
 else if(/bento|icon_band|_columns$/.test(layout))key='bento';
 else if(/_comparison$/.test(layout))key='comparison';
 else{const n=Number(layout.match(/page(\d+)$/)?.[1]);key=Object.entries(old).find(([,a])=>a.includes(n))?.[0]||key;}
 return {key,...patterns[key],hw:/^theme17_(content|chart)_hw_/.test(layout),composition:key==='media'?layout.replace(/^theme17_content_hw_/,''):key,hasMedia:/media/.test(layout)||Number(plan.mediaCount)>0};
}
const positiveIntent=value=>String(value||'').replace(/(?:不要|不得|不能|不应|不把|不用|禁止|避免|而非|不是)[^。；;\n]*/g,'');
export function explicitFocusBlockId(slide){const intent=positiveIntent(slide.visualIntent);return slide.blocks.find(b=>b.label&&(intent.includes(b.label+'为主')||intent.includes('重点突出'+b.label)||intent.includes('以'+b.label+'为核心')))?.blockId||null;}
export function expressionIntent(slide){
 const raw=slide.visualIntent||'',s=positiveIntent(raw),wanted=[];
 if(/对照|对比|双入口|双路|双路径|左右.*对应/.test(s))wanted.push('comparison');
 if(/主指标|主辅指标/.test(s))wanted.push('metricsHero');
 if(/三支柱|能力支柱|支撑维度/.test(s))wanted.push('pillars');
 if(/核心论点聚焦|主次|为主|为辅|重点聚焦/.test(s))wanted.push('asymmetric');
 if(/场景矩阵|2×2|2x2|四场景/.test(s))wanted.push('matrix');
 if(/风险分类|分类风险/.test(s))wanted.push('risks');
 if(/列表|清单|咨询条目/.test(s))wanted.push('list');
 if(/时间线|时间轴|里程碑/.test(s))wanted.push('timeline');
 if(/步骤|步路线|阶段.*流程|研究流程|流程关系|箭头链|闭环/.test(s))wanted.push('steps');
 if(/层级|支撑关系|网络结构/.test(s))wanted.push('hierarchy','radial');
 if(/图文|大截图|大图|截图.*主导|图.*为主/.test(s))wanted.push('media');
 if(/解释型|解释Bento|分段解释|四模块/.test(s))wanted.push('bento');
 const noSequence=/(?:不要|不得|不能|不把)[^。；;\n]*(?:先后|流程|连成|顺序)/.test(raw);
 return {wanted:[...new Set(wanted)],noSequence,needsMedia:/真实.*(?:截图|录屏)|截图.*主导/.test(s)};
}
export const DEFAULT_VISUAL_PREFERENCES=Object.freeze({media:true,icons:true,highlight:true,charts:true});
// Tiers are lexicographic, never additive. Three actual visible business ICONs
// have the same priority as authorized pictorial content, not a lower bonus.
export function visualPriority(features,{icons=0,authorizedMedia=false,preferences=DEFAULT_VISUAL_PREFERENCES}={}){
 if(features.media&&authorizedMedia&&preferences.media||features.icons&&icons>=3&&preferences.icons)return 0;
 if(features.icons&&preferences.icons||features.charts&&preferences.charts||features.highlight&&preferences.highlight)return 1;
 return 2;
}
export const compareVisualCandidates=(a,b)=>(a.visual?.priorityTier??2)-(b.visual?.priorityTier??2)||(b.score||0)-(a.score||0);
export function scoreVisualCandidate(slide,candidate,document={}){
 const expression=layoutExpression(candidate.layout,candidate.plan),intent=expressionIntent(slide),rank=intent.wanted.indexOf(expression.key),reasons=[];
 const preferences={...DEFAULT_VISUAL_PREFERENCES,...document.brief?.visualPreferences},activeMedia=Number(candidate.plan?.mediaCount??candidate.props?.imageCount??0)>0,allowPlaceholder=preferences.media&&document.brief?.imagePolicy==='placeholders';
 const iconCount=Number(candidate.plan?.icons?.count)||0,authorizedMedia=!!(allowPlaceholder||slide.media?.length||slide.blocks.some(b=>b.media?.length));
 const features={media:expression.hasMedia&&activeMedia,icons:iconCount>0,highlight:['asymmetric','metricsHero','metrics'].includes(expression.key)||expression.hw&&(/bento/.test(candidate.layout)||expression.key==='chart'||candidate.layout.endsWith('icon_band')),charts:expression.key==='chart'&&slide.blocks.some(b=>b.data&&['bar','column','line','area','share','donut','waterfall','radar'].includes(b.data.kind))};
 let quality=55;
 if(rank>=0){quality+=Math.max(12,42-rank*5);reasons.push('符合页面表达意图：'+expression.label);}
 if(intent.noSequence&&['steps','timeline'].includes(expression.key)){quality-=75;reasons.push('与“不表达先后流程”的要求冲突');}
 if(slide.board?.mode==='flow'&&['steps','timeline'].includes(expression.key))quality+=18;
 if(slide.board?.mode==='comparison'&&expression.key==='comparison')quality+=26;
 if(slide.board?.mode==='hierarchy'&&['hierarchy','radial'].includes(expression.key))quality+=26;
 if(slide.role==='risks'&&expression.key==='risks')quality+=30;
 if(expression.key==='timeline'&&!/时间|日期|阶段|演进|里程|路线|timeline|roadmap/i.test(positiveIntent(slide.visualIntent)))quality-=24;
 const bodyUnits=slide.blocks.reduce((n,b)=>n+String(b.text||'').length,0),per=bodyUnits/Math.max(1,slide.blocks.length);
 if(per>65&&['bento','briefing','list'].includes(expression.key)){quality+=12;reasons.push('保留商务解释性正文');}
 if(per>65&&expression.key==='quote')quality-=30;
 const missingMedia=features.media&&!slide.media?.length&&!slide.blocks.some(b=>b.media?.length);
 if(missingMedia){quality-=allowPlaceholder?10:intent.needsMedia?8:45;reasons.push(allowPlaceholder||intent.needsMedia?'已授权预留图片槽；素材待上传，不伪造截图':'无本页配图需求，不优先占用图片区域');}
 if(expression.key==='metricsHero'&&/主指标|主辅/.test(slide.visualIntent||''))quality+=20;
 const focusBlockId=explicitFocusBlockId(slide);
 if(expression.key==='asymmetric'&&focusBlockId)reasons.push('主块遵循原稿指定：'+slide.blocks.find(b=>b.blockId===focusBlockId).label);
 if(expression.key==='asymmetric'&&!focusBlockId&&!/核心论点|重点聚焦|主次|为主|为辅/.test(positiveIntent(slide.visualIntent)))quality-=28;
 const hwBonus=expression.hw?16:0;
 const priorityTier=visualPriority(features,{icons:iconCount,authorizedMedia,preferences}),preferenceBonus=0;
 reasons.push(priorityTier===0?'第一档：图文并茂＝至少 3 个可见业务 ICON':priorityTier===1?'第二档：其他 ICON＝真实数据图表＝Highlight':'普通解释版式');
 if(features.media&&preferences.media)reasons.push('优先图文结合');if(features.icons&&preferences.icons)reasons.push('使用业务 ICON');if(features.highlight&&preferences.highlight)reasons.push('支持突出关键内容');if(features.charts&&preferences.charts)reasons.push('用真实数据图表表达');
 return {...candidate,visual:{...expression,quality,hwBonus,preferenceBonus,priorityTier,iconCount,authorizedMedia,features,reasons,estimated:true,...(focusBlockId?{focusBlockId}:{})},score:quality+hwBonus+Math.min(12,(candidate.score||0)*.06)};
}
export function capabilityCatalog(pages){return {version:1,purpose:'先理解表达能力再组织内容；不是先锁槽数再填文字',expressions:patterns,layouts:pages.map(p=>({layout:p.key,label:p.label,selectable:!p.selectionHidden,expression:layoutExpression(p.key),roles:p.roles||[],needsContract:'constraints --layout '+p.key,...(/^theme17_page/.test(p.key)?{contentAdapter:originalLayoutCapability(p)}:{})})),rules:['保留事实、数字、来源和必要解释','关系改变、实质改写或拆合页须审阅确认','优先合适的HW方案，不设HW页数配额','相邻正文不同版式，并比较视觉家族节奏','不补造图表数据、截图或因果关系']};}
export function interpretationProposals(document){
 const changes=[];
 for(const slide of document.slides){const intent=expressionIntent(slide),raw=positiveIntent(slide.visualIntent),from=slide.board?.mode;
  const to=intent.noSequence&&from==='flow'?'columns':/对照的是|双流程对照|两阶段流程对照|传统与新路径/.test(raw)&&from==='flow'?'comparison':null;
  if(to)changes.push({slideId:slide.slideId,title:slide.title,from,to,reason:intent.noSequence?'原稿明确禁止把独立场景连成先后流程':'原稿明确要求两条路径/组织方式对照',requiresApproval:true,copyChanged:false});
 }
 return changes;
}
