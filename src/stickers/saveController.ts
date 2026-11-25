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
  /** 其他标签页已修改原档，保留本页草稿并阻止覆盖。 */
  conflict?: boolean;
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
    let conflict = snapshot.conflict ?? false;
    try {
      const latest = repository.read(boundScope);
      conflict = JSON.stringify(latest) !== JSON.stringify(persisted);
      if (!conflict) saved = repository.write(boundScope, doc);
    } catch {
      // 读取或写入失败时保留内存草稿，等用户重试。
    }
    if (saved) persisted = doc;
    emit({
      doc,
      status: saved ? 'saved' : 'unavailable',
      dirty: !saved,
      readBlocked: false,
      conflict,
      lastSavedAt: saved ? new Date().toISOString() : snapshot.lastSavedAt,
    });
    return saved;
  }

  function refresh(): boolean {
    if (snapshot.dirty) return false;
    try {
      const latest = repository.read(boundScope);
      if (snapshot.readBlocked || JSON.stringify(latest) !== JSON.stringify(persisted)) {
        persisted = latest;
        emit({ doc: latest, status: 'saved', dirty: false, readBlocked: false });
      }
      return true;
    } catch {
      emit({ ...snapshot, status: 'unavailable', readBlocked: true });
      return false;
    }
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
    refresh,
    retry() {
      return snapshot.readBlocked ? refresh() : flush();
    },
    discardPending() {
      clearTimer();
      if (snapshot.readBlocked) return;
      emit({ ...snapshot, doc: persisted, status: 'saved', dirty: false, conflict: false });
      refresh();
    },
  };
}
