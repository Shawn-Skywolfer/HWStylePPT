export const ADAPTATION_CHOICES={
 regroup:{zh:'按新版式整理',en:'Reorganize content',hintZh:'保留观点和解释，调整内容组织。',hintEn:'Keep the reasoning; reorganize the content.',prompt:'按目标版式重新组织内容。保留全部业务观点、必要解释、数字、来源与边界；只消除重复，不把正文压缩为口号。'},
 concise:{zh:'精简重复内容',en:'Remove repetition',hintZh:'合并重复表述，保留完整论证。',hintEn:'Merge repetition without losing the argument.',prompt:'优先去除重复表述、压缩冗余句式，保留独立观点、解释、案例、数字、来源及限定条件；不要为了适配模板删掉必要内容。'},
};
export function adaptationProblem(code,en=false){
 let pair;
 if(/RELATION/.test(code||''))pair=['原有流程或层次没有完整保留','The original flow or hierarchy was not fully retained'];
 else if(/TIMEOUT|TIMED_OUT/.test(code||''))pair=['AI 本次处理超时','The AI took too long this time'];
 else if(/CAPACITY|OVERFLOW|RENDERED_CONTENT|ADAPTATION_REVIEW/.test(code||''))pair=['内容还不适合所选版式','The content does not fit this layout yet'];
 else if(/OUTDATED|PROTOCOL/.test(code||''))pair=['页面需要刷新','Refresh this page'];
 else if(/BRIDGE|MODEL_NOT|AGENT|PROVIDER/.test(code||''))pair=['AI 连接暂时不可用','The AI connection is unavailable'];
 else if(/NETWORK|CONNECTION|FETCH/.test(code||''))pair=['与预览服务的连接中断','Connection to the preview service was interrupted'];
 else pair=['这次没有生成可用的候选页','No usable candidate was generated this time'];
 return pair[en?1:0];
}
export function adaptationStage(job,en=false){
 const s=job?.status,stage=job?.stage||'';let pair;
 if(s==='queued')pair=['排队中','Queued'];else if(s==='paused')pair=['已暂停','Paused'];else if(s==='cancelled')pair=['已取消，原页保留','Cancelled; original retained'];else if(s==='applied')pair=['已应用','Applied'];else if(s==='proposed')pair=['候选已就绪','Candidate ready'];else if(s==='ready')pair=['正在保存','Saving'];else if(s==='failed')return adaptationProblem(job.errorCode,en);
 else if(stage==='browser-check'||stage==='structure-check')pair=['检查页面效果','Checking the rendered slide'];else if(stage==='rendering')pair=['生成页面','Rendering the slide'];else if(stage==='candidate-check')pair=['核对内容','Checking content'];else if(stage.startsWith('agent'))pair=['AI 正在整理内容','AI is adapting the content'];else pair=['准备生成','Preparing'];
 return pair[en?1:0];
}
export function adaptationChoicePrompt(choice){if(!ADAPTATION_CHOICES[choice])throw new Error('Unknown adaptation choice');return ADAPTATION_CHOICES[choice].prompt;}
if(typeof window!=='undefined')window.__adaptationUX={choices:ADAPTATION_CHOICES,problem:adaptationProblem,stage:adaptationStage,prompt:adaptationChoicePrompt};
if(typeof document!=='undefined'){
 const style=document.createElement('style');style.textContent=`
 #layout-review[data-adapt-view]{margin:auto;border:1px solid var(--pp-border,#ddd);border-radius:16px;padding:28px;max-height:90vh;overflow:auto;font:14px/1.55 Arial,'Microsoft YaHei',sans-serif;box-sizing:border-box}
 #layout-review[data-adapt-view=configure],#layout-review[data-adapt-view=recovery],#layout-review[data-adapt-view=progress],#layout-review[data-adapt-view=applying]{width:min(640px,94vw)}
 #layout-review[data-adapt-view] h2{font-size:22px;line-height:1.3;margin:0}#layout-review[data-adapt-view] p:empty{display:none}
 .adapt-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:24px}.adapt-dialog-head>button{flex-shrink:0}.adapt-target{margin:7px 0 0;color:var(--pp-muted,#666)}
 #layout-review .adapt-picks{border:0;padding:0;margin:0 0 20px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.adapt-picks legend{font-weight:600;padding:0;margin-bottom:10px}
 #layout-review .adapt-choice{display:flex;align-items:center;gap:10px;padding:16px;border:1px solid var(--pp-border,#ddd);border-radius:10px;cursor:pointer;position:relative;background:var(--pp-bg,#fff)}#layout-review .adapt-choice:has(input:checked){border-color:#139a76;background:#f1fbf7}#layout-review .adapt-choice input{accent-color:#139a76;margin:0;width:18px;height:18px;min-width:18px;padding:0;flex:0 0 18px}#layout-review .adapt-choice>span:not(.adapt-info){flex:1;min-width:0;white-space:nowrap}
 .adapt-info{margin-left:auto;color:#777;cursor:help;position:relative}.adapt-info:after{content:attr(aria-label);display:none;position:absolute;z-index:2;right:0;top:25px;width:220px;padding:10px 12px;background:#222;color:#fff;border-radius:8px;font-size:12px}.adapt-info:hover:after,.adapt-info:focus:after{display:block}.adapt-info:focus-visible{outline:2px solid #139a76;outline-offset:3px}
 #layout-review .adapt-consent{display:flex;align-items:flex-start;gap:9px;margin:14px 0}.adapt-consent input{margin-top:5px;accent-color:#139a76}
 #layout-review .adapt-advanced{margin:22px 0;border-top:1px solid var(--pp-border,#eee);padding-top:16px}.adapt-advanced summary{cursor:pointer}.adapt-advanced-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.adapt-advanced-grid label{display:flex;flex-direction:column;gap:6px}
 #layout-review .adapt-problem{padding:12px 14px;margin:0 0 20px;background:#fff7ee;border-radius:9px;color:#854e11}
 #layout-review .adapt-dialog-footer{border-top:1px solid var(--pp-border,#eee);padding-top:18px;margin-top:24px}.adapt-dialog-footer>p{font-size:12px;color:var(--pp-muted,#666);margin:0 0 16px}.adapt-dialog-footer>div{display:flex;gap:10px;justify-content:flex-end}
 #layout-review #adapt-config-error,#adapt-progress-error{color:#b42318;margin:12px 0}#layout-review progress{width:100%;height:8px;accent-color:#139a76}#adapt-progress-stage{font-size:18px;margin:26px 0 16px}#adapt-progress-time{color:var(--pp-muted,#666);font-variant-numeric:tabular-nums}.adapt-progress-actions{display:flex;gap:10px;margin-top:24px}
 #layout-review[data-adapt-view=review]{width:min(1200px,94vw)}#layout-review .adapt-review-actions{display:flex;justify-content:flex-end;gap:10px;margin:20px 0}.adapt-review-more{border-top:1px solid var(--pp-border,#eee);padding-top:16px}.adapt-review-more summary{cursor:pointer}#layout-review #adapt-conflict-replace{background:#c7000b;border-color:#c7000b;color:#fff}.adapt-conflict-list{padding-left:20px;margin:0 0 20px}.adapt-conflict-note{color:var(--pp-muted,#666);font-size:13px}
 @media(max-width:560px){#layout-review .adapt-picks,.adapt-advanced-grid{grid-template-columns:1fr}#layout-review[data-adapt-view]{padding:20px}}
 `;document.head.append(style);
}
