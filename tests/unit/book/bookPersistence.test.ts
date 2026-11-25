import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookSaveFeedback, coordinateBookSaves } from '../../../src/components/book/bookPersistence';
import { DataError, type TravelBook } from '../../../src/data/contracts';
import { createBookSaveQueue, type SaveQueueRepository, type SaveQueueState } from '../../../src/data/saving';
import { createStickerSaveController } from '../../../src/stickers/saveController';
import type { StickerDocument } from '../../../src/stickers/types';

const book: TravelBook = {
  id: 'book-a', cityId: 'nanjing', title: '南京手账',
  createdAt: '2026-11-24T00:00:00.000Z', updatedAt: '2026-11-24T00:00:01.000Z',
};
const scope = { cityId: 'nanjing', mode: 'journal', journalId: book.id } as const;
const empty: StickerDocument = { version: 1, pages: [[]] };
function stickersAt(x: number): StickerDocument {
  return { version: 1, pages: [[{
    instanceId: 'one', assetId: 'paper', x, y: 0.5, scale: 1, rotation: 0, z: 1,
  }]] };
}
function repository(): SaveQueueRepository {
  return {
    renameBook: vi.fn(async (_id, title) => ({ ...book, title })),
    saveJournal: vi.fn(async (_id, journal) => ({ ...book, journal })),
    saveCollage: vi.fn(async (_id, collage) => ({ ...book, collage })),
  };
}

describe('whole-book persistence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flushes the latest sticker position after an in-flight book save finishes', async () => {
    let finish!: (value: TravelBook) => void;
    const books = repository();
    books.renameBook = vi.fn(() => new Promise<TravelBook>((resolve) => { finish = resolve; }));
    const write = vi.fn(() => true);
    const stickers = createStickerSaveController(scope, { read: () => empty, write });
    const queue = createBookSaveQueue({ bookId: book.id, repository: books });
    const persistence = coordinateBookSaves(queue, stickers);

    queue.updateTitle('新标题');
    stickers.update(stickersAt(0.3));
    const saving = persistence.flush();
    stickers.update(stickersAt(0.8));
    expect(persistence.isDirty()).toBe(true);
    finish({ ...book, title: '新标题' });

    await expect(saving).resolves.toBe(true);
    expect(write).toHaveBeenCalledExactlyOnceWith(scope, stickersAt(0.8));
    expect(persistence.isDirty()).toBe(false);
  });

  it('keeps sticker-only failures dirty and retries the latest draft', async () => {
    let canWrite = false;
    const write = vi.fn(() => canWrite);
    const stickers = createStickerSaveController(scope, { read: () => empty, write });
    const queue = createBookSaveQueue({ bookId: book.id, repository: repository() });
    const persistence = coordinateBookSaves(queue, stickers);
    stickers.update(stickersAt(0.2));
    await expect(persistence.flush()).resolves.toBe(false);
    expect(queue.isDirty()).toBe(false);
    expect(persistence.isDirty()).toBe(true);
    expect(bookSaveFeedback(queue.getState(), stickers.getSnapshot()).state.status).toBe('error');

    stickers.update(stickersAt(0.7));
    canWrite = true;
    await expect(persistence.flush()).resolves.toBe(true);
    expect(write).toHaveBeenLastCalledWith(scope, stickersAt(0.7));
    expect(persistence.isDirty()).toBe(false);
    expect(bookSaveFeedback(queue.getState(), stickers.getSnapshot()).state.status).toBe('saved');
  });

  it('a book save failure keeps navigation blocked even when stickers save successfully', async () => {
    const books = repository();
    books.renameBook = vi.fn(async () => { throw new DataError('INVALID_TITLE', '标题不能为空'); });
    const queue = createBookSaveQueue({ bookId: book.id, repository: books });
    const write = vi.fn(() => true);
    const stickers = createStickerSaveController(scope, { read: () => empty, write });
    const persistence = coordinateBookSaves(queue, stickers);
    queue.updateTitle('');
    stickers.update(stickersAt(0.6));

    await expect(persistence.flush()).resolves.toBe(false);
    expect(write).toHaveBeenCalledOnce();
    expect(persistence.isDirty()).toBe(true);
    expect(bookSaveFeedback(queue.getState(), stickers.getSnapshot()).state.status).toBe('error');
  });

  it('explicit discard clears both pending paths and later cleanup cannot save them', async () => {
    const books = repository();
    const write = vi.fn(() => true);
    const queue = createBookSaveQueue({ bookId: book.id, repository: books });
    const stickers = createStickerSaveController(scope, { read: () => empty, write });
    const persistence = coordinateBookSaves(queue, stickers);
    queue.updateTitle('放弃的标题');
    stickers.update(stickersAt(0.9));
    await persistence.discardPending();

    await expect(persistence.flush()).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(books.renameBook).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(persistence.isDirty()).toBe(false);
  });

  it('reports partial failure and pending changes instead of claiming the whole book is saved', () => {
    const saved: SaveQueueState = {
      status: 'saved', error: null, pending: [], lastSavedAt: '2026-11-24T00:00:01.000Z',
    };
    const failed = bookSaveFeedback(saved, { status: 'unavailable', dirty: true });
    expect(failed.state.status).toBe('error');
    expect(failed.message).toBe('正文已保存，贴纸保存失败');
    expect(bookSaveFeedback(saved, { status: 'saving', dirty: true }).state.status).toBe('saving');
    const complete = bookSaveFeedback(saved, {
      status: 'saved', dirty: false, lastSavedAt: '2026-11-24T00:00:02.000Z',
    });
    expect(complete.state.status).toBe('saved');
    expect(complete.state.lastSavedAt).toBe('2026-11-24T00:00:02.000Z');
    expect(bookSaveFeedback({ status: 'ready', pending: [], error: null }, {
      status: 'saved', dirty: false,
    }).state.status).toBe('ready');
    expect(bookSaveFeedback({ status: 'ready', pending: [], error: null }, {
      status: 'saved', dirty: false,
    }, true).message).toBe('正文读取失败，原文已保留');
    expect(bookSaveFeedback(saved, { status: 'saved', dirty: false }, true).message)
      .toBe('其他修改已保存，正文保护中');
    expect(bookSaveFeedback(saved, { status: 'unavailable', dirty: true }, true).message)
      .toBe('贴纸保存失败，正文保护中');
    expect(bookSaveFeedback(saved, {
      status: 'unavailable', dirty: false, readBlocked: true,
    }).message).toBe('贴纸读取失败，原存档已保留');
    const multipleFailures = bookSaveFeedback({
      status: 'error', pending: ['title'], error: new DataError('INVALID_TITLE', '标题不能为空'),
    }, { status: 'unavailable', dirty: false, readBlocked: true }, true);
    expect(multipleFailures.message).toBe('标题保存失败、贴纸读取失败，正文保护中');
    expect(multipleFailures.state.error?.message).toContain('标题不能为空');
  });

  it('pauses body writes until an asynchronous sticker discard finishes', async () => {
    let finish!: () => void;
    const books = repository();
    const queue = createBookSaveQueue({ bookId: book.id, repository: books });
    const stickers = {
      flush: () => false,
      isDirty: () => true,
      discardPending: () => new Promise<void>((resolve) => { finish = resolve; }),
    };
    queue.updateTitle('明确放弃的标题');
    const persistence = coordinateBookSaves(queue, stickers);
    const discarding = persistence.discardPending();
    await vi.advanceTimersByTimeAsync(2000);
    expect(books.renameBook).not.toHaveBeenCalled();
    expect(queue.hasPending()).toBe(true);
    finish();
    await discarding;
    await queue.flush();
    expect(queue.hasPending()).toBe(false);
    expect(books.renameBook).not.toHaveBeenCalled();
  });

  it('keeps a failed body draft when sticker checkpoint deletion fails', async () => {
    const books = repository();
    books.renameBook = vi.fn(async () => { throw new DataError('INVALID_TITLE', '标题不能为空'); });
    const queue = createBookSaveQueue({ bookId: book.id, repository: books });
    queue.updateTitle('');
    await expect(queue.flush()).resolves.toBe(false);
    const persistence = coordinateBookSaves(queue, {
      flush: () => false,
      isDirty: () => true,
      discardPending: async () => { throw new Error('checkpoint could not be removed'); },
    });
    await expect(persistence.discardPending()).rejects.toThrow('checkpoint could not be removed');
    expect(queue.hasPending()).toBe(true);
    expect(queue.isDirty()).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(books.renameBook).toHaveBeenCalledTimes(1);
  });

  it('reports durable unresolved recoveries even when all current edits are saved', () => {
    const saved: SaveQueueState = { status: 'saved', pending: [], error: null };
    const feedback = bookSaveFeedback(saved, { status: 'saved', dirty: false, recoveryCount: 2 });
    expect(feedback.state.status).toBe('ready');
    expect(feedback.message).toBe('还有 2 份贴纸草稿待处理');
    const failed = bookSaveFeedback({ ...saved, status: 'error', error: new DataError('INVALID_TITLE', '标题不能为空') }, {
      status: 'saved', dirty: false, recoveryCount: 1,
    });
    expect(failed.state.status).toBe('error');
    expect(failed.state.error?.message).toContain('标题不能为空');
    expect(failed.message).toContain('保存失败');
    expect(failed.message).toContain('还有 1 份贴纸草稿待处理');
    const unknownInventory = bookSaveFeedback(saved, {
      status: 'saved', dirty: false, recoveryCount: 0, recoveryError: '暂时无法读取待恢复的贴纸草稿',
    });
    expect(unknownInventory.state.status).toBe('error');
    expect(unknownInventory.message).toBe('贴纸草稿处理未完成');
    expect(unknownInventory.state.error?.message).toContain('暂时无法读取');
    const blocked = bookSaveFeedback(saved, {
      status: 'saved', dirty: false, recoveryError: '暂时无法读取待恢复的贴纸草稿',
    }, true);
    expect(blocked.message).toBe('贴纸草稿处理未完成，正文保护中');
    expect(blocked.message).not.toContain('标题保存失败');
  });

  it('keeps a journal conflict visible while newer edits are waiting to retry', () => {
    const conflict = bookSaveFeedback({ status: 'saving', error: null, pending: ['journal'], journalConflict: true }, {
      status: 'saved', dirty: false,
    });
    expect(conflict.state.status).toBe('error');
    expect(conflict.message).toBe('正文保存冲突，草稿已保留');
    expect(conflict.state.error?.code).toBe('JOURNAL_CONFLICT');
  });
});
