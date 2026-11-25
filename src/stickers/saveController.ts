import type { StickerCheckpoint, StickerCheckpointEntry, StickerCheckpointList } from './storage';
import type { StickerDocument, StickerScope, StickerStatus } from './types';

interface StickerRepository {
  exclusive?(scope: StickerScope, save: () => boolean): Promise<boolean>;
  checkpoints?: {
    list(scope: StickerScope): StickerCheckpointList;
    read(scope: StickerScope, key: string): StickerCheckpointEntry | undefined;
    requireSelection(scope: StickerScope): void;
    createKey(scope: StickerScope): string;
    write(scope: StickerScope, checkpoint: StickerCheckpoint): void;
    remove(scope: StickerScope, key: string): void;
  };
  read(scope: StickerScope): StickerDocument;
  write(scope: StickerScope, doc: StickerDocument): boolean;
}

export interface StickerRecoveryCandidate {
  key: string;
  unreadable: boolean;
  stickerCount: number;
  pageCount: number;
  previewAssetIds: readonly string[];
}

export interface StickerSaveSnapshot {
  doc: StickerDocument;
  status: StickerStatus;
  dirty: boolean;
  readBlocked: boolean;
  conflict?: boolean;
  lastSavedAt?: string;
  recoveries: readonly StickerRecoveryCandidate[];
  recoveryCount: number;
  recoveryError?: string;
}

const sameDocument = (a: StickerDocument, b: StickerDocument) => JSON.stringify(a) === JSON.stringify(b);
type SaveState = Omit<StickerSaveSnapshot, 'recoveries' | 'recoveryCount' | 'recoveryError'>;

/** Bound to one book; all writes and recovery decisions share its cross-tab lock. */
export function createStickerSaveController(scope: StickerScope, repository: StickerRepository, debounceMs = 350) {
  const boundScope = { ...scope };
  let persisted: StickerDocument = { version: 1, pages: [[]] };
  let inventory: StickerCheckpointList = { entries: [], selectionRequired: false };
  let recoveryError: string | undefined;
  let automaticKey: string | undefined;
  let requireManualSelection = false;
  const ownedCheckpoints = new Set<string>();
  let editVersion = 0;
  let writeEpoch = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  function readInventory(): boolean {
    try {
      inventory = repository.checkpoints?.list(boundScope) ?? { entries: [], selectionRequired: false };
      return true;
    } catch {
      recoveryError = '暂时无法读取待恢复的贴纸草稿，原始记录已保留。请重试读取。';
      return false;
    }
  }

  function withRecovery(state: SaveState): StickerSaveSnapshot {
    const recoveries = inventory.entries.map(({ key, checkpoint }): StickerRecoveryCandidate => {
      const instances = checkpoint?.draft.pages.flat() ?? [];
      return {
        key,
        unreadable: !checkpoint,
        stickerCount: instances.length,
        pageCount: checkpoint?.draft.pages.length ?? 0,
        previewAssetIds: [...new Set(instances.map((instance) => instance.assetId))].slice(0, 4),
      };
    });
    return { ...state, recoveries, recoveryCount: recoveries.length, recoveryError };
  }

  function load(): StickerSaveSnapshot {
    let current: StickerDocument;
    try {
      current = repository.read(boundScope);
    } catch {
      return withRecovery({ doc: persisted, status: 'unavailable', dirty: false, readBlocked: true });
    }
    persisted = current;
    automaticKey = undefined;
    if (readInventory() && !inventory.selectionRequired && inventory.entries.length === 1) {
      const recovery = inventory.entries[0].checkpoint;
      if (recovery && (sameDocument(current, recovery.base) || sameDocument(current, recovery.draft))) {
        automaticKey = recovery.key;
      }
    }
    // Durable candidates are not unsaved edits in this tab. Keep the main
    // document visible until the sole, unchanged-baseline recovery commits.
    return withRecovery({ doc: current, status: automaticKey ? 'saving' : 'saved', dirty: false, readBlocked: false });
  }

  let snapshot = load();

  function emit(next: SaveState): void {
    snapshot = withRecovery(next);
    for (const listener of listeners) listener();
  }

  function clearTimer(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function exclusive(save: () => boolean): boolean | Promise<boolean> {
    return repository.exclusive ? repository.exclusive(boundScope, save) : save();
  }

  /** Called only under the write lock; never removes another tab's slot. */
  function clearOwnedCheckpoints(): void {
    for (const key of ownedCheckpoints) {
      repository.checkpoints?.remove(boundScope, key);
      ownedCheckpoints.delete(key);
    }
  }

  function checkpoint(): void {
    if (!snapshot.dirty || !repository.checkpoints) return;
    try {
      // Keep older slots until a locked save/discard finishes. Synchronous
      // pagehide cleanup must not race another tab recovering an older slot.
      const key = repository.checkpoints.createKey(boundScope);
      ownedCheckpoints.add(key);
      repository.checkpoints.write(boundScope, { key, base: persisted, draft: snapshot.doc });
      readInventory();
      emit(snapshot);
    } catch {
      recoveryError = '关页草稿暂时无法保存，请留在本页重试保存。';
      emit({ ...snapshot, status: 'unavailable' });
    }
  }

  function automaticRecovery(): boolean | Promise<boolean> {
    const key = automaticKey;
    if (!key || !repository.checkpoints) return true;
    return exclusive(() => {
      if (automaticKey !== key || snapshot.dirty) return !snapshot.dirty;
      const current = repository.read(boundScope);
      const listing = repository.checkpoints!.list(boundScope);
      inventory = listing;
      const recovery = listing.entries.find((item) => item.key === key)?.checkpoint;
      if (!recovery || listing.selectionRequired || listing.entries.length !== 1
        || (!sameDocument(current, recovery.base) && !sameDocument(current, recovery.draft))) {
        automaticKey = undefined;
        if (listing.entries.length > 0) repository.checkpoints!.requireSelection(boundScope);
        persisted = current;
        recoveryError = listing.entries.length > 0 ? '检测到其他版本，请选择要恢复的贴纸草稿。' : undefined;
        emit({ doc: current, status: 'saved', dirty: false, readBlocked: false });
        return true;
      }
      const wrote = !sameDocument(current, recovery.draft);
      if (wrote && !repository.write(boundScope, recovery.draft)) {
        recoveryError = '这份贴纸草稿暂时无法恢复，原始草稿已保留。请重试。';
        emit({ ...snapshot, status: 'unavailable' });
        return false;
      }
      persisted = recovery.draft;
      const restoredState: SaveState = { doc: persisted, status: 'saved', dirty: false, readBlocked: false,
        lastSavedAt: wrote ? new Date().toISOString() : snapshot.lastSavedAt };
      try {
        repository.checkpoints!.remove(boundScope, key);
      } catch {
        recoveryError = '贴纸已恢复，清理草稿失败。尚未移除的草稿仍会列在这里，请重试。';
        readInventory();
        emit(restoredState);
        return false;
      }
      automaticKey = undefined;
      recoveryError = undefined;
      readInventory();
      emit(restoredState);
      return true;
    });
  }

  function saveNow(): boolean {
    if (!snapshot.dirty) return true;
    const doc = snapshot.doc;
    let saved = false;
    let wrote = false;
    let conflict = snapshot.conflict ?? false;
    try {
      const latest = repository.read(boundScope);
      const alreadySaved = sameDocument(latest, doc);
      conflict = !alreadySaved && !sameDocument(latest, persisted);
      if (requireManualSelection && repository.checkpoints
        && repository.checkpoints.list(boundScope).entries.length > 0) repository.checkpoints.requireSelection(boundScope);
      wrote = !alreadySaved && !conflict && repository.write(boundScope, doc);
      saved = alreadySaved || wrote;
      if (saved) {
        persisted = doc;
        clearOwnedCheckpoints();
        recoveryError = undefined;
        readInventory();
        if (inventory.entries.length === 0) requireManualSelection = false;
      }
    } catch {
      saved = false;
    }
    emit({ doc, status: saved ? 'saved' : 'unavailable', dirty: !saved, readBlocked: false, conflict,
      lastSavedAt: wrote ? new Date().toISOString() : snapshot.lastSavedAt });
    return saved;
  }

  function flush(): boolean | Promise<boolean> {
    clearTimer();
    const epoch = writeEpoch;
    try {
      const result = snapshot.dirty
        ? exclusive(() => epoch === writeEpoch ? saveNow() : !snapshot.dirty)
        : automaticRecovery();
      // IndexedDB uses Dexie's Promise implementation, which need not share
      // the global Promise prototype. Both lock providers must report errors.
      if (typeof result === 'boolean') return result;
      return result.catch(() => {
        if (epoch !== writeEpoch) return !snapshot.dirty;
        recoveryError = '贴纸保存或恢复暂时失败，草稿仍已保留。请重试。';
        emit({ ...snapshot, status: 'unavailable' });
        return false;
      });
    } catch {
      if (epoch !== writeEpoch) return !snapshot.dirty;
      emit({ ...snapshot, status: 'unavailable' });
      return false;
    }
  }

  function refresh(): boolean {
    readInventory();
    if (snapshot.dirty) {
      emit(snapshot);
      return false;
    }
    if (snapshot.readBlocked) {
      snapshot = load();
      emit(snapshot);
      if (automaticKey) void flush();
      return !snapshot.readBlocked;
    }
    try {
      const latest = repository.read(boundScope);
      persisted = latest;
      emit({ doc: latest, status: automaticKey ? 'saving' : 'saved', dirty: false, readBlocked: false,
        lastSavedAt: sameDocument(latest, snapshot.doc) ? snapshot.lastSavedAt : undefined });
      return true;
    } catch {
      emit({ ...snapshot, status: 'unavailable', readBlocked: true });
      return false;
    }
  }

  async function processRecovery(key: string, restore: boolean): Promise<boolean> {
    const checkpoints = repository.checkpoints;
    if (!checkpoints) return false;
    if (snapshot.dirty || snapshot.readBlocked) {
      recoveryError = '请先保存本页修改，或解除读取保护，再处理恢复草稿。';
      emit(snapshot);
      return false;
    }
    const expected = persisted;
    const version = editVersion;
    automaticKey = undefined;
    let applied = false;
    try {
      return await exclusive(() => {
        if (snapshot.dirty || version !== editVersion) throw new Error('本页出现了新修改，恢复操作已停止。请先保存。');
        const entry = checkpoints.read(boundScope, key);
        const current = repository.read(boundScope);
        if (!entry) {
          persisted = current;
          readInventory();
          recoveryError = '这份草稿已在其他标签页处理，列表已更新。';
          emit({ doc: current, status: 'saved', dirty: false, readBlocked: false });
          return false;
        }
        if (restore && !sameDocument(current, expected)) {
          persisted = current;
          readInventory();
          recoveryError = '当前贴纸已在其他标签页更新。请查看更新后的页面，再决定是否替换。';
          emit({ doc: current, status: 'saved', dirty: false, readBlocked: false });
          return false;
        }
        if (restore && !entry.checkpoint) throw new Error('这份草稿暂时无法读取，原始记录已保留。');
        // Persist the choice mode before removing a slot. A remaining single
        // candidate must not turn into an implicit choice after reloading.
        checkpoints.requireSelection(boundScope);
        const next = restore ? entry.checkpoint!.draft : current;
        const wrote = restore && !sameDocument(current, next);
        if (wrote && !repository.write(boundScope, next)) throw new Error('恢复保存失败，当前贴纸和这份草稿均已保留。请重试。');
        persisted = next;
        applied = restore;
        // A cleanup error must not make the view revert a successful write.
        snapshot = withRecovery({ doc: next, status: 'saved', dirty: false, readBlocked: false,
          lastSavedAt: wrote ? new Date().toISOString() : snapshot.lastSavedAt });
        checkpoints.remove(boundScope, key);
        recoveryError = undefined;
        readInventory();
        if (inventory.entries.length === 0) requireManualSelection = false;
        emit(snapshot);
        return true;
      });
    } catch (error) {
      readInventory();
      recoveryError = applied
        ? '贴纸已恢复，清理草稿失败。尚未移除的草稿仍会列在这里，请重试。'
        : error instanceof Error ? error.message : '恢复草稿处理失败，原始记录已保留。';
      emit(snapshot);
      return false;
    }
  }

  function discardPending(): void | Promise<void> {
    clearTimer();
    automaticKey = undefined;
    writeEpoch += 1; // Invalidate writes already queued before this decision.
    if (snapshot.readBlocked) return;
    const version = editVersion;
    const discard = () => {
      if (version !== editVersion) throw new Error('等待期间出现了新修改，尚未放弃。请再次确认。');
      const current = repository.read(boundScope);
      clearOwnedCheckpoints();
      persisted = current;
      recoveryError = undefined;
      readInventory();
      emit({ ...snapshot, doc: current, status: 'saved', dirty: false, conflict: false });
      return true;
    };
    if (ownedCheckpoints.size === 0) {
      discard();
      return;
    }
    return Promise.resolve().then(() => exclusive(discard)).then(() => undefined).catch((error: unknown) => {
      recoveryError = '未能放弃这份草稿，修改仍保留在本页。请重试。';
      emit({ ...snapshot, status: 'unavailable' });
      throw error;
    });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    isDirty: () => snapshot.dirty,
    update(doc: StickerDocument, immediate = false) {
      if (snapshot.readBlocked || doc === snapshot.doc) return;
      if (automaticKey) { automaticKey = undefined; requireManualSelection = true; }
      editVersion += 1;
      clearTimer();
      emit({ ...snapshot, doc, status: 'saving', dirty: true });
      if (immediate) void flush();
      else timer = setTimeout(flush, debounceMs);
    },
    flush,
    checkpoint,
    refresh,
    retry() { recoveryError = undefined; refresh(); return snapshot.readBlocked ? false : flush(); },
    discardPending,
    restoreRecovery: (key: string) => processRecovery(key, true),
    discardRecovery: (key: string) => processRecovery(key, false),
  };
}
