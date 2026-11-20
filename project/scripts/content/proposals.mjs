import { clone, digest, normalizeDocument, reconcileDocument, uid, now, WorkbenchError } from './model.mjs';
import {contentIssues} from './content-requirements.mjs';
import { commitDocument } from './store.mjs';

export function makeTask(project, request) {
  const scope = clone(request.scope || {});
  const repair=request.repair?clone(request.repair):null;
  if(repair){
    if(!['refine','split'].includes(repair.kind)||!project.current.slides.some(s=>s.slideId===repair.slideId))throw new WorkbenchError('精炼 / 拆页的目标页面无效。',422,'REPAIR_INVALID');
    if(repair.kind==='split'?scope.kind!=='deck':scope.kind!=='slide'||scope.slideId!==repair.slideId)throw new WorkbenchError('精炼 / 拆页的修改范围不匹配。',422,'REPAIR_INVALID');
  }
  if (!['selection', 'slide', 'deck'].includes(scope.kind)) throw new WorkbenchError('请选择局部、整页或整套修改范围。');
  if (!String(request.prompt || '').trim()) throw new WorkbenchError('请输入修改要求。');
  const slide = project.current.slides.find(item => item.slideId === scope.slideId);
  if (scope.kind !== 'deck' && !slide) throw new WorkbenchError('修改目标页面不存在。');
  if (scope.kind === 'selection') {
    if (scope.range) {
      const value = readTarget(slide, scope.range);
      const { start, end } = scope.range;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > value.length) throw new WorkbenchError('选区已失效，请重新选择文字。');
      scope.range.selectedText = value.slice(start, end);
    } else if (!Array.isArray(scope.blockIds) || !scope.blockIds.length || scope.blockIds.some(id => !slide.blocks.some(block => block.blockId === id))) {
      throw new WorkbenchError('请选中文字或勾选至少一个内容块。');
    }
  }
  const execution=request.execution==='manual'?'manual':'auto';
  return { id: uid('task'), runId:uid('run'), status: request.bridge && execution==='manual' ? 'pending' : 'queued', execution, applyMode:!repair && request.applyMode==='auto' && scope.kind!=='deck'?'auto':'proposal',...(repair?{repair}:{}), progress:{stage:'queued',detail:'任务已排队',percent:0}, createdAt: now(), baseContentRevision: project.contentRevision,
    scope, preserveNumbers: request.preserveNumbers !== false, baseDocument: clone(project.current),
    messages: [{ role: 'user', content: String(request.prompt) }], proposalIds: [], mode: request.bridge ? 'bridge' : 'provider' };
}
export function readTarget(slide, target) {
  if (['title', 'conclusion', 'visualIntent', 'evidence'].includes(target.field)) return slide[target.field];
  if (['block', 'blockLabel', 'blockEvidence'].includes(target.field)) {
    const block = slide.blocks.find(item => item.blockId === target.blockId);
    if (!block) throw new WorkbenchError('内容块不存在。');
    return block[target.field === 'block' ? 'text' : target.field === 'blockLabel' ? 'label' : 'evidence'];
  }
  throw new WorkbenchError('不允许修改这个字段。');
}
function writeTarget(slide, target, value) {
  if (['block', 'blockLabel', 'blockEvidence'].includes(target.field)) {
    const block = slide.blocks.find(item => item.blockId === target.blockId);
    block[target.field === 'block' ? 'text' : target.field === 'blockLabel' ? 'label' : 'evidence'] = value;
  } else slide[target.field] = value;
}
function sameTarget(a, b) { return a.field === b.field && a.blockId === b.blockId; }
function assertScope(task, operation) {
  const scope = task.scope;
  if (scope.kind === 'deck') return;
  if (operation.slideId !== scope.slideId) throw new WorkbenchError('AI 提案越界：尝试修改其他页面。', 422, 'SCOPE_VIOLATION');
  if (scope.kind === 'slide' && ['replaceText', 'replaceSlide'].includes(operation.op)) return;
  if (scope.kind === 'selection' && operation.op === 'replaceText') {
    if (scope.range && sameTarget(scope.range, operation.target) && operation.target.start === scope.range.start && operation.target.end === scope.range.end) return;
    if (!scope.range && ['block', 'blockLabel', 'blockEvidence'].includes(operation.target?.field) && scope.blockIds.includes(operation.target.blockId)) return;
  }
  throw new WorkbenchError('AI 提案越界：修改超出了选定范围。', 422, 'SCOPE_VIOLATION');
}
export function previewProposal(task, result) {
  if (!result || !Array.isArray(result.operations) || !result.operations.length || result.operations.length > 100) throw new WorkbenchError('模型未返回有效的结构化 operations。', 422);
  if(task.repair?.kind==='split'){
    const allowed=new Set([task.repair.slideId]),existing=new Set(task.baseDocument.slides.map(s=>s.slideId));let added=0;
    for(const op of result.operations){
      if(['replaceSlide','replaceText'].includes(op.op)&&op.slideId===task.repair.slideId)continue;
      if(op.op==='addSlide'&&allowed.has(op.afterSlideId)&&op.slide?.slideId&&!existing.has(op.slide.slideId)&&!allowed.has(op.slide.slideId)){allowed.add(op.slide.slideId);added++;continue;}
      throw new WorkbenchError('拆页候选越界：只允许修改目标页，并紧接目标页新增拆分页；其他页面必须保持不变。',422,'SCOPE_VIOLATION');
    }
    if(!added)throw new WorkbenchError('拆页候选没有新增页面，请重新生成有效的拆页方案。',422,'REPAIR_INVALID');
  }
  const next = clone(task.baseDocument);
  const touched = new Set();
  for (const operation of result.operations) {
    assertScope(task, operation);
    const slide = next.slides.find(item => item.slideId === operation.slideId);
    if (operation.op === 'replaceText') {
      if (!slide || typeof operation.after !== 'string') throw new WorkbenchError('无效的文字修改提案。', 422);
      const key = `${operation.slideId}:${operation.target?.field}:${operation.target?.blockId || ''}`;
      if (touched.has(key)) throw new WorkbenchError('同一字段只能提供一条修改，请合并提案。', 422);
      touched.add(key);
      const current = readTarget(slide, operation.target);
      const hasRange = operation.target.start != null || operation.target.end != null;
      const start = hasRange ? operation.target.start : 0;
      const end = hasRange ? operation.target.end : current.length;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > current.length || current.slice(start, end) !== operation.before) throw new WorkbenchError('提案的原文或选区不匹配。', 422);
      writeTarget(slide, operation.target, current.slice(0, start) + operation.after + current.slice(end));
    } else if (operation.op === 'replaceSlide') {
      if (!slide || operation.slide?.slideId !== slide.slideId) throw new WorkbenchError('整页修改必须保留 slideId。', 422);
      next.slides[next.slides.indexOf(slide)] = clone(operation.slide);
    } else if (operation.op === 'deleteSlide') {
      if (!slide) throw new WorkbenchError('删除的页面不存在。', 422);
      next.slides.splice(next.slides.indexOf(slide), 1);
    } else if (operation.op === 'addSlide') {
      const after = operation.afterSlideId ? next.slides.findIndex(item => item.slideId === operation.afterSlideId) : next.slides.length - 1;
      if (after < 0) throw new WorkbenchError('新增页面位置无效。', 422);
      next.slides.splice(after + 1, 0, clone(operation.slide));
    } else if (operation.op === 'reorderSlides') {
      if (!Array.isArray(operation.slideIds) || operation.slideIds.length !== next.slides.length || new Set(operation.slideIds).size !== next.slides.length || operation.slideIds.some(id => !next.slides.some(item => item.slideId === id))) throw new WorkbenchError('重排必须包含全部页面 ID 且不得重复。', 422);
      next.slides = operation.slideIds.map(id => next.slides.find(item => item.slideId === id));
    } else throw new WorkbenchError(`不支持的提案操作：${operation.op}`, 422);
  }
  const normalized = normalizeDocument(next, { assignIds: true });
  const issueKey=i=>[i.code,i.slideId,i.blockId||'',i.nodeId||''].join(':'),existing=new Set(contentIssues(task.baseDocument).map(issueKey)),introduced=contentIssues(normalized).filter(i=>!existing.has(issueKey(i)));
  if(introduced.length){const first=introduced[0],error=new WorkbenchError(first.message,422,first.code);error.details={slideId:first.slideId,blockId:first.blockId,nodeId:first.nodeId,issues:introduced.map(i=>i.message)};throw error;}
  if (task.preserveNumbers) {
    const numbers = document => {
      const values = [];
      for (const slide of document.slides) values.push(slide.title, slide.conclusion, slide.evidence, ...slide.blocks.flatMap(block => [block.label, block.text, block.evidence, block.data ? JSON.stringify(block.data) : '']));
      return values.join('\n').match(/-?\d+(?:[.,]\d+)*(?:%|％)?/g)?.sort() || [];
    };
    if (digest(numbers(task.baseDocument)) !== digest(numbers(normalized))) throw new WorkbenchError('提案改变或丢失了数字，已拦截。请要求 AI 保留数据，或明确取消“保护数字”。', 422, 'FACT_GUARD');
  }
  return normalized;
}
export function submitProposal(project, taskId, result) {
  const task = project.aiTasks.find(item => item.id === taskId);
  if (!task || !['pending','queued','running', 'proposed', 'failed'].includes(task.status)) throw new WorkbenchError('任务不存在、已暂停或已经结束。', 409);
  let candidate=previewProposal(task,result);
  if (task.baseContentRevision !== project.contentRevision) {
    if(task.scope.kind!=='selection' || result.operations.some(operation=>operation.op!=='replaceText')) throw new WorkbenchError('内容已经改变，请针对最新内容重新发起 AI 修改。', 409, 'STALE_PROPOSAL');
    // Moving another card must not throw away a valid scoped content edit.
    const rebased={...task,baseDocument:clone(project.current)};
    try{candidate=previewProposal(rebased,result);}catch{throw new WorkbenchError('所选内容已变化，已阻止旧结果覆盖。',409,'STALE_PROPOSAL');}
    task.baseDocument=clone(project.current);task.baseContentRevision=project.contentRevision;
  }
  const proposal = { id: uid('proposal'), taskId, createdAt: now(), baseContentRevision: task.baseContentRevision, summary: String(result.summary || '内容修改建议'),
    operations: clone(result.operations), candidate, status: 'pending' };
  for (const old of project.proposals.filter(item => item.taskId === taskId && item.status === 'pending')) old.status = 'superseded';
  project.proposals.push(proposal); task.proposalIds.push(proposal.id); task.status = 'proposed'; task.error = null;
  task.messages.push({ role: 'assistant', content: JSON.stringify({ summary: proposal.summary, operations: proposal.operations }) });
  return proposal;
}
export function decideProposal(project, id, accept) {
  const proposal = project.proposals.find(item => item.id === id);
  if (!proposal || proposal.status !== 'pending') throw new WorkbenchError('提案已处理或不存在。', 409);
  if (accept) {
    if (proposal.baseContentRevision !== project.contentRevision) throw new WorkbenchError('正式内容已经改变，此提案不能覆盖最新内容。', 409, 'STALE_PROPOSAL');
    const task = project.aiTasks.find(item => item.id === proposal.taskId);
    const verified = previewProposal(task, { operations: proposal.operations });
    commitDocument(project, reconcileDocument(project.current, verified), '接受 AI 提案');
  }
  proposal.status = accept ? 'accepted' : 'rejected';
  project.aiTasks.find(item => item.id === proposal.taskId).status = proposal.status;
}
export function modelMessages(task) {
  const context = task.scope.kind === 'deck' ? task.baseDocument : task.baseDocument.slides.find(slide => slide.slideId === task.scope.slideId);
  return [{ role: 'system', content: `你是中文商业汇报内容编辑。只返回一个 JSON 对象：{"summary":"修改说明","operations":[...]}。严禁直接改稿。
操作格式：replaceText {op,slideId,target:{field,blockId?,start?,end?},before,after}；field 为 title/conclusion/visualIntent/evidence/block/blockLabel/blockEvidence。选区索引按 JavaScript UTF-16，before 必须精确等于原文。整页可用 replaceSlide {op,slideId,slide:完整页面}，保留稳定 ID。整套另允许 deleteSlide、addSlide {afterSlideId,slide}、reorderSlides {slideIds}。不要修改状态、版本、布局或样式。
页面 title、每个内容块 label、每个正文子要点标题必须非空；不得用空标题包裹子内容。封面/章节（cover/section/chapter/transition）的 blocks 必须为空，正文用 body 或对应正文角色。保持内容、来源与数据分离，不删子分支、截字、补零或编造数字来适配容量。无法完整呈现时返回供审阅的完整拆页方案，而非强塞固定模板。
精细脑图改稿也遵循内容—视觉联合适配：保留必要解释、证据和真实关系，visualIntent描述主次与阅读路径。默认图文＝实际3个及以上业务ICON > 其他ICON＝真实图表＝Highlight，同档不叠加。不得为凑图标数制造内容，不把独立维度改为流程，不为图表造数；媒体仅用已授权素材或上传槽。最终程序按当前内容重新匹配容量及全篇相邻不同版式，不锁死初稿模板。
所有操作必须基于最初正式稿，不要基于上一轮候选计算 before。继续对话时综合上一轮候选和最新要求返回完整提案。保留事实、证据和数据；${task.preserveNumbers ? '不得改变、删除或新增任何数字。' : '只有用户明确要求时才修改数字。'}
编辑范围：${JSON.stringify(task.scope)}
汇报需求（用来判断信息取舍和表达方式，不得自行改写这些需求）：${JSON.stringify(task.baseDocument.brief)}
正式稿上下文：${JSON.stringify(context)}` }, ...task.messages];
}
