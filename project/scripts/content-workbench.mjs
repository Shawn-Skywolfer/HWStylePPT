#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from './skill-workflow-utils.mjs';
import { ProjectStore, atomicJson,recordHistory } from './content/store.mjs';
import { statusOf, WorkbenchError,normalizeDocument } from './content/model.mjs';
import {matchDeck} from './content/catalog-match.mjs';
import { migrateGoal } from './content/compile.mjs';
import { makeTask, submitProposal, decideProposal, modelMessages } from './content/proposals.mjs';
import { prepareGeneration, executeGeneration } from './content/generation.mjs';
import { createWorkbenchServer } from './content/server.mjs';
import {createTaskEngine} from './content/task-engine.mjs';
import { openDefaultBrowser,inheritedProxyEnvironment } from './start-preview-server.mjs';
import {briefReady} from './content/brief.mjs';
import {documentToMarkdown,markdownToTree,treeToDocument} from './content/mindmap-model.mjs';
import {captureHostBinding} from './content/host-binding.mjs';
import {requireWorkflowMode,workflowMode,MODE_QUESTION} from './content/workflow-mode.mjs';
import {prepareContentDraft,createCapacityPlannedProject,assertCapacityReady} from './content/capacity-plan.mjs';
import {layoutContentContract,layoutContractIndex} from './content/layout-requirements.mjs';
import {capabilityCatalog,interpretationProposals} from './content/visual-strategy.mjs';
import {THEME_PAGES} from './skill-workflow-utils.mjs';

const args = parseArgs(process.argv.slice(2)), command = args._[0];
const projectDir = path.resolve(process.env.INIT_CWD || process.cwd(), args.project || 'output/content-project');
const store = new ProjectStore(projectDir);
const readJson = file => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const print = value => console.log(JSON.stringify(value, null, 2));
try {
  if(command==='design-catalog'){
    const catalog=capabilityCatalog(THEME_PAGES);if(args.plan)catalog.interpretationProposals=interpretationProposals(readJson(args.plan));print(catalog);
  }else if(command==='usage-report'){
    if(!args.plan)throw new WorkbenchError('需要 --plan <内容稿.json>');const report=matchDeck(normalizeDocument(readJson(args.plan))).utilization;if(args.out)atomicJson(path.resolve(args.out),report);print(report);
  }else if(command==='constraints'){
    const result=args.layout?layoutContentContract(args.layout):{version:1,layouts:layoutContractIndex()};if(!result)throw new WorkbenchError('未知版式 ID。',404,'LAYOUT_NOT_FOUND');print(result);
  }else if(command==='route'){
    const mode=workflowMode(args.mode);print(mode?{mode,next:mode==='fine'?'Agent 访谈 → 内容策划 → 脑图审稿 → PPT 预览':'Agent 访谈 → 拆解提炼与视觉编排 → 直接 PPT 预览',openMindmap:mode==='fine'}:{question:MODE_QUESTION,required:true,choices:[{id:'fine',label:'是，精细模式（脑图）'},{id:'direct',label:'否，直出模式'}]});
  }else if(command==='fit-plan'){
    if(!args.plan)throw new WorkbenchError('容量匹配需要 --plan <内容草稿.json>。');
    const fitted=prepareContentDraft(readJson(args.plan));if(args.out)atomicJson(path.resolve(args.out),fitted.document);print(fitted.report);
  }else if(command==='direct'){
    if(!args.plan)throw new WorkbenchError('直出模式需要 --plan <Agent 已完成拆解提炼的逐页内容.json>。');
    const doc=readJson(args.plan);if(args.brief)doc.brief=readJson(args.brief);if(doc.brief?.workflowMode==='fine')throw new WorkbenchError('草稿已记录精细模式，不能用 --mode direct 静默覆盖并跳过脑图。请先修复精细模式；只有用户明确同意切换后才更新需求记录。',409,'WORKFLOW_MODE_MISMATCH');requireBrief(doc);const mode=requireWorkflowMode(args.mode||doc.brief?.workflowMode);if(mode!=='direct')throw new WorkbenchError('精细模式请使用 create/start 进入脑图，不能通过 direct 绕过审稿。',409,'WORKFLOW_MODE_MISMATCH');doc.brief={...doc.brief,workflowMode:'direct'};
    const source=args.source?{fileName:path.basename(args.source),text:fs.readFileSync(path.resolve(args.source),'utf8')}:{input:String(args.input||'')};createCapacityPlannedProject(store,doc,source);
    const host=captureHostBinding(projectDir,{explicit:args.host||'',descriptor:args['host-file']?readJson(args['host-file']):null,command:args['host-command'],cwd:process.env.INIT_CWD||process.cwd(),skillFile:import.meta.filename});if(host?.kind==='opencode')process.env.DASHI_PPT_AGENT='opencode';
    assertCapacityReady(store.read().current);store.action(store.read().revision,'confirm');const confirmed=store.mutate(null,p=>{p.confirmed.reviewMode='direct';p.confirmed.confirmationSource='user-selected-agent-authored-direct-mode';}),prepared=prepareGeneration(store,confirmed.revision,{planner:args.planner||'rules'});
    const result=await executeGeneration(store,prepared.job.id,{preview:args['no-preview']!==true,onProgress:progress=>{console.log(`${progress.percent}% ${progress.detail}`);store.mutate(null,p=>{p.generations.find(g=>g.id===prepared.job.id).progress=progress;});}}),job=result.generations.find(g=>g.id===prepared.job.id);print({mode:'direct',status:job.status,previewUrl:job.previewUrl,projectDir,html:job.html});console.log(job.previewUrl?'DASHI_PPT_DIRECT_READY=1':'DASHI_PPT_DIRECT_RENDERED=1');
  }else if (command === 'create' || command === 'import-goal') {
    if (!args.plan && !args.goal) throw new WorkbenchError('创建需要 --plan <逐页内容.json>，旧项目导入需要 --goal <goal.json>。');
    let source = { input: String(args.input || '') };
    if (args.source) source = { ...source, fileName: path.basename(args.source), text: fs.readFileSync(path.resolve(args.source), 'utf8') };
    if (args.goal) { const goal=readJson(args.goal),migrated = migrateGoal(goal);if(args.brief)migrated.document.brief=readJson(args.brief);else if(goal.brief)migrated.document.brief=goal.brief;requireBrief(migrated.document);const mode=requireWorkflowMode(args.mode||migrated.document.brief?.workflowMode);if(mode!=='fine')throw new WorkbenchError('直出模式请使用 direct 或 render_goal_deck --fast，不打开脑图。',409,'WORKFLOW_MODE_MISMATCH');migrated.document.brief.workflowMode=mode;migrated.migration.sourceDir = path.dirname(path.resolve(args.goal)); print(store.create(migrated.document, source, { migration: migrated.migration })); }
    else {const doc=readJson(args.plan);if(args.brief)doc.brief=readJson(args.brief);requireBrief(doc);const mode=requireWorkflowMode(args.mode||doc.brief?.workflowMode);if(mode!=='fine')throw new WorkbenchError('请选择 direct 入口，直出模式不会启动脑图。',409,'WORKFLOW_MODE_MISMATCH');doc.brief.workflowMode=mode;print(createCapacityPlannedProject(store,doc,source));}
    captureHostBinding(projectDir,{explicit:args.host||'',descriptor:args['host-file']?readJson(args['host-file']):null,command:args['host-command'],cwd:process.env.INIT_CWD||process.cwd(),skillFile:import.meta.filename});
  } else if (command === 'get') print(store.read());
  else if (command === 'status') print(statusOf(store.read()));
  else if (command === 'write') print(store.edit(requireRevision(), readJson(args.plan)));
  else if(command==='export-markdown'){const markdown=documentToMarkdown(store.read().current);if(args.out){fs.writeFileSync(path.resolve(args.out),markdown);print({out:path.resolve(args.out)});}else console.log(markdown);}
  else if(command==='import-markdown'){if(!args.file)throw new WorkbenchError('需要 --file <content.md>。');const doc=treeToDocument(markdownToTree(fs.readFileSync(path.resolve(args.file),'utf8'),store.read().current));print(store.edit(requireRevision(),doc,'导入 Markdown 脑图'));}
  else if (['confirm', 'undo', 'redo', 'restore', 'checkpoint'].includes(command)) {if(command==='confirm')assertCapacityReady(store.read().current,args.slide);print(store.action(requireRevision(), command, { slideId: args.slide, id: args.id, label: args.label }));}
  else if (command === 'tasks') print(store.read().aiTasks.filter(task => ['pending','queued','paused'].includes(task.status)).map(task => ({ ...task, modelMessages: modelMessages(task) })));
  else if (command === 'request') print(store.mutate(requireRevision(), project => {recordHistory(project,'Agent 请求');project.aiTasks.push(makeTask(project, { ...readJson(args.request), bridge: true,execution:args.auto?'auto':'manual' }));}));
  else if (['pause','resume','cancel'].includes(command)) {const engine=createTaskEngine(store);try{print(store.mutate(requireRevision(),project=>engine.control(project,args.collection || 'aiTasks',args.task,command)));}finally{engine.close();}}
  else if (command === 'submit') print(store.mutate(requireRevision(), project => submitProposal(project, args.task, readJson(args.result))));
  else if (command === 'decide') print(store.mutate(requireRevision(), project => decideProposal(project, args.proposal, args.accept === true)));
  else if (command === 'generate') {
    const prepared = prepareGeneration(store, requireRevision(), { fast: args.fast === true,planner:args.planner||'rules' });
    print(statusOf(await executeGeneration(store, prepared.job.id, { preview: args['no-preview'] !== true })));
  } else if (command === 'serve') {
    requireBrief(store.read().current);
    const { server, token,readiness } = createWorkbenchServer(projectDir);
    // A killed host cannot silently leave an eternally-running job.
    if (store.read().aiTasks.some(task => task.status === 'running') || store.read().generations.some(job => job.status === 'running')) store.mutate(null, project => {
      project.aiTasks.filter(task => task.status === 'running').forEach(task => {let alive=Number(task.executorPid)>0;try{if(alive)process.kill(task.executorPid,0);}catch{alive=false;}if(!alive){task.status='paused';task.error='上次执行已中断，点击继续可重新运行。';}});
      for (const job of project.generations.filter(job => job.status === 'running')) {
        let alive = Number(job.executorPid || job.pid)>0; try { if(alive)process.kill(job.executorPid || job.pid, 0); } catch { alive = false; }
        if (!alive) { job.status = 'paused'; job.error = '上次生成进程已结束，点击继续可恢复。'; }
      }
    });
    const basePort = Number(args.port || process.env.DASHI_CONTENT_PORT || 5490);
    if (!Number.isInteger(basePort) || basePort < 5200 || basePort > 5999) throw new WorkbenchError('工作台端口需要在 5200–5999 之间。');
    const lastPort = Math.min(basePort + 100, 6000);
    let port = basePort;
    for (; port < lastPort; port++) {
      try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); break; }
      catch (error) { if (error.code !== 'EADDRINUSE') throw error; }
      finally { server.removeAllListeners('error'); }
    }
    if (port === lastPort) throw new WorkbenchError('没有可用工作台端口。');
    const url = `http://127.0.0.1:${port}/#token=${token}`;
    atomicJson(path.join(projectDir, '.private', 'workbench-server.json'), { pid: process.pid, port, url });
    console.log(`内容策划工作台：${url}`);
    console.log('项目已持久保存。此服务可独立运行，Agent 无需等待用户完成审核。');
    const execution=await readiness;console.log(`DASHI_CONTENT_CHILD_PROCESS_READY=${execution.canSpawn?1:0}`);if(!execution.canSpawn)console.warn(execution.message+' 脑图仍可编辑；生成和自动桥接须先恢复执行权限。');
    if (args['no-open'] !== true && process.env.DASHI_PPT_AUTO_OPEN !== '0') {
      const opened = await openDefaultBrowser(url); if (!opened.ok) console.warn('自动打开浏览器失败，请手动打开以上地址。');
    }
  } else if (command === 'start') {
    requireBrief(store.read().current);
    captureHostBinding(projectDir,{explicit:args.host||'',descriptor:args['host-file']?readJson(args['host-file']):null,command:args['host-command'],cwd:process.env.INIT_CWD||process.cwd(),skillFile:import.meta.filename});
    const stateFile = path.join(projectDir, '.private', 'workbench-server.json');
    let reuse = null;
    try { const state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); process.kill(state.pid, 0); const response = await fetch(`http://127.0.0.1:${state.port}/api/status`, { headers: { 'x-workbench-token': new URLSearchParams(new URL(state.url).hash.slice(1)).get('token') }, signal: AbortSignal.timeout(2000) }); if (response.ok) reuse = state; } catch {}
    if (reuse) { if (!args['no-open'] && process.env.DASHI_PPT_AUTO_OPEN !== '0') await openDefaultBrowser(reuse.url); console.log(`内容策划工作台：${reuse.url}`); }
    else {
      fs.mkdirSync(path.join(projectDir, '.private'), { recursive: true });
      const log = fs.openSync(path.join(projectDir, '.private', 'workbench.log'), 'a');
      const child = spawn(process.execPath, [import.meta.filename, 'serve', '--project', projectDir, ...(args.port ? ['--port', String(args.port)] : []), ...(args['no-open'] ? ['--no-open'] : [])], { detached: true, windowsHide: true, env:inheritedProxyEnvironment(), stdio: ['ignore', log, log] });
      child.unref(); fs.closeSync(log);
      let ready = null;
      for (let i = 0; i < 80; i++) { try { const state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); if (state.pid === child.pid) { ready = state; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
      if (!ready) throw new WorkbenchError('工作台启动失败，请检查项目 .private/workbench.log。');
      console.log(`内容策划工作台：${ready.url}`);
    }
    console.log(`DASHI_CONTENT_REVIEW_READY=1\nPROJECT_DIR=${projectDir}\n内容审稿待用户操作，当前 Agent 任务可结束；确认和生成由工作台完成。`);
  } else {
    console.log('Usage: node scripts/content-workbench.mjs <route|direct|create|import-goal|get|status|write|confirm|undo|redo|restore|checkpoint|tasks|request|submit|decide|pause|resume|cancel|generate|start|serve> --project <dir>\n先问模式：route；精细：create --mode fine --plan <content-draft.json> 后 start；直出：direct --mode direct --plan <Agent已提炼内容.json> --host <原宿主>\n修改命令必须带 --revision <当前revision>；任务控制：pause/resume/cancel --task <id> [--collection aiTasks|generations]；桥接 request --auto 自动执行（需工作台服务运行）\n已有项目恢复：start [--port 5490] [--no-open]，不重复询问模式；传统 goal 直出入口使用 render_goal_deck.mjs --fast');
    if(!command||command==='help')console.log('容量预匹配：fit-plan --plan draft.json [--out fitted.json]；create/direct 自动匹配并保留原稿。严格单页写 slide.pagination=single；固定页数写 brief.pagination=fixed。');
    if (command && command !== 'help') process.exitCode = 2;
  }
} catch (error) { console.error(JSON.stringify({ error: error.message, code: error.code || 'ERROR' })); process.exitCode = 1; }
function requireRevision() {
  const revision = Number(args.revision);
  if (!Number.isInteger(revision) || revision < 1) throw new WorkbenchError('修改前先读取项目，并提供 --revision <当前revision> 进行冲突检查。');
  return revision;
}
function requireBrief(doc){if(!briefReady(doc))throw new WorkbenchError('请先在 Agent 对话框中完成受众、使用场合、最重要要求的问答，再根据回答生成内容草稿并打开脑图。需要 brief.audience / occasion / priority 和 confirmed:true；不要在浏览器中补做首次访谈。',409,'AGENT_INTAKE_REQUIRED');}
