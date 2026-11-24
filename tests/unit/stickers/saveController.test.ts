import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStickerSaveController } from '../../../src/stickers/saveController';
import type { StickerDocument, StickerScope } from '../../../src/stickers/types';

const scopeA: StickerScope = { cityId: 'nanjing', mode: 'journal', journalId: 'book-a' };
const scopeB: StickerScope = { cityId: 'nanjing', mode: 'journal', journalId: 'book-b' };

function documentAt(x: number): StickerDocument {
  return {
    version: 1,
    pages: [[{ instanceId: 'one', assetId: 'common-train', x, y: 0.4, scale: 1, rotation: -4, z: 1 }]],
  };
}

function repository() {
  return {
    read: vi.fn((_scope: StickerScope): StickerDocument => ({ version: 1, pages: [[]] })),
    write: vi.fn((_scope: StickerScope, _doc: StickerDocument) => true),
  };
}

describe('sticker save controller', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('debounces movement and saves only its latest position', () => {
    const storage = repository();
    const controller = createStickerSaveController(scopeA, storage);
    expect(controller.getSnapshot().lastSavedAt).toBeUndefined();
    controller.flush();
    expect(controller.getSnapshot().lastSavedAt).toBeUndefined();

    controller.update(documentAt(0.4));
    vi.advanceTimersByTime(300);
    controller.update(documentAt(0.7));
    vi.advanceTimersByTime(349);
    expect(storage.write).not.toHaveBeenCalled();
    expect(controller.isDirty()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(storage.write).toHaveBeenCalledExactlyOnceWith(scopeA, documentAt(0.7));
    expect(controller.getSnapshot()).toMatchObject({ status: 'saved', dirty: false });
    expect(controller.getSnapshot().lastSavedAt).toBe(new Date().toISOString());
  });

  it('flushes the last movement before the 350ms window expires and cancels the timer', () => {
    const storage = repository();
    const controller = createStickerSaveController(scopeA, storage);
    controller.update(documentAt(0.8));
    vi.advanceTimersByTime(349);

    expect(controller.flush()).toBe(true);
    expect(storage.write).toHaveBeenCalledExactlyOnceWith(scopeA, documentAt(0.8));
    vi.runAllTimers();
    expect(storage.write).toHaveBeenCalledTimes(1);
  });

  it('writes discrete actions immediately instead of leaving a navigation race', () => {
    const storage = repository();
    const controller = createStickerSaveController(scopeA, storage);
    controller.update(documentAt(0.5), true);
    expect(storage.write).toHaveBeenCalledExactlyOnceWith(scopeA, documentAt(0.5));
    expect(controller.isDirty()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains failed drafts and retries the latest edit, without claiming a save time', () => {
    const storage = repository();
    storage.write.mockReturnValueOnce(false);
    const controller = createStickerSaveController(scopeA, storage);
    controller.update(documentAt(0.6), true);
    expect(controller.getSnapshot()).toMatchObject({ doc: documentAt(0.6), status: 'unavailable', dirty: true });
    expect(controller.getSnapshot().lastSavedAt).toBeUndefined();

    controller.update(documentAt(0.9));
    expect(controller.retry()).toBe(true);
    expect(storage.write).toHaveBeenLastCalledWith(scopeA, documentAt(0.9));
    expect(controller.isDirty()).toBe(false);
  });

  it('treats an unexpected storage exception as a retryable failure', () => {
    const storage = repository();
    storage.write.mockImplementationOnce(() => { throw new Error('Storage is unavailable'); });
    const controller = createStickerSaveController(scopeA, storage);
    controller.update(documentAt(0.65));
    expect(controller.flush()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ doc: documentAt(0.65), status: 'unavailable', dirty: true });
    expect(controller.flush()).toBe(true);
    expect(storage.write).toHaveBeenLastCalledWith(scopeA, documentAt(0.65));
  });

  it('never resurrects a discarded draft during unload, lifecycle flushes or timers', () => {
    const storage = repository();
    const controller = createStickerSaveController(scopeA, storage);
    controller.update(documentAt(0.3), true);
    const savedAt = controller.getSnapshot().lastSavedAt;
    storage.write.mockReturnValueOnce(false);
    controller.update(documentAt(0.95), true);
    expect(controller.isDirty()).toBe(true);
    controller.update(documentAt(0.99));

    controller.discardPending();
    expect(controller.getSnapshot()).toMatchObject({ doc: documentAt(0.3), dirty: false, lastSavedAt: savedAt });
    expect(controller.flush()).toBe(true);
    expect(controller.flush()).toBe(true);
    vi.runAllTimers();
    expect(storage.write).toHaveBeenCalledTimes(2);

    controller.update(documentAt(0.4), true);
    expect(storage.write).toHaveBeenLastCalledWith(scopeA, documentAt(0.4));
  });

  it('keeps old and new books isolated even if a caller reuses and mutates its scope object', () => {
    const storage = repository();
    const scope = { ...scopeA };
    const oldBook = createStickerSaveController(scope, storage);
    oldBook.update(documentAt(0.2));
    scope.journalId = scopeB.journalId;
    const newBook = createStickerSaveController(scope, storage);
    newBook.update(documentAt(0.8), true);

    // The old component's cleanup runs after the new scope has rendered.
    oldBook.flush();
    expect(storage.write.mock.calls).toEqual([
      [scopeB, documentAt(0.8)],
      [scopeA, documentAt(0.2)],
    ]);
    expect(newBook.getSnapshot().doc).toEqual(documentAt(0.8));
    expect(oldBook.getSnapshot().doc).toEqual(documentAt(0.2));
  });
});
