import test from 'node:test';import assert from 'node:assert/strict';
import {HW_DEFINITIONS} from '../../src/components/hw/contracts.mjs';import {validateHwPlanningCapacity} from '../../assets/hw-template-view.mjs';
const def=HW_DEFINITIONS.find(d=>d.layout==='theme17_content_hw_media_bento_matrix');
test('media Bento planning reserves the original title band, body padding and empty heading margin',()=>{
 const p={variant:'6',cards:[{blockId:'a',label:'专业问答',text:'独立OfficeAce Session按权限读取Wiki，回答一个跨资料问题，并打开引用核对。不能把每个新任务都变成重新建库。',evidence:''}]},geometry={nodes:[{w:180.328125,h:229}]};assert.throws(()=>validateHwPlanningCapacity(def,p,geometry),/HW_CONTENT_OVERFLOW/);p.cards[0].text='按权限回答问题，并核对引用。';assert.doesNotThrow(()=>validateHwPlanningCapacity(def,p,geometry));
});
