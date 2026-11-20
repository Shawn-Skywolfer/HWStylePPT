import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {atomicJson} from './store.mjs';import {WorkbenchError} from './model.mjs';
export const HOST_KINDS=['deepseek','opencode','claude','codex','json-worker'];
const alias=s=>({'deepseek-harness':'deepseek',dsh:'deepseek','claude-code':'claude','codex-cli':'codex'}[s]||s);
export function deepseekSelection(home){
 const file=path.join(home,'profiles/desktop/cordis.patch.yml');if(!fs.existsSync(file))return null;
 // Read only the public route selector, not credentials, account tokens or arbitrary profile rows.
 const block=fs.readFileSync(file,'utf8').match(/(?:^|\n)- id: agent-default-model[\s\S]*?(?=\n- id:|$)/)?.[0];if(!block)return null;
 const selection={};for(const key of ['provider','model','reasoningEffort']){const raw=block.match(new RegExp('^\\s+'+key+':\\s*(.*?)\\s*$','m'))?.[1];if(!raw)continue;if(raw.startsWith('!!')||/[\r\n]/.test(raw))throw new WorkbenchError('宿主模型选择为动态配置，请用明确的宿主描述文件绑定模型路由。',422,'BRIDGE_ADAPTER_REQUIRED');selection[key]=raw.startsWith('"')?JSON.parse(raw):raw.startsWith("'")?raw.slice(1,-1).replaceAll("''","'"):raw.replace(/\s+#.*$/,'');}
 return selection.provider&&selection.model?selection:null;
}
export function detectHost({env=process.env,cwd=process.cwd(),skillFile=import.meta.filename,explicit=''}={}){
 let kind=alias(String(explicit||env.DASHI_PPT_AGENT||env.DASHI_AGENT_HOST||'').toLowerCase()),source=kind?'explicit':'environment';
 if(!kind){if(env.DSH_HOME||env.DSH_SESSION_ID||/[\\/]\.dsh[\\/]skills[\\/]/i.test(skillFile))kind='deepseek';else if(env.CLAUDECODE)kind='claude';else if(env.OPENCODE||env.OPENCODE_SESSION_ID)kind='opencode';else if(env.CODEX_THREAD_ID||env.CODEX_HOME)kind='codex';}
 if(!kind){let dir=path.resolve(cwd);for(let i=0;i<8;i++){if(fs.existsSync(path.join(dir,'.dsh','skills'))){kind='deepseek';source='workspace-marker';break;}const parent=path.dirname(dir);if(parent===dir)break;dir=parent;}}
 if(!kind)return null;if(!HOST_KINDS.includes(kind))return {kind:'json-worker',label:kind,source:'explicit-unsupported',requiresAdapter:true};
 return {kind,label:kind==='deepseek'?'DeepSeek Harness':kind,source,...(kind==='deepseek'?{home:env.DSH_HOME||path.join(os.homedir(),'.dsh')}:{})};
}
export function readHostBinding(dir){try{return JSON.parse(fs.readFileSync(path.join(dir,'.private/host.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export function captureHostBinding(dir,options={}){
 const saved=readHostBinding(dir);if(saved&&!options.explicit&&!options.descriptor)return saved;
 const host=options.descriptor?{...Object.fromEntries(['kind','label','command','args','home'].filter(k=>options.descriptor[k]!=null).map(k=>[k,options.descriptor[k]])),source:'host-descriptor'}:detectHost(options);if(!host)return saved;
 if(options.descriptor?.selection)host.selection=Object.fromEntries(['provider','model','reasoningEffort'].filter(k=>typeof options.descriptor.selection[k]==='string').map(k=>[k,options.descriptor.selection[k]]));
 if(!HOST_KINDS.includes(host.kind))throw new WorkbenchError('宿主描述的 kind 必须为内置适配器或 json-worker。');
 if(host.command&&!path.isAbsolute(host.command))throw new WorkbenchError('宿主描述的 command 必须为绝对路径。');
 if(host.args&&(!Array.isArray(host.args)||host.args.some(s=>typeof s!=='string')))throw new WorkbenchError('宿主描述的 args 必须为字符串数组。');
 if(options.command){if(!path.isAbsolute(options.command))throw new WorkbenchError('宿主入口必须为绝对路径。');host.command=options.command;}
 if(options.args)host.args=options.args;
 if(host.kind==='deepseek'){host.home||=process.env.DSH_HOME||path.join(os.homedir(),'.dsh');host.selection||=deepseekSelection(host.home);}
 host.boundAt=new Date().toISOString();host.workspace=path.resolve(options.cwd||process.cwd());atomicJson(path.join(dir,'.private/host.json'),host);return host;
}
