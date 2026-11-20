import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import https from 'node:https';
import http from 'node:http';
import {readHostBinding} from '../content/host-binding.mjs';

export const IMAGE_LIMIT=15*1024*1024;
export function imageError(code,message){return Object.assign(new Error(message),{code});}
const scalar=s=>{s=String(s||'').trim();if(s.startsWith('!!')||s==='|'||s==='>')return '';try{return s.startsWith('"')?JSON.parse(s):s.startsWith("'")?s.slice(1,-1).replaceAll("''","'"):s.replace(/\s+#.*$/,'');}catch{return '';}};
// A deliberately narrow reader of the host's provider route, not a YAML executor.
export function discoverImageRoute(home){
 const file=path.join(home,'profiles/desktop/cordis.patch.yml');if(!fs.existsSync(file))return null;
 const text=fs.readFileSync(file,'utf8');if(text.length>2e6)return null;
 const providers=text.split(/(?=^      [\w-]+:\s*$)/m);
 for(const block of providers){const id=block.match(/^      ([\w-]+):\s*$/m)?.[1];if(!id)continue;
  const baseURL=scalar(block.match(/^        baseURL:\s*(.+)$/m)?.[1]),keyEnv=scalar(block.match(/^        apiKeyEnv:\s*(.+)$/m)?.[1]);
  const models=[...block.matchAll(/^          - id:\s*(.+)$/gm)].map(m=>scalar(m[1])).filter(m=>/image|flux|imagen|ideogram/i.test(m));
  if(baseURL&&models.length)return {provider:id,baseURL,model:models[0],models,keyEnv};
 }return null;
}
function envKey(name,home,env){if(!/^[A-Z_][A-Z0-9_]*$/i.test(name||''))return '';if(env[name])return env[name];
 for(const file of [path.join(home,'.env'),path.join(home,'profiles/desktop/.env')]){if(!fs.existsSync(file))continue;const txt=fs.readFileSync(file,'utf8');const raw=txt.match(new RegExp('^(?:export\\s+)?'+name+'\\s*=\\s*(.*)$','m'))?.[1];if(raw!==undefined)return scalar(raw);}
 const credentials=path.join(home,'.credentials.yaml');if(fs.existsSync(credentials)){const txt=fs.readFileSync(credentials,'utf8'),raw=txt.match(new RegExp('^\\s*'+name+':[^\\S\\r\\n]*(.*)$','m'))?.[1];if(raw&& !/^[{[|>]/.test(raw.trim()))return scalar(raw);}return '';
}
export function imageProviderConfig(owner,{env=process.env,home}={}){
 let saved={};try{saved=JSON.parse(fs.readFileSync(path.join(owner,'.private/image-provider.json'),'utf8'));}catch{}
 const host=readHostBinding(owner);home||=host?.kind==='deepseek'?host.home||env.DSH_HOME||path.join(os.homedir(),'.dsh'):null;
 const found=home?discoverImageRoute(home):null,source=saved.source||'host';
 const route=source==='host'?found:{baseURL:saved.baseURL,model:saved.model};
 const apiKey=source==='host'&&found?envKey(found.keyEnv,home,env):saved.apiKey||env.DASHI_IMAGE_API_KEY||'';
 return {...route,apiKey,source,enabled:saved.enabled===true,quality:saved.quality||'low',available:!!(route?.baseURL&&route?.model&&apiKey),hostFound:!!found};
}
export function publicImageConfig(owner,opts){const c=imageProviderConfig(owner,opts);let origin='';try{origin=new URL(c.baseURL).origin;}catch{}return {source:c.source,enabled:c.enabled,model:c.model||'',baseURL:c.baseURL||'',origin,available:c.available,hasKey:!!c.apiKey,hostFound:c.hostFound,quality:c.quality};}
export function saveImageConfig(owner,input,opts){
 if(!['host','manual'].includes(input.source))throw imageError('IMAGE_CONFIG_INVALID','请选择原宿主配置或独立配置');
 let prior={};const file=path.join(owner,'.private/image-provider.json');try{prior=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
 const next={source:input.source,enabled:input.enabled===true,quality:['low','medium','high'].includes(input.quality)?input.quality:'low'};
 if(next.enabled&&input.consent!==true)throw imageError('IMAGE_CONSENT_REQUIRED','启用前请确认图片服务的数据传输和计费提示');
 if(input.source==='manual'){
  const u=new URL(String(input.baseURL||''));if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw imageError('IMAGE_CONFIG_INVALID','图片接口必须是无凭据、无查询参数的 HTTPS 地址');
  if(!/^[\w.\/-]{1,160}$/.test(input.model||''))throw imageError('IMAGE_CONFIG_INVALID','请填写准确的图片模型 ID');
  const baseURL=u.href.replace(/\/$/,'');Object.assign(next,{baseURL,model:input.model,apiKey:input.apiKey||(prior.baseURL===baseURL?prior.apiKey:'')||''});
 }
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(next,null,2),{mode:0o600});return publicImageConfig(owner,opts);
}
export function imageSize(ratio){ratio=Number(ratio);if(!Number.isFinite(ratio)||ratio<.05||ratio>20)throw imageError('IMAGE_RATIO_INVALID','图片框比例无效');
 const requestRatio=Math.max(1/3,Math.min(3,ratio));const height=Math.round(Math.sqrt(1048576/requestRatio)/16)*16,width=Math.round(height*requestRatio/16)*16;
 return {width,height,size:`${width}x${height}`,targetRatio:ratio,requestRatio:width/height,needsCrop:Math.abs(width/height-ratio)>.001};
}
export function publicAddress(address){address=address.toLowerCase().replace(/^\[|\]$/g,'');if(address.startsWith('::ffff:'))return publicAddress(address.slice(7));
 if(isIP(address)===4){const a=address.split('.').map(Number);return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&[0,168].includes(a[1])||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===198&&[18,19,51].includes(a[1])||a[0]===203&&a[1]===0);}
 return isIP(address)===6&&/^2[0-9a-f]{3}:/.test(address)&&!address.startsWith('2001:db8:')&&!address.startsWith('2002:')&&!/^2001:0{1,4}:/.test(address);
}
async function abortable(promise,signal){if(!signal)return promise;signal.throwIfAborted();let abort;try{return await Promise.race([promise,new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});})]);}finally{signal.removeEventListener('abort',abort);}}
export async function safeRemoteURL(value,{resolve=lookup,signal}={}){let u;try{u=new URL(String(value||''));}catch{throw imageError('IMAGE_URL_INVALID','请填写完整的公网 HTTP/HTTPS 原图链接');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.hash||u.port&&!['80','443'].includes(u.port))throw imageError('IMAGE_URL_INVALID','只接受不含凭据的公网 HTTP/HTTPS 图片链接');
 const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();if(!isIP(host)&&(!host.includes('.')||/(^|\.)(localhost|local|internal|lan|home\.arpa)$/.test(host)))throw imageError('IMAGE_URL_PRIVATE','不支持本机或内网域名，请保存图片后本地上传');
 let records;try{records=isIP(host)?[{address:host,family:isIP(host)}]:await abortable(resolve(host,{all:true}),signal);}catch(e){if(signal?.aborted)throw signal.reason;throw imageError('IMAGE_DNS_FAILED','图片域名解析失败，请检查链接或当前网络；也可保存图片后本地上传');}
 if(!isIP(host)&&records.length&&records.every(r=>/^198\.(18|19)\./.test(r.address)))throw imageError('IMAGE_URL_FAKE_IP','公网域名解析为 Fake-IP 保留地址，本机服务未下载图片。可点击“浏览器通道下载并裁切”使用浏览器自己的网络；网站不允许跨域读取时，请保存后本地上传。不会放宽内网防护或修改代理/DNS');
 if(!records.length||records.some(r=>!publicAddress(r.address)))throw imageError('IMAGE_URL_PRIVATE','域名解析到本机、内网或保留地址，已阻止读取；请保存图片后本地上传，不会通过浏览器通道绕过内网地址检查');return {url:u,address:records[0]};
}
export async function browserImageURL(value,options={}){try{await safeRemoteURL(value,options);return {allowed:true,reason:'public-url'};}catch(e){if(e.code==='IMAGE_URL_FAKE_IP')return {allowed:true,reason:'fake-ip-browser-only'};throw e;}}
export function sniffImage(bytes){let mime;if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')mime='image/webp';
 if(!mime||bytes.length>IMAGE_LIMIT||bytes.length<20)throw imageError('IMAGE_FORMAT_INVALID','仅支持 15 MB 内的 PNG、JPEG、WebP 图片，不支持 SVG 或网页链接');return mime;
}
export async function downloadImage(value,{signal,redirects=0}={}){
 if(redirects>3)throw imageError('IMAGE_REDIRECT_LIMIT','图片链接跳转过多');const {url:u,address}=await safeRemoteURL(value,{signal});signal?.throwIfAborted();
 const response=await new Promise((resolve,reject)=>{const request=(u.protocol==='https:'?https:http).get(u,{signal,headers:{accept:'image/png,image/jpeg,image/webp'},lookup:(_host,options,cb)=>cb(null,options?.all?[address]:address.address,address.family)},resolve);request.on('error',reject);request.setTimeout(30000,()=>request.destroy(imageError('IMAGE_DOWNLOAD_TIMEOUT','图片下载超时')));});
 if([301,302,303,307,308].includes(response.statusCode)){response.resume();return downloadImage(new URL(response.headers.location,u).href,{signal,redirects:redirects+1});}
 if(response.statusCode!==200){response.resume();throw imageError('IMAGE_DOWNLOAD_FAILED','图片服务返回 HTTP '+response.statusCode);}
 if(Number(response.headers['content-length'])>IMAGE_LIMIT){response.destroy();throw imageError('IMAGE_TOO_LARGE','图片超过 15 MB');}
 let length=0,parts=[];for await(const part of response){length+=part.length;if(length>IMAGE_LIMIT){response.destroy();throw imageError('IMAGE_TOO_LARGE','图片超过 15 MB');}parts.push(part);}const bytes=Buffer.concat(parts),mime=sniffImage(bytes);return {bytes,mime};
}
export async function generateImage(config,input,{signal,fetcher=fetch,downloader=downloadImage}={}){
 if(!config.enabled||!config.available)throw imageError('IMAGE_PROVIDER_NOT_READY','请先启用并配置可用的图片模型');
 if(input.consent!==true)throw imageError('IMAGE_CONSENT_REQUIRED','生成前请确认本次提示词将发送给图片服务并可能计费');
 const prompt=String(input.prompt||'').trim();if(!prompt||prompt.length>12000)throw imageError('IMAGE_PROMPT_INVALID','请填写 1–12000 字的图片提示词');
 const sizing=imageSize(input.ratio),base=new URL(config.baseURL);if(base.protocol!=='https:'||base.username||base.password)throw imageError('IMAGE_CONFIG_INVALID','图片接口需要 HTTPS');
 const endpoint=base.href.replace(/\/$/,'').replace(/\/images\/generations$/,'')+'/images/generations';
let response;try{response=await fetcher(endpoint,{method:'POST',redirect:'manual',signal,headers:{'content-type':'application/json',authorization:`Bearer ${config.apiKey}`},body:JSON.stringify({model:config.model,prompt:`${prompt}\nComposition: target frame aspect ratio ${sizing.targetRatio.toFixed(5)}:1; keep the main subject inside safe margins. No text, labels, logos or watermarks.`,n:1,size:sizing.size,quality:config.quality||'low',output_format:'png'})});}catch(e){if(signal?.aborted)throw signal.reason;throw imageError('IMAGE_NETWORK_FAILED','图片模型连接失败。请检查服务地址、网络及已批准的代理配置；若浏览器出现企业风险告知页，请自行按公司流程处理后重试。不会自动重试或更换网络出口');}
 if(response.status>=300&&response.status<400){response.body?.cancel?.();throw imageError('IMAGE_NETWORK_CONFIRMATION_REQUIRED','图片请求被重定向，可能是企业代理的告知/登录页或接口地址变化。请在系统浏览器按公司流程确认，或联系 IT 核对地址后重试；未跟随跳转、未转发密钥。');}
 if(response.status===407){response.body?.cancel?.();throw imageError('IMAGE_PROXY_AUTH_REQUIRED','代理需要认证，请通过系统或 IT 批准的方式登录；不要在图片配置中填写电脑/域账号密码。');}
 if(!response.ok){response.body?.cancel?.();throw imageError('IMAGE_PROVIDER_HTTP_'+response.status,'图片模型返回 HTTP '+response.status+'；请检查该模型的权限、额度与参数，未自动重试');}
 if(/text\/html/i.test(response.headers?.get?.('content-type')||'')){response.body?.cancel?.();throw imageError('IMAGE_NETWORK_PORTAL','图片服务返回了网页而非模型结果，可能是企业告知页或登录页。请在浏览器按公司流程处理，或联系 IT；没有自动确认或重复调用。');}
 const reader=response.body.getReader();let count=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>24*1024*1024){await reader.cancel();throw imageError('IMAGE_RESPONSE_TOO_LARGE','模型返回图片过大');}chunks.push(value);}let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw imageError('IMAGE_RESPONSE_INVALID','图片模型没有返回有效 JSON');}
 let image;const result=data.data?.[0];if(result?.b64_json){const bytes=Buffer.from(result.b64_json,'base64');image={bytes,mime:sniffImage(bytes)};}else if(result?.url)image=await downloader(result.url,{signal});else throw imageError('IMAGE_RESPONSE_INVALID','没有找到可用图片；请确认所配的是图片生成接口，而不是聊天接口');
 return {...image,sizing};
}
