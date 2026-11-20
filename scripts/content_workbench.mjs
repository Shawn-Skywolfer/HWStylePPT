#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'content-workbench.mjs');
if(!fs.existsSync(entry)){console.error(JSON.stringify({ok:false,code:'SKILL_INSTALL_INCOMPLETE',missing:entry,error:'缺少统一入口。请重新完整解压同一版本安装包；精细模式不得擅自切为直出。'},null,2));process.exitCode=2;}
else (await import(pathToFileURL(entry))).runWorkbench();
