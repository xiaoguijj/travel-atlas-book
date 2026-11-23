import {
  DataError,
  isDataError,
  type CollageCanvas,
  type EditorSaveStatus,
  type IsoDateTime,
  type JournalContent,
  type TravelBook,
} from '../contracts';

export type SaveField = 'title' | 'journal' | 'collage';

export interface SaveQueueState {
  status: EditorSaveStatus;
  error: DataError | null;
  lastSavedAt?: IsoDateTime;
  /** 当前等待写入的字段，供界面提示「还有草稿未保存」。 */
  pending: SaveField[];
}

/** 只暴露保存队列需要的三个仓储方法，测试可以注入失败或延迟实现。 */
export interface SaveQueueRepository {
  renameBook(bookId: string, title: string): Promise<TravelBook>;
  saveJournal(bookId: string, content: JournalContent): Promise<TravelBook>;
  saveCollage(bookId: string, canvas: CollageCanvas): Promise<TravelBook>;
}

export interface SaveQueueOptions {
  bookId: string;
  repository: SaveQueueRepository;
  /** 停手多久后写盘；默认 700ms。 */
  debounceMs?: number;
  /** 单字段保存成功后的回调，用于让页面持有最新书对象。 */
  onSaved?: (field: SaveField, book: TravelBook) => void;
}

export interface BookSaveQueue {
  updateTitle(title: string): void;
  updateJournal(content: JournalContent): void;
  updateCollage(canvas: CollageCanvas): void;
  /** 立即写入当前草稿；失败时草稿仍留在队列里，可再次调用重试。 */
  flush(): Promise<boolean>;
  /** 放弃尚未写入的草稿，用于离开前用户明确选择不保存。 */
  discardPending(): void;
  hasPending(): boolean;
  isDirty(): boolean;
  subscribe(listener: () => void): () => void;
  getState(): SaveQueueState;
  dispose(): void;
}

interface PendingEntry {
  field: SaveField;
  payload: unknown;
  revision: number;
}

const DEFAULT_DEBOUNCE_MS = 700;

function asDataError(error: unknown): DataError {
  if (isDataError(error)) return error;
  return new DataError('STORAGE_WRITE_FAILED', '保存失败，请重试', {
    cause: (error as { message?: unknown } | null)?.message,
  });
}

/**
 * 按书建立的唯一保存队列。标题、Journal、Collage 各保留最新一版草稿，
 * 同一时间只发出一个写入请求；失败时失败字段的草稿不会丢，成功字段也不会被旧对象覆盖。
 *
 * 队列构造时固定 bookId，跨书切换时旧队列只会写旧书，新页面用新队列。
 */
export function createBookSaveQueue(options: SaveQueueOptions): BookSaveQueue {
  const { bookId, repository, onSaved } = options;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  let pending = new Map<SaveField, PendingEntry>();
  let revision = 0;
  let discardedThrough = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<boolean> | null = null;
  let disposed = false;
  let lastSavedAt: IsoDateTime | undefined;

  let state: SaveQueueState = {
    status: 'ready',
    error: null,
    pending: [],
  };
  const listeners = new Set<() => void>();

  function pendingFields(): SaveField[] {
    return Array.from(pending.keys());
  }

  function emit(next: Partial<Omit<SaveQueueState, 'pending'>>): void {
    state = { ...state, ...next, pending: pendingFields() };
    for (const listener of listeners) listener();
  }

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function schedule(): void {
    if (disposed) return;
    clearTimer();
    timer = setTimeout(() => {
      timer = undefined;
      void drain();
    }, debounceMs);
  }

  async function write(entry: PendingEntry): Promise<TravelBook> {
    const { payload } = entry;
    switch (entry.field) {
      case 'title':
        return repository.renameBook(bookId, payload as string);
      case 'journal':
        return repository.saveJournal(bookId, payload as JournalContent);
      case 'collage':
        return repository.saveCollage(bookId, payload as CollageCanvas);
    }
  }

  function drain(): Promise<boolean> {
    if (active) return active;

    active = (async () => {
      clearTimer();
      while (pending.size > 0) {
        const first = pending.entries().next().value as [SaveField, PendingEntry];
        const [field, entry] = first;
        pending.delete(field);
        emit({ status: 'saving', error: null });

        let saved: TravelBook;
        try {
          saved = await write(entry);
        } catch (error) {
          // 用户已经明确放弃这一版：失败就失败，不再放回队列。
          if (entry.revision <= discardedThrough) continue;
          // 只有还没有更新版草稿时才把失败这一版放回去，避免重试时写回旧内容。
          if (!pending.has(field)) pending.set(field, entry);
          emit({ status: 'error', error: asDataError(error) });
          return false;
        }

        lastSavedAt = saved.updatedAt;
        try {
          onSaved?.(field, saved);
        } catch {
          // 页面回调不应影响保存结果。
        }
      }

      emit({ status: 'saved', error: null, lastSavedAt });
      return true;
    })().finally(() => {
      active = null;
    });

    return active;
  }

  function enqueue(field: SaveField, payload: unknown): void {
    if (disposed) return;
    revision += 1;
    pending.set(field, { field, payload, revision });
    emit({ status: 'saving', error: null });
    schedule();
  }

  async function flush(): Promise<boolean> {
    clearTimer();
    let ok = true;
    while (pending.size > 0 || active) {
      const run = active ?? drain();
      ok = await run;
      if (!ok) return false;
    }
    return true;
  }

  return {
    updateTitle(title) {
      enqueue('title', title);
    },
    updateJournal(content) {
      enqueue('journal', content);
    },
    updateCollage(canvas) {
      enqueue('collage', canvas);
    },
    flush,
    discardPending() {
      clearTimer();
      discardedThrough = revision;
      pending = new Map();
      emit({ status: active ? 'saving' : 'ready', error: null });
    },
    hasPending() {
      return pending.size > 0;
    },
    isDirty() {
      return pending.size > 0 || state.status === 'saving' || state.status === 'error';
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState() {
      return state;
    },
    dispose() {
      disposed = true;
      clearTimer();
      listeners.clear();
    },
  };
}