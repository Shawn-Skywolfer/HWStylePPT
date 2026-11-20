import fs from 'node:fs';
import path from 'node:path';
import { clone, digest, now, uid, normalizeDocument, reconcileDocument, WorkbenchError } from './model.mjs';
import {assertContentReady} from './content-requirements.mjs';
import {documentToMarkdown} from './mindmap-model.mjs';

function renameFile(from,to){for(let attempt=0;;attempt++){try{fs.renameSync(from,to);return;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=8)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25*(attempt+1));}}}
function atomicText(file,text){const temp=file+'.'+uid('tmp');fs.writeFileSync(temp,text,{mode:0o600});try{renameFile(temp,file);}catch(error){try{fs.unlinkSync(temp);}catch{}throw error;}}
function saveMarkdown(dir,project,{initial=false}={}){
 atomicText(path.join(dir,'content-current.md'),documentToMarkdown(project.current));
 if(initial)atomicText(path.join(dir,'content-original.md'),documentToMarkdown(project.original));
 if(project.confirmed)atomicText(path.join(dir,'content-confirmed.md'),documentToMarkdown(project.confirmed.document));
}

// Lock directories contain one known file. Avoid recursive rm: some bundled
// Windows runtimes silently leave non-ASCII paths in place after rmSync.
function removeLockDirectory(lock){
  const names=fs.readdirSync(lock);
  if(names.some(name=>name!=='owner.json'))throw new WorkbenchError('保存锁包含未知文件，未自动清理。请保留项目并检查锁目录。',503,'PROJECT_LOCK_INVALID');
  try{fs.unlinkSync(path.join(lock,'owner.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
  fs.rmdirSync(lock);
  if(fs.existsSync(lock))throw new WorkbenchError('运行时未能释放保存锁，请使用经过验证的 Node 重新启动工作台。内容请先保留。',503,'PROJECT_LOCK_RELEASE_FAILED');
}
export function storageError(error){
  if(error instanceof WorkbenchError)return error;
  const code=String(error?.code||'');
  if(!['EEXIST','EPERM','EACCES','EBUSY','ENOTEMPTY','EROFS','ENOSPC'].includes(code))return error;
  const target=path.basename(error.path||error.dest||'项目文件');
  const e=new WorkbenchError(code==='ENOSPC'?'磁盘空间不足，项目未能保存。请释放空间后重试。':`项目保存未完成（${code}，${target}）。请保留当前页面，检查文件是否只读、被占用或保存锁未释放；不要重新创建项目或删除正文。`,503,'PROJECT_STORAGE_FAILED');
  e.details={phase:'project-save',systemCode:code,syscall:String(error.syscall||'file-operation'),target,suggestions:['先导出或保留当前草稿','核对当前项目文件的只读属性与占用状态','若锁无法释放，使用经过验证的 Node 重启工作台，不修改全局安全设置']};
  return e;
}

export function atomicJson(file, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${uid('tmp')}`;
  const fd = fs.openSync(temp, 'wx', mode);
  try { fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { renameFile(temp, file); } catch (error) { try { fs.unlinkSync(temp); } catch {} throw error; }
}
export class ProjectStore {
  constructor(dir) { this.dir = path.resolve(dir); this.file = path.join(this.dir, 'content-plan.json'); this.lock = path.join(this.dir, '.content.lock'); }
  read() {
    if (!fs.existsSync(this.file)) throw new WorkbenchError('项目不存在，请先创建或导入。', 404);
    const project = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    if (project.schemaVersion !== 1) throw new WorkbenchError('不支持此项目格式，请保留原文件。');
    return project;
  }
  create(document, source = {}, extras = {}) {
    return this.withLock(() => {
      if (fs.existsSync(this.file)) throw new WorkbenchError('项目已经存在，不会覆盖。', 409);
      const current = normalizeDocument(document, { assignIds: true });
      current.slides.forEach(slide => { slide.status = 'draft'; });
      const project = { schemaVersion: 1, projectId: uid('project'), revision: 1, contentRevision: 1,
        createdAt: now(), updatedAt: now(), stage: 'planning', source: clone(source),
        original: clone(current), current, confirmed: null, checkpoints: [], history: { undo: [], redo: [] },
        proposals: [], aiTasks: [], generations: [], mapping: null, events: [], ...extras };
      atomicJson(this.file, project);saveMarkdown(this.dir,project,{initial:true}); return project;
    });
  }
  withLock(fn) {
    fs.mkdirSync(this.dir, { recursive: true });
    try { fs.mkdirSync(this.lock); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let stale = false;
      try { const owner = JSON.parse(fs.readFileSync(path.join(this.lock, 'owner.json'), 'utf8')); try { process.kill(owner.pid, 0); } catch (e) { stale = e.code === 'ESRCH'; } }
      catch { stale = Date.now() - fs.statSync(this.lock).mtimeMs > 30000; }
      if (!stale) throw new WorkbenchError('项目正在保存，请稍后重试。', 409, 'PROJECT_BUSY');
      removeLockDirectory(this.lock);
      try{fs.mkdirSync(this.lock);}catch(e){if(e.code==='EEXIST')throw new WorkbenchError('另一进程正在保存，请稍后重试。',409,'PROJECT_BUSY');throw e;}
    }
    fs.writeFileSync(path.join(this.lock, 'owner.json'), JSON.stringify({ pid: process.pid }));
    let result,failed;
    try { result=fn(); } catch(error) { failed=error; }
    try { removeLockDirectory(this.lock); } catch(error) { failed ||= error; }
    if(failed)throw storageError(failed);
    return result;
  }
  mutate(expectedRevision, fn) {
    return this.withLock(() => {
      const project = this.read();
      const beforeContent=digest(project.current),beforeConfirmed=project.confirmed?.hash;
      if (expectedRevision != null && expectedRevision !== project.revision) throw new WorkbenchError('项目已被其他窗口或 Agent 修改。你的输入已保留，请重新读取后合并。', 409, 'VERSION_CONFLICT');
      fn(project);
      project.revision++; project.updatedAt = now();
      if(beforeContent!==digest(project.current)||beforeConfirmed!==project.confirmed?.hash||project.markdownSync?.status==='pending'||!fs.existsSync(path.join(this.dir,'content-current.md'))){
        try{saveMarkdown(this.dir,project);project.markdownSync={status:'ready'};}catch(error){project.markdownSync={status:'pending',code:error.code||'WRITE_FAILED'};}
      }
      atomicJson(this.file,project);return project;
    });
  }
  edit(expected, document, label = '手工修改') {
    return this.mutate(expected, project => commitDocument(project, reconcileDocument(project.current, document), label));
  }
  action(expected, action, payload = {}) {
    return this.mutate(expected, project => {
      if (action === 'undo' || action === 'redo') {
        const from = action === 'undo' ? project.history.undo : project.history.redo;
        const to = action === 'undo' ? project.history.redo : project.history.undo;
        if (!from.length) throw new WorkbenchError('没有可恢复的历史。');
        to.push(projectSnapshot(project));const restored=from.pop();restoreSnapshot(project,restored);invalidate(project);
        for(const task of project.aiTasks.filter(item=>['pending','running','queued'].includes(item.status))) {
          task.baseContentRevision=project.contentRevision;task.runId=uid('run');
          task.status=task.mode==='bridge'&&task.execution==='manual'?'pending':(action==='redo'||/^(pause|cancel)/.test(restored.historyLabel||''))&&!project.workspacePaused?'queued':'paused';
        }
        for(const job of project.generations.filter(item=>['running','queued'].includes(item.status))){job.runId=uid('run');job.status=action==='redo'&&!project.workspacePaused?'queued':'paused';}
      } else if (action === 'restore') {
        const saved = payload.id === 'original' ? project.original : project.checkpoints.find(item => item.id === payload.id)?.document;
        if (!saved) throw new WorkbenchError('找不到此版本。', 404);
        const next = clone(saved); next.slides.forEach(slide => { slide.status = 'editing'; });
        commitDocument(project, reconcileDocument(project.current, next), '恢复内容版本');
      } else if (action === 'checkpoint') {
        recordHistory(project,'保存关键版本');
        project.checkpoints.push({ id: uid('checkpoint'), label: String(payload.label || '手动版本'), createdAt: now(), document: clone(project.current) });
      } else if (action === 'confirm') {
        assertContentReady(project.current,{slideId:payload.slideId});
        recordHistory(project,'确认内容');
        const targets = payload.slideId ? project.current.slides.filter(slide => slide.slideId === payload.slideId) : project.current.slides;
        if (!targets.length) throw new WorkbenchError('找不到需要确认的页面。');
        for (const slide of targets) {
          if (!slide.title.trim()) throw new WorkbenchError(`第 ${slide.order} 页缺少标题。`);
          slide.status = 'confirmed';
        }
        if (project.current.slides.every(slide => slide.status === 'confirmed')) {
          project.confirmed = { id: uid('confirmed'), contentRevision: project.contentRevision, createdAt: now(), hash: digest(project.current), document: clone(project.current) };
          project.checkpoints.push({ ...project.confirmed, label: '已确认内容' }); project.stage = 'confirmed';
        }
      } else throw new WorkbenchError(`未知操作：${action}`);
      project.events.push({ at: now(), type: action, contentRevision: project.contentRevision });
    });
  }
}
export function invalidate(project) { project.contentRevision++; project.stage = 'planning'; }
export function commitDocument(project, document, label) {
  if (digest(document) === digest(project.current)) return;
  recordHistory(project,label); project.current = document; invalidate(project);
  project.events.push({ at: now(), type: 'content-edit', label, contentRevision: project.contentRevision });
}
export function projectSnapshot(project) {
  return clone({current:project.current,confirmed:project.confirmed,stage:project.stage,aiTasks:project.aiTasks,proposals:project.proposals,generations:project.generations,mapping:project.mapping,checkpoints:project.checkpoints,workspacePaused:!!project.workspacePaused});
}
export function recordHistory(project,label) {
  project.history.undo.push({...projectSnapshot(project),historyLabel:label});project.history.undo=project.history.undo.slice(-60);project.history.redo=[];
}
function restoreSnapshot(project,snapshot) {
  if(snapshot.slides) {project.current=clone(snapshot);return;}
  for(const key of ['current','confirmed','stage','aiTasks','proposals','generations','mapping','checkpoints','workspacePaused']) if(key in snapshot)project[key]=clone(snapshot[key]);
}
