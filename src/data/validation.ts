import { getCityById } from './cities';
import {
  COLLAGE_CANVAS_HEIGHT,
  COLLAGE_CANVAS_WIDTH,
  DataError,
  JOURNAL_MEDIA_NODE_NAME,
  LEGACY_COLLAGE_CANVAS_WIDTH,
  MAX_BOOK_TITLE_LENGTH,
  type CollageCanvas,
  type CollageItem,
  type JournalContent,
  type TravelPlan,
} from './contracts';
import { isKnownAssetId, isPhotoAssetId, isStickerAssetId } from './ids';
import type { City } from './types';

/** 城市必须能由静态目录解析；`xian` 等 ID 在 V1-04 补入目录后自动生效。 */
export function requireCity(cityId: string): City {
  const city = getCityById(cityId);
  if (!city) {
    throw new DataError('INVALID_CITY', `未知城市：${cityId || '(空)'}`, { cityId });
  }
  return city;
}

export function normalizeBookId(bookId: string): string {
  const id = bookId?.trim();
  if (!id) {
    throw new DataError('INVALID_BOOK_ID', '手账 ID 不能为空');
  }
  return id;
}

export function normalizePlanId(planId: string): string {
  const id = planId?.trim();
  if (!id) {
    throw new DataError('INVALID_PLAN', '旅行计划 ID 不能为空');
  }
  return id;
}

export function normalizeBookTitle(title: string): string {
  const normalized = title?.trim() ?? '';
  if (!normalized) {
    throw new DataError('INVALID_TITLE', '手账标题不能为空');
  }
  if (normalized.length > MAX_BOOK_TITLE_LENGTH) {
    throw new DataError('INVALID_TITLE', `手账标题不能超过 ${MAX_BOOK_TITLE_LENGTH} 个字符`, {
      length: normalized.length,
    });
  }
  return normalized;
}

export function planIncludesCity(plan: TravelPlan, cityId: string): boolean {
  return plan.cityIds.includes(cityId);
}

function assertJournalNodes(nodes: unknown): void {
  if (nodes === undefined) return;
  if (!Array.isArray(nodes)) {
    throw new DataError('INVALID_JOURNAL', '手账正文结构无效');
  }
  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      throw new DataError('INVALID_JOURNAL', '手账正文包含无效节点');
    }
    const record = node as Record<string, unknown>;
    if (record.type === JOURNAL_MEDIA_NODE_NAME) {
      const attrs = record.attrs;
      if (!attrs || typeof attrs !== 'object') {
        throw new DataError('INVALID_JOURNAL', '媒体节点缺少素材 ID');
      }
      const assetId = (attrs as Record<string, unknown>).assetId;
      if (!isKnownAssetId(typeof assetId === 'string' ? assetId : undefined)) {
        throw new DataError('INVALID_JOURNAL', '媒体节点引用了无效的素材 ID');
      }
    }
    assertJournalNodes(record.content);
  }
}

export function assertJournalContent(content: JournalContent): void {
  if (!content || typeof content !== 'object' || !content.doc || typeof content.doc !== 'object') {
    throw new DataError('INVALID_JOURNAL', '手账正文不能为空');
  }
  const doc = content.doc as unknown as Record<string, unknown>;
  if (doc.type !== 'doc') {
    throw new DataError('INVALID_JOURNAL', '手账正文必须是 Tiptap doc 文档');
  }
  assertJournalNodes(doc.content);
}

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DataError('INVALID_COLLAGE', `拼贴元素缺少有效的${label}`);
  }
}

function assertCollageItem(item: CollageItem, seenIds: Set<string>): void {
  if (!item || typeof item !== 'object') {
    throw new DataError('INVALID_COLLAGE', '拼贴包含无效元素');
  }
  if (typeof item.id !== 'string' || !item.id.trim()) {
    throw new DataError('INVALID_COLLAGE', '拼贴元素缺少 ID');
  }
  if (seenIds.has(item.id)) {
    throw new DataError('INVALID_COLLAGE', '拼贴元素 ID 不能重复', { itemId: item.id });
  }
  seenIds.add(item.id);
  assertFiniteNumber(item.x, '横坐标');
  assertFiniteNumber(item.y, '纵坐标');
  assertFiniteNumber(item.width, '宽度');
  assertFiniteNumber(item.height, '高度');
  assertFiniteNumber(item.rotation, '旋转角度');
  if (item.width <= 0 || item.height <= 0) {
    throw new DataError('INVALID_COLLAGE', '拼贴元素尺寸必须大于 0', { itemId: item.id });
  }

  if (item.kind === 'photo') {
    if (!isPhotoAssetId(item.assetId)) {
      throw new DataError('INVALID_COLLAGE', '照片元素引用了无效的 photo: ID', { itemId: item.id });
    }
    return;
  }
  if (item.kind === 'sticker') {
    if (!isStickerAssetId(item.assetId)) {
      throw new DataError('INVALID_COLLAGE', '贴纸元素引用了无效的 sticker: ID', { itemId: item.id });
    }
    return;
  }
  if (item.kind === 'text') {
    if (typeof item.text !== 'string') {
      throw new DataError('INVALID_COLLAGE', '文字元素缺少文本内容', { itemId: item.id });
    }
    return;
  }
  throw new DataError('INVALID_COLLAGE', '拼贴元素类型无效', {
    itemKind: (item as { kind?: unknown }).kind,
  });
}

export function assertCollageCanvas(canvas: CollageCanvas): void {
  if (!canvas || typeof canvas !== 'object') {
    throw new DataError('INVALID_COLLAGE', '拼贴内容不能为空');
  }
  const validWidth = canvas.width === COLLAGE_CANVAS_WIDTH || canvas.width === LEGACY_COLLAGE_CANVAS_WIDTH;
  if (!validWidth || canvas.height !== COLLAGE_CANVAS_HEIGHT) {
    throw new DataError(
      'INVALID_COLLAGE',
      `拼贴逻辑画布必须是 ${COLLAGE_CANVAS_WIDTH}×${COLLAGE_CANVAS_HEIGHT}（兼容 ${LEGACY_COLLAGE_CANVAS_WIDTH}×${COLLAGE_CANVAS_HEIGHT}）`,
      { width: canvas.width, height: canvas.height },
    );
  }
  if (!Array.isArray(canvas.items)) {
    throw new DataError('INVALID_COLLAGE', '拼贴元素列表无效');
  }
  const seenIds = new Set<string>();
  for (const item of canvas.items) {
    assertCollageItem(item, seenIds);
  }
}