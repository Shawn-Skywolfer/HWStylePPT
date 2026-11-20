import test from 'node:test';import assert from 'node:assert/strict';
import {CONSOLE_EN,translateConsoleText} from '../../assets/console-i18n.mjs';
import {THEME_PAGES} from '../../scripts/skill-workflow-utils.mjs';
import {collectMetadataStrings,loadI18nDictionary} from '../../src/i18n-core.mjs';
import {LAYOUT_ALIASES_EN,LAYOUT_VARIANT_NAMES_EN} from '../../assets/layout-names.mjs';
test('console English translates dynamic task, image and chart labels',()=>{
 for(const [zh,en]of Object.entries(CONSOLE_EN))assert.equal(translateConsoleText(zh),en);
 for(const [zh,en]of [['0 个未结束 · 0/2 个执行名额','0 unfinished · 0/2 workers'],['历史 · 已完成 · 100%','History · Completed · 100%'],['12 秒 / AI 上限 180 秒','12 s / AI limit 180 s'],['图片 2 · 待裁切确认 · 21 秒','Image 2 · Ready to crop · 21 s'],['数据项 · 3 · Label','Item 3 · Label']])assert.equal(translateConsoleText(zh),en);
});
test('console translation retains original data and whitespace',()=>{
 for(const value of ['原材料价格上涨 12%','待补充','https://example.com/图像.png','{"error":"内部错误"}',null,undefined,42])assert.equal(translateConsoleText(value),value);
 assert.equal(translateConsoleText('  关闭\n'),'  Close\n');
 assert.equal(translateConsoleText('替换 ICON · 责任边界'),'Replace icon · 责任边界');
 assert.equal(translateConsoleText('根据标题中的“数据”匹配'),'Matched title term “数据”');
});
test('console translation reuses registered metadata and preserves missing entries',()=>{
 assert.equal(translateConsoleText('特殊控件',v=>v==='特殊控件'?'Special control':v),'Special control');
 assert.equal(translateConsoleText('用户自定义标题',v=>v),'用户自定义标题');
});
test('all registered layout controls remain translatable after switching layouts',()=>{
 const d={...loadI18nDictionary(),...Object.fromEntries(THEME_PAGES.map(p=>[p.label,p.labelEn])),...LAYOUT_ALIASES_EN,...LAYOUT_VARIANT_NAMES_EN};
 const missing=[...collectMetadataStrings(THEME_PAGES,[]).keys()].filter(k=>/[一-鿿]/.test(translateConsoleText(k,v=>d[v]||v)));
 assert.deepEqual(missing,[]);
});
