import { DataError } from '../../data/contracts';
import type { BookSaveQueue, SaveQueueState } from '../../data/saving';

/** The sticker document stays separate; the shell coordinates both persistence paths. */
export interface StickerPersistence {
  status: 'saved' | 'saving' | 'unavailable';
  dirty: boolean;
  readBlocked?: boolean;
  conflict?: boolean;
  recoveryCount?: number;
  recoveryError?: string;
  lastSavedAt?: string;
  flush(): boolean | Promise<boolean>;
  isDirty(): boolean;
  discardPending(): void | Promise<void>;
}

export type BookPersistence = Pick<BookSaveQueue, 'flush' | 'isDirty'> & {
  discardPending(): void | Promise<void>;
};

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
      const stickersSaved = await stickers.flush();
      return bookSaved && stickersSaved && !queue.isDirty() && !stickers.isDirty();
    },
    async discardPending() {
      // Do not let a body debounce expire while waiting for another tab's
      // sticker lock. If deletion fails, the body draft must still be available.
      const resume = queue.pauseAutoSave();
      try {
        await stickers.discardPending();
        queue.discardPending();
      } finally {
        resume();
      }
    },
  };
}

export function bookSaveFeedback(
  book: SaveQueueState,
  stickers: Pick<StickerPersistence, 'status' | 'dirty' | 'lastSavedAt' | 'readBlocked' | 'conflict' | 'recoveryCount' | 'recoveryError'> | undefined,
  journalBlocked = false,
): { state: SaveQueueState; message?: string } {
  const journalConflict = Boolean(book.journalConflict || book.error?.code === 'JOURNAL_CONFLICT');
  if (journalConflict) {
    const explanation = '另一个标签页已更新正文，本页草稿已保留。可先另存本页正文，再在副本中继续编辑。';
    book = {
      ...book,
      status: 'error',
      error: new DataError('JOURNAL_CONFLICT', book.error && book.error.code !== 'JOURNAL_CONFLICT'
        ? `${book.error.message}；${explanation}` : explanation),
    };
  }
  if (!stickers) return { state: book, message: journalConflict ? '正文保存冲突，草稿已保留' : undefined };

  const bookFailed = book.status === 'error';
  const stickersFailed = stickers.status === 'unavailable';
  const saving = book.status === 'saving' || book.pending.length > 0 || stickers.dirty;
  const lastSavedAt = [book.lastSavedAt, stickers.lastSavedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();
  const recoveryCount = stickers.recoveryCount ?? 0;
  const status = bookFailed || stickersFailed || stickers.recoveryError
    ? 'error'
    : saving
      ? 'saving'
      : recoveryCount > 0
        ? 'ready'
        : book.status === 'saved' || stickers.lastSavedAt
        ? 'saved'
        : 'ready';

  let message: string | undefined = journalConflict ? '正文保存冲突，草稿已保留'
    : bookFailed ? '手账保存失败' : undefined;
  let error = book.error;
  if (stickers.readBlocked) {
    message = bookFailed ? '手账保存失败，贴纸读取失败' : '贴纸读取失败，原存档已保留';
    error = new DataError(
      'DATABASE_UNAVAILABLE',
      `${bookFailed ? `${book.error?.message ?? '手账内容保存失败'}；` : ''}贴纸存档暂时无法读取，原始记录已保留。请重试读取，恢复前不会覆盖原存档。`,
    );
  } else if (stickers.conflict) {
    message = bookFailed ? '手账保存失败，贴纸有冲突' : '贴纸保存冲突，草稿已保留';
    const conflictMessage = '另一个标签页已更新贴纸。本页草稿仍可查看。若要载入对方版本，请在离开提示中选择「放弃修改并离开」后重新打开。';
    error = new DataError(
      'STORAGE_WRITE_FAILED',
      bookFailed ? `${book.error?.message ?? '手账内容保存失败'}；${conflictMessage}` : conflictMessage,
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

  if (stickers.recoveryError) {
    message = message ? `${message}；贴纸草稿处理未完成` : '贴纸草稿处理未完成';
    error = new DataError(
      'STORAGE_WRITE_FAILED',
      error ? `${error.message}；${stickers.recoveryError}` : stickers.recoveryError,
    );
  }

  if (journalBlocked && (stickers.conflict || stickers.recoveryError)) {
    message += '，正文保护中';
  } else if (journalBlocked) {
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

  if (recoveryCount > 0) {
    const recoveryMessage = `还有 ${recoveryCount} 份贴纸草稿待处理`;
    message = message ? `${message}；${recoveryMessage}`
      : status === 'saving' ? `正在保存；${recoveryMessage}` : recoveryMessage;
  }

  return {
    state: { ...book, status, error, lastSavedAt },
    message,
  };
}
