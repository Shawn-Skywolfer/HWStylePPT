import fs from 'node:fs';import path from 'node:path';
import {atomicJson} from '../content/store.mjs';
import {WorkbenchError} from '../content/model.mjs';
import {captureHostBinding,readHostBinding,detectHost,HOST_KINDS} from '../content/host-binding.mjs';
import {bridgeConfig,publicBridgeConfig,saveBridgeConfig} from '../content/bridge.mjs';
import {publicProviderConfig} from '../content/provider.mjs';

const real=root=>fs.realpathSync(path.resolve(root));
const local=root=>path.join(root,'.private','layout-agent');
function project(root){const owner=path.resolve(root,'../../..');return path.basename(path.dirname(path.dirname(root)))==='generations'&&fs.existsSync(path.join(owner,'content-plan.json'))?owner:null;}
function origin(root){try{return JSON.parse(fs.readFileSync(path.join(local(root),'origin.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export function layoutAgentOwner(root){
 const owner=project(root);if(owner)return owner;
 const o=origin(root),dir=local(root),host=readHostBinding(dir);
 if(o?.version===1&&o.previewRoot===real(root)&&host?.kind===o.hostKind)return dir;
 throw new WorkbenchError('此预览尚未连接原生成 Agent。请先打开“Agent 连接设置”完成连接；无需重新生成 PPT。未提交模型请求。',409,'LAYOUT_AGENT_NOT_BOUND');
}
function recordOrigin(root,host,source){atomicJson(path.join(local(root),'origin.json'),{version:1,previewRoot:real(root),hostKind:host.kind,label:host.label||host.kind,source,boundAt:new Date().toISOString()});}
export function capturePreviewHost(root,options={}){
 // Full content-workbench projects already own the binding. Never shadow it.
 if(project(root)||origin(root))return;
 const host=options.host||detectHost(options);if(!host)return;
 const dir=local(root);let saved=captureHostBinding(dir,{descriptor:host,cwd:options.cwd||process.cwd()});
 const found=publicBridgeConfig(dir);
 // Freeze a same-host native entry only. A Node shim needs its prefix and must
 // not be mistaken for a standalone Agent executable.
 if(!saved.command&&found.available&&/^(codex|opencode|claude|dsh|deepseek harness)\.exe$/i.test(path.basename(found.detectedCommand||'')))saved=captureHostBinding(dir,{descriptor:{...saved,command:found.detectedCommand},cwd:options.cwd||process.cwd()});
 recordOrigin(root,saved,'generation');
}
export function layoutAgentStatus(root,{bridgeInjected=false,providerInjected=false}={}){
 let owner,problem;try{owner=layoutAgentOwner(root);}catch(e){problem=e;}
 const detected=origin(root)||detectHost(),host=owner?readHostBinding(owner):null;
 if(!owner)return {bound:false,available:false,providerAvailable:false,canConfigure:true,kind:null,suggestedKind:detected?.hostKind||detected?.kind||'',scope:'standalone',error:problem.message,errorCode:problem.code,runtimeTested:false};
 const bridge=publicBridgeConfig(owner),provider=publicProviderConfig(owner),available=bridgeInjected||bridge.available;
 return {bound:true,available,providerAvailable:providerInjected||!!(provider.baseUrl&&provider.model),canConfigure:true,kind:bridge.detectedKind||host?.kind||null,suggestedKind:host?.kind||'',scope:project(root)?'project':'standalone',error:available?null:bridge.error,errorCode:available?null:bridge.errorCode,timeoutMs:bridge.timeoutMs,model:bridge.model||'',command:host?.command||bridge.command||'',runtimeTested:false,readiness:available?'entry-found-not-executed':'not-ready'};
}
export function configureLayoutAgent(root,input){
 const kind=String(input.kind||''),command=String(input.command||'').trim();if(!HOST_KINDS.includes(kind))throw new WorkbenchError('请选择受支持的 Agent 类型。',422,'BRIDGE_HOST_UNKNOWN');
 const owner=project(root)||local(root),old=readHostBinding(owner);
 if(old?.kind&&old.kind!==kind&&input.confirmHostChange!==true)throw new WorkbenchError('所选环境与原生成 Agent 不同，请明确确认仅为本预览切换连接。',409,'BRIDGE_HOST_CHANGE_REQUIRES_CONFIRMATION');
 const descriptor={...(old?.kind===kind?old:{}),kind,label:kind==='deepseek'?'DeepSeek Harness':kind,...(command?{command}:{})};if('command'in input&&!command)delete descriptor.command;
 const host=captureHostBinding(owner,{descriptor,cwd:path.dirname(root)});
 const existing=bridgeConfig(owner);saveBridgeConfig(owner,{kind:'auto',command:'',args:input.args??existing.args,model:String(input.model??existing.model??''),timeoutMs:Number(input.timeoutMs??existing.timeoutMs??180000)});
 if(!project(root))recordOrigin(root,host,'explicit-preview-connection');
 return layoutAgentStatus(root);
}
export function requireLayoutAgent(root,mode,overrides){const status=layoutAgentStatus(root,overrides);if(!(mode==='provider'?status.providerAvailable:status.available))throw new WorkbenchError(mode==='provider'?'此预览没有可用的原项目模型服务，请先配置模型或选择已连接的 Agent。':status.error||'Agent 连接尚未就绪，请先检查连接设置。',409,mode==='provider'?'MODEL_NOT_CONFIGURED':status.errorCode||'BRIDGE_UNAVAILABLE');return layoutAgentOwner(root);}
