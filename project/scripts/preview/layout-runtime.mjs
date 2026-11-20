import fs from 'node:fs';import path from 'node:path';
import {WorkbenchError} from '../content/model.mjs';
export const LAYOUT_PROTOCOL=2;
export function layoutRuntime(root){let version='unknown';try{version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;}catch{}
 return {protocol:LAYOUT_PROTOCOL,version,features:['relation-preflight','relation-confirmation','automatic-recovery-dialog','failure-recovery-plans','option-based-adaptation','visible-task-progress','canonical-edit-guard','explicit-apply-conflict','renderer-region-contracts','candidate-aware-repair','cross-region-occlusion-check','chart-caption-headroom']};
}
export function requireLayoutProtocol(input){if(input.layoutProtocol!==LAYOUT_PROTOCOL)throw new WorkbenchError('控制台页面与预览服务版本不一致。请先刷新页面后重试；尚未调用模型，原页面保持不变。',409,'LAYOUT_CLIENT_OUTDATED');}
