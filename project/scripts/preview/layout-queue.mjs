import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {atomicJson} from '../content/store.mjs';
import {safeMessage} from '../content/diagnostics.mjs';
import {preserveCompletedTaskHistory} from './layout-history.mjs';

const activeStates=new Set(['queued','running','paused','proposed','ready']);
const stamp=()=>new Date().toISOString();
const clean=(v,depth=0)=>{if(depth>6)return '[DEPTH LIMIT]';if(typeof v==='string')return safeMessage(v,1800);if(Array.isArray(v))return v.slice(0,50).map(x=>clean(x,depth+1));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).slice(0,60).map(([k,x])=>[k,/api.?key|authorization|credential|token|secret/i.test(k)?'[REDACTED]':clean(x,depth+1)]));return v;};
export class LayoutQueue {
 constructor(root,execute){
  this.root=path.join(root,'.layout-tasks');this.file=path.join(this.root,'state.json');this.execute=execute;this.jobs=new Map();this.active=new Map();this.settings={concurrency:2,timeoutMs:null};this.revision=0;this.sequence=0;this.closed=false;
  fs.mkdirSync(this.root,{recursive:true});if(fs.existsSync(this.file)){const saved=JSON.parse(fs.readFileSync(this.file,'utf8'));this.settings={...this.settings,...saved.settings};this.revision=saved.revision||0;this.sequence=saved.sequence||0;for(const job of saved.jobs||[]){if(!/^[a-f0-9-]{36}$/.test(job.id||''))continue;if(job.status==='running'){job.status='paused';job.completedAt=stamp();job.detail='预览服务曾中断。任务已暂停，请明确继续后再调用模型。';job.errorCode='SERVER_INTERRUPTED';}this.jobs.set(job.id,job);}}
  this.persist();setImmediate(()=>this.pump());
 }
 get(id){const j=this.jobs.get(id);if(!j)throw new Error('任务不存在');return j;}
 list(){return [...this.jobs.values()].sort((a,b)=>a.order-b.order);}
 persist(){const revision=this.revision+1;atomicJson(this.file,{version:1,settings:this.settings,revision,sequence:this.sequence,jobs:this.list()});this.revision=revision;this.storageBlocked=false;this.lastPersistenceError=null;}
 storageFailure(error){
  this.storageBlocked=true;this.lastPersistenceError=safeMessage(error.message||'任务状态保存失败');
  for(const [id,entry]of this.active){const j=this.get(id);if(j.status==='running'){j.status='paused';j.completedAt=stamp();j.detail='任务状态保存失败，执行已停止；恢复写入后可继续，原页面未改动';j.errorCode='LAYOUT_SAVE_FAILED';j.error=this.lastPersistenceError;}entry.controller.abort(new DOMException('Task state could not be saved','AbortError'));}
  // A transient write failure may recover, but stopped tasks never auto-resume.
  try{this.persist();}catch{}
 }
 safelySave(action){try{action();this.persist();return true;}catch(error){this.storageFailure(error);return false;}}
 log(j,code,message,details={},level='info'){
  const entry={at:stamp(),runId:j.runId||null,level,code,message:safeMessage(message,1800),details:clean(details)};j.lastLogAt=entry.at;
  const file=path.join(this.root,j.id+'.jsonl');if(!fs.existsSync(file)||fs.statSync(file).size<4*1024*1024)fs.appendFileSync(file,JSON.stringify(entry)+'\n',{mode:0o600});return entry;
 }
 logs(id){this.get(id);const file=path.join(this.root,id+'.jsonl');return fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)):[];}
 canDelete(id){return ['applied','paused','failed','cancelled','conflict'].includes(this.get(id).status)&&!this.active.has(id);}
 remove(ids){
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw new Error('请选择 1–100 个不重复的任务');
  const jobs=ids.map(id=>this.get(id));for(const j of jobs){if(!['applied','paused','failed','cancelled','conflict'].includes(j.status))throw new Error('只能删除已完成、暂停、失败/冲突停止或取消的任务；排队、运行、待确认和待应用任务不能删除');if(this.active.has(j.id))throw new Error('任务正在结束后台执行，请等待执行进程完全停止后再删除');}
  // Keep verified page versions discoverable even when their task records go away.
  preserveCompletedTaskHistory(path.dirname(this.root),jobs);
  for(const j of jobs)this.jobs.delete(j.id);try{this.persist();}catch(e){for(const j of jobs)this.jobs.set(j.id,j);throw e;}
  for(const j of jobs){const file=path.join(this.root,j.id+'.jsonl');try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')console.warn('已删除任务的日志清理未完成');}}
  return {deleted:ids};
 }
 enqueue(input,meta){if(this.jobs.size>=500)throw new Error('本演示已保留 500 个任务，请先导出日志并新建演示版本。');if(this.list().some(j=>j.slideId===input.slideId&&activeStates.has(j.status)))throw new Error('本页已有执行中、暂停或待确认任务；其他页面仍可提交。');
  const sequence=this.sequence,j={id:randomUUID(),input:structuredClone(input),slideId:input.slideId,...meta,status:'queued',percent:0,stage:'queued',detail:'等待执行名额，可调整队列顺序',createdAt:stamp(),order:++this.sequence,attempt:0};this.jobs.set(j.id,j);try{this.log(j,'QUEUED','任务已进入队列',{layout:input.layout,kind:j.kind,timeoutMs:j.timeoutMs});this.persist();}catch(error){this.jobs.delete(j.id);this.sequence=sequence;throw error;}setImmediate(()=>this.pump());return j;
 }
 configure(settings){const before=this.settings,next={...before};if(settings.concurrency!=null){const n=Number(settings.concurrency);if(!Number.isInteger(n)||n<1||n>4)throw new Error('并发数需为 1–4');next.concurrency=n;}if('timeoutMs'in settings){const n=settings.timeoutMs==null?null:Number(settings.timeoutMs);if(n!=null&&(!Number.isFinite(n)||n<1000||n>600000))throw new Error('等待上限需为 1–600 秒');next.timeoutMs=n;}this.settings=next;try{this.persist();}catch(error){this.settings=before;throw error;}this.pump();return this.settings;}
 reorder(ids){const queued=this.list().filter(j=>j.status==='queued');if(!Array.isArray(ids)||ids.length!==queued.length||new Set(ids).size!==ids.length||ids.some(id=>!queued.some(j=>j.id===id)))throw new Error('队列已变化，请刷新后再调整顺序');const sequence=this.sequence,orders=new Map(queued.map(j=>[j.id,j.order])),start=++this.sequence;try{ids.forEach((id,i)=>{const j=this.get(id);j.order=start+i;this.log(j,'REORDERED','调整队列顺序',{position:i+1});});this.sequence+=ids.length;this.persist();}catch(error){this.sequence=sequence;for(const j of queued)j.order=orders.get(j.id);throw error;}this.pump();}
 configureTask(id,timeoutMs){const j=this.get(id),n=Number(timeoutMs);if(!['queued','paused','failed','cancelled','conflict'].includes(j.status))throw new Error('请先暂停任务，再修改等待上限');if(!Number.isFinite(n)||n<1000||n>600000)throw new Error('等待上限需为 1–600 秒');const before=j.timeoutMs;j.timeoutMs=n;try{this.log(j,'TIMEOUT_CONFIGURED','用户修改单次 AI 等待上限',{timeoutMs:n});this.persist();}catch(error){j.timeoutMs=before;throw error;}return j;}
 control(id,action,approval={}){const j=this.get(id),before=structuredClone(j),sequence=this.sequence;
  if(action==='pause'&&['running','queued'].includes(j.status)){j.status='paused';j.completedAt=stamp();j.detail='已暂停；正在结束本次执行，继续时从安全步骤重新执行';this.active.get(id)?.controller.abort(new DOMException('Paused','AbortError'));}
  else if(action==='cancel'&&['running','queued','paused','proposed','ready','conflict','failed'].includes(j.status)){j.status='cancelled';j.completedAt=stamp();j.detail='已取消，原页面保持不变';this.active.get(id)?.controller.abort(new DOMException('Cancelled','AbortError'));}
  else if(action==='resume'&&['paused','failed','cancelled','conflict'].includes(j.status)){if(this.list().some(other=>other.id!==id&&other.slideId===j.slideId&&activeStates.has(other.status)))throw new Error('本页已有其他活动任务，请先处理它');j.status='queued';j.order=++this.sequence;j.runId=null;j.resultId=null;j.approvalBaseline=null;j.replacementApproved=false;j.error=null;j.errorCode=null;j.percent=0;j.startedAt=null;j.completedAt=null;j.detail='重新排队，旧执行退出后开始';}
  else if(action==='accept'&&['proposed','conflict'].includes(j.status)){if(j.status==='conflict'&&approval.replaceCurrent!==true)throw new Error('请先确认如何处理当前页的新改动。');if(approval.baseline!=null&&!/^sha256:[a-f0-9]{64}$/.test(approval.baseline))throw new Error('页面确认标识无效，请重新审阅。');if(approval.replaceCurrent===true&&!approval.baseline)throw new Error('替换当前改动前需要重新确认页面状态。');j.approvalBaseline=approval.baseline||j.input.clientBaseline;j.replacementApproved=approval.replaceCurrent===true;j.status='ready';j.detail='候选已确认，等待本页安全应用';}
  else if(action==='reject'&&['proposed','conflict'].includes(j.status)){j.status='rejected';j.detail='已拒绝候选，原页面不变';}
  else if(action==='applied'&&j.status==='ready'){j.status='applied';j.appliedAt=stamp();j.detail='已应用并保存，可通过演示控制台撤销';}
  else throw new Error('当前状态不支持此操作');
  try{this.log(j,action.toUpperCase(),j.detail);this.persist();}catch(error){if(['pause','cancel'].includes(action)){j.persistenceWarning='执行已停止，但状态保存失败；恢复写入后再刷新。';j.detail=j.persistenceWarning;this.storageFailure(error);return j;}for(const key of Object.keys(j))delete j[key];Object.assign(j,before);this.sequence=sequence;throw error;}delete j.persistenceWarning;this.pump();return j;
 }
 clientEvent(id,event,message){const j=this.get(id);if(!['apply-failed','stale','undo','redo'].includes(event))throw new Error('不支持的客户端日志');if(['apply-failed','stale'].includes(event)&&j.status==='ready'){j.status='conflict';j.errorCode='CLIENT_STATE_CHANGED';j.error=safeMessage(message);j.detail='未应用旧结果，当前编辑保留';}this.log(j,event.toUpperCase(),message,{},event.includes('failed')||event==='stale'?'error':'info');this.persist();return j;}
 pump(){if(this.closed||this.storageBlocked)return;for(const j of this.list()){if(this.active.size>=this.settings.concurrency||this.storageBlocked)break;if(j.status!=='queued'||this.active.has(j.id))continue;this.start(j);}}
 start(j){const runId=randomUUID(),controller=new AbortController(),entry={runId,controller};this.active.set(j.id,entry);Object.assign(j,{runId,status:'running',attempt:j.attempt+1,startedAt:stamp(),completedAt:null,percent:1,stage:'starting',error:null,errorCode:null,lastSignalAt:null,lastHostOutputAt:null,diagnostics:{}});if(!this.safelySave(()=>this.log(j,'STARTED','取得执行名额',{attempt:j.attempt,timeoutMs:j.timeoutMs}))){this.active.delete(j.id);return;}
  const valid=()=>this.active.get(j.id)===entry&&j.runId===runId&&j.status==='running'&&!controller.signal.aborted;
  const progress=(percent,detail,stage)=>{if(!valid())return;const changed=j.stage!==stage||j.detail!==detail;j.percent=Math.round(Math.max(0,Math.min(100,percent))*10)/10;j.detail=safeMessage(detail,1200);if(stage)j.stage=stage;this.safelySave(()=>{if(changed)this.log(j,'PROGRESS',j.detail,{stage:j.stage,percent:j.percent});});};
  const diagnostic=event=>{if(!valid())return;j.lastSignalAt=event.at||stamp();if(['event','live','stderr'].includes(event.type))j.lastHostOutputAt=j.lastSignalAt;j.diagnostics={...j.diagnostics,...clean(event)};this.safelySave(()=>this.log(j,'AGENT_'+String(event.type||'EVENT').toUpperCase(),event.message||event.phase||'宿主信号',event));};
  Promise.resolve().then(()=>{controller.signal.throwIfAborted();return this.execute(j,{signal:controller.signal,progress,diagnostic,log:(code,msg,data,level)=>{if(valid())this.safelySave(()=>this.log(j,code,msg,data,level));}});}).then(result=>{if(!valid())return;const before=structuredClone(j);Object.assign(j,result,{completedAt:stamp(),percent:100});try{this.log(j,'FINISHED',j.detail,{status:j.status,resultId:j.resultId});this.persist();}catch(error){Object.assign(j,before);delete j.resultId;this.storageFailure(error);}}).catch(error=>{if(!valid())return;j.status='failed';j.completedAt=stamp();j.error=safeMessage(error.message);j.errorCode=error.code||'LAYOUT_TASK_FAILED';j.errorDetails=clean(error.details||{});j.detail='任务失败，原页面和编辑保留';this.safelySave(()=>this.log(j,'FAILED',j.error,{code:j.errorCode,stage:j.stage,elapsedMs:Date.now()-Date.parse(j.startedAt),...j.errorDetails},'error'));}).finally(()=>{if(this.active.get(j.id)===entry)this.active.delete(j.id);this.pump();});
 }
 close(){this.closed=true;for(const[id,e]of this.active){const j=this.get(id);if(j.status==='running'){j.status='paused';j.detail='服务关闭，需明确继续';}e.controller.abort();}try{this.persist();}catch(error){this.lastPersistenceError=safeMessage(error.message);}}
}
