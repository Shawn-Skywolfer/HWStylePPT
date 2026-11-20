import test from 'node:test';import assert from 'node:assert/strict';
import {boundContentNoteIssues} from '../../assets/content-note-layout.mjs';
const bindings=[{blockId:'b1',source:'text',text:'完整正文'},{blockId:'b1',source:'evidence',text:'独立来源'}];
const leaf=(text,y,h=18)=>({text,rect:{x:10,y,w:120,h},textRects:[{left:10,top:y,right:130,bottom:y+h}]});
test('source must follow the last actual body line, not its first line or nominal box',()=>{
 const body=leaf('完整正文',10);body.rect.h=200;body.textRects.push({left:10,top:28,right:130,bottom:46});
 assert.equal(boundContentNoteIssues(bindings,[body,leaf('独立来源',35)]).length,1);
 assert.deepEqual(boundContentNoteIssues(bindings,[body,leaf('独立来源',54)]),[]);
});
test('separate columns, unrelated blocks and ambiguous repeated sources are not guessed',()=>{
 const note=leaf('独立来源',10);note.textRects[0].left=200;note.textRects[0].right=300;
 assert.deepEqual(boundContentNoteIssues(bindings,[leaf('完整正文',10),note]),[]);
 assert.deepEqual(boundContentNoteIssues(bindings,[leaf('完整正文',10),leaf('独立来源',10),leaf('独立来源',80)]),[]);
});
