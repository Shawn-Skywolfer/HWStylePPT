import {spawn} from 'node:child_process';
import {WorkbenchError} from './model.mjs';

export function processLaunchError(error,{phase='process-start',executable=process.execPath}={}){
 const denied=['EPERM','EACCES','ERR_ACCESS_DENIED'].includes(error?.code),message=denied?'当前工作台进程没有启动子进程的权限。请由用户允许后，在普通桌面终端重新启动工作台；后台脱离父进程不会解除宿主限制。无需管理员权限，也不要关闭安全软件或绕过宿主策略。':`无法启动生成组件（${error?.code||'SPAWN_FAILED'}），请检查可执行文件和运行环境。`;
 const e=new WorkbenchError(message,503,denied?'PROCESS_LAUNCH_DENIED':'PROCESS_START_FAILED');e.details={phase,executable,systemCode:String(error?.code||'SPAWN_FAILED'),syscall:String(error?.syscall||'spawn')};return e;
}

// A harmless local Node child, not a model call or a promise that browsers work.
export function probeExecution({spawnImpl=spawn,timeoutMs=4000}={}){
 return new Promise(resolve=>{
  let child,timer,done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve({checkedAt:new Date().toISOString(),pid:process.pid,node:process.version,browserCheck:'not-run',...value});};
  const failure=error=>{const e=processLaunchError(error,{phase:'node-preflight'});finish({canSpawn:false,code:e.code,message:e.message,details:e.details});};
  try{child=spawnImpl(process.execPath,['-e','process.exit(0)'],{windowsHide:true,stdio:'ignore',shell:false});}catch(error){failure(error);return;}
  child.once('error',failure);child.once('close',code=>code===0?finish({canSpawn:true,code:'PROCESS_LAUNCH_READY',message:'本机 Node 子进程启动检查通过；浏览器与模型尚未调用。'}):finish({canSpawn:false,code:'PROCESS_START_FAILED',message:'Node 子进程检查未正常完成，请检查宿主执行环境。'}));
  timer=setTimeout(()=>{try{child.kill();}catch{}finish({canSpawn:false,code:'PROCESS_CHECK_TIMEOUT',message:'本机子进程检查超时，未调用模型。请检查宿主执行权限。'});},timeoutMs);
 });
}
export function requireExecution(report){if(report.canSpawn)return;const e=new WorkbenchError(report.message,503,report.code);e.details=report.details;throw e;}
