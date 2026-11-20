import test from 'node:test';
import assert from 'node:assert/strict';
import library from '../../assets/hw-original-library.json' with {type:'json'};
import {enlargeHwBodyCss,HW_TITLE,HW_BODY_FONT_INCREASE_PX} from '../../assets/hw-typography.mjs';
test('HW original typography adds two points, preserving KPI and title scales',()=>{
 const css=enlargeHwBodyCss(library.css);
 assert.equal(HW_BODY_FONT_INCREASE_PX,8/3);
 assert.deepEqual(HW_TITLE,{x:64,y:40,width:1020,fontSize:34,lineHeight:1.25,fontWeight:700,letterSpacing:-.02});
 assert.match(css,/\.bento-body p\{[^}]*font-size:calc\(14px \* var\(--font-factor\) \+ 2pt\)/);
 assert.match(css,/\.bento-title\{[^}]*font-size:calc\(16px \+ 2pt\)/);
 for(const selector of ['.hw-original h1',':where(.hw-original) .metric-hero .hero-value',':where(.hw-original) .highlight-unit','.hw-original .source',':where(.hw-original) .slide-footer']){
  const rules=s=>[...s.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].trim()===selector).map(m=>m[2]);
  assert.deepEqual(rules(css),rules(library.css),selector);
 }
 assert.match(css,/font-size:calc\(11\.5px \+ 2pt\)!important/);
});
