import test from 'node:test';import assert from 'node:assert/strict';
import {prepareContentDraft} from '../../scripts/content/capacity-plan.mjs';
import {compileContent} from '../../scripts/content/compile.mjs';
import {contentCandidates} from '../../scripts/content/catalog-match.mjs';
import {validateGoalSpec} from '../../scripts/validate-goal-spec.mjs';
const document={title:'知识复用',goal:'解释知识复用方式',audience:'内部同事',brief:{audience:'内部同事',occasion:'内部培训',priority:'解释完整，图文和多ICON优先',workflowMode:'fine',imagePolicy:'placeholders',confirmed:true},slides:[{slideId:'a',role:'body',title:'知识复用需要明确工作方式',visualIntent:'独立能力支柱，不要连成先后流程',blocks:[{blockId:'a1',label:'核验来源',text:'通过原始资料核验关键判断，保留引用与适用边界。'},{blockId:'a2',label:'形成问题',text:'围绕真实业务任务组织研究问题，避免脱离目标。'},{blockId:'a3',label:'持续更新',text:'把已确认的方法与反馈沉淀为可复用的工作流程。'}]},{slideId:'b',role:'body',title:'完整解释帮助同事独立应用',visualIntent:'图文解释，允许上传真实截图',blocks:[{blockId:'b1',label:'操作路径',text:'展示从材料到确认结果的操作路径。'},{blockId:'b2',label:'结果复核',text:'核对结论、证据与边界，不把候选当作最终答案。'}]}]};
test('fine mind-map draft and final generation share visual tiers and whole-deck choices',()=>{
 const before=structuredClone(document),fine=prepareContentDraft(document),compiled=compileContent(fine.document);
 assert.equal(fine.report.reviewCount,0);assert.equal(fine.report.visualPlanning.ok,true);
 for(const p of fine.report.visualPlanning.pages){assert.equal(compiled.goal.slides.find(s=>s.id===p.slideId).layout,p.layout);assert.equal(p.visual.priorityTier,0);}
 assert.deepEqual(document,before);
});
test('direct and fine modes have identical content-adaptation recommendations',()=>{
 const fine=prepareContentDraft(document),direct=prepareContentDraft({...document,brief:{...document.brief,workflowMode:'direct'}});
 assert.deepEqual(direct.report.visualPlanning,fine.report.visualPlanning);
 assert.ok(fine.report.pages[0].options.every(c=>c.visual&&Number.isFinite(c.visual.priorityTier)));
});
test('chart candidates cannot reintroduce labels rejected by final field contracts',()=>{
 const s={slideId:'labels',role:'body',title:'各市场价格存在差异',conclusion:'保留国家标签和当前价格。',visualIntent:'真实价格对比',blocks:[{blockId:'data',label:'零售柴油',text:'十个市场的当前价。',data:{kind:'bar',labels:['比利时','法国','葡萄牙','爱尔兰','奥地利','挪威','爱沙尼亚','克罗地亚','希腊','卢森堡'],values:[2.16,2.13,2.05,2.01,1.97,1.91,1.90,1.90,1.84,1.84],unit:'美元/L'}},{blockId:'explain',label:'口径',text:'按同一日期的零售报价比较，不据此判断税前成本。'},{blockId:'boundary',label:'边界',text:'仅复现原报告快照，保留来源与单位。'}]},d={...document,slides:[s]},r=contentCandidates(s,d);
 assert.ok(r.candidates.length);assert.ok(r.rejections.some(c=>c.code==='CANDIDATE_CONTRACT_FAILED'));
 for(const c of r.candidates)assert.deepEqual(validateGoalSpec({title:d.title,goal:d.goal,themePack:'theme17',slides:[{id:s.slideId,layout:c.layout,props:c.props}]}),[]);
});
