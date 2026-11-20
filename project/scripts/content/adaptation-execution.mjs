import {adaptationMessages,validateAdaptation,assertAdaptationPreflight} from './layout-adaptation.mjs';
const repairable=new Set(['ADAPTATION_REVIEW_REQUIRED','ADAPTATION_RELATION_UNRESOLVED','LAYOUT_RELATION_APPROVAL_REQUIRED','RENDERED_CONTENT_FAILED']);
export async function adaptWithRenderedValidation({document,target,request,render,signal,options={},onAttempt=()=>{},onRejected=()=>{}}){
 assertAdaptationPreflight(document,target,options);let feedback='';
 for(let attempt=0;attempt<2;attempt++){
  signal.throwIfAborted();onAttempt(attempt);const result=await request(adaptationMessages(document,target,{...options,feedback}),attempt);signal.throwIfAborted();
  try{const planned=validateAdaptation(document,result,target,options),rendered=await render(planned,attempt);signal.throwIfAborted();return {...planned,rendered};}
  catch(error){signal.throwIfAborted();if(!repairable.has(error.code))throw error;onRejected(error,attempt);if(attempt===1)throw error;feedback=JSON.stringify({code:error.code,message:error.message,previousCandidate:result,issues:error.details?.bindingIssues||error.details?.rejections||error.details?.relations||[],relationChange:error.details?.relationChange,expected:error.details?.expected,capacity:error.details?.capacity,rule:error.code==='LAYOUT_RELATION_APPROVAL_REQUIRED'?'这是未授权的关系改变，不是字数问题。恢复 original.board 的关系模式，按 originMap 保留全部原关系和标签；不要新增关系。未获授权，不得自行改为并列、合并相连步骤或删除关系。无法保留时明确停止，不能绕过授权。':error.code==='ADAPTATION_RELATION_UNRESOLVED'?'这是关系去向问题，不是字数问题。将缺失的关系落实为可见正文与 relationMap，保留原意后提交完整候选。':'基于 previousCandidate 修正 issues 指定字段，返回完整候选。先满足每区 key/min/max 和 origin.presentation，再核对几何空间；不能只反复缩短文字。仍保留原始数字、来源、所有原块去向和目标原稿样式；不缩字、不截断，不改目标版式。'});}
 }
}
