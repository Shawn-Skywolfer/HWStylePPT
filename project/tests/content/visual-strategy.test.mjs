import test from 'node:test';import assert from 'node:assert/strict';
import {scoreVisualCandidate,interpretationProposals,capabilityCatalog,compareVisualCandidates} from '../../scripts/content/visual-strategy.mjs';
import {chooseLayoutSequence} from '../../scripts/content/layout-policy.mjs';
import {inferBoardMode} from '../../scripts/content/board-model.mjs';
import {planContentSlide} from '../../scripts/content/visual-plan.mjs';
import {normalizeDocument} from '../../scripts/content/model.mjs';
import {explicitFocusBlockId} from '../../scripts/content/visual-strategy.mjs';
const candidate=(layout,score=80)=>({layout,score,props:{imageCount:/media/.test(layout)?1:0},plan:{family:'columns'}});
test('expression fit precedes a HW count quota; equally suitable options still prefer HW',()=>{
 const s={visualIntent:'三个能力支柱，不要连成流程。',blocks:[{text:'必要的解释'}],board:{mode:'columns'}};
 const pillar=scoreVisualCandidate(s,candidate('theme17_content_icon_pillars')),generic=scoreVisualCandidate(s,candidate('theme17_content_hw_bento_dense'));
 assert.ok(pillar.score>generic.score);const hw=scoreVisualCandidate({...s,visualIntent:''},candidate('theme17_content_hw_icon_list')),other=scoreVisualCandidate({...s,visualIntent:''},candidate('theme17_content_editorial'));assert.ok(hw.score>other.score);
});
test('placeholder permission is not a requirement to use a picture on every page',()=>{
 const s={visualIntent:'三个能力支柱',blocks:[{text:'解释'}],board:{mode:'columns'}};
 assert.ok(scoreVisualCandidate(s,candidate('theme17_content_hw_media_left')).score<scoreVisualCandidate(s,candidate('theme17_content_hw_icon_list')).score);
});
test('explicit relationship contradictions become review proposals without modifying the document',()=>{
 const d={slides:[{slideId:'a',title:'四类工作',visualIntent:'四场景矩阵，不把它们连成强制先后流程。',board:{mode:'flow'},blocks:[]}]},before=structuredClone(d),p=interpretationProposals(d);
 assert.equal(p[0].to,'columns');assert.equal(p[0].requiresApproval,true);assert.deepEqual(d,before);
 assert.equal(inferBoardMode({role:'process',visualIntent:d.slides[0].visualIntent}),'comparison');
});
test('whole-deck search compares visual families, not just different IDs',()=>{
 const c=(layout,composition,score)=>({layout,score,visual:{composition},plan:{family:composition}});
 const r=chooseLayoutSequence([{id:'a',candidates:[c('theme17_content_a','grid',100)]},{id:'b',candidates:[c('theme17_content_b','grid',100),c('theme17_content_c','comparison',95)]}]);
 assert.equal(r.selected.get('b').layout,'theme17_content_c');
 const manual=chooseLayoutSequence([{id:'a',candidates:[c('theme17_content_a','grid',100)]},{id:'b',requested:'theme17_content_b',candidates:[c('theme17_content_b','grid',100),c('theme17_content_c','comparison',95)]}]);assert.equal(manual.selected.get('b').layout,'theme17_content_b');
});
test('catalog retains paused status and requires real contracts rather than invented slots',()=>{
 const c=capabilityCatalog([{key:'theme17_content_hw_layers',label:'分层',selectionHidden:true}]);assert.equal(c.layouts[0].selectable,false);assert.match(c.layouts[0].needsContract,/constraints/);assert.ok(c.expressions.comparison.avoid);
});
test('an explicit primary block is promoted visually without changing source order or copy',()=>{
 const d=normalizeDocument({title:'主次',slides:[{slideId:'s',role:'body',title:'判断需要聚焦',visualIntent:'三个支柱，抓住关键为主。',blocks:[{blockId:'a',label:'理解系统',text:'理解关系。'},{blockId:'b',label:'抓住关键',text:'把资源放到重要问题。'},{blockId:'c',label:'持续学习',text:'保留核验。'}]}]}),s=d.slides[0],before=structuredClone(s),focus=explicitFocusBlockId(s),p=planContentSlide(s,{presentation:'spotlight',focusBlockId:focus});
 assert.equal(focus,'b');assert.equal(p.blocks[0].blockId,'b');assert.equal(p.props.cards[0].text,s.blocks[1].text);assert.deepEqual(s,before);
});
test('authorized media, real ICONs and highlight capabilities can combine without inventing chart data',()=>{
 const s={visualIntent:'图文解释',blocks:[{label:'依据',text:'完整解释'}],board:{mode:'columns'}},c={layout:'theme17_content_icon_media',props:{imageCount:1},plan:{mediaCount:1,icons:{count:2}},score:80};
 const r=scoreVisualCandidate(s,c,{brief:{imagePolicy:'placeholders'}});assert.equal(r.visual.features.media,true);assert.equal(r.visual.features.icons,true);assert.equal(r.visual.features.charts,false);assert.equal(r.visual.priorityTier,0);assert.equal(r.visual.preferenceBonus,0);assert.match(r.visual.reasons.join('；'),/不伪造截图/);
 const fake=scoreVisualCandidate(s,{layout:'theme17_chart_bar',props:{},plan:{},score:100});assert.equal(fake.visual.features.charts,false);
});
test('chart preference requires actual data and can be explicitly disabled',()=>{
 const s={visualIntent:'真实数据与解读',blocks:[{data:{kind:'bar',labels:['A','B'],values:[2,3]}}],board:{mode:'columns'}},c={layout:'theme17_chart_bar',props:{},plan:{},score:100},a=scoreVisualCandidate(s,c),b=scoreVisualCandidate(s,c,{brief:{visualPreferences:{charts:false}}});assert.equal(a.visual.features.charts,true);assert.equal(a.visual.priorityTier,1);assert.equal(b.visual.priorityTier,2);
});

test('media equals 3+ visible ICONs; lower-tier features never accumulate above either',()=>{
 const s={visualIntent:'解释',blocks:[{text:'完整正文'}],board:{mode:'columns'}},doc={brief:{imagePolicy:'placeholders'}},sc=c=>scoreVisualCandidate(s,c,doc);
 const media=sc(candidate('theme17_content_hw_media_left')),many=sc({...candidate('theme17_content_icon_pillars'),plan:{icons:{count:3}}}),few=sc({...candidate('theme17_content_hw_icon_band'),plan:{icons:{count:2}}}),highlight=sc(candidate('theme17_content_spotlight'));
 assert.equal(media.visual.priorityTier,0);assert.equal(many.visual.priorityTier,0);assert.equal(few.visual.priorityTier,1);assert.equal(highlight.visual.priorityTier,1);
 few.score=1e9;few.visual.quality=1e9;assert.ok(compareVisualCandidates(media,few)<0);
 const selected=chooseLayoutSequence([{id:'s',candidates:[few,media]}]);assert.equal(selected.selected.get('s').layout,media.layout);
 const equal=chooseLayoutSequence([{id:'s',candidates:[{...media,score:10,visual:{...media.visual,quality:0}},{...many,score:20,visual:{...many.visual,quality:0}}]}]);assert.equal(equal.selected.get('s').layout,many.layout);
});

test('priority respects actual visible counts, authorization and manual choices',()=>{
 const s={visualIntent:'解释',blocks:[{text:'正文'}]},c=n=>scoreVisualCandidate(s,{...candidate('theme17_content_icon_list'),plan:{icons:{count:n}}});
 assert.equal(c(2).visual.priorityTier,1);assert.equal(c(3).visual.priorityTier,0);assert.equal(c(0).visual.priorityTier,2);
 assert.notEqual(scoreVisualCandidate(s,candidate('theme17_content_hw_media_left')).visual.priorityTier,0);
 const media=scoreVisualCandidate(s,candidate('theme17_content_hw_media_left'),{brief:{imagePolicy:'placeholders'}}),few=c(2);
 assert.equal(chooseLayoutSequence([{id:'s',requested:few.layout,candidates:[media,few]}]).selected.get('s').layout,few.layout);
});
