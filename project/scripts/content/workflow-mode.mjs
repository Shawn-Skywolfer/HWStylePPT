import {WorkbenchError} from './model.mjs';
export const MODE_QUESTION='是否启动精细模式（脑图模式），先梳理并微调内容？选择“是”进入脑图审稿；选择“否”采用直出模式，由 Agent 拆解、提炼内容后直接生成 PPT HTML 预览。';
export function workflowMode(value){const modes={fine:'fine',mindmap:'fine',yes:'fine',true:'fine','精细':'fine','脑图':'fine','是':'fine',direct:'direct',fast:'direct',no:'direct',false:'direct','直出':'direct','否':'direct'};return modes[String(value??'').trim().toLowerCase()]||'';}
export function requireWorkflowMode(value){const mode=workflowMode(value);if(!mode)throw new WorkbenchError(MODE_QUESTION,409,'WORKFLOW_MODE_REQUIRED');return mode;}
