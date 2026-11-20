import { randomUUID, createHash } from 'node:crypto';
import { normalizeBoard } from './board-model.mjs';
import {normalizeBrief,briefReady} from './brief.mjs';
import {reconcileContentTree} from './mindmap-model.mjs';
import {normalizeIconConfig} from '../../assets/huawei-icons.mjs';
import {contentIssues} from './content-requirements.mjs';

export class WorkbenchError extends Error {
  constructor(message, status = 400, code = 'INVALID_REQUEST') { super(message); this.status = status; this.code = code; }
}
export const clone = value => structuredClone(value);
export const uid = prefix => `${prefix}-${randomUUID()}`;
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const now = () => new Date().toISOString();
// Only infer a section from explicit author intent plus an empty body; never from a short title alone.
export function effectiveRole(slide){return slide.role==='body'&&!slide.blocks.length&&(/章节页|章节背景|section page|chapter page/i.test(slide.visualIntent||''))?'section':slide.role;}
const text = value => String(value ?? '');
// SVG references are local image assets, never injected as active inline HTML.
const contentMedia=items=>(items||[]).map(item=>{if(!item||!/^assets\/[\w\u4e00-\u9fff./-]+\.(png|jpe?g|webp|gif|svg)$/i.test(item.src||'')||String(item.src).split('/').includes('..'))throw new WorkbenchError('图片必须是项目 assets 内的本地图片路径。');return {src:item.src,kind:'image',caption:text(item.caption)};});
const contentTreeProps=block=>{const tree=reconcileContentTree(block.contentTree,text(block.text));return tree?{contentTree:tree}:{};};
export function normalizeDocument(input, { assignIds = false } = {}) {
  if (!input || !Array.isArray(input.slides) || !input.slides.length) throw new WorkbenchError('内容稿至少需要一页。');
  if (input.slides.length > 60) throw new WorkbenchError('P0 每个项目最多支持 60 页。');
  const ids = new Set();
  const takeId = (value, prefix) => {
    const id = value || (assignIds ? uid(prefix) : '');
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id) || ids.has(id)) throw new WorkbenchError(`无效或重复的稳定 ID：${id || '(空)'}`);
    ids.add(id); return id;
  };
  return {
    title: text(input.title || '未命名汇报'), goal: text(input.goal), audience: text(input.audience||input.brief?.audience),
    brief:normalizeBrief(input.brief,input.audience),
    slides: input.slides.map((slide, index) => {
      if (!slide || (slide.blocks != null && !Array.isArray(slide.blocks)) || slide.blocks?.length > 100) throw new WorkbenchError('每页内容块必须是数组且不超过 100 个。');
      const normalized = {
      slideId: takeId(slide.slideId, 'slide'), order: index + 1, role: text(slide.role || (index === 0 && !slide.blocks?.length ? 'cover' : 'body')),
      title: text(slide.title), conclusion: text(slide.conclusion), visualIntent: text(slide.visualIntent),
      status: ['draft', 'editing', 'confirmed'].includes(slide.status) ? slide.status : 'draft',
      version: Math.max(1, Number(slide.version) || 1),
      ...(slide.visuals?.icons?{visuals:{icons:normalizeIconConfig(slide.visuals.icons)}}:{}),
      ...(slide.pagination==='single'?{pagination:'single'}:{}),
      blocks: (slide.blocks || []).map(block => ({
        blockId: takeId(block.blockId, 'block'), type: text(block.type || 'paragraph'), label: text(block.label),
        text: text(block.text), evidence: text(block.evidence),
        ...(block.data == null ? {} : { data: clone(block.data) }),
        ...(block.media?.length?{media:contentMedia(block.media)}:{}),
        ...(block.origin ? { origin: clone(block.origin) } : {}),
        ...contentTreeProps(block),
      })),
      evidence: text(slide.evidence), ...(slide.legacy ? { legacy: clone(slide.legacy) } : {}),
      ...(slide.media?.length?{media:contentMedia(slide.media)}:{}),
      };
      normalized.board = normalizeBoard(slide.board,normalized);
      return normalized; }),
  };
}
export function slideContent(slide) {
  const { status, version, order, ...rest } = slide; return rest;
}
export function reconcileDocument(previous, incoming) {
  const next = normalizeDocument(incoming);
  const byId = new Map(previous.slides.map(slide => [slide.slideId, slide]));
  for (const slide of next.slides) {
    const old = byId.get(slide.slideId);
    const changed = !old || digest(slideContent(slide)) !== digest(slideContent(old));
    slide.version = old ? old.version + (changed ? 1 : 0) : 1;
    slide.status = changed ? 'editing' : old.status;
  }
  return next;
}
export function statusOf(project) {
  const slides = project.current.slides;
  const confirmed = slides.filter(slide => slide.status === 'confirmed').length;
  return { projectId: project.projectId, revision: project.revision, contentRevision: project.contentRevision,
    stage: project.stage, pageCount: slides.length, confirmed, canGenerate: confirmed === slides.length && !!project.confirmed && digest(project.current) === project.confirmed.hash && !contentIssues(project.current).length,
    briefReady:briefReady(project.current),canUndo: !!project.history.undo.length, canRedo: !!project.history.redo.length,
    updatedAt: project.updatedAt, slides: slides.map(({ slideId, order, title, status, version }) => ({ slideId, order, title, status, version })) };
}
