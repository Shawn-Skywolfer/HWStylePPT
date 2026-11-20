import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeDocument} from '../../scripts/content/model.mjs';
import {adaptationTargets,validateAdaptation,adaptationMessages} from '../../scripts/content/layout-adaptation.mjs';
import {adaptWithRenderedValidation} from '../../scripts/content/adaptation-execution.mjs';
import {validateRelationMapping,assertRelationApproval,relationChangeRequired} from '../../scripts/content/adaptation-relations.mjs';
const fixture=()=>normalizeDocument({title:'证据闭环',brief:{imagePolicy:'placeholders'},slides:[{slideId:'s',role:'body',title:'证据核验需要完整流程',conclusion:'保留先后关系。',visualIntent:'真实步骤链',board:{mode:'flow'},blocks:['提出问题','寻找材料','查找缺口','核验结论'].map((label,i)=>({blockId:'b'+i,label,text:'明确业务要求，保留可追溯的证据与解释。',evidence:'内部资料'}))}]});
const proposal=d=>{const slide=structuredClone(d.slides[0]);slide.board={mode:'columns',nodes:[],edges:[]};slide.blocks=slide.blocks.slice(0,3);slide.evidence='内部资料';slide.blocks.forEach(b=>b.evidence='');const relationMap=d.slides[0].board.edges.map((e,i)=>{const from=d.slides[0].blocks[i],to=d.slides[0].blocks[i+1],text='完成'+from.label+'后，再进行'+to.label+'。';slide.blocks[i].text+='\n'+text;return {from:from.blockId,to:to.blockId,kind:e.kind,disposition:'text',blockId:from.blockId,text};});return {operations:[{op:'replaceSlide',slideId:'s',slide}],originMap:slide.blocks.map((b,i)=>({blockId:b.blockId,sourceBlockIds:i===2?['b2','b3']:[b.blockId]})),relationMap};};
test('flow to pictorial columns requires explicit relation approval before any model call',async()=>{
 const d=fixture(),t=adaptationTargets(d.slides[0],d).find(t=>t.id==='theme17_content_icon_media');assert.ok(t);assert.equal(t.requiresRelationChange,true);assert.equal(t.boardMode,'columns');let calls=0;
 await assert.rejects(adaptWithRenderedValidation({document:d,target:t,signal:new AbortController().signal,request:async()=>{calls++;return proposal(d);},render:async()=>({})}),e=>e.code==='LAYOUT_RELATION_APPROVAL_REQUIRED');assert.equal(calls,0);
 assert.throws(()=>adaptationMessages(d,t),e=>e.code==='LAYOUT_RELATION_APPROVAL_REQUIRED');
});
test('approved relation adaptation keeps every source edge as visible, reviewable text',()=>{
 const d=fixture(),t=adaptationTargets(d.slides[0],d).find(t=>t.id==='theme17_content_icon_media'),before=structuredClone(d),r=validateAdaptation(d,proposal(d),t,{allowRelationChange:true});
 assert.equal(r.candidate.layout,t.id);assert.equal(r.candidate.plan.mediaCount,1);assert.equal(r.review.relationReview.relationMap.length,3);assert.equal(r.review.relationReview.requiresHumanReview,true);assert.deepEqual(d,before);
 const prompt=JSON.parse(adaptationMessages(d,t,{allowRelationChange:true})[1].content);assert.equal(prompt.allowRelationChange,true);assert.equal(prompt.sourceRelations.length,3);
});
test('approval does not allow silently deleting, hiding or misattributing a relation',()=>{
 const d=fixture(),t=adaptationTargets(d.slides[0],d).find(t=>t.id==='theme17_content_icon_media');for(const mutate of [r=>r.relationMap.pop(),r=>r.relationMap[0].text='没有出现在正文的关系句。',r=>r.relationMap[0].blockId='b3']){const r=proposal(d);mutate(r);assert.throws(()=>validateAdaptation(d,r,t,{allowRelationChange:true}),e=>e.code==='ADAPTATION_RELATION_UNRESOLVED');}
});
test('compatible flow targets retain relation mode and never inherit a columns probe contract',()=>{
 const d=fixture(),t=adaptationTargets(d.slides[0],d).find(t=>t.id==='theme17_content_icon_steps');assert.ok(t);assert.equal(t.requiresRelationChange,false);assert.equal(t.boardMode,'flow');assert.equal(t.preserveRelations,true);assert.deepEqual(t.counts,[4]);
 const slide=structuredClone(d.slides[0]),r={operations:[{op:'replaceSlide',slideId:'s',slide}],originMap:slide.blocks.map(b=>({blockId:b.blockId,sourceBlockIds:[b.blockId]}))};assert.equal(validateAdaptation(d,r,t).candidate.layout,t.id);
});
test('unapproved extra connectors and changed connector labels cannot slip through existing-edge checks',()=>{
 const original=fixture().slides[0],slide=structuredClone(original),originMap=slide.blocks.map(b=>({blockId:b.blockId,sourceBlockIds:[b.blockId]}));slide.board.edges.push({from:'block:b3',to:'block:b0',kind:'sequence',label:''});assert.throws(()=>validateRelationMapping(original,slide,{originMap}),e=>e.code==='LAYOUT_RELATION_APPROVAL_REQUIRED');slide.board.edges.pop();slide.board.edges[0].label='新增关系';assert.throws(()=>validateRelationMapping(original,slide,{originMap}),e=>e.code==='LAYOUT_RELATION_APPROVAL_REQUIRED');
});
test('known regroup and role incompatibilities stop before invoking a model',async()=>{
 const document=fixture();let calls=0;const request=async()=>{calls++;};for(const [target,options,code] of [[{id:'x',boardMode:'flow',preserveRelations:true,counts:[2]},{allowRegroup:false},'LAYOUT_REGROUP_APPROVAL_REQUIRED'],[{id:'x',boardMode:'flow',preserveRelations:true,counts:[4],requiresRoleChange:true},{},'LAYOUT_ROLE_APPROVAL_REQUIRED']])await assert.rejects(adaptWithRenderedValidation({document,target,options,request,render:async()=>({}),signal:new AbortController().signal}),e=>e.code===code);assert.equal(calls,0);
});
test('all probed targets require approval when their counts cannot retain source edges, including one-card media probes',()=>{
 const d=fixture(),targets=adaptationTargets(d.slides[0],d),media=targets.find(t=>t.id==='theme17_page026');assert.ok(media);assert.equal(media.boardMode,'columns');assert.equal(media.requiresRelationChange,true);
 for(const target of targets){if(!target.preserveRelations&&(target.boardMode!=='flow'||target.regionGroups?.length>1||!target.counts.includes(4)))assert.equal(target.requiresRelationChange,true,target.id);}
 const stale={...media,boardMode:'flow',counts:[1],requiresRelationChange:false};assert.equal(relationChangeRequired(d.slides[0],stale),true);assert.throws(()=>assertRelationApproval(d,stale),e=>e.code==='LAYOUT_RELATION_APPROVAL_REQUIRED');
});
test('unexpected model relation changes get one bounded repair without granting permission',async()=>{
 const d=fixture(),target=adaptationTargets(d.slides[0],d).find(t=>t.id==='theme17_content_icon_steps'),messages=[];let rendered=0;
 const result=await adaptWithRenderedValidation({document:d,target,signal:new AbortController().signal,request:async m=>{messages.push(JSON.parse(m[1].content));const slide=structuredClone(d.slides[0]);if(messages.length===1)slide.board.edges=[];return {operations:[{op:'replaceSlide',slideId:'s',slide}],originMap:slide.blocks.map(b=>({blockId:b.blockId,sourceBlockIds:[b.blockId]}))};},render:async()=>{rendered++;return {ok:true};}});
 assert.equal(messages.length,2);assert.equal(rendered,1);assert.equal(result.rendered.ok,true);assert.equal(messages[1].allowRelationChange,false);assert.match(messages[1].feedback,/LAYOUT_RELATION_APPROVAL_REQUIRED/);assert.match(messages[1].feedback,/恢复 original.board/);
});
test('repeated unauthorized relation changes preserve the source and expose a content-free confirmation recovery',async()=>{
 const d=fixture(),before=structuredClone(d),target=adaptationTargets(d.slides[0],d).find(t=>t.id==='theme17_content_icon_steps');let calls=0,renders=0;
 await assert.rejects(adaptWithRenderedValidation({document:d,target,signal:new AbortController().signal,request:async()=>{calls++;const slide=structuredClone(d.slides[0]);slide.board.edges=[];return {operations:[{op:'replaceSlide',slideId:'s',slide}],originMap:slide.blocks.map(b=>({blockId:b.blockId,sourceBlockIds:[b.blockId]}))};},render:async()=>{renders++;}}),e=>{assert.equal(e.code,'LAYOUT_RELATION_APPROVAL_REQUIRED');assert.equal(e.details.recovery,'review-relations');assert.equal(e.details.relationChange.removed.length,3);assert.ok(!JSON.stringify(e.details).includes('明确业务要求'));return true;});assert.equal(calls,2);assert.equal(renders,0);assert.deepEqual(d,before);
});
