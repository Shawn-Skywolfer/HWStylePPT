// Deck 界面语言与词典裁剪(主题注册表层)。纯函数部分(语言归一化/词典加载/
// 文案收集)住 src/i18n-core.mjs,本文件叠加 THEME_PAGES 依赖,给 renderDeck 用。
import { THEME_PAGES, THEME_PACK_OPTIONS } from './components/themes/index.jsx';
import { collectMetadataStrings, loadI18nDictionary } from './i18n-core.mjs';
import {LAYOUT_ALIASES_EN,LAYOUT_VARIANT_NAMES_EN} from '../assets/layout-names.mjs';

export { DECK_LANGUAGES, normalizeDeckLanguage, loadI18nDictionary, collectMetadataStrings } from './i18n-core.mjs';

const PAGES_BY_KEY = new Map(THEME_PAGES.map((page) => [page.key, page]));

// 所有可换版控件的词典，加上当前 deck 所属主题包的名称/场景文案。
export function buildDeckI18nDict(viewModel) {
  const usedPackKeys = new Set();
  for (const slide of viewModel.slides || []) {
    const page = PAGES_BY_KEY.get(slide.layout);
    if (page) {
      if (page.themeKey) usedPackKeys.add(page.themeKey);
    }
    if (slide.themePack) usedPackKeys.add(slide.themePack);
  }
  const usedPacks = [...usedPackKeys]
    .map((key) => THEME_PACK_OPTIONS[key])
    .filter(Boolean);
  const dict = loadI18nDictionary();
  const subset = {};
  // A later layout switch can introduce controls absent from the initial deck.
  for (const zh of collectMetadataStrings(THEME_PAGES, usedPacks).keys()) {
    if (dict[zh]) subset[zh] = dict[zh];
  }
  // Switch menus can load layouts not present in the initial deck.
  for(const page of THEME_PAGES)if(page.labelEn)subset[page.label]=page.labelEn;
  Object.assign(subset,LAYOUT_ALIASES_EN,LAYOUT_VARIANT_NAMES_EN);
  Object.assign(subset,{'华为风格':'Huawei Style','Theme17 华为风格':'Theme17 · Huawei Style','华为调研风':'Huawei Research'});
  return subset;
}
