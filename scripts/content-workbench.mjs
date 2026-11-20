#!/usr/bin/env node
// Public entry and dependency-free installation doctor. Resolve from this file,
// never from the caller's cwd, PATH or an unrelated installed skill.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';

export const skillRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const essential=['SKILL.md','scripts/content-workbench.mjs','scripts/content_workbench.mjs','project/package.json','project/scripts/content-workbench.mjs','project/examples/content-demo.json','references/content-mindmap.md','project/assets/content-workbench/mindmap.html','project/assets/content-workbench/mindmap-app.js','project/scripts/content/server.mjs'];
const packages=['react','react-dom','tsx','esbuild','gsap','html-to-image','pptxgenjs','pdf-lib','playwright-core'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const inside=(root,file)=>file.startsWith(root+path.sep);
export function inspectInstallation(root=skillRoot){
 root=path.resolve(root);const issues=[],warnings=[],files=[];
 const issue=(code,message,relative)=>issues.push({code,message,...(relative?{path:relative}:{})});
 let version=null,pkg;try{pkg=JSON.parse(fs.readFileSync(path.join(root,'project/package.json'),'utf8'));version=pkg.version;}catch{issue('SKILL_PACKAGE_METADATA_MISSING','找不到或无法读取 project/package.json；请核对当前加载的 SKILL.md 所在目录。','project/package.json');}
 const major=Number(process.versions.node.split('.')[0]);if(major<22)issue('NODE_VERSION_UNSUPPORTED','需要 Node.js 22 或以上。请使用已确认的 Node.js 绝对路径，不要更换所选工作模式。');
 const manifestFile=path.join(root,'installation-manifest.json');let manifest;
 try{manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));if(manifest.format!==1||!manifest.files||typeof manifest.files!=='object'||Array.isArray(manifest.files))throw new Error('invalid');if(essential.some(p=>typeof manifest.files[p]!=='string'))issue('SKILL_MANIFEST_INVALID','安装清单未覆盖必要组件，请重新完整解压安装包。','installation-manifest.json');if(manifest.version!==version)issue('SKILL_VERSION_MIXED','安装清单与运行包版本不一致，可能混用了不同版本文件。','installation-manifest.json');}
 catch{issue('SKILL_MANIFEST_MISSING','安装清单缺失或损坏。请重新完整解压新版安装包，不要只复制 SKILL.md。','installation-manifest.json');}
 const entries=new Map(essential.map(p=>[p,null]));if(manifest)for(const [p,hash]of Object.entries(manifest.files))entries.set(p,hash);
 let realRoot;try{realRoot=fs.realpathSync(root);}catch{}
 for(const [relative,expected]of entries){
  const absolute=path.resolve(root,relative);if(!/^[\x20-\x7e]+$/.test(relative)||relative.includes('\\')||path.isAbsolute(relative)||relative.split('/').includes('..')||!inside(root,absolute)){issue('SKILL_MANIFEST_INVALID','安装清单包含不安全路径。');continue;}
  let status='ok';try{if(!fs.statSync(absolute).isFile())throw new Error('not file');if(realRoot&&!inside(realRoot,fs.realpathSync(absolute))){status='outside-root';issue('SKILL_FILE_OUTSIDE_ROOT','组件实际指向 Skill 目录以外；请使用完整独立安装。',relative);}else if(expected&&(!/^[a-f0-9]{64}$/.test(expected)||sha(fs.readFileSync(absolute))!==expected)){if(relative==='project/package-lock.json'&&/^[a-f0-9]{64}$/.test(expected)){status='dependency-lock-updated';warnings.push({code:'DEPENDENCY_LOCK_UPDATED',path:relative,message:'依赖锁文件发生变化，可能由正常 npm 安装更新；不作为脚本损坏。运行包版本与其余组件仍严格检查。'});}else{status='modified';issue('SKILL_FILE_MISMATCH','文件与该版本安装清单不一致，可能解压不完整、混用版本或被修改。',relative);}}}
  catch{status='missing';issue('SKILL_FILE_MISSING','缺少必要文件，请从同一版本 ZIP 恢复，不要自行编造替代脚本。',relative);}
  files.push({path:relative,status});
 }
 const dependencies=packages.map(name=>{try{createRequire(path.join(root,'project/package.json')).resolve(name);return {name,available:true};}catch{return {name,available:false};}});
 if(dependencies.some(p=>!p.available))warnings.push({code:'GENERATION_DEPENDENCIES_MISSING',message:'生成/导出依赖尚未齐全。脑图可在安装文件完整时打开；生成前需准备 project 依赖。内网请使用批准的镜像或离线依赖，不自动联网安装。'});
 const ok=issues.length===0;
 return {ok,code:ok?'SKILL_INSTALL_OK':'SKILL_INSTALL_INCOMPLETE',skillRoot:root,version,node:{version:process.version,executable:process.execPath,supported:major>=22},entrypoints:{canonical:path.join(root,'scripts/content-workbench.mjs'),legacyAlias:path.join(root,'scripts/content_workbench.mjs'),implementation:path.join(root,'project/scripts/content-workbench.mjs'),example:path.join(root,'project/examples/content-demo.json')},manifest:{present:!!manifest,checkedFiles:files.length},files:files.filter(f=>f.status!=='ok'),issues,warnings,dependencies,readyForFineReview:ok,readyForGeneration:ok&&dependencies.every(p=>p.available),browserExportCheck:'not-run',repair:ok?[]:['以当前加载的 SKILL.md 所在目录作为 Skill 根目录；若当前指向 project 子目录，请返回上一级核对。','从可信的同一版本完整 ZIP 重新解压，保留项目输出，不合并不同版本的 Skill 文件。','使用上面 node.executable 的绝对路径执行 scripts/content-workbench.mjs doctor，再按结果继续。','用户已选择精细模式时保持精细模式；未经用户同意不得改为直出，也不得称两者效果相同。']};
}
export function runWorkbench(args=process.argv.slice(2)){
 const command=args[0];if(command==='doctor'){
  const at=args.indexOf('--root'),root=at<0?skillRoot:args[at+1];if(!root){console.error(JSON.stringify({ok:false,code:'DOCTOR_ARGUMENT_INVALID',error:'--root 需要 Skill 根目录'}));process.exitCode=2;return;}
  const report=inspectInstallation(root);console.log(JSON.stringify(report,null,2));process.exitCode=report.ok?0:2;return;
 }
 const report=inspectInstallation();if(!report.ok){console.error(JSON.stringify({...report,error:'安装自检未通过，尚未创建草稿或切换模式。请先修复安装。'},null,2));process.exitCode=2;return;}
 const child=spawn(process.execPath,[path.join(skillRoot,'project/scripts/content-workbench.mjs'),...args],{stdio:'inherit',windowsHide:true});
 child.on('error',e=>{console.error(JSON.stringify({code:'WORKBENCH_START_FAILED',error:e.message,skillRoot,node:process.execPath,modeUnchanged:true}));process.exitCode=1;});child.on('close',(code,signal)=>{process.exitCode=typeof code==='number'?code:signal?1:0;});
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url)))runWorkbench();
