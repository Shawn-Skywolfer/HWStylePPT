export const RUNTIME_TEMPLATE = 'assets/template-swiss.html';

export const LOCAL_OUTPUT_ASSET_ROOTS = ['assets', 'images', 'uploads'];

export const RUNTIME_ASSET_PATHS = [
  RUNTIME_TEMPLATE,
  'assets/theme17-no-media-layouts.css',
  'assets/huawei-back-cover.png',
  'assets/huawei-logo.png',
  'assets/huawei-chart-view.mjs',
  'assets/huawei-chart-mixed.mjs',
  'assets/huawei-chart-signed.mjs',
  'assets/huawei-analysis-layout.mjs',
  'assets/huawei-icon-library.mjs',
  'assets/huawei-icons.mjs',
  'assets/huawei-icon-layout.mjs',
  'assets/tabler-icons-LICENSE.txt',
  'assets/skill/dashiai-ppt-favicon.png',
  'assets/ui-icons/sidebar.svg',
  'assets/unicorn/tech_background_remix_scene.json',
  'assets/unicorn/automations_remix_scene.json',
  'assets/unicorn/moving_into_remix_scene.json',
  'assets/unicorn/goey_balls_remix_scene.json',
  // 场景 JSON 引用的贴图(蓝噪声/字体图集)本地快照:引用远程 assets.unicorn.studio
  // 会让交付 deck 产生外链请求(隐私/离线/供应链面),与 SDK 本体一样全部随 deck 分发。
  'assets/unicorn/media',
  'assets/vendor/unicornstudio.umd.js',
  // 浏览器端可编辑 PPTX 导出 bundle(服务端起不了无头浏览器时的降级通道,
  // 由 scripts/build/build-editable-pptx-browser.mjs 预构建)。
  'assets/vendor/editable-pptx-browser.js',
  'assets/vendor/fonts',
];

export const GENERATED_RUNTIME_OUTPUT_ASSETS = [
  'assets/imported-theme-runtime.js',
];

export const VENDOR_RUNTIME_OUTPUT_ASSETS = [
  'assets/vendor/gsap.min.js',
  'assets/vendor/pptxgen.bundle.js',
  'assets/vendor/html-to-image.js',
  // 浏览器内 PDF 合成(静态服务器/无 assemble 端点时的 blob 导出)。
  'assets/vendor/pdf-lib.min.js',
];

export const REQUIRED_OUTPUT_ASSETS = [
  ...RUNTIME_ASSET_PATHS.filter(assetPath => assetPath !== RUNTIME_TEMPLATE),
  ...GENERATED_RUNTIME_OUTPUT_ASSETS,
  ...VENDOR_RUNTIME_OUTPUT_ASSETS,
];
