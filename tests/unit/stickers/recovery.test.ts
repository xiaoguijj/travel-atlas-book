import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { createStickerSaveController } from '../../../src/stickers/saveController';
import { readStickerDocument, stickerKey, stickerRepository, writeStickerDocument } from '../../../src/stickers/storage';
import type { StickerDocument, StickerScope } from '../../../src/stickers/types';

const scope: StickerScope = { cityId: 'nanjing', mode: 'journal', journalId: 'recoverable-book' };
const key = stickerKey(scope);
const empty: StickerDocument = { version: 1, pages: [[]] };
function document(assetId: string, x = 0.4): StickerDocument {
  return { version: 1, pages: [[{ instanceId: assetId, assetId, x, y: 0.5, scale: 1, rotation: -4, z: 1 }]] };
}
const train = document('common-train');
const camera = document('common-camera');

function memoryStorage() {
  const records = new Map<string, string>();
  return {
    records,
    get length() { return records.size; },
    key: (index: number) => [...records.keys()][index] ?? null,
    getItem: vi.fn((name: string) => records.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => { records.set(name, value); }),
    removeItem: vi.fn((name: string) => { records.delete(name); }),
  };
}

function serialLocks() {
  let tail = Promise.resolve();
  let barrier: Promise<void> | undefined;
  return {
    request: vi.fn((_name: string, save: () => boolean) => {
      const result = tail.then(async () => { if (barrier) await barrier; return save(); });
      tail = result.then(() => undefined, () => undefined);
      return result;
    }),
    hold() {
      let release!: () => void;
      barrier = new Promise<void>((resolve) => { release = resolve; });
      return () => { barrier = undefined; release(); };
    },
  };
}

describe('durable sticker recovery uses the production storage adapter', () => {
  let storage: ReturnType<typeof memoryStorage>;
  let locks: ReturnType<typeof serialLocks>;

  beforeEach(() => {
    storage = memoryStorage();
    locks = serialLocks();
    let sequence = 0;
    vi.stubGlobal('window', { localStorage: storage, crypto: { randomUUID: () => `checkpoint-${++sequence}` } });
    vi.stubGlobal('navigator', { locks });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  // Natural pagehide sequence: two tabs share the same base, edit, checkpoint,
  // then disappear before their pending lock callbacks can run. No raw recovery
  // records are manufactured for valid drafts.
  function leaveDrafts(...drafts: StickerDocument[]) {
    const blocked = { ...stickerRepository, exclusive: () => new Promise<boolean>(() => {}) };
    const tabs = drafts.map(() => createStickerSaveController(scope, blocked));
    tabs.forEach((tab, index) => { tab.update(drafts[index], true); tab.checkpoint(); void tab.flush(); });
    return stickerRepository.checkpoints.list(scope).entries.map((entry) => entry.key);
  }

  it('lists every abandoned draft and keeps the main version stable across reloads until explicit choices', async () => {
    const [first, second] = leaveDrafts(train, camera);
    const remainingRaw = storage.getItem(second);
    const opened = createStickerSaveController(scope, stickerRepository);
    expect(opened.getSnapshot()).toMatchObject({ doc: empty, dirty: false, recoveryCount: 2 });
    expect(await opened.flush()).toBe(true);
    expect(readStickerDocument(scope)).toEqual(empty);
    expect(createStickerSaveController(scope, stickerRepository).getSnapshot().doc).toEqual(empty);

    expect(await opened.restoreRecovery(first)).toBe(true);
    expect(opened.getSnapshot()).toMatchObject({ doc: train, recoveryCount: 1, dirty: false });
    expect(storage.getItem(second)).toBe(remainingRaw);
    const reloaded = createStickerSaveController(scope, stickerRepository);
    await reloaded.flush();
    expect(reloaded.getSnapshot()).toMatchObject({ doc: train, recoveryCount: 1 });
    expect(readStickerDocument(scope)).toEqual(train);
    expect(await reloaded.discardRecovery(second)).toBe(true);
    expect(reloaded.getSnapshot().recoveryCount).toBe(0);
    expect(readStickerDocument(scope)).toEqual(train);
  });

  it('does not auto-restore the last remaining candidate even when it still matches the main base', async () => {
    const [first, second] = leaveDrafts(empty, camera);
    const opened = createStickerSaveController(scope, stickerRepository);
    expect(await opened.restoreRecovery(first)).toBe(true);
    const reloaded = createStickerSaveController(scope, stickerRepository);
    await reloaded.flush();
    expect(reloaded.getSnapshot()).toMatchObject({ doc: empty, recoveryCount: 1 });
    expect(storage.getItem(second)).not.toBeNull();
    expect(readStickerDocument(scope)).toEqual(empty);
  });

  it('automatically restores a single draft with an unchanged base', async () => {
    const [draftKey] = leaveDrafts(train);
    const opened = createStickerSaveController(scope, stickerRepository);
    expect(opened.getSnapshot().doc).toEqual(empty);
    expect(await opened.flush()).toBe(true);
    expect(opened.getSnapshot()).toMatchObject({ doc: train, status: 'saved', dirty: false, recoveryCount: 0 });
    expect(storage.getItem(draftKey)).toBeNull();
    expect(readStickerDocument(scope)).toEqual(train);
  });

  it('does not automatically choose a single draft after another tab changes the main version', async () => {
    const [draftKey] = leaveDrafts(train);
    const original = storage.getItem(draftKey);
    const opened = createStickerSaveController(scope, stickerRepository);
    const release = locks.hold();
    const other = createStickerSaveController(scope, { read: readStickerDocument, write: writeStickerDocument });
    other.update(camera, true);
    const saving = opened.flush();
    release();
    await saving;
    expect(readStickerDocument(scope)).toEqual(camera);
    expect(opened.getSnapshot()).toMatchObject({ doc: camera, dirty: false, recoveryCount: 1 });
    expect(storage.getItem(draftKey)).toBe(original);
    const again = createStickerSaveController(scope, stickerRepository);
    await again.flush();
    expect(again.getSnapshot().doc).toEqual(camera);
  });

  it('isolates malformed records, keeps them unchanged and lets valid candidates be restored', async () => {
    const [valid] = leaveDrafts(train);
    const broken = key + '.pending.broken';
    storage.records.set(broken, '{broken');
    const opened = createStickerSaveController(scope, stickerRepository);
    expect(opened.getSnapshot()).toMatchObject({ readBlocked: false, recoveryCount: 2, doc: empty });
    expect(opened.getSnapshot().recoveries.find((entry) => entry.key === broken)?.unreadable).toBe(true);
    expect(await opened.restoreRecovery(broken)).toBe(false);
    expect(storage.getItem(broken)).toBe('{broken');
    expect(await opened.restoreRecovery(valid)).toBe(true);
    expect(readStickerDocument(scope)).toEqual(train);
    expect(storage.getItem(broken)).toBe('{broken');
    expect(await opened.discardRecovery(broken)).toBe(true);
    expect(opened.getSnapshot().recoveryCount).toBe(0);
  });

  it('does not replay a candidate that another tab has already processed', async () => {
    const [first] = leaveDrafts(train, camera);
    const a = createStickerSaveController(scope, stickerRepository);
    const b = createStickerSaveController(scope, stickerRepository);
    const results = await Promise.all([a.restoreRecovery(first), b.restoreRecovery(first)]);
    expect(results).toEqual([true, false]);
    expect(b.getSnapshot().recoveryError).toContain('其他标签页处理');
    expect(b.getSnapshot().doc).toEqual(train);
    expect(storage.setItem.mock.calls.filter(([name]) => name === key)).toHaveLength(1);
    expect(stickerRepository.checkpoints.list(scope).entries).toHaveLength(1);
  });

  it('serializes different recovery choices through the IndexedDB fallback when Web Locks are absent', async () => {
    const [first, second] = leaveDrafts(train, camera);
    vi.stubGlobal('navigator', {});
    const a = createStickerSaveController(scope, stickerRepository);
    const b = createStickerSaveController(scope, stickerRepository);
    const results = await Promise.all([a.restoreRecovery(first), b.restoreRecovery(second)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(stickerRepository.checkpoints.list(scope).entries).toHaveLength(1);
    expect([train, camera]).toContainEqual(readStickerDocument(scope));
  });

  it('compares against the version shown before the user waited for the recovery lock', async () => {
    const [first] = leaveDrafts(train, camera);
    const opened = createStickerSaveController(scope, stickerRepository);
    const other = createStickerSaveController(scope, stickerRepository);
    const changed = document('common-gramophone');
    const release = locks.hold();
    other.update(changed, true);
    const recovering = opened.restoreRecovery(first);
    release();
    expect(await recovering).toBe(false);
    expect(readStickerDocument(scope)).toEqual(changed);
    expect(opened.getSnapshot().recoveryError).toContain('其他标签页更新');
    expect(storage.getItem(first)).not.toBeNull();
  });

  it('keeps new local edits made while a recovery decision waits for its lock', async () => {
    const [first] = leaveDrafts(train, camera);
    const opened = createStickerSaveController(scope, stickerRepository);
    const release = locks.hold();
    const recovering = opened.restoreRecovery(first);
    const fresh = document('common-gramophone');
    opened.update(fresh);
    release();
    expect(await recovering).toBe(false);
    expect(opened.getSnapshot()).toMatchObject({ doc: fresh, dirty: true });
    expect(storage.getItem(first)).not.toBeNull();
    expect(await opened.flush()).toBe(true);
    expect(readStickerDocument(scope)).toEqual(fresh);
  });

  it('preserves a failed recovery and the main document, then retries the same candidate', async () => {
    const [first] = leaveDrafts(train, camera);
    const before = storage.getItem(first);
    const opened = createStickerSaveController(scope, stickerRepository);
    storage.setItem.mockImplementation((name, value) => {
      if (name === key) throw new Error('Quota exceeded');
      storage.records.set(name, value);
    });
    expect(await opened.restoreRecovery(first)).toBe(false);
    expect(readStickerDocument(scope)).toEqual(empty);
    expect(storage.getItem(first)).toBe(before);
    storage.setItem.mockImplementation((name, value) => { storage.records.set(name, value); });
    expect(await opened.restoreRecovery(first)).toBe(true);
    expect(readStickerDocument(scope)).toEqual(train);
  });

  it.each(['automatic', 'manual'] as const)('shows the actual saved document if %s recovery cleanup fails', async (mode) => {
    const [first] = mode === 'automatic' ? leaveDrafts(train) : leaveDrafts(train, camera);
    const original = storage.getItem(first);
    const opened = createStickerSaveController(scope, stickerRepository);
    storage.removeItem.mockImplementation((name) => {
      if (name === first) throw new Error('Removal denied');
      storage.records.delete(name);
    });
    const saved = mode === 'automatic' ? await opened.flush() : await opened.restoreRecovery(first);
    expect(saved).toBe(false);
    expect(readStickerDocument(scope)).toEqual(train);
    expect(opened.getSnapshot().doc).toEqual(train);
    expect(opened.getSnapshot().recoveryError).toContain('贴纸已恢复，清理草稿失败');
    expect(storage.getItem(first)).toBe(original);
    storage.removeItem.mockImplementation((name) => { storage.records.delete(name); });
    expect(mode === 'automatic' ? await opened.retry() : await opened.restoreRecovery(first)).toBe(true);
    expect(storage.getItem(first)).toBeNull();
  });

  it('rejects a failed durable discard, retains dirty and prevents an older queued save from resurrecting it', async () => {
    const opened = createStickerSaveController(scope, stickerRepository);
    const release = locks.hold();
    opened.update(train, true);
    opened.checkpoint();
    const [pending] = stickerRepository.checkpoints.list(scope).entries;
    storage.removeItem.mockImplementation(() => { throw new Error('Removal denied'); });
    const discarding = opened.discardPending();
    release();
    await expect(discarding).rejects.toThrow('Removal denied');
    expect(opened.getSnapshot()).toMatchObject({ doc: train, dirty: true, status: 'unavailable' });
    expect(readStickerDocument(scope)).toEqual(empty);
    expect(storage.getItem(pending.key)).not.toBeNull();
    storage.removeItem.mockImplementation((name) => { storage.records.delete(name); });
    await opened.discardPending();
    expect(opened.isDirty()).toBe(false);
    await opened.flush();
    expect(readStickerDocument(scope)).toEqual(empty);
    expect(storage.getItem(pending.key)).toBeNull();
  });

  it('does not clear edits made after a durable discard started waiting', async () => {
    const opened = createStickerSaveController(scope, stickerRepository);
    const release = locks.hold();
    opened.update(train, true);
    opened.checkpoint();
    const discarding = opened.discardPending();
    opened.update(camera);
    release();
    await expect(discarding).rejects.toThrow('新修改');
    expect(opened.getSnapshot()).toMatchObject({ doc: camera, dirty: true });
    expect(await opened.flush()).toBe(true);
    expect(readStickerDocument(scope)).toEqual(camera);
  });

  it('handles a non-native lock promise rejection without losing the editable draft', async () => {
    const opened = createStickerSaveController(scope, {
      ...stickerRepository,
      exclusive: () => Dexie.Promise.reject(new Error('IndexedDB unavailable')),
    });
    opened.update(train);
    expect(await opened.flush()).toBe(false);
    expect(opened.getSnapshot()).toMatchObject({ doc: train, dirty: true, status: 'unavailable' });
    expect(readStickerDocument(scope)).toEqual(empty);
  });

  it('ignores an obsolete lock rejection after the user has discarded its local edits', async () => {
    let reject!: (reason: Error) => void;
    const opened = createStickerSaveController(scope, {
      ...stickerRepository,
      exclusive: () => new Promise<boolean>((_resolve, fail) => { reject = fail; }),
    });
    opened.update(train);
    const saving = opened.flush();
    await opened.discardPending();
    reject(new Error('Cancelled old lock'));
    expect(await saving).toBe(true);
    expect(opened.getSnapshot()).toMatchObject({ doc: empty, dirty: false, status: 'saved' });
    expect(opened.getSnapshot().recoveryError).toBeUndefined();
  });
});
