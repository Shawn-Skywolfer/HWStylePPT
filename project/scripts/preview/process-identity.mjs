import {execFileSync} from 'node:child_process';import path from 'node:path';
let cached=null;
export function parseProcessSnapshot(text){const value=JSON.parse(String(text).replace(/^\uFEFF/,'')),rows=Array.isArray(value)?value:value?[value]:[];return new Map(rows.filter(r=>Number.isInteger(r.ProcessId)&&typeof r.CommandLine==='string').map(r=>[r.ProcessId,r.CommandLine]));}
export function previewProcessSnapshot({run=execFileSync,now=Date.now,executable=process.execPath}={}){
 const time=now();if(cached&&cached.run===run&&cached.exe===executable&&time-cached.time<1500)return cached.rows;
 const name=path.win32.basename(executable);if(!/^[a-zA-Z0-9_.-]+$/.test(name))throw Error('Unexpected executable name');
 const command=`[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); @(Get-CimInstance Win32_Process -Filter \"Name = '${name}'\" | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress`;
 const text=run('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:10000,stdio:['ignore','pipe','ignore']}),rows=parseProcessSnapshot(text||'[]');cached={run,exe:executable,time,rows};return rows;
}
export function readProcessCommandLine(pid,{platform=process.platform,run=execFileSync}={}){
 if(!Number.isInteger(pid)||pid<=0)return '';
 try{return platform==='win32'?previewProcessSnapshot({run}).get(pid)||'':run('ps',['-p',String(pid),'-o','command='],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return '';}
}
export function matchesPreviewRoot(commandLine,root){const line=String(commandLine).replaceAll('\\','/').toLowerCase(),resolved=String(root).replaceAll('\\','/').toLowerCase();return /serve-preview-https\.mjs/.test(line)&&(line.includes(' '+resolved+' ')||line.includes('"'+resolved+'"'));}
