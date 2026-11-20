import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {readModel} from './layout-artifacts.mjs';
import {inspectLayout} from '../skill-workflow-utils.mjs';
import {publicImageConfig,saveImageConfig,imageProviderConfig,generateImage,downloadImage,imageError,browserImageURL} from './image-provider.mjs';
const instances=new Set();
export const activeImageCount=()=>[...instances].reduce((n,v)=>n+v(),0);
export function imageOwner(root){const owner=path.resolve(root,'../../..');return path.basename(path.dirname(path.dirname(root)))==='generations'&&fs.existsSync(path.join(owner,'content-plan.json'))?owner:root;}
export function createImageRoutes({serveRoot,allowed,generator=generateImage,downloader=downloadImage,configOptions}={}){
 const jobs=new Map(),owner=imageOwner(serveRoot);let active=0;const count=()=>active;instances.add(count);
 const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json;charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
 const read=async req=>{let length=0,parts=[];for await(const p of req){length+=p.length;if(length>64*1024)throw imageError('IMAGE_INPUT_TOO_LARGE','图片设置请求过大');parts.push(p);}try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{throw imageError('IMAGE_INPUT_INVALID','图片设置格式无效');}};
 const publicJob=j=>Object.fromEntries(['id','slideId','index','kind','status','stage','createdAt','updatedAt','elapsedMs','code','message','model','sizing'].map(k=>[k,k==='elapsedMs'?(j.status==='running'||j.status==='queued'?Date.now():j.updatedAt)-j.createdAt:j[k]]));
 const checkTarget=input=>{const vm=readModel(fs.readFileSync(path.join(serveRoot,'index.html'),'utf8')),slide=vm.slides.find(s=>s.id===input.slideId);if(!slide||!/^theme17_/.test(slide.layout))throw imageError('IMAGE_TARGET_INVALID','页面不存在或不是当前演示');if(Number.isInteger(input.index)&&input.index>=100&&input.index<=199){const objects=vm.state?.props?.[slide.id]?.editorCanvasObjects||slide.props?.editorCanvasObjects||[];if(objects.some(o=>o.kind==='image'&&o.mediaIndex===input.index))return;throw imageError('IMAGE_TARGET_INVALID','新增图片框尚未保存或已删除，请在当前页重新选择');}if(['theme17_page001','theme17_page002','theme17_page003','theme17_page004','theme17_page005'].includes(slide.layout))throw imageError('IMAGE_TARGET_INVALID','固定封面、章节和封底的原模板不修改');const capacity=(inspectLayout(slide.layout,{compact:true}).mediaSlots||[]).filter(s=>s.field==='images'&&s.canPresetMedia).reduce((n,s)=>n+Number(s.maxCount||0),0);if(!Number.isInteger(input.index)||input.index<0||input.index>=capacity)throw imageError('IMAGE_TARGET_INVALID','图片框编号无效或当前版式不支持配图');};
 function pump(){for(const j of jobs.values()){if(active>=2)break;if(j.status!=='queued')continue;active++;j.status='running';j.stage=j.kind==='generate'?'model-wait':'downloading';j.updatedAt=Date.now();const controller=new AbortController();j.controller=controller;const timer=setTimeout(()=>controller.abort(imageError(j.kind==='generate'?'IMAGE_TIMEOUT':'IMAGE_DOWNLOAD_TIMEOUT',j.kind==='generate'?'图片生成超过 10 分钟，已停止等待；服务端可能仍计费':'图片链接读取超过 60 秒，已停止等待；可重试或改用浏览器通道/本地上传')),j.kind==='generate'?600000:60000);timer.unref?.();
   Promise.resolve().then(()=>j.kind==='generate'?generator(j.config,j.input,{signal:controller.signal}):downloader(j.input.url,{signal:controller.signal})).then(result=>{if(j.status==='cancelled')return;j.result={dataURL:`data:${result.mime};base64,${result.bytes.toString('base64')}`,sizing:result.sizing};j.sizing=result.sizing;j.status='ready';j.stage='crop-review';j.message='图片已就绪，点击预览并裁切；尚未替换页面';}).catch(e=>{if(j.status==='cancelled')return;j.status='failed';j.stage='failed';j.code=String(e.code||'IMAGE_FAILED').replace(/[^A-Z0-9_]/g,'').slice(0,80);j.message=/^IMAGE_/.test(e.code||'')?e.message:'图片处理失败，请检查网络、模型配置或图片链接';}).finally(()=>{clearTimeout(timer);delete j.input;delete j.config;delete j.controller;j.updatedAt=Date.now();active--;pump();});
  }}
 const handler=async(req,res,url)=>{if(!url.pathname.startsWith('/api/image-'))return false;const remote=req.socket?.remoteAddress;if(!allowed(req)||remote&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)){json(res,403,{error:'仅允许从本机演示控制台发起图片操作'});return true;}
  try{
   for(const [id,j]of jobs)if(!['queued','running'].includes(j.status)&&Date.now()-j.updatedAt>1800000)jobs.delete(id);
   if(req.method==='POST'&&url.pathname==='/api/image-browser-url-check'){const {url:remoteURL}=await read(req);json(res,200,await browserImageURL(remoteURL,{signal:AbortSignal.timeout(10000)}));}
   else if(req.method==='GET'&&url.pathname==='/api/image-config')json(res,200,publicImageConfig(owner,configOptions));
   else if(req.method==='POST'&&url.pathname==='/api/image-config')json(res,200,saveImageConfig(owner,await read(req),configOptions));
   else if(req.method==='GET'&&url.pathname==='/api/image-jobs')json(res,200,{jobs:[...jobs.values()].map(publicJob),active,concurrency:2});
   else if(req.method==='GET'&&url.pathname==='/api/image-result'){const j=jobs.get(url.searchParams.get('id'));if(!j||j.status!=='ready')throw imageError('IMAGE_RESULT_MISSING','图片尚未就绪或会话已结束，请重新生成或导入');json(res,200,j.result);}
   else if(req.method==='POST'&&url.pathname==='/api/image-cancel'){const {id}=await read(req),j=jobs.get(id);if(!j)throw imageError('IMAGE_JOB_MISSING','图片任务不存在');if(['queued','running'].includes(j.status)){j.status='cancelled';j.stage='cancelled';j.message='已取消本地等待，不会替换页面；已提交的模型请求可能仍计费';j.controller?.abort(imageError('IMAGE_CANCELLED',j.message));}json(res,200,publicJob(j));}
   else if(req.method==='POST'&&['/api/image-generate','/api/image-import'].includes(url.pathname)){
    const input=await read(req);checkTarget(input);const kind=url.pathname.endsWith('generate')?'generate':'url';
    const existing=[...jobs.values()].find(j=>j.slideId===input.slideId&&j.index===input.index&&['queued','running'].includes(j.status));if(existing){json(res,409,{code:'IMAGE_SLOT_BUSY',error:'此图片框已有进行中的任务，已显示该任务状态；请等待完成或取消。失败任务不会阻止重新下载。',job:publicJob(existing)});return true;}
    const requestKey=kind==='url'?createHash('sha256').update(String(input.url||'')).digest('hex'):null;
    const cached=kind==='url'?[...jobs.values()].filter(j=>j.slideId===input.slideId&&j.index===input.index&&j.kind==='url'&&j.status==='ready'&&j.requestKey===requestKey).at(-1):null;if(cached){json(res,200,{...publicJob(cached),reused:true});return true;}
    if([...jobs.values()].filter(j=>['queued','running'].includes(j.status)).length>=10)throw imageError('IMAGE_QUEUE_FULL','图片任务队列已满，请先处理已有任务');
    const config=kind==='generate'?imageProviderConfig(owner,configOptions):null;
    if(kind==='generate'&&(!config.enabled||!config.available||input.consent!==true))throw imageError('IMAGE_PROVIDER_NOT_READY','请先启用可用的图片模型，并确认本次数据传输和计费');
    const j={id:'image-'+randomUUID(),slideId:input.slideId,index:input.index,kind,requestKey,status:'queued',stage:'queued',createdAt:Date.now(),updatedAt:Date.now(),input,config,model:config?.model};jobs.set(j.id,j);pump();json(res,202,publicJob(j));
   }else json(res,404,{error:'图片操作不存在'});
  }catch(e){const known=typeof e.code==='string'&&e.code.startsWith('IMAGE_');json(res,422,{code:known?e.code:e.name==='TimeoutError'?'IMAGE_DNS_TIMEOUT':'IMAGE_REQUEST_FAILED',error:known?e.message:e.name==='TimeoutError'?'图片域名检查超时，请重试或保存后本地上传':'图片操作失败，请检查配置或输入'});}return true;
 };
 handler.close=()=>{for(const j of jobs.values())j.controller?.abort();instances.delete(count);};return handler;
}
