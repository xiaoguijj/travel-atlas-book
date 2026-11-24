import { DataError } from '../../data/contracts';
import type { BookSaveQueue, SaveQueueState } from '../../data/saving';

/** The sticker document stays separate; the shell coordinates both persistence paths. */
export interface StickerPersistence {
  status: 'saved' | 'saving' | 'unavailable';
  dirty: boolean;
  readBlocked?: boolean;
  lastSavedAt?: string;
  flush(): boolean;
  isDirty(): boolean;
  discardPending(): void;
}

export type BookPersistence = Pick<BookSaveQueue, 'flush' | 'isDirty' | 'discardPending'>;

export function coordinateBookSaves(
  queue: BookSaveQueue,
  stickers: Pick<StickerPersistence, 'flush' | 'isDirty' | 'discardPending'>,
): BookPersistence {
  return {
    isDirty: () => queue.isDirty() || stickers.isDirty(),
    async flush() {
      const bookSaved = await queue.flush();
      // Read the latest sticker draft AFTER the asynchronous book save. A gesture
      // may have changed it while IndexedDB was still finishing its transaction.
      const stickersSaved = stickers.flush();
      return bookSaved && stickersSaved && !queue.isDirty() && !stickers.isDirty();
    },
    discardPending() {
      queue.discardPending();
      stickers.discardPending();
    },
  };
}

export function bookSaveFeedback(
  book: SaveQueueState,
  stickers: Pick<StickerPersistence, 'status' | 'dirty' | 'lastSavedAt' | 'readBlocked'>,
  journalBlocked = false,
): { state: SaveQueueState; message?: string } {
  const bookFailed = book.status === 'error';
  const stickersFailed = stickers.status === 'unavailable';
  const saving = book.status === 'saving' || book.pending.length > 0 || stickers.dirty;
  const lastSavedAt = [book.lastSavedAt, stickers.lastSavedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();
  const status = bookFailed || stickersFailed
    ? 'error'
    : saving
      ? 'saving'
      : book.status === 'saved' || stickers.lastSavedAt
        ? 'saved'
        : 'ready';

  let message: string | undefined;
  let error = book.error;
  if (stickers.readBlocked) {
    message = bookFailed ? '手账保存失败，贴纸读取失败' : '贴纸读取失败，原存档已保留';
    error = new DataError(
      'DATABASE_UNAVAILABLE',
      `${bookFailed ? `${book.error?.message ?? '手账内容保存失败'}；` : ''}贴纸存档暂时无法读取，原始记录已保留。请重试读取，恢复前不会覆盖原存档。`,
    );
  } else if (stickersFailed) {
    message = bookFailed
      ? '手账内容与贴纸保存失败'
      : book.status === 'saved'
        ? '正文已保存，贴纸保存失败'
        : '贴纸保存失败';
    error = new DataError(
      'STORAGE_WRITE_FAILED',
      bookFailed
        ? `${book.error?.message ?? '手账内容保存失败'}；贴纸也尚未保存，请重试。`
        : '贴纸尚未保存，最新修改仍保留在本页。请重试，保存成功后再离开。',
    );
  }

  if (journalBlocked) {
    message = stickers.readBlocked
      ? `${bookFailed ? '标题保存失败、' : ''}贴纸读取失败，正文保护中`
      : status === 'ready'
        ? '正文读取失败，原文已保留'
        : status === 'error'
          ? `${stickersFailed ? (bookFailed ? '标题和贴纸' : '贴纸') : '标题'}保存失败，正文保护中`
          : status === 'saving'
            ? '正在保存其他修改，正文保护中'
            : '其他修改已保存，正文保护中';
  }

  return {
    state: { ...book, status, error, lastSavedAt },
    message,
  };
}
