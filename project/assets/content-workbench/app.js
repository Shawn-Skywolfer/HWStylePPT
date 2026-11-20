const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const clone = value => structuredClone(value);
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
let token = new URLSearchParams(location.hash.slice(1)).get('token') || sessionStorage.getItem('dashi-content-token');
if (token) { sessionStorage.setItem('dashi-content-token', token); history.replaceState(null, '', location.pathname); }
let project, status, selectedId, draft, dirty = false, saveTimer, savePromise = Promise.resolve(), busy = false, conflict = false;
let selection = null, blockSelection = new Set(), taskId = null, proposalId = null, dragId = null, invalidData = false;
const states = { draft: '草稿', editing: '待确认', confirmed: '已确认' };
const roleNames = { cover:'封面', section:'章节', body:'正文', method:'方法', risks:'风险', process:'流程', comparison:'比较', actions:'行动', trend:'趋势', table:'表格', metrics:'指标', case:'案例' };
const blockNames = { paragraph:'段落', bullet:'要点', metric:'指标', table:'表格', chart:'图表', quote:'引用', 'legacy-field':'旧稿字段' };
async function api(route, data) {
  const response = await fetch(`/api/${route}`, { method: data === undefined ? 'GET' : 'POST', headers: { 'content-type':'application/json', 'x-workbench-token': token || '' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || '请求失败'); error.code = result.code; throw error; }
  return result;
}
let noticeTimer;
function notify(message, persist = false) { $('#notice').textContent = message; $('#notice').hidden = false; clearTimeout(noticeTimer); if (!persist) noticeTimer = setTimeout(() => { $('#notice').hidden = true; }, 6000); }
function showError(error) { notify(error.message, true); }
function absorb(result, { editor = false } = {}) {
  project = result.project; status = result.status;
  draft = clone(project.current); dirty = false; conflict = false; invalidData = false;
  if (!draft.slides.some(slide => slide.slideId === selectedId)) selectedId = draft.slides[0].slideId;
  $('#save-state').textContent = '已保存'; renderOutline(); renderStatus(); renderAi();
  if (editor) renderEditor();
}
function current() { return draft.slides.find(slide => slide.slideId === selectedId); }
function updateDraft() {
  dirty = true; current().status = 'editing'; $('#save-state').textContent = '尚未保存';
  renderOutline(); renderStatus(); clearTimeout(saveTimer); saveTimer = setTimeout(() => flush().catch(showError), 600);
}
async function flush() {
  clearTimeout(saveTimer);
  if (invalidData) throw new Error('结构化数据 JSON 无效，请修正后保存。');
  savePromise = savePromise.catch(() => {}).then(async () => {
    if (!dirty || conflict) return;
    const snapshot = clone(draft); const originalJson = JSON.stringify(snapshot);
    $('#save-state').textContent = '正在保存…';
    try {
      const result = await api('document', { revision: project.revision, document: snapshot });
      project = result.project; status = result.status;
      if (JSON.stringify(draft) === originalJson) { draft = clone(project.current); dirty = false; $('#save-state').textContent = '已保存'; }
      else { dirty = true; $('#save-state').textContent = '尚未保存'; saveTimer = setTimeout(() => flush().catch(showError), 300); }
      renderOutline(); renderStatus();
    } catch (error) {
      $('#save-state').textContent = '保存失败，输入已保留';
      if (error.code === 'VERSION_CONFLICT') { conflict = true; showConflict(); }
      throw error;
    }
  });
  await savePromise;
  if (conflict) throw new Error('请先处理版本冲突。');
  if (dirty) await flush();
}
function renderOutline() {
  $('#project-title').textContent = draft.title;
  const count = draft.slides.filter(slide => slide.status === 'confirmed').length;
  $('#progress').textContent = `${draft.slides.length} 页 · 已确认 ${count} 页`;
  $('#progress-bar').style.width = `${count / draft.slides.length * 100}%`;
  $('#slides').innerHTML = draft.slides.map((slide, index) => `<button class="slide-item ${slide.slideId === selectedId ? 'active' : ''}" draggable="true" data-slide="${esc(slide.slideId)}"><span class="slide-title">${index + 1}. ${esc(slide.title || '未填写标题')}</span><span class="badge ${slide.status}">${states[slide.status]}</span><span class="slide-summary">${esc(slide.conclusion || roleNames[slide.role] || slide.role)}</span></button>`).join('');
}
function field(label, key, value, { rows = 2, blockId, cls = '' } = {}) {
  return `<label>${label}<textarea class="${cls}" data-field="${key}" ${blockId ? `data-block="${esc(blockId)}"` : ''} rows="${rows}">${esc(value)}</textarea></label>`;
}
function renderEditor() {
  const slide = current(); if (!slide) return;
  $('#slide-number').textContent = `第 ${draft.slides.indexOf(slide) + 1} 页 · 内容版本 ${slide.version}`;
  $('#slide-state').textContent = states[slide.status]; $('#slide-state').className = `badge ${slide.status}`;
  $('#editor').innerHTML = `<div class="field-row"><label>页面角色<select data-field="role">${Object.entries(roleNames).map(([value, label]) => `<option value="${value}" ${slide.role === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>${field('观点标题', 'title', slide.title, { cls:'title-input' })}${field('核心结论 / 本页主要信息', 'conclusion', slide.conclusion, { rows:3 })}<div id="blocks">${slide.blocks.map((block, index) => `<article class="block ${blockSelection.has(block.blockId) ? 'selected' : ''}" data-block-card="${esc(block.blockId)}"><div class="block-head"><label class="check"><input type="checkbox" data-select-block="${esc(block.blockId)}" ${blockSelection.has(block.blockId) ? 'checked' : ''}>内容块 ${index + 1}</label><div><select data-field="type" data-block="${esc(block.blockId)}">${['paragraph','bullet','metric','table','chart','quote','legacy-field'].map(type => `<option ${type === block.type ? 'selected' : ''}>${type}</option>`).join('')}</select> <button data-block-action="up" data-id="${esc(block.blockId)}" title="上移内容块">↑</button> <button data-block-action="down" data-id="${esc(block.blockId)}" title="下移内容块">↓</button> <button data-block-action="delete" data-id="${esc(block.blockId)}" title="删除内容块">删除</button></div></div>${field('小标题（可选）', 'blockLabel', block.label, { blockId:block.blockId, rows:1 })}${field('内容（支持 Markdown 文本）', 'block', block.text, { blockId:block.blockId, rows:4 })}${field('相关数据或证据 / 来源', 'blockEvidence', block.evidence, { blockId:block.blockId })}<details><summary>结构化数据 / Markdown 预览</summary>${field('结构化数据 JSON（可选）', 'data', block.data == null ? '' : JSON.stringify(block.data, null, 2), { blockId:block.blockId, rows:4 })}<div class="markdown-preview">${markdown(block.text)}</div></details></article>`).join('')}</div>${field('本页证据与来源', 'evidence', slide.evidence)}${field('视觉表达建议（供编排参考）', 'visualIntent', slide.visualIntent)}`;
  $('#editor').querySelectorAll('select[data-field="type"] option').forEach(option => { const type = option.value; option.value = type; option.textContent = blockNames[type] || type; });
  if (!roleNames[slide.role]) $('#editor select[data-field="role"]').add(new Option(`自定义角色：${slide.role}`, slide.role, true, true));
  renderStatus(); renderSelection();
}
function markdown(value) { return esc(value).replace(/^### (.+)$/gm, '<strong>$1</strong>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>'); }
function renderStatus() {
  if (!project) return;
  const slide = current();
  $('#slide-state').textContent = states[slide?.status] || ''; $('#slide-state').className = `badge ${slide?.status}`;
  $('#undo').disabled = !status.canUndo || busy; $('#redo').disabled = !status.canRedo || busy;
  const working = project.generations.find(job => job.status === 'running');
  $('#generate').disabled = dirty || !status.canGenerate || !!working || busy;
  $('#generate').textContent = working ? '正在生成 PPT…' : '生成 PPT';
  const job = project.generations.at(-1);
  $('#generation-state').textContent = working ? '正在调用 Theme17 原有渲染与校验。请稍候。' : job?.status === 'failed' ? `生成失败：${job.error}` : status.canGenerate ? '内容已全部确认，可以生成 PPT。' : '确认全部内容后进入现有 PPT 生成流程。';
  $('#preview-link').hidden = !job?.previewUrl; if (job?.previewUrl) $('#preview-link').href = job.previewUrl;
  $('#preview-link').textContent = job?.confirmedId === project.confirmed?.id && status.canGenerate ? '打开 PPT 预览 / 编辑 / 导出 ↗' : '打开上次生成的 PPT（当前稿未生成）↗';
}
function renderSelection() {
  const kind = $('#scope').value;
  $('#selection-info').textContent = kind === 'deck' ? `整套 ${draft.slides.length} 页：跨页修改先预览，再确认。` : kind === 'slide' ? `当前页：${current().title}` : selection?.slideId === selectedId ? `已选中文字：\n${selection.selectedText}` : blockSelection.size ? `已选 ${blockSelection.size} 个内容块。` : '在文字稿中选取文字，或勾选内容块。';
}
function renderAi() {
  const task = project.aiTasks.find(item => item.id === taskId) || (!taskId ? project.aiTasks.findLast(item => item.scope.kind === 'deck' || item.scope.slideId === selectedId) : null);
  if (task && !taskId) taskId = task.id;
  if (task && ['running','pending','proposed','failed'].includes(task.status)) {
    $('#ai-mode').value = task.mode === 'bridge' ? 'bridge' : 'provider';
    $('#scope').value = task.scope.kind;
    $('#protect-numbers').checked = task.preserveNumbers;
    const target = project.current.slides.find(slide => slide.slideId === task.scope.slideId);
    $('#selection-info').textContent = task.scope.kind === 'deck' ? '当前会话：整套内容结构（范围锁定）' : `当前会话：第 ${target?.order || '?'} 页 · ${task.scope.kind === 'slide' ? '整页' : '局部内容'}（范围锁定）${task.scope.range?.selectedText ? '\n' + task.scope.range.selectedText : ''}`;
  }
  const pending = project.proposals.filter(item => item.taskId === taskId && item.status === 'pending').at(-1);
  proposalId = pending?.id || null;
  $('#proposal-actions').hidden = !pending;
  $('#ask-ai').disabled = !!task && ['running','pending'].includes(task.status);
  $('#ask-ai').textContent = task && ['proposed','failed'].includes(task.status) ? '继续修改此候选' : '生成修改提案';
  $('#ai-state').textContent = !task ? '修改仅在接受提案后生效。' : task.status === 'running' ? 'AI 正在生成结构化提案，正式稿未改变…' : task.status === 'pending' ? `等待 Agent 桥接处理。任务 ID：${task.id}\nAgent 可运行 tasks / submit 命令。` : task.status === 'failed' ? task.error : pending ? pending.summary : task.status === 'accepted' ? '提案已接受，相关页面需要重新确认。' : task.status === 'rejected' ? '提案已拒绝，正式稿未改变。' : '';
  $('#conversation').innerHTML = (task?.messages || []).filter(message => message.role === 'user').map(message => `<div class="chat-message user">${esc(message.content)}</div>`).join('');
}
async function mutate(route, input, { editor = true } = {}) { await flush(); busy = true; renderStatus(); try { absorb(await api(route, { revision: project.revision, ...input }), { editor }); } finally { busy = false; renderStatus(); } }
function modal(title, html) { $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; if (!$('#modal').open) $('#modal').showModal(); }
function serializeDoc(doc) { return doc.slides.map((slide, index) => `${index + 1}. ${slide.title}\n${slide.conclusion}\n${slide.blocks.map(block => [block.label, block.text, block.evidence, block.data ? JSON.stringify(block.data) : ''].filter(Boolean).join('\n')).join('\n\n')}\n${slide.evidence || ''}\n视觉建议：${slide.visualIntent || ''}`).join('\n\n────────────\n\n'); }
function viewProposal() {
  const proposal = project.proposals.find(item => item.id === proposalId); if (!proposal) return;
  const task = project.aiTasks.find(item => item.id === proposal.taskId);
  const before = task.scope.kind === 'deck' ? task.baseDocument : { slides: task.baseDocument.slides.filter(slide => slide.slideId === task.scope.slideId) };
  const after = task.scope.kind === 'deck' ? proposal.candidate : { slides: proposal.candidate.slides.filter(slide => slide.slideId === task.scope.slideId) };
  modal('AI 修改提案 · 接受后才写入正式稿', `<p>${esc(proposal.summary)}</p><p class="hint">操作：${proposal.operations.map(operation => esc(operation.op)).join('、')}。请比较全部修改内容。</p><div class="diff-grid"><div class="diff-col"><h3>修改前</h3><pre>${esc(serializeDoc(before))}</pre></div><div class="diff-col after"><h3>候选修改后</h3><pre>${esc(serializeDoc(after))}</pre></div></div><div class="editor-footer"><button id="modal-reject">拒绝</button><button id="modal-accept" class="primary">接受此提案</button></div>`);
  $('#modal-accept').onclick = () => decide(true); $('#modal-reject').onclick = () => decide(false);
}
async function decide(accept) { try { await mutate('proposal/decide', { proposalId, accept }); $('#modal').close(); taskId = null; renderAi(); } catch (error) { showError(error); } }
function showConflict() {
  modal('检测到并发修改 · 你的输入仍在本窗口', '<p>另一个窗口或 Agent 已更新项目。请先下载本地草稿，随后读取服务端版本并合并修改。</p><button id="download-draft">下载本地草稿 JSON</button> <button id="reload-server">读取服务端版本</button>');
  $('#download-draft').onclick = () => download('content-draft-recovery.json', draft);
  $('#reload-server').onclick = async () => { absorb(await api('project'), { editor:true }); $('#modal').close(); };
}
function download(name, data) { const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], { type:'application/json' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

$('#editor').addEventListener('input', event => {
  const el = event.target, field = el.dataset.field; if (!field) return;
  const slide = current();
  if (el.dataset.block) {
    const block = slide.blocks.find(item => item.blockId === el.dataset.block);
    if (field === 'data') { try { block.data = el.value.trim() ? JSON.parse(el.value) : undefined; invalidData = false; el.setCustomValidity(''); } catch { invalidData = true; el.setCustomValidity('请输入有效 JSON'); $('#save-state').textContent = '数据 JSON 无效，尚未保存'; clearTimeout(saveTimer); return; } }
    else block[{ block:'text', blockLabel:'label', blockEvidence:'evidence', type:'type' }[field]] = el.value;
  } else slide[field] = el.value;
  updateDraft();
});
function captureSelection(event) {
  const el = event.target; if (el.tagName !== 'TEXTAREA' || !el.dataset.field || el.selectionStart === el.selectionEnd || el.dataset.field === 'data') return;
  selection = { slideId:selectedId, field:el.dataset.field, ...(el.dataset.block ? { blockId:el.dataset.block } : {}), start:el.selectionStart, end:el.selectionEnd, selectedText:el.value.slice(el.selectionStart,el.selectionEnd) };
  blockSelection.clear(); taskId = 'new'; $('#editor').querySelectorAll('[data-select-block]').forEach(input => { input.checked = false; }); $('#scope').value = 'selection'; renderSelection(); renderAi();
}
$('#editor').addEventListener('mouseup', captureSelection); $('#editor').addEventListener('keyup', captureSelection);
$('#editor').addEventListener('change', event => {
  const el = event.target;
  if (el.dataset.selectBlock) { selection = null; taskId = 'new'; if (el.checked) blockSelection.add(el.dataset.selectBlock); else blockSelection.delete(el.dataset.selectBlock); el.closest('.block').classList.toggle('selected', el.checked); $('#scope').value = 'selection'; renderSelection(); renderAi(); }
});
$('#editor').addEventListener('click', async event => {
  const button = event.target.closest('[data-block-action]'); if (!button) return;
  const blocks = current().blocks, index = blocks.findIndex(block => block.blockId === button.dataset.id);
  if (button.dataset.blockAction === 'delete') blocks.splice(index, 1);
  else { const next = index + (button.dataset.blockAction === 'up' ? -1 : 1); if (next < 0 || next >= blocks.length) return; [blocks[index],blocks[next]] = [blocks[next],blocks[index]]; }
  selection = null; updateDraft(); renderEditor();
});
$('#slides').addEventListener('click', event => { const button = event.target.closest('[data-slide]'); if (button) { selectedId = button.dataset.slide; selection = null; blockSelection.clear(); taskId = null; renderOutline(); renderEditor(); renderAi(); } });
$('#slides').addEventListener('dragstart', event => { const item = event.target.closest('[data-slide]'); if (item) { dragId = item.dataset.slide; item.classList.add('dragging'); event.dataTransfer.setData('text/plain', dragId); } });
$('#slides').addEventListener('dragover', event => event.preventDefault());
$('#slides').addEventListener('drop', event => { event.preventDefault(); const target = event.target.closest('[data-slide]')?.dataset.slide; if (!target || !dragId || target === dragId) return; const from = draft.slides.findIndex(slide => slide.slideId === dragId), to = draft.slides.findIndex(slide => slide.slideId === target); draft.slides.splice(to, 0, draft.slides.splice(from, 1)[0]); updateDraft(); renderOutline(); renderEditor(); });
$('#slides').addEventListener('dragend', () => { dragId = null; renderOutline(); });
$('#add-slide').onclick = () => { const slide = { slideId:id('slide'), role:'body', title:'', conclusion:'', evidence:'', visualIntent:'', status:'draft', version:1, blocks:[] }; draft.slides.push(slide); selectedId = slide.slideId; updateDraft(); renderEditor(); };
$('#duplicate-slide').onclick = () => { const slide = clone(current()); slide.slideId = id('slide'); slide.blocks.forEach(block => { block.blockId = id('block'); }); delete slide.legacy; slide.title += '（副本）'; slide.status = 'draft'; draft.slides.splice(draft.slides.indexOf(current()) + 1, 0, slide); selectedId = slide.slideId; updateDraft(); renderEditor(); };
$('#delete-slide').onclick = () => { if (draft.slides.length < 2) return notify('至少保留一页。'); if (!confirm('删除当前页面？可通过撤回恢复。')) return; const index = draft.slides.indexOf(current()); draft.slides.splice(index,1); selectedId = draft.slides[Math.min(index,draft.slides.length-1)].slideId; updateDraft(); renderEditor(); };
function moveSlide(delta) { const index = draft.slides.indexOf(current()), to = index + delta; if (to < 0 || to >= draft.slides.length) return; [draft.slides[index],draft.slides[to]] = [draft.slides[to],draft.slides[index]]; updateDraft(); renderEditor(); }
$('#move-up').onclick = () => moveSlide(-1); $('#move-down').onclick = () => moveSlide(1);
$('#add-block').onclick = () => { current().blocks.push({ blockId:id('block'), type:'paragraph', label:'', text:'', evidence:'' }); updateDraft(); renderEditor(); };
$('#save').onclick = () => flush().then(() => notify('草稿已保存。')).catch(showError);
for (const action of ['undo','redo']) $(`#${action}`).onclick = () => mutate('action',{action}).catch(showError);
$('#confirm-slide').onclick = () => mutate('action', { action:'confirm', slideId:selectedId }).then(() => notify('本页已确认。')).catch(showError);
$('#confirm-all').onclick = () => mutate('action', { action:'confirm' }).then(() => notify('整套内容已确认，修改后会重新标记待确认。')).catch(showError);
$('#compile-check').onclick = async () => { try { await flush(); const result = await api('compile-check',{}); notify(`编排校验通过。${result.warnings.join('\n')}`); } catch (error) { showError(error); } };
$('#generate').onclick = () => mutate('generate', {}, {editor:false}).catch(showError);
$('#scope').onchange = () => { taskId = 'new'; renderSelection(); renderAi(); };
$('#ask-ai').onclick = async () => {
  try {
    await flush(); const prompt = $('#prompt').value.trim(); if (!prompt) return notify('请输入修改要求。');
    const task = project.aiTasks.find(item => item.id === taskId);
    if (task && ['proposed','failed'].includes(task.status)) absorb(await api('ai/refine',{revision:project.revision,taskId,prompt}));
    else {
      const kind = $('#scope').value; let scope = {kind};
      if (kind !== 'deck') scope.slideId = selectedId;
      if (kind === 'selection') { if (selection?.slideId === selectedId) { const { slideId, selectedText, ...range } = selection; scope.range = range; } else scope.blockIds = [...blockSelection]; }
      const result = await api('ai/request',{revision:project.revision,prompt,scope,bridge:$('#ai-mode').value === 'bridge',preserveNumbers:$('#protect-numbers').checked});
      taskId = result.project.aiTasks.at(-1).id; absorb(result);
    }
    $('#prompt').value = '';
  } catch(error) { showError(error); }
};
$('#view-proposal').onclick = viewProposal; $('#accept').onclick = () => decide(true); $('#reject').onclick = () => decide(false);
$('#close-modal').onclick = () => $('#modal').close();
$('#original').onclick = () => { const slide = project.original.slides.find(item => item.slideId === selectedId); modal('最初生成稿 · 只读', `<pre>${esc(slide ? serializeDoc({slides:[slide]}) : '此页为后续新增，不在最初稿中。')}</pre>`); };
$('#history').onclick = async () => {
  try { await flush(); modal('内容版本与恢复', `<p>恢复会创建一次新的可撤回修改，不删除最初稿。</p><button id="checkpoint">保存当前关键版本</button><div class="version-row"><span>最初 AI 生成稿</span><button data-restore="original">恢复</button></div>${project.checkpoints.map(item => `<div class="version-row"><span>${esc(item.label)} · ${esc(new Date(item.createdAt).toLocaleString())}</span><button data-restore="${esc(item.id)}">恢复</button></div>`).join('')}`);
    $('#checkpoint').onclick = async () => { try { await mutate('action',{action:'checkpoint',label:prompt('版本名称','手动版本') || '手动版本'}); $('#history').click(); } catch(error){showError(error);} };
    $('#modal-body').querySelectorAll('[data-restore]').forEach(button => { button.onclick = async () => { if (!confirm('恢复此内容版本？当前稿可通过撤回找回。')) return; try { await mutate('action',{action:'restore',id:button.dataset.restore}); $('#modal').close(); } catch(error){showError(error);} }; });
  } catch(error){showError(error);}
};
$('#settings').onclick = async () => {
  try {
    const cfg = await api('model');
    modal('模型服务设置 · 仅存于本地服务端', `<form id="model-form" class="model-form"><p class="hint">支持内网 OpenAI-compatible Chat Completions 服务。密钥不会写入 HTML / PPT，也不会回传到浏览器。已配置：${cfg.hasApiKey ? '是' : '否'}${cfg.keyFromEnvironment ? '（环境变量）' : ''}</p><label>Base URL（通常以 /v1 结尾）<input name="baseUrl" type="url" value="${esc(cfg.baseUrl)}" placeholder="http://your-internal-model/v1" required></label><label>Model<input name="model" type="text" value="${esc(cfg.model)}" required></label><label>API Key（留空保留已有值）<input name="apiKey" type="password" autocomplete="off"></label><label class="check"><input name="clearApiKey" type="checkbox">清除已保存的 Key</label><div class="field-row"><label>Temperature<input name="temperature" type="number" step="0.1" min="0" max="2" value="${cfg.temperature}"></label><label>最大输出 Token<input name="maxTokens" type="number" min="128" max="65536" value="${cfg.maxTokens}"></label></div><label>超时（毫秒）<input name="timeoutMs" type="number" min="1000" max="600000" value="${cfg.timeoutMs}"></label><button class="primary" type="submit">保存设置</button><button id="test-model" type="button">保存并测试连接</button><p id="model-result"></p></form>`);
    const saveConfig = async test => { const form = $('#model-form'), data = Object.fromEntries(new FormData(form)); if (!form.reportValidity()) return; data.clearApiKey = form.elements.clearApiKey.checked; $('#model-result').textContent = test ? '正在连接模型服务…' : '正在保存…'; try { await api('model',data); form.elements.apiKey.value = ''; $('#model-result').textContent = test ? (await api('model/test',{})).message : '配置已保存在本地服务端。'; } catch(error){$('#model-result').textContent = error.message;} };
    $('#model-form').onsubmit = event => { event.preventDefault(); saveConfig(false); }; $('#test-model').onclick = () => saveConfig(true);
  } catch(error){showError(error);}
};
document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  if (event.key.toLowerCase() === 's') { event.preventDefault(); flush().catch(showError); }
  if (['z','y'].includes(event.key.toLowerCase()) && !['TEXTAREA','INPUT'].includes(document.activeElement.tagName)) { event.preventDefault(); mutate('action',{action:event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo'}).catch(showError); }
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
try { absorb(await api('project'),{editor:true}); if (project.migration?.warnings?.length) notify(project.migration.warnings.join('\n'),true); }
catch(error){showError(error);}
setInterval(async () => {
  if (!project || dirty || busy || conflict) return;
  try { const result = await api('project'); if (result.project.revision !== project.revision) { const focusInEditor = $('#editor').contains(document.activeElement); absorb(result,{editor:!focusInEditor}); } } catch {}
},1500);
