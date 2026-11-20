import {callModel} from './provider.mjs';
import {runBridge} from './bridge.mjs';
import {modelMessages,submitProposal,decideProposal} from './proposals.mjs';
import {recordHistory,storageError} from './store.mjs';
import {executeGeneration} from './generation.mjs';
import {uid,now,WorkbenchError} from './model.mjs';
import {publicError} from './diagnostics.mjs';

export function createTaskEngine(store,{bridgeRunner=runBridge,modelRunner=callModel,generationRunner=executeGeneration,onError=()=>{}}={}) {
  const active=new Map(),pending=new Map(),runtimeDiagnostics=[];let closed=false,pumping=false,retryAfter=0,workspaceStop=null;
  const keyOf=(collection,id)=>`${collection}:${id}`;
  function report(error){const diagnostic=publicError(storageError(error)),last=runtimeDiagnostics.at(-1);if(last?.errorCode===diagnostic.errorCode&&last?.error===diagnostic.error)return;runtimeDiagnostics.push({...diagnostic,at:now()});if(runtimeDiagnostics.length>20)runtimeDiagnostics.shift();try{onError(error);}catch{}}
  function applyPending(project){for(const entry of pending.values()){const item=project[entry.collection]?.find(v=>v.id===entry.id);if(item?.runId===entry.previousRunId)Object.assign(item,structuredClone(entry.patch));}if(workspaceStop!==null)project.workspacePaused=workspaceStop;project.runtimeDiagnostics=structuredClone(runtimeDiagnostics);project.runtimeStateRevision=[...pending.values()].map(e=>e.patch.runId).join(':')+':'+(runtimeDiagnostics.at(-1)?.at||'');return project;}
  function view(project){return applyPending(structuredClone(project));}
  function flush(){if(!pending.size&&workspaceStop===null)return;store.mutate(null,project=>{if(workspaceStop!==null||[...pending.values()].some(e=>e.action&&project[e.collection]?.some(v=>v.id===e.id&&v.runId===e.previousRunId)))recordHistory(project,'暂停 / 取消任务');for(const entry of pending.values()){const item=project[entry.collection]?.find(v=>v.id===entry.id);if(item?.runId===entry.previousRunId)Object.assign(item,structuredClone(entry.patch));}if(workspaceStop!==null)project.workspacePaused=workspaceStop;});pending.clear();workspaceStop=null;}
  // Stop execution BEFORE attempting disk writes. A locked project must not
  // keep a browser/model process alive or allow a late result to publish.
  function stop(collection,id,action){return stopMany([{collection,id}],action);}
  function stopMany(targets,action,{workspace=false}={}){
    if(!['pause','cancel'].includes(action))throw new WorkbenchError('不支持的停止操作。');
    const project=view(store.read()),entries=[];
    for(const {collection,id} of targets){if(!['aiTasks','generations'].includes(collection))throw new WorkbenchError('操作任务类型无效。');const item=project[collection].find(v=>v.id===id),previousRunId=item?.runId;control(project,collection,id,action,{history:false});entries.push({collection,id,action,previousRunId,patch:structuredClone(project[collection].find(v=>v.id===id))});}
    if(workspace)workspaceStop=action==='pause';
    for(const entry of entries){const previous=pending.get(keyOf(entry.collection,entry.id));if(previous)entry.previousRunId=previous.previousRunId;pending.set(keyOf(entry.collection,entry.id),entry);for(const run of active.values())if(run.collection===entry.collection&&run.id===entry.id)run.controller.abort(new DOMException('Operation stopped','AbortError'));}
    let warning;try{flush();}catch(error){report(error);warning='执行已停止，但项目状态尚未保存；请保留此工作台，文件恢复可写后会重试保存。';retryAfter=Date.now()+1000;}
    return {project:view(store.read()),...(warning?{warning,volatile:true}:{})};
  }
  function updateProgress(collection,id,runId,progress) {
    if(pending.has(keyOf(collection,id)))return;
    try{const item=store.read()[collection].find(value=>value.id===id);if(!item || item.status!=='running' || item.runId!==runId)return;store.mutate(null,project=>{const current=project[collection].find(value=>value.id===id);if(current?.status==='running' && current.runId===runId)current.progress={...progress,at:now()};});}catch(error){if(error.code!=='PROJECT_BUSY')report(error);}
  }
  async function transaction(fn) {for(let attempt=0;attempt<12;attempt++){try{return store.mutate(null,fn);}catch(error){if(error.code!=='PROJECT_BUSY' || attempt===11)throw error;await new Promise(resolve=>setTimeout(resolve,25));}}}
  function pump() {
    if(closed || pumping)return;pumping=true;
    try {
      if(Date.now()<retryAfter)return;
      flush();const project=view(store.read());
      for(const [key,entry] of active) {
        const item=project[entry.collection].find(value=>value.id===entry.id);
        if(!item || item.status!=='running' || item.runId!==entry.runId)entry.controller.abort(new DOMException('Operation stopped','AbortError'));
      }
      if(!project.workspacePaused) {
        for(const task of project.aiTasks.filter(item=>item.status==='queued'))start('aiTasks',task);
        for(const job of project.generations.filter(item=>item.status==='queued'))start('generations',job);
      }
    } catch(error){report(error);retryAfter=Date.now()+1000;} finally {pumping=false;}
  }
  function start(collection,item) {
    const runId=item.runId || uid('run'),key=`${collection}:${item.id}:${runId}`;
    if(pending.has(keyOf(collection,item.id))||active.has(key)||[...active.values()].some(entry=>entry.collection===collection&&entry.id===item.id))return;
    const controller=new AbortController();active.set(key,{collection,id:item.id,runId,controller});
    let claimed=false;
    try{store.mutate(null,project=>{const saved=project[collection].find(value=>value.id===item.id);if(!saved||saved.status!=='queued'||(saved.runId&&saved.runId!==runId))return;Object.assign(saved,{runId,status:'running',executorPid:process.pid,error:null,progress:{stage:'starting',detail:'正在启动任务',percent:3},startedAt:now()});claimed=true;});}catch(error){active.delete(key);if(error.code!=='PROJECT_BUSY')report(error);retryAfter=Date.now()+1000;return;}
    if(!claimed){active.delete(key);return;}
    const task=store.read()[collection].find(value=>value.id===item.id);
    let lastProgress=0,lastStage='';
    const onProgress=progress=>{if(progress.stage===lastStage&&Date.now()-lastProgress<200 && progress.percent<80)return;lastProgress=Date.now();lastStage=progress.stage;updateProgress(collection,item.id,runId,progress);};
    const promise=Promise.resolve().then(()=>{controller.signal.throwIfAborted();return collection==='aiTasks'?(task.mode==='bridge'?bridgeRunner(store.dir,task,modelMessages(task),{signal:controller.signal,onProgress}):modelRunner(store.dir,modelMessages(task),{signal:controller.signal,onProgress})):generationRunner(store,item.id,{signal:controller.signal,onProgress,runId,bridgeRunner,modelRunner});});
    Promise.resolve(promise).then(result=>{
      if(collection!=='aiTasks')return;
      return transaction(project=>{
        const current=project.aiTasks.find(value=>value.id===item.id);
        if(!current || current.runId!==runId || current.status!=='running' || controller.signal.aborted)return;
        const proposal=submitProposal(project,item.id,result);
        if(current.applyMode==='auto' && current.scope.kind!=='deck')decideProposal(project,proposal.id,true);
        current.progress={stage:current.status==='accepted'?'applied':'review',detail:current.status==='accepted'?'修改已应用到白板，可撤销':'修改方案已准备，请预览确认',percent:100};current.completedAt=now();
      });
    }).catch(async error=>{
      if(controller.signal.aborted)return;
      const diagnostic=publicError(error),patch={runId:uid('run'),status:'failed',...diagnostic,failedStage:task.progress?.stage,progress:{stage:'failed',detail:diagnostic.error,percent:0},failedAt:now()};
      try{await transaction(project=>{const current=project[collection].find(value=>value.id===item.id);if(current?.status==='running' && current.runId===runId){patch.failedStage=current.progress?.stage;Object.assign(current,patch);}});}catch(saveError){pending.set(keyOf(collection,item.id),{collection,id:item.id,previousRunId:runId,patch});report(saveError);}
    }).finally(()=>{active.delete(key);setImmediate(pump);});
  }
  function control(project,collection,id,action,{history=true}={}) {
    const item=project[collection]?.find(value=>value.id===id);
    if(!item)throw new WorkbenchError('操作任务不存在。',404);
    if(!['pause','resume','cancel'].includes(action))throw new WorkbenchError('不支持的任务操作。');
    if(action==='resume' && !['pending','paused','failed','cancelled'].includes(item.status))throw new WorkbenchError('只有等待、暂停、失败或取消的任务可继续。',409);
    if(action!=='resume' && !['queued','pending','running','proposed','paused'].includes(item.status))throw new WorkbenchError('此任务已经结束，可用撤销恢复已完成的修改。',409);
    if(history)recordHistory(project,`${action} ${collection==='aiTasks'?'AI 修改':'PPT 生成'}`);
    item.runId=uid('run');item.status=action==='resume'?'queued':action==='pause'?'paused':'cancelled';item.error=null;item.errorCode=null;item.errorDetails=null;
    if(action==='resume' && collection==='aiTasks')item.execution='auto';
    item.progress={stage:item.status,detail:action==='pause'?'已暂停，当前请求已停止；继续时重新执行':action==='cancel'?'已取消，不会再写入结果':'已重新排队',percent:0};
    if(action==='cancel')for(const proposal of project.proposals.filter(value=>value.taskId===id && value.status==='pending'))proposal.status='cancelled';
  }
  const timer=setInterval(pump,500);timer.unref();
  return {pump,control,stop,stopMany,view,flush,close(){closed=true;clearInterval(timer);for(const entry of active.values())entry.controller.abort();active.clear();}};
}
