import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createStickerSaveController } from './saveController';
import { MAX_SCALE, MIN_SCALE, createInstanceId, readStickerDocument, stickerKey, writeStickerDocument } from './storage';
import type { StickerDocument, StickerInstance, StickerScope, StickerStatus } from './types';

/**
 * 一个作用域（城市 + 创作模式 + 第几本手账）的贴纸状态。
 *
 * Journal 用法：useStickers({ cityId, mode:'journal', journalId:'default' }, 当前页)。
 * Collage 用法：同一页就是 pages[0]，pageIndex 恒为 0。
 * 组件本身不碰存储，宿主页面拿着这个 API 传给 StickerLayer 就行。
 */

const repository = { read: readStickerDocument, write: writeStickerDocument };

/** 新贴纸的落点：按已贴数量错开一点，免得第二张正好压在第一天同一个点上 */
const CASCADE = [0, 0.045, -0.045, 0.09, -0.09, 0.02];

export interface StickerApi {
  /** 当前页的贴纸实例，未排序，渲染顺序由 StickerLayer 按 z 处理 */
  instances: StickerInstance[];
  status: StickerStatus;
  lastSavedAt?: string;
  readBlocked: boolean;
  conflict?: boolean;
  /** 失败草稿同样保持 dirty，直到成功写入或用户明确放弃。 */
  dirty: boolean;
  isDirty: () => boolean;
  /** 同步补存最新草稿；失败返回 false，可直接再次调用重试。 */
  flush: () => boolean;
  /** 读取失败时只重新读取原档；写入失败时重新保存最新草稿。 */
  retry: () => boolean;
  discardPending: () => void;
  selectedId: string | null;
  select: (instanceId: string | null) => void;
  /** 贴一张，返回新实例编号；原档尚未读出时返回 null，不允许修改。 */
  add: (assetId: string) => string | null;
  update: (instanceId: string, patch: Partial<StickerInstance>) => void;
  remove: (instanceId: string) => void;
  duplicate: (instanceId: string) => string | null;
  reorder: (instanceId: string, direction: 'forward' | 'backward') => void;
}

export function useStickers(scope: StickerScope, pageIndex: number): StickerApi {
  const { cityId, mode, journalId } = scope;
  const controller = useMemo(
    () => createStickerSaveController({ cityId, mode, journalId }, repository),
    [cityId, mode, journalId],
  );
  const { doc, status, dirty, lastSavedAt, readBlocked, conflict } = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pageRef = useRef(pageIndex);
  pageRef.current = pageIndex;

  useEffect(() => {
    setSelectedId(null);
  }, [controller]);

  useEffect(() => {
    const key = stickerKey({ cityId, mode, journalId });
    const flush = () => { controller.flush(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) controller.refresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibilityChange);
    controller.refresh();
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // 正常路由由宿主先保存并拦截失败；卸载时仍补存尚在防抖窗口的修改。
      // discardPending 已清掉 dirty，因此明确放弃后这里不会重新写入。
      flush();
    };
  }, [cityId, mode, journalId, controller]);

  /** 连续拖动防抖，增删复制等离散动作立即保存。 */
  const mutate = useCallback(
    (fn: (list: StickerInstance[]) => StickerInstance[], immediate = false) => {
      if (controller.getSnapshot().readBlocked) return;
      const next = patchPage(controller.getSnapshot().doc, pageRef.current, fn);
      controller.update(next, immediate);
    },
    [controller],
  );

  const add = useCallback(
    (assetId: string) => {
      if (controller.getSnapshot().readBlocked) return null;
      const instanceId = createInstanceId();
      mutate((list) => {
        const top = list.reduce((max, item) => Math.max(max, item.z), 0);
        const step = CASCADE[list.length % CASCADE.length];
        return [
          ...list,
          {
            instanceId,
            assetId,
            x: clamp01(0.5 + step),
            y: clamp01(0.42 + step * 0.7),
            scale: 1,
            rotation: list.length % 2 === 0 ? -4 : 5,
            z: top + 1,
          },
        ];
      }, true);
      setSelectedId(instanceId);
      return instanceId;
    },
    [controller, mutate],
  );

  const update = useCallback(
    (instanceId: string, patch: Partial<StickerInstance>) => {
      mutate((list) =>
        list.map((item) =>
          item.instanceId === instanceId
            ? {
                ...item,
                ...patch,
                x: clamp01(patch.x ?? item.x),
                y: clamp01(patch.y ?? item.y),
                scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, patch.scale ?? item.scale)),
              }
            : item,
        ),
      );
    },
    [mutate],
  );

  const remove = useCallback(
    (instanceId: string) => {
      mutate((list) => list.filter((item) => item.instanceId !== instanceId), true);
      setSelectedId((current) => (current === instanceId ? null : current));
    },
    [mutate],
  );

  const duplicate = useCallback(
    (instanceId: string) => {
      const source = controller.getSnapshot().doc.pages[pageRef.current]?.find((item) => item.instanceId === instanceId);
      if (!source) return null;
      const copyId = createInstanceId();
      mutate((list) => {
        const top = list.reduce((max, item) => Math.max(max, item.z), 0);
        return [...list, { ...source, instanceId: copyId, x: clamp01(source.x + 0.05), y: clamp01(source.y + 0.05), z: top + 1 }];
      }, true);
      setSelectedId(copyId);
      return copyId;
    },
    [controller, mutate],
  );

  /** 上移 / 下移一层：和紧邻的那一张换 z，比"提到最顶"更符合手账里的直觉 */
  const reorder = useCallback(
    (instanceId: string, direction: 'forward' | 'backward') => {
      mutate((list) => {
        const sorted = [...list].sort((a, b) => a.z - b.z);
        const at = sorted.findIndex((item) => item.instanceId === instanceId);
        if (at < 0) return list;
        const neighbourIndex = direction === 'forward' ? at + 1 : at - 1;
        if (neighbourIndex < 0 || neighbourIndex >= sorted.length) return list;
        const current = sorted[at];
        const neighbour = sorted[neighbourIndex];
        return list.map((item) => {
          if (item.instanceId === current.instanceId) return { ...item, z: neighbour.z };
          if (item.instanceId === neighbour.instanceId) return { ...item, z: current.z };
          return item;
        });
      }, true);
    },
    [mutate],
  );

  return {
    instances: doc.pages[pageIndex] ?? [],
    status,
    lastSavedAt,
    readBlocked,
    conflict,
    dirty,
    isDirty: controller.isDirty,
    flush: controller.flush,
    retry: controller.retry,
    discardPending: controller.discardPending,
    selectedId,
    select: setSelectedId,
    add,
    update,
    remove,
    duplicate,
    reorder,
  };
}

function patchPage(doc: StickerDocument, index: number, fn: (list: StickerInstance[]) => StickerInstance[]): StickerDocument {
  const current = doc.pages[index] ?? [];
  const next = fn(current);
  if (next === current) return doc;
  const pages = doc.pages.slice();
  while (pages.length <= index) pages.push([]);
  pages[index] = next;
  return { ...doc, pages };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
