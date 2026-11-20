import { createSlideModel } from './view-model/index.jsx';
import {makeSemanticHuaweiContent} from './components/SemanticHuaweiContent.jsx';
import {makeSemanticHuaweiChart} from './components/SemanticHuaweiChart.jsx';
import {makeHuaweiIconContent} from './components/HuaweiIconContent.jsx';
import {makeHwPage} from './components/hw/HwPage.jsx';
import {
  THEME_PAGES,
  THEME_PACK_OPTIONS as BASE_THEME_PACK_OPTIONS,
  makeImportedThemePage,
} from './components/themes/index.jsx';
import {
  FIXED_HUAWEI_BACK_COVER_LAYOUT,
  FixedHuaweiBackCover,
} from './components/FixedHuaweiBackCover.jsx';

export const DEFAULT_THEME_PACK = 'theme17';
export const THEME_PACK_OPTIONS = {
  ...BASE_THEME_PACK_OPTIONS,
  theme17: {
    ...BASE_THEME_PACK_OPTIONS.theme17,
    layouts: [
      ...(BASE_THEME_PACK_OPTIONS.theme17?.layouts || []),
      FIXED_HUAWEI_BACK_COVER_LAYOUT,
    ],
  },
};

export const LAYOUT_ALIASES = Object.fromEntries(
  THEME_PAGES.map((page) => [`${page.themeKey}_${String(page.slot).replaceAll('-', '_')}`, page.key]),
);

export const LAYOUT_OPTIONS = Object.fromEntries([
  ...THEME_PAGES.map((page) => [
    page.key,
    {
      label: `${THEME_PACK_OPTIONS[page.themeKey]?.label || page.themeKey} · ${page.themeKey} · ${String(page.pageNumber).padStart(3, '0')} · ${page.label}`,
      dataLayout: page.layout,
      component: page.nativeHw?makeHwPage(page):page.nativeIcon?makeHuaweiIconContent(page):page.nativeChart?makeSemanticHuaweiChart(page):page.nativeContent?makeSemanticHuaweiContent(page.key):makeImportedThemePage(page.key),
    },
  ]),
  [
    FIXED_HUAWEI_BACK_COVER_LAYOUT,
    {
      label: 'Huawei fixed back cover',
      dataLayout: 'HUAWEI-BACK-COVER',
      component: FixedHuaweiBackCover,
    },
  ],
]);

export function resolveLayoutName(layoutName) {
  return LAYOUT_ALIASES[layoutName] || layoutName;
}

export function slide(layoutName, props) {
  const resolvedLayout = resolveLayoutName(layoutName);
  const option = LAYOUT_OPTIONS[resolvedLayout];
  if (!option) {
    throw new Error(`Unknown layout "${layoutName}". Choose one of: ${Object.keys(LAYOUT_OPTIONS).join(', ')}`);
  }
  return createSlideModel(resolvedLayout, props || {});
}

export function resolveOption(registry, name, fallback, label) {
  const key = name ?? fallback;
  const option = registry[key];
  if (!option) {
    throw new Error(`Unknown ${label} "${key}". Choose one of: ${Object.keys(registry).join(', ')}`);
  }
  return { key, option };
}
