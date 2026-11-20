import { inspectLayout, getLayoutRecord } from '../skill-workflow-utils.mjs';
import { charLength } from '../workflow/copy-contract.mjs';
import { validateGoalSpec } from '../validate-goal-spec.mjs';
import { clone, digest, normalizeDocument, WorkbenchError,effectiveRole } from './model.mjs';
import {planContentSlide} from './visual-plan.mjs';
import {matchDeck} from './catalog-match.mjs';
import {assertContentReady} from './content-requirements.mjs';

const layoutName = n => `theme17_page${String(n).padStart(3, '0')}`;
function empty(value) {
  if (typeof value === 'string') return '';
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.map(empty);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, empty(v)]));
  return null;
}
function blankProps(layout) {
  const record = getLayoutRecord(layout), inspection = inspectLayout(layout, { compact: true });
  const props = Object.fromEntries(Object.entries(clone(record.defaultProps)).filter(([key]) => key !== 'renderSlot'));
  for (const key of inspection.copyKeys) { const root = key.split(/[.\[]/)[0]; props[root] = empty(record.defaultProps[root]); }
  for (const slot of inspection.mediaSlots || []) { props[slot.field] = []; if (slot.countKey) props[slot.countKey] = 0; }
  for (const control of record.controls) {
    if (/装饰文案/.test(control.label) || /^(focusEnabled|showMeter|showMetrics|showTags|showContact|showChange|showShare|showValues|showValueLabels|showTimeline)$/.test(control.key)) props[control.publicKey || control.key] = false;
  }
  return { props, inspection, record };
}
function fit(value, max, label) {
  if (charLength(value) > max) throw new WorkbenchError(`${label}超出模板容量（${charLength(value)} / ${max} 字符宽度）。请在内容工作台精炼或拆页；原稿未截断。`, 422, 'CONTENT_OVERFLOW');
  return value;
}
function splitText(value, budget = 36) {
  const chunks = []; let chunk = '';
  for (const char of value) { if (charLength(chunk + char) > budget) { chunks.push(chunk); chunk = ''; } chunk += char; }
  if (chunk) chunks.push(chunk); return chunks;
}
export function compileContent(document, { projectId = '', confirmedId = '', legacyGoal = null,choices={},excluded={} } = {}) {
  const content = normalizeDocument(document), used = new Set(), mappings = [], warnings = [];
  assertContentReady(content);
  const deckMatch=matchDeck(content,{choices,excluded});
  if (legacyGoal?.text && Object.keys(legacyGoal.text).length) throw new WorkbenchError('旧 goal 含有顶层 text 槽位覆盖，尚不能安全反推到内容块。原稿已完整保留，请由 Agent 将其迁移为中性内容稿，避免覆盖确认后的文字。', 422, 'LEGACY_TEXT_MAPPING_REQUIRED');
  const slides = content.slides.map((slide, index) => {
    // Imported goals retain their full layout contracts and scalar field bindings.
    if (legacyGoal && slide.legacy && !slide.evidence && (!slide.conclusion || slide.legacy.conclusionPath)
      && (slide.legacy.titlePath || slide.title === slide.legacy.initialTitle)
      && slide.blocks.every(block => block.origin && block.type === 'legacy-field' && block.label === block.origin.path.join('.') && !block.evidence && block.data == null)
      && slide.blocks.length === slide.legacy.blockCount) {
      const original = legacyGoal.slides[slide.legacy.index];
      const authored = clone(original); authored.id = slide.slideId; authored.key = slide.slideId;
      for (const block of slide.blocks) {
        const parts = block.origin.path; let parent = authored.props;
        for (const key of parts.slice(0, -1)) parent = parent[key];
        const key = parts.at(-1); const converted = block.origin.type === 'number' ? Number(block.text) : block.text;
        if (block.origin.type === 'number' && !Number.isFinite(converted)) throw new WorkbenchError(`旧项目数值字段 ${parts.join('.')} 必须是数字。`, 422);
        parent[key] = converted;
      }
      if (slide.legacy.titlePath) authored.props[slide.legacy.titlePath] = slide.title;
      if (slide.legacy.conclusionPath) authored.props[slide.legacy.conclusionPath] = slide.conclusion;
      if (used.has(authored.layout) && !getLayoutRecord(authored.layout)?.page.reusable) throw new WorkbenchError('旧项目存在重复布局，请在快速模式下使用原 goal 或手动选择布局。', 422);
      used.add(authored.layout);
      mappings.push({ slideId: slide.slideId, goalSlideId: slide.slideId, layout: authored.layout, blocks: slide.blocks.map(block => ({ blockId: block.blockId, paths: [`props.${block.origin.path.join('.')}`] })) });
      return authored;
    }
    let layout, props, blockMappings = [],visualPlan=null,titlePaths=null;
    const role=effectiveRole(slide),isCover = role === 'cover';
    const isSection = ['section', 'transition', 'chapter'].includes(role);
    if (isCover || isSection) {
      if (slide.blocks.some(block => block.text || block.evidence || block.data != null)) throw new WorkbenchError(`第 ${index + 1} 页是封面/章节页，不能承载正文块。请改为正文页或移到后一页，避免丢失内容。`, 422);
      layout = isCover ? layoutName(4) : [16, 46, 59, 68].map(layoutName).find(key => !used.has(key));
      if (!layout || used.has(layout)) throw new WorkbenchError('封面只能有一页，章节页最多四页。', 422);
      ({ props } = blankProps(layout));
      // These special templates only expose title/subtitle; do not submit inert legacy geometry arrays as content props.
      for(const key of Object.keys(props))if(props[key]&&typeof props[key]==='object')delete props[key];
      if (isCover) {
        const titleParts = splitText(slide.title, 18);
        if (titleParts.length > 2) fit(slide.title, 36, `第 ${index + 1} 页封面标题`);
        props.titleL1 = titleParts[0] || ''; props.titleL2 = titleParts[1] || '';
        props.summary = fit(slide.conclusion, 36, `第 ${index + 1} 页封面摘要`);
      } else { props.title = fit(slide.title, 28, `第 ${index + 1} 页章节标题`);props.contentLead=fit(slide.conclusion,80,'章节结论'); }
      props.contentEvidence=fit(slide.evidence,180,'页面来源');
      visualPlan={special:true,engine:'original-special-with-copy',bindings:[{source:'title',text:slide.title},{source:'conclusion',text:slide.conclusion},{source:'evidence',text:slide.evidence}]};
      if(role!==slide.role)warnings.push({slideId:slide.slideId,code:'SECTION_ROLE_INFERRED',message:'根据空正文与明确章节页设计意图，以章节页呈现；原稿未改写。'});
    } else {
      const planned=deckMatch.matched.get(slide.slideId)||planContentSlide(slide);
      layout=planned.layout;props=planned.props;blockMappings=planned.blocks;visualPlan=planned.plan;titlePaths=planned.titlePaths;
    }
    used.add(layout);
    mappings.push({ slideId: slide.slideId, goalSlideId: slide.slideId, layout,visualPlan,planningBoard:slide.board, titlePaths: titlePaths || (isCover ? ['props.titleL1', 'props.titleL2'] : ['props.title']), blocks: blockMappings });
    return { id: slide.slideId, key: slide.slideId, layout, props };
  });
  const goal = { ...(legacyGoal ? clone(legacyGoal) : {}), title: content.title, goal: content.goal || content.title, audience: content.audience, themePack: 'theme17', pageCount: slides.length,
    randomSeed: `${projectId}:${confirmedId}`, contentPlan: { projectId, confirmedId, hash: digest(content), mappingVersion: 3,mediaPlaceholders:content.brief?.imagePolicy==='placeholders' }, slides };
  const errors = validateGoalSpec(goal);
  if (errors.length) throw new WorkbenchError(`确认稿未通过现有模板校验，未生成 PPT：\n${errors.join('\n')}`, 422, 'GOAL_VALIDATION');
  return { goal, mapping: { version: 3, projectId, confirmedId, slides: mappings }, warnings,design:deckMatch.overview,utilization:deckMatch.utilization };
}

export function migrateGoal(goal) {
  if (!Array.isArray(goal.slides) || !goal.slides.length) throw new WorkbenchError('旧 goal 没有可导入的页面。');
  const warnings = ['已保留完整原 goal。旧文件缺少核心结论、内容块语义和审核状态，请逐页核对；标为 legacy-field 的字段是无损恢复的属性，不代表已理解其含义。'];
  const slides = goal.slides.filter(slide => slide.layout !== 'theme17_back_cover').map((slide, index) => {
    const props = slide.props || {}, titlePath = ['title', 'titleL1', 'kicker'].find(key => typeof props[key] === 'string'), conclusionPath = ['lead', 'summary', 'sub'].find(key => typeof props[key] === 'string' && key !== titlePath);
    const blocks = [];
    function visit(value, parts) {
      if (['string', 'number'].includes(typeof value)) {
        if (parts.length === 1 && [titlePath, conclusionPath].includes(parts[0])) return;
        blocks.push({ type: 'legacy-field', label: parts.join('.'), text: String(value), origin: { path: parts, type: typeof value } });
      } else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => visit(item, [...parts, key]));
    }
    visit(props, []);
    const title = props[titlePath] || slide.label || `页面 ${index + 1}`;
    return { slideId: slide.id || slide.key, role: index === 0 ? 'cover' : 'body', title, conclusion: props[conclusionPath] || '', blocks,
      legacy: { index, layout: slide.layout, titlePath, conclusionPath, initialTitle: title, blockCount: blocks.length } };
  });
  return { document: normalizeDocument({ title: goal.title, goal: goal.goal, audience: goal.audience, slides }, { assignIds: true }), migration: { originalGoal: clone(goal), warnings } };
}
