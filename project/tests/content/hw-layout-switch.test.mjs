import test from 'node:test';import assert from 'node:assert/strict';
import {importHwLayoutContent} from '../../scripts/preview/hw-layout-content.mjs';
import {contentCandidates} from '../../scripts/content/catalog-match.mjs';
const page=(layout,props)=>({id:'switch-test',layout,props});
test('HW-only importer does not guess missing mappings for arbitrary legacy HTML',()=>{assert.equal(importHwLayoutContent(page('theme17_page009',{})),null);});
test('rich HW cards keep heading and body in neutral content, never truncate either field',()=>{
 const s=page('theme17_content_hw_bento_2x3',{title:'以统一平台支撑能力协同',lead:'',closing:'内部研究',variant:'5',cards:Array.from({length:5},(_,i)=>({blockId:'card'+i,label:'维度'+i,heading:'独立的核心判断'+i,text:'这是完整正文内容'+i,evidence:''}))});
 const d=importHwLayoutContent(s);assert.equal(d.slides[0].blocks.length,5);for(let i=0;i<5;i++){assert.equal(d.slides[0].blocks[i].text,'独立的核心判断'+i+'\n这是完整正文内容'+i);assert.equal(d.slides[0].blocks[i].origin.hw.card.heading,s.props.cards[i].heading);}
 const non=contentCandidates(d.slides[0],d).candidates.filter(c=>!c.layout.includes('_hw_'));assert.ok(non.length);assert.ok(non.some(c=>c.layout==='theme17_content_columns'));assert.deepEqual(s.props.cards[0].heading,'独立的核心判断0');
});
test('HW chart switching retains structured values, labels and units in existing chart templates',()=>{
 const s=page('theme17_chart_hw_column_bento',{title:'业务进展保持增长',lead:'',closing:'内部数据',variant:'3',caption:'实际业务量',note:'按统一口径统计。',cards:[{blockId:'analysis1',label:'重点一',text:'保持投入。',evidence:''},{blockId:'analysis2',label:'重点二',text:'跟踪进展。',evidence:''}],chart:{type:'column',unit:'%',items:[{label:'A',value:20},{label:'B',value:40},{label:'C',value:60}],series:[]}});
 const d=importHwLayoutContent(s),c=contentCandidates(d.slides[0],d).candidates.find(c=>c.layout==='theme17_chart_column');assert.ok(c);assert.deepEqual(c.props.items,s.props.chart.items);assert.equal(c.props.unit,'%');assert.equal(c.props.analysis.length,2);
});
test('HW ICON configuration retains stable block IDs and manual size/color overrides',()=>{
 const cards=Array.from({length:3},(_,i)=>({blockId:'icon'+i,label:'数据治理',heading:'清晰的判断',text:'保留原始文字。',evidence:''})),iconConfig={enabled:true,overrides:{icon0:{id:'database',size:32,color:'#C7000B'}}};
 // Use a real bundled ID rather than assuming external icon library names.
 delete iconConfig.overrides.icon0.id;
 const d=importHwLayoutContent(page('theme17_content_hw_icon_list',{title:'以数据治理支撑业务',lead:'',closing:'',variant:'3',cards,iconConfig}));
 const c=contentCandidates(d.slides[0],d).candidates.find(c=>c.layout==='theme17_content_icon_list');assert.ok(c);assert.equal(c.props.iconConfig.overrides.icon0.color,'#C7000B');assert.equal(c.props.iconConfig.overrides.icon0.size,32);assert.equal(c.props.layout.nodes[0].id,'icon0');
});
test('current text edits rebase one exact source field, ambiguous edits remain protected',()=>{
 const s=page('theme17_content_hw_bento_2x3',{title:'以统一平台支撑能力协同',lead:'',closing:'',variant:'5',cards:Array.from({length:5},(_,i)=>({blockId:'card'+i,label:'维度'+i,heading:'判断'+i,text:'原文'+i,evidence:''}))});
 const d=importHwLayoutContent(s,{edits:[{before:'判断1',after:'编辑后的判断'}]});assert.match(d.slides[0].blocks[1].text,/编辑后的判断/);assert.throws(()=>importHwLayoutContent(s,{edits:[{before:'不属于任何字段',after:'新文字'}]}),/无法唯一归属/);
});
