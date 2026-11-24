import type { StickerDocument, StickerScope, StickerStatus } from './types';

interface StickerRepository {
  read(scope: StickerScope): StickerDocument;
  write(scope: StickerScope, doc: StickerDocument): boolean;
}

export interface StickerSaveSnapshot {
  doc: StickerDocument;
  status: StickerStatus;
  dirty: boolean;
  /** 原档未完整读出时禁止任何修改或空档写入；仍允许无草稿离开。 */
  readBlocked: boolean;
  /** 仅由一次实际成功的写入更新；读取存档不会伪造保存时间。 */
  lastSavedAt?: string;
}

/**
 * 每个控制器固定绑定一本手账。定时器、离开补存和重试都只写这份作用域，
 * 不会在切换城市或本子之后通过可变 ref 把旧草稿写到新本上。
 * 写入是同步 localStorage；失败时保留最新草稿，明确放弃后不再补写。
 */
export function createStickerSaveController(
  scope: StickerScope,
  repository: StickerRepository,
  debounceMs = 350,
) {
  const boundScope = { ...scope };
  let persisted: StickerDocument = { version: 1, pages: [[]] };
  let readBlocked = false;
  try {
    persisted = repository.read(boundScope);
  } catch {
    readBlocked = true;
  }
  let snapshot: StickerSaveSnapshot = {
    doc: persisted,
    status: readBlocked ? 'unavailable' : 'saved',
    dirty: false,
    readBlocked,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  function emit(next: StickerSaveSnapshot): void {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function clearTimer(): void {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
  }

  function flush(): boolean {
    clearTimer();
    if (!snapshot.dirty) return true;
    const doc = snapshot.doc;
    let saved = false;
    try {
      saved = repository.write(boundScope, doc);
    } catch {
      // 仓储通常返回 false；意外抛错也不能丢掉仍在内存中的草稿。
    }
    if (saved) persisted = doc;
    emit({
      doc,
      status: saved ? 'saved' : 'unavailable',
      dirty: !saved,
      readBlocked: false,
      lastSavedAt: saved ? new Date().toISOString() : snapshot.lastSavedAt,
    });
    return saved;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isDirty: () => snapshot.dirty,
    update(doc: StickerDocument, immediate = false) {
      if (snapshot.readBlocked || doc === snapshot.doc) return;
      clearTimer();
      emit({ ...snapshot, doc, status: 'saving', dirty: true });
      if (immediate) flush();
      else timer = setTimeout(flush, debounceMs);
    },
    flush,
    retry() {
      if (!snapshot.readBlocked) return flush();
      try {
        const doc = repository.read(boundScope);
        persisted = doc;
        emit({ doc, status: 'saved', dirty: false, readBlocked: false });
        return true;
      } catch {
        // 重试读取失败仍保持保护，不能转成可写的空白本。
        return false;
      }
    },
    discardPending() {
      clearTimer();
      if (snapshot.readBlocked) return;
      emit({ ...snapshot, doc: persisted, status: 'saved', dirty: false });
    },
  };
}
