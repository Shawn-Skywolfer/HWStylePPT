import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeDocument} from '../../scripts/content/model.mjs';
import {contentCandidates} from '../../scripts/content/catalog-match.mjs';
import {adaptationTargets,adaptationMessages,validateAdaptation} from '../../scripts/content/layout-adaptation.mjs';
import {iconGeometry,iconCapacityProfiles} from '../../assets/huawei-icon-layout.mjs';
import {ICON_TYPES} from '../../assets/huawei-icons.mjs';
const fixture=()=>normalizeDocument({title:'业务协同',brief:{imagePolicy:'none'},slides:[{slideId:'geometry',role:'body',title:'日常应用与进阶共创应并进',conclusion:'保留应用边界，逐步验证成果。',evidence:'原始材料',board:{mode:'columns',nodes:[],edges:[]},blocks:Array.from({length:4},(_,i)=>({blockId:'g'+i,label:['日常应用','进阶共创','适用边界','共同行动'][i],text:'围绕真实任务开展验证，明确责任并收集业务反馈。'.repeat(3),evidence:'同一业务来源'}))}]});
const proposal=(d,blocks)=>({operations:[{op:'replaceSlide',slideId:'geometry',slide:{...structuredClone(d.slides[0]),blocks}}],originMap:blocks.map((b,i)=>({blockId:b.blockId,sourceBlockIds:i===0?['g0','g2']:['g1','g3']}))});
test('every advertised icon count uses a budget accepted by the actual geometry, with and without media',()=>{
 for(const mode of Object.keys(ICON_TYPES))for(const imageCount of mode==='media'?[0,1]:[0])for(const p of iconCapacityProfiles(mode,{imageCount})){
  assert.ok(p.textMax>0,mode+':'+p.count);const cards=Array.from({length:p.count},()=>({label:'标'.repeat(p.labelMax),text:'文'.repeat(p.textMax),evidence:''}));
  assert.ok(iconGeometry(mode,cards,{imageCount}),mode+':'+p.count+':'+imageCount);
  for(const c of cards)c.text+='文';assert.equal(iconGeometry(mode,cards,{imageCount}),null);
 }
});
test('geometric rejection identifies exact block and dimensions, not a generic grouping error',()=>{
 const d=fixture(),catalog=contentCandidates(d.slides[0],d),rejected=catalog.rejections.filter(r=>r.layout==='theme17_content_icon_media');
 assert.equal(rejected.length,4);assert.ok(rejected.every(r=>r.blockId&&r.geometry.requiredHeight>r.geometry.availableHeight));
 const target=adaptationTargets(d.slides[0],d).find(t=>t.id==='theme17_content_icon_media');
 const payload=JSON.parse(adaptationMessages(d,target)[1].content);assert.ok(payload.target.capacity.geometryProfiles.length);assert.ok(payload.target.capacity.preferredBlockCount<4);
 const bad=proposal(d,d.slides[0].blocks);bad.originMap=d.slides[0].blocks.map(b=>({blockId:b.blockId,sourceBlockIds:[b.blockId]}));
 assert.throws(()=>validateAdaptation(d,bad,target),e=>e.code==='ADAPTATION_REVIEW_REQUIRED'&&e.details.rejections.length===4&&e.message.includes('px'));
});
test('content can regroup into a measured target without dropping source or any original paragraph',()=>{
 const d=fixture(),original=structuredClone(d),s=d.slides[0],blocks=[[0,2],[1,3]].map((indices,i)=>({blockId:'pair'+i,label:i?'进阶共创':'日常应用',text:indices.map(n=>s.blocks[n].text).join('\n'),evidence:'同一业务来源'}));
 const target=adaptationTargets(s,d).find(t=>t.id==='theme17_content_icon_media'),out=validateAdaptation(d,proposal(d,blocks),target);
 assert.equal(out.candidate.layout,target.id);assert.equal(out.candidate.blocks.length,2);assert.deepEqual(d,original);assert.ok(out.review.checks.allOriginalBlocksMapped);
 const bad=proposal(d,blocks);for(const b of bad.operations[0].slide.blocks)b.evidence='';assert.throws(()=>validateAdaptation(d,bad,target),/遗漏完整原始来源/);
});
