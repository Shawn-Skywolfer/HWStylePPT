import test from 'node:test';
import assert from 'node:assert/strict';
import {renderText,pptFontScale} from '../../packages/html-deck-to-pptx/src/editable-core.mjs';

function capture({fontSize=40,textScale=1.5,height=1080,family='Arial',text='Font 字号'}={}){
  let options;const warnings=[],totals={textObjects:0};
  renderText({addText(_text,o){options=o;}},{text,rect:{x:50,y:50,w:800,h:100},singleLine:false,parentTag:'p',style:{fontSize:`${fontSize}px`,fontFamily:family,textScale,color:'rgb(0,0,0)',lineHeight:'60px',letterSpacing:'2px'}},{x:0,y:0,w:height*16/9,h:height},warnings,totals);
  assert.deepEqual(warnings,[]);assert.equal(totals.textObjects,1);return options;
}
test('font point scale follows page geometry rather than language or font family',()=>{
  for(const face of ['Arial','Microsoft YaHei','monospace','Times New Roman'])assert.equal(pptFontScale(face,{},'字号'),.6);
  for(const family of ['Arial','Microsoft YaHei'])assert.equal(capture({family}).fontSize,36);
});
test('page viewport scaling cancels cumulative text scaling without changing relative type size',()=>{
  assert.equal(capture({height:540,textScale:.75}).fontSize,36);
  assert.equal(capture({height:1080,textScale:1.5}).fontSize,36);
  assert.equal(capture({height:2160,textScale:3}).fontSize,36);
});
test('line spacing, character spacing and 10 percent type share the same scale; no shrink fitting',()=>{
  const o=capture();assert.ok(Math.abs(o.lineSpacing-54)<1e-9);assert.ok(Math.abs(o.charSpacing-1.8)<1e-9);
  assert.equal(o.fit,'resize');assert.equal(o.valign,'mid');assert.ok(Math.abs(capture({fontSize:4}).fontSize-3.6)<1e-9);
  assert.ok(Math.abs(capture({fontSize:2}).fontSize-1.8)<1e-9);
});
