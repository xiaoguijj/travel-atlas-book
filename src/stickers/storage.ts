import { getStickerAsset } from './catalog';
import type { StickerDocument, StickerInstance, StickerScope } from './types';

/**
 * 贴纸存档的读写。
 *
 * 键和 Journal 正文的 travel-atlas-book.journal.<城市> 完全分开，
 * 各写各的：贴纸存坏、存不下，都不会碰已经写好的日记内容。
 * 一个作用域（城市 + 创作模式 + 第几本手账）一条记录，Collage 接进来时
 * 只是换一个 mode，不用和 Journal 抢同一个键。
 */

const PREFIX = 'travel-atlas-book.stickers';

/** 与 Journal 的分页上限对齐，再多就是粘贴出来的异常数据 */
const MAX_PAGES = 200;
const MAX_PER_PAGE = 120;

/** 缩放的允许区间，界面上的加减也按这个范围夹 */
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;

export function stickerKey(scope: StickerScope): string {
  return `${PREFIX}.${scope.cityId}.${scope.mode}.${scope.journalId}`;
}

export function readStickerDocument(scope: StickerScope): StickerDocument {
  try {
    const raw = window.localStorage.getItem(stickerKey(scope));
    if (!raw) return emptyDocument();
    return normalizeDocument(JSON.parse(raw));
  } catch {
    // 隐私模式、存储被禁用、或者键里是半截 JSON：当作没贴过，页面照样能贴
    return emptyDocument();
  }
}

/** 写不进去（配额满、隐私模式）返回 false，由界面如实说明 */
export function writeStickerDocument(scope: StickerScope, doc: StickerDocument): boolean {
  try {
    window.localStorage.setItem(stickerKey(scope), JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export function emptyDocument(): StickerDocument {
  return { version: 1, pages: [[]] };
}

export function createInstanceId(): string {
  const crypto = window.crypto;
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // 非安全上下文（http://局域网 IP）里 randomUUID 不存在，退化成时间戳 + 随机数
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 老数据、改过字段的数据、被人手改过的 JSON 都从这里过一遍。
 * 认不出来的实例直接丢掉——素材下架了不该让整个页面白屏。
 */
function normalizeDocument(parsed: unknown): StickerDocument {
  if (typeof parsed !== 'object' || parsed === null) return emptyDocument();
  const raw = parsed as { pages?: unknown };
  if (!Array.isArray(raw.pages)) return emptyDocument();

  const pages = raw.pages
    .slice(0, MAX_PAGES)
    .map((page) =>
      Array.isArray(page)
        ? page.slice(0, MAX_PER_PAGE).map(normalizeInstance).filter((item): item is StickerInstance => item !== null)
        : [],
    );
  while (pages.length < 1) pages.push([]);
  return { version: 1, pages };
}

function normalizeInstance(value: unknown): StickerInstance | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<StickerInstance>;
  if (typeof raw.assetId !== 'string' || !getStickerAsset(raw.assetId)) return null;
  return {
    instanceId: typeof raw.instanceId === 'string' && raw.instanceId !== '' ? raw.instanceId : createInstanceId(),
    assetId: raw.assetId,
    x: clamp(numberOr(raw.x, 0.5), 0, 1),
    y: clamp(numberOr(raw.y, 0.5), 0, 1),
    scale: clamp(numberOr(raw.scale, 1), MIN_SCALE, MAX_SCALE),
    rotation: numberOr(raw.rotation, 0),
    z: numberOr(raw.z, 0),
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
