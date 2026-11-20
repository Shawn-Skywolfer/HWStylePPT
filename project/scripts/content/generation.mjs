import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { compileContent } from './compile.mjs';
import { atomicJson } from './store.mjs';
import { clone, digest, now, uid, statusOf, WorkbenchError } from './model.mjs';
import {recordHistory} from './store.mjs';
import {stopOwnedProcess} from './bridge.mjs';
import {briefReady} from './brief.mjs';
import {designDeck} from './deck-design.mjs';
import {publicError} from './diagnostics.mjs';
import {processLaunchError} from './runtime-readiness.mjs';
import {assertCapacityReady} from './capacity-plan.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
function runNode(args, cwd = ROOT, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const phase=args.find(a=>/scripts\/.+\.(mjs|jsx)$/.test(a))||'node-command';let child;
    try{child = spawn(process.execPath, args, { cwd, windowsHide: true, env: { ...process.env, INIT_CWD: cwd }, stdio: ['ignore', 'pipe', 'pipe'] });}catch(error){reject(processLaunchError(error,{phase}));return;}
    const abort=()=>{stopOwnedProcess(child);reject(signal.reason||new DOMException('Cancelled','AbortError'));};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output = (output + data).slice(-24000); });
    child.on('error', error=>{signal?.removeEventListener('abort',abort);reject(processLaunchError(error,{phase}));});
    child.on('close', code => {signal?.removeEventListener('abort',abort);if(signal?.aborted)return reject(signal.reason || new DOMException('Cancelled','AbortError'));code === 0 ? resolve(output) : reject(new WorkbenchError(`生成步骤失败：${output.slice(-7000)}`, 500, 'RENDER_FAILED'));});
  });
}
export function prepareGeneration(store, expectedRevision, { fast = false,planner='rules' } = {}) {
  let job;
  const project = store.mutate(expectedRevision, project => {
    if(!briefReady(project.current))throw new WorkbenchError('请先完成汇报需求问答：受众、使用场合和最重要要求，并确认需求。',409,'BRIEF_REQUIRED');
    if(!['rules','bridge','provider'].includes(planner))throw new WorkbenchError('不支持的视觉规划模式。');
    if (!fast && !statusOf(project).canGenerate) throw new WorkbenchError('请先确认全部内容，再生成 PPT。', 409, 'CONFIRMATION_REQUIRED');
    if (project.generations.some(item => ['running','queued','paused'].includes(item.status))) throw new WorkbenchError('当前项目已有生成任务，请先继续或取消。', 409);
    const document = clone(fast ? project.current : project.confirmed.document);
    assertCapacityReady(document);
    const confirmedId = fast ? `fast-${project.contentRevision}` : project.confirmed.id;
    const id = uid('generation'), dir = path.join(store.dir, 'generations', id);
    atomicJson(path.join(dir, 'confirmed-content.json'), document);
    recordHistory(project,'生成 PPT');
    job = { id, planner,status: 'queued', progress:{stage:'queued',percent:0,detail:'内容已确认，等待启动全篇视觉策划'},runId:uid('run'),pid: process.pid, startedAt: now(), confirmedId, contentHash: digest(document), warnings: [], relativeDir: `generations/${id}`, previewUrl: null };
    project.generations.push(job); project.stage = 'generating';
  });
  return { project, job };
}
export async function executeGeneration(store, jobId, { preview = true,signal,onProgress=()=>{},runId,bridgeRunner,modelRunner } = {}) {
  const project = store.read(), job = project.generations.find(item => item.id === jobId);
  if (!job) throw new WorkbenchError('生成任务不存在。', 404);
  if(!runId)store.mutate(null,latest=>{latest.generations.find(item=>item.id===jobId).status='running';});
  const dir = path.join(store.dir, job.relativeDir), goal = path.join(dir, 'goal.json'), html = path.join(dir, 'ppt', 'index.html');
  try {
    let tsx;
    try { tsx = require.resolve('tsx/esm'); } catch { throw new WorkbenchError('缺少生成依赖，请在 Skill 的 project 目录先运行 npm install。内容工作台不受影响。', 422, 'DEPENDENCIES_MISSING'); }
    const logs = [];
    const document=JSON.parse(fs.readFileSync(path.join(dir,'confirmed-content.json'),'utf8'));
    const options={projectId:project.projectId,confirmedId:job.confirmedId,legacyGoal:project.migration?.originalGoal};
    signal?.throwIfAborted();onProgress({stage:'content-match',percent:5,detail:'正在核对整套确认内容，匹配完整主题库与多种正文排版'});
    const designed=await designDeck(store.dir,document,options,{planner:job.planner||'rules',signal,onProgress,bridgeRunner,modelRunner});
    let compiled=designed.compiled;
    const savePlan=()=>{atomicJson(goal,compiled.goal);atomicJson(path.join(dir,'layout-utilization.json'),compiled.utilization);atomicJson(path.join(dir,'content-mapping.json'),compiled.mapping);atomicJson(path.join(dir,'visual-plan.json'),{version:3,design:designed.report,slides:compiled.mapping.slides.map(({slideId,layout,visualPlan})=>({slideId,layout,plan:visualPlan}))});};
    savePlan();
    const run=async(args,percent,detail)=>{signal?.throwIfAborted();const command=args.find(a=>/scripts\/.+\.(mjs|jsx)$/.test(a))||'node-command';onProgress({stage:command.replace(/^scripts\//,'').replace(/\.(mjs|jsx)$/,''),percent,detail});return runNode(args,ROOT,signal);};
    const excluded={};
    for(let attempt=0;attempt<3;attempt++){
    logs.push(await run(['scripts/validate-goal-spec.mjs', goal],26,'正在校验完整主题库匹配与确认稿'));
    logs.push(await run(['--import', pathToFileURL(tsx).href, 'scripts/render-goal-deck.jsx', goal, html],30,'正在渲染 Theme17 页面'));
    if (project.migration?.sourceDir) copyMigratedMedia(project.migration.sourceDir, JSON.parse(fs.readFileSync(goal, 'utf8')), path.dirname(html));
    if(document.slides.some(s=>s.media?.length))copyMigratedMedia(store.dir,compiled.goal,path.dirname(html));
    logs.push(await run(['scripts/validate-swiss-deck.mjs', html],65,'正在检查页面结构'));
    logs.push(await run(['scripts/validate-goal-copy.mjs', goal, html],80,'正在核对确认内容'));
    signal?.throwIfAborted();onProgress({stage:'rendered-validation',percent:85,detail:'正在浏览器实测内容完整性、来源归属、关系连线与文字溢出'});
    const {validateRenderedContent}=await import('./rendered-validation.mjs');
    try{await validateRenderedContent(path.dirname(html),document,compiled.goal,{signal,mapping:compiled.mapping,onProgress});break;}
    catch(error){
      if(error.code!=='RENDERED_CONTENT_FAILED'||attempt===2||!error.details?.failedPages?.length)throw error;
      for(const i of error.details.failedPages){const s=document.slides[i],layout=compiled.goal.slides[i].layout;(excluded[s.slideId]||=[]).push(layout);}
      onProgress({stage:'layout-rematch',percent:28,detail:'实测发现文字缺失或空间不足，正在保留原文并更换问题页版式'});
      const choices=Object.fromEntries(compiled.design.filter(p=>!error.details.failedPages.some(i=>document.slides[i].slideId===p.slideId)).map(p=>[p.slideId,p.selected]));
      if(attempt===1)for(const i of error.details.failedPages){const s=document.slides[i],fallback=compiled.design.find(p=>p.slideId===s.slideId)?.candidates.find(c=>c.layout.startsWith('theme17_content_')&&!excluded[s.slideId]?.includes(c.layout));if(fallback)choices[s.slideId]=fallback.layout;}
      try{compiled=compileContent(document,{...options,excluded,choices});}
      catch(rematchError){
        if(rematchError.code!=='LAYOUT_SEQUENCE_REQUIRED')throw rematchError;
        // Passing neighbours are not user-pinned choices during initial
        // generation. Release temporary picks so the whole deck can regain
        // a valid alternating sequence; content and explicit choices stay fixed.
        onProgress({stage:'layout-rematch',percent:28,detail:'问题页需要邻页同步重新选版，正在保留全文与相邻不同版式规则重新规划'});
        compiled=compileContent(document,{...options,excluded});
      }
      designed.report.renderRetries=(designed.report.renderRetries||0)+1;designed.report.pages=compiled.design;savePlan();
    }
    }
    let previewUrl = null;
    if (preview) {
      logs.push(await run(['scripts/start-preview-server.mjs', path.dirname(html), process.env.DASHI_PPT_PREVIEW_PORT || '5488'],90,'正在启动演示控制台'));
      previewUrl = JSON.parse(fs.readFileSync(path.join(dir, 'ppt', '.preview-server.json'), 'utf8')).httpUrl;
    }
    fs.writeFileSync(path.join(dir, 'generation.log'), logs.join('\n'), { mode: 0o600 });
    return store.mutate(null, latest => {
      const saved = latest.generations.find(item => item.id === jobId);
      if(!saved || signal?.aborted || (runId && saved.runId!==runId))return;
      Object.assign(saved, { status: 'ready',progress:{stage:'ready',percent:100,detail:'内容、版式与浏览器实测通过，演示控制台已就绪'}, completedAt: now(), previewUrl, html: `${job.relativeDir}/ppt/index.html` });
      latest.mapping=compiled.mapping;saved.warnings=compiled.warnings;saved.designMode=designed.report.mode;saved.designFallback=designed.report.fallbackReason||null;
      latest.stage = latest.confirmed?.id === job.confirmedId && statusOf(latest).canGenerate ? 'generated' : 'planning';
    });
  } catch (error) {
    if(signal?.aborted)throw error;
    try{store.mutate(null, latest => {
      const saved=latest.generations.find(item=>item.id===jobId);if(saved && (!runId || saved.runId===runId))Object.assign(saved, { status: 'failed', completedAt: now(), failedStage:saved.progress?.stage,...publicError(error) }); latest.stage = 'planning';
    });}catch{/* The engine records a pending terminal state if storage is still
       unavailable. Preserve the original generation error, not the save error. */}
    throw error;
  }
}
function copyMigratedMedia(sourceDir, goal, outDir) {
  const refs = new Set();
  function visit(value) {
    if (typeof value === 'string' && /^(assets|images)\/.+\.(png|jpe?g|gif|webp|svg|mp4|mov)$/i.test(value)) refs.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  }
  goal.slides.forEach(slide => visit(slide.props));
  for (const relative of refs) {
    const target = path.resolve(outDir, relative);
    if (!target.startsWith(path.resolve(outDir) + path.sep)) throw new WorkbenchError('旧媒体路径越界，已阻止生成。', 422);
    if (fs.existsSync(target)) continue;
    const source = [path.resolve(sourceDir, 'ppt', relative), path.resolve(sourceDir, relative)].find(file => file.startsWith(path.resolve(sourceDir) + path.sep) && fs.existsSync(file));
    if (!source) throw new WorkbenchError(`旧项目媒体缺失：${relative}。原稿已保留，请补齐素材后重试。`, 422, 'LEGACY_MEDIA_MISSING');
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
  }
}
