import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_SCALE, MIN_SCALE, createInstanceId, readStickerDocument, stickerKey, writeStickerDocument } from './storage';
import type { StickerDocument, StickerInstance, StickerScope, StickerStatus } from './types';

/**
 * 一个作用域（城市 + 创作模式 + 第几本手账）的贴纸状态。
 *
 * Journal 用法：useStickers({ cityId, mode:'journal', journalId:'default' }, 当前页)。
 * Collage 用法：同一页就是 pages[0]，pageIndex 恒为 0。
 * 组件本身不碰存储，宿主页面拿着这个 API 传给 StickerLayer 就行。
 */

const SAVE_DEBOUNCE_MS = 350;

/** 新贴纸的落点：按已贴数量错开一点，免得第二张正好压在第一天同一个点上 */
const CASCADE = [0, 0.045, -0.045, 0.09, -0.09, 0.02];

export interface StickerApi {
  /** 当前页的贴纸实例，未排序，渲染顺序由 StickerLayer 按 z 处理 */
  instances: StickerInstance[];
  status: StickerStatus;
  selectedId: string | null;
  select: (instanceId: string | null) => void;
  /** 贴一张，返回新实例的编号 */
  add: (assetId: string) => string;
  update: (instanceId: string, patch: Partial<StickerInstance>) => void;
  remove: (instanceId: string) => void;
  duplicate: (instanceId: string) => string | null;
  reorder: (instanceId: string, direction: 'forward' | 'backward') => void;
}

export function useStickers(scope: StickerScope, pageIndex: number): StickerApi {
  const key = stickerKey(scope);
  const [doc, setDoc] = useState<StickerDocument>(() => readStickerDocument(scope));
  const [status, setStatus] = useState<StickerStatus>('saved');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const latest = useRef(doc);
  const pageRef = useRef(pageIndex);
  const scopeRef = useRef(scope);
  const timer = useRef<number | undefined>(undefined);

  pageRef.current = pageIndex;
  scopeRef.current = scope;

  // 换城市、换模式、换本子都要重读一遍，不能拿上一本的存档继续写。
  // 宿主每次渲染都会造一个新的 scope 对象，所以这里只认它拼出来的键。
  useEffect(() => {
    const next = readStickerDocument(scopeRef.current);
    latest.current = next;
    setDoc(next);
    setSelectedId(null);
  }, [key]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  /** 改当前页那一段实例，改完统一走同一个防抖写入 */
  const mutate = useCallback(
    (fn: (list: StickerInstance[]) => StickerInstance[]) => {
      const next = patchPage(latest.current, pageRef.current, fn);
      latest.current = next;
      setDoc(next);
      setStatus('saving');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setStatus(writeStickerDocument(scopeRef.current, next) ? 'saved' : 'unavailable');
      }, SAVE_DEBOUNCE_MS);
    },
    [key],
  );

  const add = useCallback(
    (assetId: string) => {
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
      });
      setSelectedId(instanceId);
      return instanceId;
    },
    [mutate],
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
      mutate((list) => list.filter((item) => item.instanceId !== instanceId));
      setSelectedId((current) => (current === instanceId ? null : current));
    },
    [mutate],
  );

  const duplicate = useCallback(
    (instanceId: string) => {
      const source = latest.current.pages[pageRef.current]?.find((item) => item.instanceId === instanceId);
      if (!source) return null;
      const copyId = createInstanceId();
      mutate((list) => {
        const top = list.reduce((max, item) => Math.max(max, item.z), 0);
        return [...list, { ...source, instanceId: copyId, x: clamp01(source.x + 0.05), y: clamp01(source.y + 0.05), z: top + 1 }];
      });
      setSelectedId(copyId);
      return copyId;
    },
    [mutate],
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
      });
    },
    [mutate],
  );

  return {
    instances: doc.pages[pageIndex] ?? [],
    status,
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
  const pages = doc.pages.slice();
  while (pages.length <= index) pages.push([]);
  pages[index] = fn(pages[index] ?? []);
  return { version: 1, pages };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
