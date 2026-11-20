// Shared, dependency-free public diagnostics. Never copy provider configuration into reports.
export function safeMessage(value, limit=7000) {
  return String(value??'').replace(/(Bearer\s+)[\w.+\/-]+/gi,'$1[REDACTED]')
    .replace(/((?:api[-_]?key|token|authorization)["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi,'$1[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,limit);
}
export function publicError(error) {
  const raw=error?.details||{},details={};
  if(typeof raw.slideId==='string')details.slideId=raw.slideId;
  if(typeof raw.blockId==='string')details.blockId=safeMessage(raw.blockId,160);
  for(const k of ['phase','executable','systemCode','syscall','target','field','nodeId'])if(typeof raw[k]==='string')details[k]=safeMessage(raw[k],500);
  for(const k of ['issues','suggestions','rejections'])if(Array.isArray(raw[k]))details[k]=raw[k].slice(0,30).map(v=>safeMessage(typeof v==='string'?v:JSON.stringify(v),1000));
  if(Array.isArray(raw.failedPages))details.failedPages=raw.failedPages.filter(Number.isInteger).slice(0,100);
  return {error:safeMessage(error?.message||error?.error||'操作失败'),errorCode:String(error?.code||error?.errorCode||'OPERATION_FAILED').slice(0,80),errorDetails:details};
}
export function publicDiagnosticReport(input,{projectId=input?.projectId,contentRevision=input?.contentRevision}={}){
 return {projectId:String(projectId||'').slice(0,160),contentRevision:Number.isInteger(contentRevision)?contentRevision:null,exportedAt:new Date().toISOString(),records:(Array.isArray(input?.records)?input.records:[]).filter(r=>r&&typeof r==='object').slice(-100).map(r=>{const e=publicError({message:r.message,code:r.code,details:r.details});return {id:safeMessage(r.id,200),at:safeMessage(r.at,80),source:safeMessage(r.source,120),code:e.errorCode,message:e.error,details:e.errorDetails,stage:safeMessage(r.stage,80),slideIds:(Array.isArray(r.slideIds)?r.slideIds:[]).filter(v=>typeof v==='string').slice(0,60).map(v=>safeMessage(v,160)),resolved:r.resolved===true};})};
}
export function diagnosticOf(error,{document,source='操作',id,taskId,collection,at,runId}={}) {
  const e=publicError({message:error?.message||error?.error,code:error?.code||error?.errorCode,details:error?.details||error?.errorDetails});
  const slides=document?.slides||[],details=e.errorDetails;
  let slideIds=[details.slideId,...(details.failedPages||[]).map(i=>slides[i]?.slideId)].filter(Boolean);
  if(!slideIds.length){const m=e.error.match(/(?:第\s*(\d+)\s*页|Slide\s+(\d+))/i);if(m&&slides[Number(m[1]||m[2])-1])slideIds=[slides[Number(m[1]||m[2])-1].slideId];}
  slideIds=[...new Set(slideIds)].filter(s=>slides.some(p=>p.slideId===s));
  const layout=['CAPACITY_REVIEW_REQUIRED','LAYOUT_REVIEW_REQUIRED','RENDERED_CONTENT_FAILED','CONTENT_LAYOUT_FAILED'].includes(e.errorCode)||/放不下|安全容量|拆页候选|内容编排|文字溢出/.test(e.error);
  const config=/BRIDGE|PROVIDER|MODEL/.test(e.errorCode)||/执行器|模型服务|API Key|未配置/.test(e.error);
  if(e.errorCode==='PROCESS_LAUNCH_DENIED'||/spawn\s+EPERM/i.test(e.error))return {id:id||'diagnostic-'+Date.now()+'-'+Math.random().toString(36).slice(2),at:at||new Date().toISOString(),source,code:e.errorCode,message:e.error,details,slideIds,help:'这是工作台启动子进程的权限问题，不是内容框架错误。打开“访问链接 / 环境”检查，保留当前稿；用户允许后停止旧服务，并在普通桌面终端重新启动。无需管理员权限，不要关闭安全软件或默认绕过宿主策略。重试前重新确认仍在编辑的页面。',canRepair:false,canConfigure:false,taskId,collection,runId,stage:safeMessage(error?.failedStage||error?.progress?.stage||'',80),resolved:false};
  if(/^CHART_(DATA|LAYOUT)_REQUIRED$/.test(e.errorCode))return {id:id||'diagnostic-'+Date.now()+'-'+Math.random().toString(36).slice(2),at:at||new Date().toISOString(),source,code:e.errorCode,message:e.error,details,slideIds,help:'定位本页并展开对应内容块的“结构化数据”，核对 kind、labels、values 和单位；标签与数值须逐项对应。条形/柱形/瀑布图允许负值，占比图不允许负值且合计须为 100%。不要取绝对值、补零或编造数据；保存并重新确认后再预检。',canRepair:false,canConfigure:false,taskId,collection,runId,stage:safeMessage(error?.failedStage||error?.progress?.stage||'',80),resolved:false};
  const structural=/^(PAGE_TITLE_REQUIRED|BLOCK_TITLE_REQUIRED|CONTENT_NODE_TITLE_REQUIRED|CONTENT_ROLE_CONFLICT)$/.test(e.errorCode);
  const help=structural?'定位对应页面或内容块，补齐准确标题；封面/章节含正文时修正页面角色或完整移动正文。全部子内容保留，不会自动删字或猜标题。保存后重新确认。':/^RENDER_BROWSER_/.test(e.errorCode)?'浏览器校验组件中断，不代表正文不合格。保留确认稿，关闭多余预览后重试；重复发生时导出诊断，不调用 AI 改写内容来绕过。':/^WORKBENCH_(CONNECTION_LOST|REQUEST_TIMEOUT)$/.test(e.errorCode)?'服务未响应，不能确认取消是否成功。保留当前草稿，恢复原工作台连接后重新执行取消；不要重复提交生成。':layout?'本页内容或关系未通过版式容量检查。可先定位并手工调整，或生成 AI 精炼 / 拆页候选；接受后重新确认内容，再预检生成。':e.errorCode==='DEPENDENCIES_MISSING'?'在 Skill 的 project 目录安装依赖（npm install），完成后重试。内容稿未被覆盖。':config?'打开“模型 / Agent”检查执行器、模型及连接设置，再重试。也可切换到已配置的执行方式。':/STALE|VERSION_CONFLICT/.test(e.errorCode)?'内容版本已变化。请基于当前脑图重新发起操作，旧候选不会覆盖最新稿。':/BRIEF|INTAKE|CONFIRMATION/.test(e.errorCode)?'补齐 Agent 对话中的汇报需求，或确认修改后的页面，再生成。':'查看下方具体原因，调整后重试；如仍失败，可导出诊断记录交给维护者。正式内容不会因关闭提示而改变。';
  return {id:id||'diagnostic-'+Date.now()+'-'+Math.random().toString(36).slice(2),at:at||new Date().toISOString(),source,code:e.errorCode,message:e.error,details,slideIds,help,canRepair:layout,canConfigure:config,taskId,collection,runId,stage:safeMessage(error?.failedStage||error?.progress?.stage||'',80),resolved:false};
}
export function repairRequest({kind,slideId,prompt='',mode='bridge',diagnostic},document) {
  if(!['refine','split'].includes(kind))throw new Error('未知的处理方式。');
  const slide=document.slides.find(s=>s.slideId===slideId);if(!slide)throw new Error('请先选择仍存在的目标页面。');
  const instruction=kind==='refine'?'精炼本页表达，突出论点和层级，减少冗余；保留关键事实、论证、来源、结构化数据和图片引用，不改变页数。':'将本页过长内容拆为逻辑完整的多页，每页一个明确论点。保留原页 slideId，使用 replaceSlide / replaceText 更新原页，并用 addSlide 紧接原页（或刚新增页）插入拆分页。新增页面和内容块使用不重复的稳定 ID；不能删除、重排或改写其他原有页面。';
  return {scope:kind==='split'?{kind:'deck'}:{kind:'slide',slideId},repair:{kind,slideId,...(diagnostic?{diagnosticId:diagnostic.id}:{})},applyMode:'proposal',preserveNumbers:true,bridge:mode!=='provider',execution:mode==='manual'?'manual':'auto',prompt:`生成待用户审阅的${kind==='split'?'拆页':'精炼'}候选，不直接改正式稿。\n目标页面 slideId：${slideId}；论点：${slide.title}\n${instruction}\n遵守已确认的受众、场合、核心诉求。所有原有数字及出现次数保持不变，不补造事实、数据或图片；来源可移动到对应拆分页，不复制或遗漏。保持内容树层级与关系有效。${diagnostic?'\n需要解决的问题：'+safeMessage(diagnostic.message,2500):''}${prompt?'\n用户补充要求：'+prompt:''}`};
}
