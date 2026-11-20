import test from 'node:test';import assert from 'node:assert/strict';
import {hwDefinition,HW_THEME_PAGES,isHwSelectable} from '../../src/components/hw/contracts.mjs';
import {listLayouts,layoutExists} from '../../scripts/skill-workflow-utils.mjs';
import {hwCandidates} from '../../scripts/content/hw-plan.mjs';
import {importHwLayoutContent} from '../../scripts/preview/hw-layout-content.mjs';
import {validateHwProps,hwMarkup} from '../../assets/hw-template-view.mjs';
import fixtures from './hw-original-fixtures.json' with {type:'json'};
import {contentCandidates} from '../../scripts/content/catalog-match.mjs';
const hidden=['theme17_content_hw_layers','theme17_content_hw_table'];
test('paused HW table/layers are absent from layout discovery but their old render contracts remain',()=>{
 for(const key of hidden){const d=hwDefinition(key);assert.equal(d.selectionHidden,true);assert.equal(isHwSelectable(key),false);assert.equal(HW_THEME_PAGES.find(p=>p.key===key).selectionHidden,true);assert.ok(d.preferredExistingLayouts.length);for(const fallback of d.preferredExistingLayouts)assert.ok(layoutExists(fallback),fallback);assert.ok(!listLayouts({theme:'theme17',keyword:d.id,limit:50,seed:'hidden'}).some(p=>p.layout===key));for(const f of fixtures.filter(f=>f.layout===key)){validateHwProps(d,f.props);assert.ok(hwMarkup(d,f.props,1).includes('data-content-block'));}}
 assert.equal(isHwSelectable('theme17_content_hw_radial'),true);
});
test('automatic planning does not reintroduce paused templates from old deck content',()=>{
 for(const key of hidden){const f=fixtures.find(f=>f.layout===key),doc=importHwLayoutContent({id:'old',layout:key,props:f.props});assert.ok(!hwCandidates(doc.slides[0],doc).some(c=>hidden.includes(c.layout)));}
});
test('a compatible structured table uses the original Skill table without changing headers or cells',()=>{
 const data={kind:'table',headers:['业务','数量','说明'],rows:[['甲','12','稳步增长'],['乙','24','持续改善'],['丙','36','保持稳定']]},slide={slideId:'table',title:'各项业务表现',conclusion:'业务表现稳定',evidence:'内部数据',role:'table',blocks:[{blockId:'data',label:'业务数据',text:'主要业务',evidence:'',data}],board:{mode:'columns',nodes:[],edges:[]}},doc={slides:[slide],brief:{}};
 const c=contentCandidates(slide,doc).candidates[0];assert.equal(c.layout,'theme17_page019');assert.deepEqual([c.props.colHeads.dim,c.props.colHeads.val,c.props.colHeads.note],data.headers);assert.deepEqual(c.props.rows.map(r=>[r.dim,r.val,r.note]),data.rows);
 const wide=structuredClone(slide);wide.blocks[0].data.headers.push('第四列','第五列');assert.throws(()=>contentCandidates(wide,{...doc,slides:[wide]}),e=>e.code==='EXISTING_TABLE_LAYOUT_REQUIRED');assert.deepEqual(slide.blocks[0].data,data);
});
test('hierarchy content still has an existing Skill layout candidate',()=>{
 const slide={slideId:'layers',title:'分层能力形成业务支撑',conclusion:'各层职责清晰',evidence:'内部规划',role:'body',blocks:['应用层','服务层','资源层'].map((label,i)=>({blockId:'layer'+i,label,text:'提供相应业务能力。',evidence:''})),board:{mode:'hierarchy',nodes:[],edges:[]}};
 const candidates=contentCandidates(slide,{slides:[slide],brief:{}}).candidates;assert.ok(candidates.some(c=>c.layout==='theme17_content_hierarchy'));assert.ok(!candidates.some(c=>hidden.includes(c.layout)));
});
