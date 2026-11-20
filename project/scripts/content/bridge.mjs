import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import {atomicJson} from './store.mjs';
import {WorkbenchError} from './model.mjs';
import {readHostBinding,detectHost,HOST_KINDS,deepseekSelection} from './host-binding.mjs';
import {safeMessage} from './diagnostics.mjs';

const exists=file=>{try{return fs.statSync(file).isFile();}catch{return false;}};
function executable(name,kind=name) {
  const search=Object.entries(process.env).find(([key])=>key.toLowerCase()==='path')?.[1] || '';
  for(const dir of search.split(path.delimiter)) for(const ext of process.platform==='win32'?['.exe','.cmd','']:['']) {
    const file=path.join(dir,`${name}${ext}`);if(exists(file)){try{return unwrap(file,kind);}catch(error){if(error.code!=='BRIDGE_PATH_REQUIRED')throw error;}}
  }
  return null;
}
function unwrap(file,kind) {
  if(kind==='deepseek'&&process.platform==='win32'&&/deepseek harness\.exe$/i.test(file)){
    const asar=path.join(path.dirname(file),'resources/app.asar');if(exists(asar))return {command:file,prefix:['--expose-internals',path.join(asar,'dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js')],env:{ELECTRON_RUN_AS_NODE:'1'}};
  }
  if(/\.(mjs|cjs|js)$/i.test(file))return {command:process.execPath,prefix:[file]};
  if(process.platform!=='win32' || !/\.cmd$/i.test(file))return {command:file,prefix:[]};
  const root=path.dirname(file);
  if(kind==='codex'){const entry=path.join(root,'node_modules/@openai/codex/bin/codex.js');if(exists(entry))return {command:process.execPath,prefix:[entry]};}
  if(kind==='deepseek'){
    const exe=path.resolve(root,'../../../..','DeepSeek Harness.exe'),asar=path.resolve(root,'../../../app.asar');
    if(exists(exe)&&exists(asar))return {command:exe,prefix:['--expose-internals',path.join(asar,'dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js')],env:{ELECTRON_RUN_AS_NODE:'1'}};
    const entry=path.join(root,'node_modules/@deepseek-ai/dsh/lib/bin.js');if(exists(entry))return {command:process.execPath,prefix:[entry]};
  }
  const candidates=kind==='claude'?[path.join(root,'node_modules/@anthropic-ai/claude-code/bin/claude.exe')]:[path.join(root,'node_modules/opencode-ai/node_modules/opencode-windows-x64/bin/opencode.exe'),path.join(root,'node_modules/opencode-windows-x64/bin/opencode.exe')];
  const binary=candidates.find(exists);if(binary)return {command:binary,prefix:[]};
  if(kind==='opencode') {const script=path.join(root,'node_modules/opencode-ai/bin/opencode');if(exists(script))return {command:process.execPath,prefix:[script]};}
  throw new WorkbenchError('请将 Agent 执行路径设为真正的 .exe 或 Node.js 入口；不能通过命令解释器执行 .cmd。',422,'BRIDGE_PATH_REQUIRED');
}
export function bridgeConfig(dir) {
  let config={kind:'auto',command:'',args:[],model:'',timeoutMs:180000};
  const file=path.join(dir,'.private','agent.json');if(exists(file))config={...config,...JSON.parse(fs.readFileSync(file,'utf8'))};
  if(process.env.DASHI_BRIDGE_COMMAND)config={...config,kind:process.env.DASHI_BRIDGE_KIND || 'json-worker',command:process.env.DASHI_BRIDGE_COMMAND};
  config.host=readHostBinding(dir)||detectHost({cwd:dir,env:{},skillFile:''});if(config.kind==='auto'&&!config.args.length&&config.host?.args)config.args=config.host.args;return config;
}
export function saveBridgeConfig(dir,input) {
  const config={...bridgeConfig(dir),kind:String(input.kind || 'auto'),command:String(input.command || '').trim(),model:String(input.model || '').trim(),args:input.args || [],timeoutMs:Number(input.timeoutMs || 180000)};
  if(!['auto',...HOST_KINDS].includes(config.kind) || !Array.isArray(config.args) || config.args.some(arg=>typeof arg!=='string') || !Number.isFinite(config.timeoutMs) || config.timeoutMs<1000 || config.timeoutMs>600000)throw new WorkbenchError('Agent 桥接配置格式无效。');
  if(config.command && !path.isAbsolute(config.command))throw new WorkbenchError('请填写 Agent 可执行文件的绝对路径。');
  atomicJson(path.join(dir,'.private','agent.json'),config);return publicBridgeConfig(dir);
}
function resolve(config) {
  const kind=config.kind==='auto'?config.host?.kind:config.kind;
  if(config.kind==='auto'&&!kind&&!config.command)throw new WorkbenchError('项目尚未绑定生成它的宿主。请由原 Agent 用 start --host <宿主ID> 启动，或显式配置通用 JSON Worker；不会自动切换到其他 Agent。',422,'BRIDGE_HOST_UNKNOWN');
  const command=config.command||(config.kind==='auto'?config.host?.command:'');
  if(command){if(!exists(command))throw new WorkbenchError('绑定宿主的可执行文件不存在，请修复入口；不会调用其他 Agent。',422,'BRIDGE_UNAVAILABLE');return {kind:kind||'json-worker',...unwrap(command,kind),host:config.host};}
  if(config.host?.requiresAdapter&&config.kind==='auto')throw new WorkbenchError('已识别原宿主，但它需要提供 CLI / JSON Worker 适配入口；不会借用其他 Agent。',422,'BRIDGE_ADAPTER_REQUIRED');
  const found=executable(kind==='deepseek'?'dsh':kind,kind);if(found)return {kind,...found,host:config.host};
  if(kind==='deepseek'&&process.platform==='win32'){
    const cmd=path.join(process.env.LOCALAPPDATA||path.join(process.env.USERPROFILE||'','AppData/Local'),'Programs/DeepSeek Harness/resources/runtime/cli/bin/dsh.cmd');
    if(exists(cmd))return {kind,...unwrap(cmd,kind),host:config.host};
  }
  throw new WorkbenchError(`已绑定 ${kind||'原宿主'}，但未找到它的可调用入口。请指定其 CLI / JSON Worker，禁止静默换成其他 Agent。`,422,'BRIDGE_UNAVAILABLE');
}
export function publicBridgeConfig(dir) {
  const config=bridgeConfig(dir);try{const found=resolve(config);return {...config,available:true,runtimeTested:false,detectedKind:found.kind,detectedCommand:found.command,readiness:'entry-found-not-executed'};}catch(error){return {...config,available:false,error:error.message,errorCode:error.code};}
}
export function stopOwnedProcess(child) {
  if(!child?.pid || child.exitCode!==null)return;
  if(process.platform==='win32') {
    try{const killer=spawn(path.join(process.env.SystemRoot || 'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>{try{child.kill();}catch{}});}catch{try{child.kill();}catch{}}
  } else {try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}}
}
export function extractBridgeResult(output) {
  const clean=String(output).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed;try{parsed=JSON.parse(clean);}catch{throw new WorkbenchError('Agent 未返回可解析的 JSON 修改结果，正式稿未改变。',422,'BRIDGE_INVALID_JSON');}
  if(parsed.result && typeof parsed.result==='object')parsed=parsed.result;
  if(parsed.structured_output)parsed=parsed.structured_output;
  if(!Array.isArray(parsed.operations))throw new WorkbenchError('Agent 返回缺少 operations 修改操作。',422,'BRIDGE_INVALID_JSON');
  return parsed;
}
export function runBridge(dir,task,messages,{signal,onProgress=()=>{},onDiagnostic=()=>{},timeoutMs,reasoningEffort='inherit'}={}) {
  const config=bridgeConfig(dir),resolved=resolve(config);
  if(!['inherit','off','low','high','max'].includes(reasoningEffort)||reasoningEffort!=='inherit'&&resolved.kind!=='deepseek')throw new WorkbenchError('本次推理强度仅支持原 DeepSeek 宿主的明确选择。',422,'BRIDGE_REASONING_UNSUPPORTED');
  if(timeoutMs!=null){if(!Number.isFinite(Number(timeoutMs))||Number(timeoutMs)<1000||Number(timeoutMs)>600000)throw new WorkbenchError('Agent 等待上限需为 1–600 秒。');config.timeoutMs=Number(timeoutMs);}
  const localRun=path.join(dir,'.private','agent-runs',randomUUID()),cwd=process.platform==='win32'&&localRun.length>220?fs.mkdtempSync(path.join(os.tmpdir(),'dashi-agent-')):localRun;fs.mkdirSync(cwd,{recursive:true});
  let args=[...resolved.prefix,...config.args];
  if(resolved.kind==='claude')args.push('-p','--output-format','stream-json','--verbose','--include-partial-messages','--tools','','--disable-slash-commands','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--permission-mode','dontAsk','--no-session-persistence','--safe-mode',...(config.model?['--model',config.model]:[]));
  if(resolved.kind==='opencode')args.push('run','--format','json',...(config.model?['--model',config.model]:[]));
  if(resolved.kind==='codex')args.push('exec','--json','--sandbox','read-only','--skip-git-repo-check','--ephemeral',...(config.model?['--model',config.model]:[]),'-');
  if(resolved.kind==='deepseek'){
    const inherited=config.host?.selection||(config.host?.home?deepseekSelection(config.host.home):null),selection=inherited?{...inherited,...(reasoningEffort==='inherit'?{}:{reasoningEffort})}:null,overlay=path.join(cwd,'deepseek-invocation.patch.yml');
    let yaml=fs.readFileSync(fileURLToPath(new URL('./deepseek-bridge.patch.yml',import.meta.url)),'utf8');
    if(selection){yaml+='\n- id: agent-default-model\n  config:\n';for(const key of ['provider','model','reasoningEffort'])if(selection[key])yaml+=`    ${key}: ${JSON.stringify(key==='model'&&config.model?config.model:selection[key])}\n`;}
    yaml+='\n- insert:\n    - id: dashi-bridge-observer\n      name: '+JSON.stringify(new URL('./deepseek-observer.mjs',import.meta.url).href)+'\n';
    fs.writeFileSync(overlay,yaml,{mode:0o600});args.push('--profile','headless','--patch',overlay,'--json','-');
  }
  const env={...process.env,...resolved.env,NO_COLOR:'1',...(resolved.kind==='opencode'?{OPENCODE_CONFIG_CONTENT:JSON.stringify({permission:{'*':'deny'}})}:{})};
  if(resolved.kind==='deepseek'){if(config.host?.home)env.DSH_HOME=config.host.home;env.DSH_PERMISSION_MODE='read-only';}
  delete env.CLAUDECODE;
  return new Promise((accept,reject)=>{
    if(signal?.aborted)return reject(signal.reason || new DOMException('Cancelled','AbortError'));
    let child;try{child=spawn(resolved.command,args,{cwd,env,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe'],shell:false});}catch(error){return reject(new WorkbenchError(`无法启动已绑定的 ${resolved.kind}（${error.code||'SPAWN_FAILED'}）。请检查宿主入口和进程权限；不会改用其他 Agent。`,502,'BRIDGE_START_FAILED'));}
    let pending='',raw='',resultText='',received=0,done=false,explicitError=false,sawFinal=false,diagnostic='',lastEvent='spawn',firstOutputAt=null,lastOutputAt=null,terminalResult=null,stopError=null,cleanupTimer,liveReasoningChars=0,liveTextChars=0,observerReady=false,lastProviderError=null;const startedAt=Date.now();
    const trace=(type,message,extra={})=>onDiagnostic({type,message,at:new Date().toISOString(),elapsedMs:Date.now()-startedAt,executor:resolved.kind,pid:child.pid,timeoutMs:config.timeoutMs,lastEvent,receivedChars:received,liveReasoningChars,liveTextChars,observerReady,...extra});
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(cleanupTimer);signal?.removeEventListener('abort',abort);trace(error?'failed':'completed',error?.message||'宿主返回了结构化候选',{errorCode:error?.code,firstOutputAt,lastOutputAt,sawFinal});error?reject(error):accept(result);};
    const stop=(error,result)=>{stopError=error||null;terminalResult=result||null;clearTimeout(timer);clearTimeout(cleanupTimer);stopOwnedProcess(child);cleanupTimer=setTimeout(()=>finish(stopError,terminalResult),4000);};
    const abort=()=>stop(signal?.reason || new DOMException('Cancelled','AbortError'));
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>{const activity=liveReasoningChars||liveTextChars?'宿主仍在生成（推理 '+liveReasoningChars+' 字符，正文 '+liveTextChars+' 字符），并非未启动。可在新任务中明确选择轻量推理，或延长上限。':observerReady?'模型请求尚未返回实时内容，请检查原宿主的服务状态；重试或延长上限。':'宿主 JSON 模式可能只在整步提交时输出；零字符不能单独证明模型未运行。请查看 LOG 或调整等待上限。';const error=new WorkbenchError(`本地 Agent 在 ${Math.round(config.timeoutMs/1000)} 秒内未返回有效最终候选。${activity}`,504,'BRIDGE_TIMEOUT');error.details={executor:resolved.kind,timeoutMs:config.timeoutMs,elapsedMs:Date.now()-startedAt,lastEvent,firstOutputAt,lastOutputAt,receivedChars:received,liveReasoningChars,liveTextChars,observerReady,lastProviderError,sawFinal};trace('timeout',error.message,error.details);stop(error);},config.timeoutMs);
    const progress=detail=>onProgress({stage:'agent-generating',detail,percent:received?Math.min(75,25+Math.floor(received/300)):15,receivedChars:received,executor:resolved.kind});
    function line(text) {
      if(done||stopError)return;
      let event;try{event=JSON.parse(text);}catch{return;}
      if(resolved.kind==='deepseek'&&event.type==='dashi_bridge'){
       observerReady=true;lastEvent='live:'+String(event.phase||'unknown');liveReasoningChars=Math.max(liveReasoningChars,Number(event.reasoningChars)||0);liveTextChars=Math.max(liveTextChars,Number(event.textChars)||0);if(event.errorCode)lastProviderError=String(event.errorCode).slice(0,80);
       trace('live','宿主实时状态：'+String(event.phase),{phase:event.phase,sessionId:event.sessionId,retry:event.retry,errorCode:event.errorCode,delayMs:event.delayMs});
       const detail=event.phase==='reasoning'?'模型正在推理（只统计长度，不展示思考正文）':event.phase==='writing'?'模型正在生成候选正文':event.phase==='provider_retry'?'原模型服务正在重试（'+(event.errorCode||'等待恢复')+'）':event.phase==='request_started'?'模型请求已启动，等待实时响应':event.phase==='request_ended'?'模型本次响应已结束，等待最终候选':'原宿主实时状态：'+event.phase;
       onProgress({stage:'agent-'+(event.phase||'waiting'),detail:detail+'；思考 '+liveReasoningChars+' 字符，正文 '+liveTextChars+' 字符',percent:liveTextChars?35:liveReasoningChars?25:15,executor:resolved.kind});return;
      }
      lastEvent=String(event.type||'event')+(event.phase?':'+String(event.phase):'');if(resolved.kind==='deepseek'&&event.type==='text'&&typeof event.text==='string'){received+=event.text.length;resultText+=event.text;}
      trace('event','宿主事件：'+lastEvent,{phase:event.phase,...(event.type==='session'?{sessionId:event.sessionId}:{})});
      if(event.type==='progress')return onProgress({stage:'agent-generating',detail:String(event.detail || 'Agent 正在处理').slice(0,200),percent:Math.min(85,Math.max(10,Number(event.percent)||20))});
      if(event.operations)resultText=JSON.stringify(event);
      if(resolved.kind==='codex'&&event.type==='item.completed'&&event.item?.type==='agent_message')resultText=event.item.text||'';
      if(resolved.kind==='deepseek'&&event.type==='final'){sawFinal=true;explicitError=!!(event.reason&&event.reason.kind!=='completed');resultText=event.text||event.answer||event.finalResponse||'';if(explicitError){const code=String(event.reason.error?.code||event.reason.kind||'MODEL_FAILED'),error=new WorkbenchError('原 DeepSeek Harness 未完成任务（'+code+'）。'+safeMessage(event.reason.error?.message||'',600),502,/SIGN_IN|UNAUTH|CREDENTIAL/.test(code)?'BRIDGE_AUTH_REQUIRED':'BRIDGE_MODEL_ERROR');error.details={providerCode:code,reason:event.reason.kind};stop(error);return;}try{const parsed=extractBridgeResult(resultText);received=resultText.length;trace('final','已收到最终候选，正在回收本次宿主进程');stop(null,parsed);}catch(error){stop(error);}return;}
      if(event.type==='error'){explicitError=true;diagnostic=safeMessage(event.message||event.error?.message||'',800);}
      if(resolved.kind==='deepseek'&&event.type==='status')progress('DeepSeek Harness 正在处理内容：'+String(event.phase||'执行中'));
      if(event.type==='result') {
        if(event.is_error){explicitError=true;return;}
        if(event.structured_output)resultText=JSON.stringify(event.structured_output);
        else if(event.result)resultText=typeof event.result==='string'?event.result:JSON.stringify(event.result);
      }
      if(event.type==='text' && event.part?.text){resultText+=event.part.text;received+=event.part.text.length;}
      if(event.type==='assistant' && event.message?.content)resultText=event.message.content.filter(block=>block.type==='text').map(block=>block.text).join('');
      if(event.type==='stream_event') {const delta=event.event?.delta?.text;if(delta){received+=delta.length;progress(`Agent 已生成 ${received} 个字符，正在整理修改结果`);}}
    }
    child.stdout.on('data',data=>{firstOutputAt||=new Date().toISOString();lastOutputAt=new Date().toISOString();raw+=data;pending+=data;if(raw.length>4*1024*1024){stop(new WorkbenchError('Agent 响应超过大小限制。',422));return;}let i;while((i=pending.indexOf('\n'))>=0){line(pending.slice(0,i));pending=pending.slice(i+1);}});
    child.stderr.on('data',data=>{firstOutputAt||=new Date().toISOString();lastOutputAt=new Date().toISOString();const errors=String(data).split('\n').filter(line=>/^dsh:\s*(?!reasoning)/i.test(line));if(errors.length)diagnostic=safeMessage(errors.join('\n'),1800);trace('stderr','宿主进程有诊断输出',{chars:data.length,hint:/UNAUTH|CRED|HTTP|ECONN|timeout|error/i.test(diagnostic)?diagnostic:''});progress('宿主进程有输出，尚在等待最终候选；不会改动正式内容。');});
    child.on('error',error=>finish(new WorkbenchError(`无法启动已绑定的 ${resolved.kind}（${error.code||'SPAWN_FAILED'}），请检查执行路径和宿主权限。`,502,'BRIDGE_START_FAILED')));
    child.on('close',code=>{if(pending.trim())line(pending);trace('exit','宿主进程退出',{exitCode:code});if(done)return;if(stopError||terminalResult)return finish(stopError,terminalResult);if(code!==0 || explicitError || resolved.kind==='deepseek'&&!sawFinal)return finish(new WorkbenchError(`已绑定 ${resolved.kind} 执行失败（退出码 ${code}）。请检查此宿主的登录、模型与网络配置。${diagnostic?'\n'+diagnostic:''}`,502,/MISSING_CREDENTIAL|UNAUTH|HTTP 40[13]/i.test(diagnostic)?'BRIDGE_AUTH_REQUIRED':'BRIDGE_AGENT_FAILED'));try{finish(null,extractBridgeResult(resultText || raw));}catch(error){finish(error);}});
    child.stdin.on('error',()=>{});
    onProgress({stage:'agent-starting',detail:`正在启动已绑定宿主：${resolved.kind}`,percent:8,executor:resolved.kind});
    trace('spawn','已启动本次独立宿主调用',{invocationId:path.basename(cwd),reasoningEffort:reasoningEffort==='inherit'?config.host?.selection?.reasoningEffort:reasoningEffort,requestChars:messages.reduce((n,m)=>n+String(m.content||'').length,0)});
    child.stdin.end(resolved.kind==='json-worker'?JSON.stringify({protocol:'dashi.content-edit.v1',taskId:task.id,scope:task.scope,messages})+'\n':'只基于以下上下文返回 JSON 候选。不要调用工具，不要读写文件，不要执行命令。\n\n'+messages.map(message=>`${message.role.toUpperCase()}:\n${message.content}`).join('\n\n'));
  });
}
