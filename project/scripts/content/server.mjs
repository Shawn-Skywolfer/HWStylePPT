import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ProjectStore,recordHistory,commitDocument } from './store.mjs';
import { statusOf, WorkbenchError, now,reconcileDocument,uid } from './model.mjs';
import { makeTask, modelMessages, submitProposal, decideProposal } from './proposals.mjs';
import { publicProviderConfig, saveProviderConfig, callModel } from './provider.mjs';
import { prepareGeneration, executeGeneration } from './generation.mjs';
import { compileContent } from './compile.mjs';
import {createTaskEngine} from './task-engine.mjs';
import {publicBridgeConfig,saveBridgeConfig} from './bridge.mjs';
import {documentToMarkdown,markdownToTree,treeToDocument} from './mindmap-model.mjs';
import {publicError} from './diagnostics.mjs';
import {prepareContentDraft,assertCapacityReady} from './capacity-plan.mjs';
import {digest} from './model.mjs';
import {probeExecution,requireExecution} from './runtime-readiness.mjs';
import {openDefaultBrowser} from '../start-preview-server.mjs';
import {atomicJson,storageError} from './store.mjs';
import {safeMessage,publicDiagnosticReport} from './diagnostics.mjs';

const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/content-workbench');
function send(res, code, data) { res.writeHead(code, { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(data)); }
async function body(req) {
  let size = 0, chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) throw new WorkbenchError('请求超过 8 MB。', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new WorkbenchError('无效 JSON 请求。'); }
}
function sameSecret(a, b) { const left = Buffer.from(a || ''), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
export function createWorkbenchServer(projectDir, { token = randomBytes(32).toString('hex'),engineOptions={},onError,runtimeProbe=probeExecution } = {}) {
  onError ||= error=>{try{const file=path.join(projectDir,'.private/workbench-errors.jsonl');fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file)&&fs.statSync(file).size>1024*1024)fs.unlinkSync(file);const d=publicError(storageError(error));fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),code:d.errorCode,phase:d.errorDetails.phase||'request',systemCode:d.errorDetails.systemCode||'',syscall:d.errorDetails.syscall||'',target:d.errorDetails.target||''})+'\n',{mode:0o600});}catch{ /* Logging must never hide the original failure. */ }};
  const store = new ProjectStore(projectDir); store.read();
  const engine=createTaskEngine(store,{onError,...engineOptions});
  const readiness=runtimeProbe();
  function mutate(input,fn) {
    return store.mutate(input.contentRevision==null?input.revision:null,project=>{if(input.contentRevision!=null && input.contentRevision!==project.contentRevision)throw new WorkbenchError('内容已由其他操作更新，请先重新读取。',409,'VERSION_CONFLICT');fn(project);});
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const host = req.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new WorkbenchError('仅允许本机访问。', 403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new WorkbenchError('拒绝跨来源请求。', 403);
      if (url.pathname.startsWith('/api/')) {
        const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('dashi_workbench='))?.slice(16);
        if (!sameSecret(req.headers['x-workbench-token'] || cookie, token)) throw new WorkbenchError('此工作台会话未授权。请粘贴启动器提供的完整访问链接，或在原预览中点击“访问链接”复制；不要只复制去掉凭证的短地址。', 401,'WORKBENCH_UNAUTHORIZED');
        if (req.method === 'GET') {
          if (url.pathname === '/api/project') {const project=engine.view(store.read());return send(res,200,{project,status:statusOf(project)});}
          if (url.pathname === '/api/status') return send(res, 200, statusOf(engine.view(store.read())));
          if(url.pathname==='/api/runtime'){const report=await readiness,quote=s=>"'"+String(s).replaceAll("'","''")+"'";return send(res,200,{...report,recoveryCommand:(process.platform==='win32'?'& ':'')+quote(process.execPath)+' '+quote(path.resolve(import.meta.dirname,'../../../scripts/content-workbench.mjs'))+' serve --project '+quote(store.dir)+' --port '+host.split(':').at(-1)});}
          if(url.pathname==='/api/markdown')return send(res,200,{markdown:documentToMarkdown(store.read().current),contentRevision:store.read().contentRevision});
          if (url.pathname === '/api/model') return send(res, 200, publicProviderConfig(store.dir));
          if (url.pathname === '/api/bridge') return send(res,200,publicBridgeConfig(store.dir));
          if (url.pathname === '/api/tasks') return send(res, 200, store.read().aiTasks.filter(task => task.status === 'pending'));
          throw new WorkbenchError('接口不存在。', 404);
        }
        if (req.method !== 'POST') throw new WorkbenchError('不支持的请求方法。', 405);
        const input = await body(req);
        if(url.pathname==='/api/session/access')return send(res,200,{url:`http://${host}/#token=${token}`,notice:'此链接包含本工作台的访问凭证，只在本机可信浏览器使用，不要公开分享。'});
        if(url.pathname==='/api/session/open-browser'){const opened=await openDefaultBrowser(`http://${host}/#token=${token}`);if(!opened.ok)throw new WorkbenchError('系统浏览器未能打开。请复制完整访问链接，手工粘贴到系统浏览器；受限进程不能自行解除权限限制。',503,'WORKBENCH_BROWSER_OPEN_FAILED');return send(res,200,{opened:true});}
        // Pause/cancel are priority safety controls, not content writes. Stale
        // revisions and a failed save must not prevent stopping owned work.
        if(['/api/task/control','/api/workspace/control'].includes(url.pathname)&&['pause','cancel'].includes(input.action)){
          const targets=url.pathname==='/api/task/control'?[{collection:input.collection||'aiTasks',id:input.id}]:['aiTasks','generations'].flatMap(collection=>engine.view(store.read())[collection].filter(item=>['queued','pending','running','paused','proposed'].includes(item.status)).map(item=>({collection,id:item.id})));
          const stopped=engine.stopMany(targets,input.action,{workspace:url.pathname==='/api/workspace/control'});return send(res,200,{...stopped,status:statusOf(stopped.project)});
        }
        if(url.pathname==='/api/diagnostics/export'){const p=store.read(),report=publicDiagnosticReport(input.report||{},{projectId:p.projectId,contentRevision:p.contentRevision}),relative='diagnostics/dashi-diagnostics-'+Date.now()+'-'+randomBytes(3).toString('hex')+'.json';atomicJson(path.join(store.dir,relative),report);return send(res,200,{saved:true,path:path.join(store.dir,relative),relative});}
        if (url.pathname === '/api/model') return send(res, 200, saveProviderConfig(store.dir, input));
        if (url.pathname === '/api/bridge') return send(res,200,saveBridgeConfig(store.dir,input));
        if (url.pathname === '/api/model/test') return send(res, 200, await callModel(store.dir, [{ role: 'user', content: 'Reply OK.' }], { test: true }));
        if (url.pathname !== '/api/compile-check' && (!Number.isInteger(input.revision) || input.revision < 1)) throw new WorkbenchError('写操作必须携带当前 revision。');
        let project;
        if (url.pathname === '/api/document') project = mutate(input,latest=>commitDocument(latest,reconcileDocument(latest.current,input.document),input.label || '脑图编辑'));
        else if(url.pathname==='/api/markdown')project=mutate(input,latest=>{let doc;try{doc=treeToDocument(markdownToTree(input.markdown,latest.current));}catch(error){throw new WorkbenchError(error.message,422,'MARKDOWN_INVALID');}commitDocument(latest,reconcileDocument(latest.current,doc),'导入 / 编辑 Markdown 脑图');});
        else if(url.pathname==='/api/capacity'){
          const latest=store.read(),prepared=prepareContentDraft(latest.current);
          if(input.action==='apply'){
            if(latest.workspacePaused)throw new WorkbenchError('工作台已暂停，请先继续。',409,'WORKSPACE_PAUSED');
            if(input.sourceHash!==digest(latest.current)||input.planHash!==prepared.report.planHash)throw new WorkbenchError('内容或分页方案已经变化，请重新预览后再应用。',409,'VERSION_CONFLICT');
            project=mutate(input,p=>commitDocument(p,reconcileDocument(p.current,prepared.document),'容量匹配：确认无损自动拆页'));
          }else if(input.action==='preview')return send(res,200,{report:prepared.report});
          else throw new WorkbenchError('未知的容量匹配操作。');
        }
        else if (url.pathname === '/api/action') {
          if(input.action==='confirm')assertCapacityReady(store.read().current,input.slideId);
          if(input.contentRevision!=null && input.contentRevision!==store.read().contentRevision)throw new WorkbenchError('内容版本冲突，请先重新读取。',409,'VERSION_CONFLICT');
          project = store.action(input.contentRevision==null?input.revision:null,input.action,input);
        }
        else if (url.pathname === '/api/compile-check') {
          const latest = store.read(); const result = compileContent(latest.current, { projectId: latest.projectId, legacyGoal: latest.migration?.originalGoal });
          return send(res, 200, { ok: true, warnings: result.warnings, layouts: result.goal.slides.map(slide => slide.layout),plans:result.mapping.slides.map(slide=>({slideId:slide.slideId,layout:slide.layout,plan:slide.visualPlan})) });
        } else if (url.pathname === '/api/ai/request') {
          if(input.bridge&&input.execution!=='manual')requireExecution(await readiness);
          let task;
          project = mutate(input, latest => {recordHistory(latest,'AI 修改'); task = makeTask(latest, input); latest.aiTasks.push(task); });
        } else if (url.pathname === '/api/ai/refine') {
          project = mutate(input, latest => {
            const task = latest.aiTasks.find(item => item.id === input.taskId);
            if (!task || !['proposed', 'failed'].includes(task.status) || task.baseContentRevision !== latest.contentRevision) throw new WorkbenchError('此会话已结束或正式稿发生改变，请重新发起修改。', 409);
            if (!String(input.prompt || '').trim()) throw new WorkbenchError('请输入继续修改的要求。');
            recordHistory(latest,'继续 AI 修改');task.messages.push({ role: 'user', content: String(input.prompt) }); task.status = task.mode === 'bridge' && task.execution==='manual' ? 'pending' : 'queued';task.runId=uid('run'); task.error = null;
            if(['auto','proposal'].includes(input.applyMode)&&task.scope.kind!=='deck')task.applyMode=task.repair?'proposal':input.applyMode;
            if(typeof input.preserveNumbers==='boolean')task.preserveNumbers=input.preserveNumbers;
          });
        } else if (url.pathname === '/api/ai/submit') project = mutate(input, latest => submitProposal(latest, input.taskId, input.result));
        else if (url.pathname === '/api/proposal/decide') project = mutate(input, latest => {if(!input.accept)recordHistory(latest,'拒绝 AI 提案');decideProposal(latest,input.proposalId,input.accept===true);});
        else if(url.pathname==='/api/task/control'){engine.flush();project=mutate(input,latest=>engine.control(latest,input.collection || 'aiTasks',input.id,input.action));}
        else if(url.pathname==='/api/workspace/control'){engine.flush();project=mutate(input,latest=>{
          if(!['pause','resume','cancel'].includes(input.action))throw new WorkbenchError('未知的工作台操作。');
          recordHistory(latest,`${input.action} 工作台操作`);latest.workspacePaused=input.action==='pause';
          for(const collection of ['aiTasks','generations'])for(const item of latest[collection]) {
            if(input.action==='resume' && item.status==='paused')engine.control(latest,collection,item.id,'resume',{history:false});
            if(input.action!=='resume' && ['queued','pending','running','paused','proposed'].includes(item.status))engine.control(latest,collection,item.id,input.action,{history:false});
          }
        });}
        else if (url.pathname === '/api/generate') {
          requireExecution(await readiness);
          if(input.contentRevision!=null && input.contentRevision!==store.read().contentRevision)throw new WorkbenchError('内容版本冲突。',409,'VERSION_CONFLICT');
          const prepared = prepareGeneration(store, input.contentRevision==null?input.revision:null,{planner:input.planner||'rules'});
          project = prepared.project;
        } else throw new WorkbenchError('接口不存在。', 404);
        send(res, 200, { project, status: statusOf(project) });setImmediate(engine.pump);return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new WorkbenchError('不支持的请求方法。', 405);
      const files = { '/': ['mindmap.html', 'text/html'], '/app.js': ['mindmap-app.js', 'application/javascript'], '/style.css': ['mindmap.css', 'text/css'],'/board-model.mjs':['../../scripts/content/board-model.mjs','application/javascript'],'/mindmap-model.mjs':['../../scripts/content/mindmap-model.mjs','application/javascript'] };
      files['/diagnostics-ui.js']=['diagnostics-ui.js','application/javascript'];files['/diagnostics-model.mjs']=['../../scripts/content/diagnostics.mjs','application/javascript'];files['/diagnostics.css']=['diagnostics.css','text/css'];
      files['/generation-progress.css']=['generation-progress.css','text/css'];
      files['/bridge-ui.js']=['bridge-ui.js','application/javascript'];
      files['/capacity-ui.js']=['capacity-ui.js','application/javascript'];
      files['/content-requirements.mjs']=['../../scripts/content/content-requirements.mjs','application/javascript'];
      files['/workbench-session.js']=['workbench-session.js','application/javascript'];files['/workbench-session.css']=['workbench-session.css','text/css'];
      const file = files[url.pathname]; if (!file) throw new WorkbenchError('文件不存在。', 404);
      res.writeHead(200, { 'content-type': `${file[1]};charset=utf-8`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'none'", 'referrer-policy': 'no-referrer' });
      res.end(req.method === 'HEAD' ? '' : fs.readFileSync(path.join(UI, file[0])));
    } catch (rawError) {const error=storageError(rawError);try{onError(error);}catch{}const diagnostic=publicError(error);send(res, error.status || 500, { error: error.status ? diagnostic.error : '工作台内部错误，请检查项目 .private/workbench-errors.jsonl。', code: error.code || 'INTERNAL_ERROR',...(error.details?{details:diagnostic.errorDetails}:{}) }); }
  });
  server.on('close',()=>engine.close());
  return { server, store, token,engine,readiness };
}
