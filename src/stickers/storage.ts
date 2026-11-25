import { db } from '../data/db';
import { getStickerAsset } from './catalog';
import type { StickerDocument, StickerInstance, StickerScope } from './types';

/**
 * 贴纸存档的读写。
 *
 * 贴纸的 localStorage 键和 Journal 正文的 IndexedDB 记录完全分开，
 * 各写各的：贴纸存坏、存不下，都不会碰已经写好的日记内容。
 * 一个作用域（城市 + 创作模式 + 第几本手账）一条记录，Collage 接进来时
 * 只是换一个 mode，不用和 Journal 抢同一个键。
 */

const PREFIX = 'travel-atlas-book.stickers';

/** 缩放的允许区间，界面上的加减也按这个范围夹 */
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;

export function stickerKey(scope: StickerScope): string {
  return `${PREFIX}.${scope.cityId}.${scope.mode}.${scope.journalId}`;
}

export function readStickerDocument(scope: StickerScope): StickerDocument {
  const raw = window.localStorage.getItem(stickerKey(scope));
  // 只有键确实不存在才是新本。拒绝读取、空字符串、坏 JSON 和不兼容文档
  // 都向上报告，宿主必须暂停编辑，不能拿空档覆盖尚未读出的旧贴纸。
  if (raw === null) return emptyDocument();
  const parsed: unknown = JSON.parse(raw);
  assertDocument(parsed);
  return parsed;
}

/** 写不进去（配额满、隐私模式）返回 false，由界面如实说明 */
export function writeStickerDocument(scope: StickerScope, doc: StickerDocument): boolean {
  try {
    assertDocument(doc);
    window.localStorage.setItem(stickerKey(scope), JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export function emptyDocument(): StickerDocument {
  return { version: 1, pages: [[]] };
}

/** Only the read/compare/write section runs under this cross-tab lock. */
function withStickerWriteLock(scope: StickerScope, save: () => boolean): Promise<boolean> {
  if (navigator.locks) return navigator.locks.request(stickerKey(scope), save);
  // Web Locks require HTTPS. A readwrite transaction also serializes tabs on LAN HTTP.
  return db.transaction('rw', db.books, async () => {
    await db.books.where(':id').equals(scope.journalId).count();
    return save();
  });
}

export interface StickerCheckpoint {
  key: string;
  base: StickerDocument;
  draft: StickerDocument;
}

// pagehide cannot wait for a lock. Give each departing editor a separate durable
// slot so that closing tabs can never overwrite another editor's pending draft.
function readStickerCheckpoint(scope: StickerScope): StickerCheckpoint | undefined {
  const prefix = stickerKey(scope) + '.pending.';
  const storage = window.localStorage;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const { base, draft } = JSON.parse(raw);
    assertDocument(base);
    assertDocument(draft);
    return { key, base, draft };
  }
}

function saveStickerCheckpoint(checkpoint: StickerCheckpoint): void {
  window.localStorage.setItem(checkpoint.key, JSON.stringify({ base: checkpoint.base, draft: checkpoint.draft }));
}

export const stickerRepository = {
  read: readStickerDocument,
  write: writeStickerDocument,
  exclusive: withStickerWriteLock,
  checkpoints: {
    read: readStickerCheckpoint,
    createKey: (scope: StickerScope) => stickerKey(scope) + '.pending.' + createInstanceId(),
    write: saveStickerCheckpoint,
    remove: (key: string) => window.localStorage.removeItem(key),
  },
};

export function createInstanceId(): string {
  const crypto = window.crypto;
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // 非安全上下文（http://局域网 IP）里 randomUUID 不存在，退化成时间戳 + 随机数
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 校验后原样读取，不裁页数/贴纸数、不补默认值、不静默删除未知实例。
 * 任一字段不兼容都保留原始存档并报告错误，避免下一次自动保存固化数据损失。
 */
function assertDocument(parsed: unknown): asserts parsed is StickerDocument {
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.pages)) {
    throw new Error('贴纸存档格式不兼容，原数据已保留。');
  }
  for (const page of parsed.pages) {
    if (!Array.isArray(page)) throw new Error('贴纸页格式不兼容，原数据已保留。');
    const ids = new Set<string>();
    for (const instance of page) {
      assertInstance(instance);
      if (ids.has(instance.instanceId)) throw new Error('贴纸编号重复，原数据已保留。');
      ids.add(instance.instanceId);
    }
  }
}

function assertInstance(value: unknown): asserts value is StickerInstance {
  if (!isRecord(value)
    || typeof value.instanceId !== 'string' || value.instanceId.trim() === ''
    || typeof value.assetId !== 'string' || !getStickerAsset(value.assetId)
    || !finiteInRange(value.x, 0, 1) || !finiteInRange(value.y, 0, 1)
    || !finiteInRange(value.scale, MIN_SCALE, MAX_SCALE)
    || !finiteInRange(value.rotation) || !finiteInRange(value.z)) {
    throw new Error('贴纸内容暂时无法完整读取，原数据已保留。');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteInRange(value: unknown, min = -Infinity, max = Infinity): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
