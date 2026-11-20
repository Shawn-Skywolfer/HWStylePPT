#!/usr/bin/env node
import { existsSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, '..');
const projectRoot = path.resolve(process.env.DASHI_PPT_PROJECT_ROOT || path.join(skillRoot, 'project'));
const callerCwd = process.cwd();
const cliArgs = process.argv.slice(2);
const fastMode = cliArgs.includes('--fast');
const [specArg, outputArg] = cliArgs.filter(arg => arg !== '--fast');

if (!specArg || !outputArg) {
  console.error('Usage: node render_goal_deck.mjs <goal-spec.json> <output/ppt/index.html> [--fast]');
  process.exit(2);
}

const specPath = path.resolve(callerCwd, specArg);
const outputPath = path.resolve(callerCwd, outputArg);
if(fastMode){let spec;try{spec=JSON.parse(readFileSync(specPath,'utf8'));}catch(e){console.error(JSON.stringify({code:'GOAL_READ_FAILED',error:e.message}));process.exit(2);}if(spec.brief?.workflowMode==='fine'||process.env.DASHI_PPT_WORKFLOW_MODE==='fine'){console.error(JSON.stringify({code:'WORKFLOW_MODE_MISMATCH',error:'已选择精细模式，不能以 --fast 跳过脑图。请使用 scripts/content-workbench.mjs doctor 检查安装并修复；未经用户明确同意不得降级直出。'}));process.exit(2);}}
if (!fastMode) {
  const reviewDir = path.join(path.dirname(path.dirname(outputPath)), 'content-project');
  const cli = path.join(projectRoot, 'scripts/content-workbench.mjs');
  if (!existsSync(path.join(reviewDir, 'content-plan.json'))) {
    const imported = spawnSync(process.execPath, [cli, 'import-goal', '--project', reviewDir, '--goal', specPath], { cwd: callerCwd, stdio: 'inherit', windowsHide: true });
    if (imported.error || imported.status !== 0) process.exit(imported.status || 1);
  }
  const started = spawnSync(process.execPath, [cli, 'start', '--project', reviewDir], { cwd: callerCwd, stdio: 'inherit', windowsHide: true });
  process.exit(started.status || 0);
}
const npmCli = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')].find(file => file && existsSync(file));
const env = { ...process.env, INIT_CWD: callerCwd };

function run(args, { optional = false } = {}) {
  if (!npmCli) { console.error('Cannot locate npm-cli.js beside Node.js. Install a standard Node.js + npm distribution.'); process.exit(1); }
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: projectRoot,
    env,
    stdio: optional ? 'ignore' : 'inherit',
    shell: false,
    windowsHide: true,
    ...(optional ? { timeout: 25000 } : {}),
  });
  if (!optional && (result.error || result.status !== 0)) {
    if (result.error) console.error(result.error.message);
    process.exit(result.status || 1);
  }
}

function newer(left, right) {
  try {
    return statSync(left).mtimeMs > statSync(right).mtimeMs;
  } catch {
    return false;
  }
}

const modulesDir = path.join(projectRoot, 'node_modules');
const installMarker = path.join(modulesDir, '.package-lock.json');
const packageJson = path.join(projectRoot, 'package.json');
const packageLock = path.join(projectRoot, 'package-lock.json');
const requiredPackages = ['react', 'react-dom', 'tsx', 'esbuild', 'gsap', 'html-to-image', 'pptxgenjs', 'pdf-lib', 'playwright-core'];
const dependenciesReady = requiredPackages.every(name => existsSync(path.join(modulesDir, name, 'package.json')));
if (!dependenciesReady) {
  run(['install']);
}

run(['exec', '--', 'playwright-core', 'install', 'chromium-headless-shell'], { optional: true });
mkdirSync(path.dirname(outputPath), { recursive: true });
run(['run', 'props:safe', '--', '--goal', specPath, '--write']);
run(['run', 'validate:goal-spec', '--', specPath]);
run(['run', 'render:goal', '--', specPath, outputPath]);
run(['run', 'validate:swiss', '--', outputPath]);
run(['run', 'validate:goal-copy', '--', specPath, outputPath]);

const previewPort = process.env.DASHI_PPT_PREVIEW_PORT || '5388';
run(['run', 'preview:start', '--', path.dirname(outputPath), previewPort]);
