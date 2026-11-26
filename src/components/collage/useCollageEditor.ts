import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COLLAGE_CANVAS_HEIGHT,
  COLLAGE_CANVAS_WIDTH,
  type CollageCanvas,
  type CollageEditorProps,
  type CollageItem,
} from '../../data/contracts';
import { createStableId, isPhotoAssetId, isStickerAssetId } from '../../data/ids';

export type LayerMove = 'up' | 'down' | 'top' | 'bottom';

export const DEFAULT_TEXT_SIZE = 48;
export const DEFAULT_TEXT_COLOR = '#202020';

/**
 * 将既有画布（如早期 1200×1600）元素无变形地居中迁移到当前宽幅画布（1800×1600）。
 * 只平移坐标，不拉伸图片、贴纸或字号，保证已有作品完整恢复。
 */
export function normalizeCollageItems(content: CollageCanvas | undefined): CollageItem[] {
  if (!content?.items) return [];
  const offsetX = content.width !== COLLAGE_CANVAS_WIDTH
    ? (COLLAGE_CANVAS_WIDTH - content.width) / 2
    : 0;
  const offsetY = content.height !== COLLAGE_CANVAS_HEIGHT
    ? (COLLAGE_CANVAS_HEIGHT - content.height) / 2
    : 0;
  if (offsetX === 0 && offsetY === 0) return content.items;
  return content.items.map((item) => ({
    ...item,
    x: item.x + offsetX,
    y: item.y + offsetY,
  }));
}

function newItemBounds(count: number, width: number, height: number) {
  const offset = (count % 8) * 24;
  return { id: createStableId(), x: 240 + offset, y: 140 + offset, width, height, rotation: 0 };
}

export function fitItemToCanvas(item: CollageItem): CollageItem | undefined {
  const angle = item.rotation * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfWidth = (item.width * Math.abs(cos) + item.height * Math.abs(sin)) / 2;
  const halfHeight = (item.width * Math.abs(sin) + item.height * Math.abs(cos)) / 2;
  const offsetX = (item.width * cos - item.height * sin) / 2;
  const offsetY = (item.width * sin + item.height * cos) / 2;
  const centerX = item.x + offsetX;
  const centerY = item.y + offsetY;
  if (centerX - halfWidth >= 0 && centerX + halfWidth <= COLLAGE_CANVAS_WIDTH
    && centerY - halfHeight >= 0 && centerY + halfHeight <= COLLAGE_CANVAS_HEIGHT) return undefined;

  // Leave room inside the artwork for the handles, including the rotation handle.
  const margin = 120;
  const scale = Math.min(1,
    (COLLAGE_CANVAS_WIDTH / 2 - margin) / halfWidth,
    (COLLAGE_CANVAS_HEIGHT / 2 - margin) / halfHeight);
  const insetX = margin + halfWidth * scale;
  const insetY = margin + halfHeight * scale;
  const fitted = {
    x: Math.max(insetX, Math.min(centerX, COLLAGE_CANVAS_WIDTH - insetX)) - offsetX * scale,
    y: Math.max(insetY, Math.min(centerY, COLLAGE_CANVAS_HEIGHT - insetY)) - offsetY * scale,
    width: item.width * scale,
    height: item.height * scale,
  };
  if (item.kind === 'text' && scale !== 1) {
    const fontSize = Math.max(1, (item.style?.fontSize ?? DEFAULT_TEXT_SIZE) * scale);
    return { ...item, ...fitted, style: { ...item.style, fontSize } };
  }
  return { ...item, ...fitted };
}

export function useCollageEditor({ content, onChange, insertionRequest, onInsertionHandled }: CollageEditorProps) {
  const [items, setItems] = useState(() => normalizeCollageItems(content));
  // Event handlers and the insertion effect both commit to the latest draft.
  // Enqueue outside a React state updater, which can run twice in Strict Mode.
  const draft = useRef(items);
  const [selectedId, select] = useState<string | null>(null);
  const handledRequests = useRef(new Set<string>());
  const selected = items.find((item) => item.id === selectedId);

  const commit = useCallback((next: CollageItem[]) => {
    draft.current = next;
    setItems(next);
    onChange({ width: COLLAGE_CANVAS_WIDTH, height: COLLAGE_CANVAS_HEIGHT, items: next });
  }, [onChange]);

  const insert = useCallback((item: CollageItem) => {
    commit([...draft.current, item]);
    select(item.id);
  }, [commit]);

  /** Drop one asset from the shared library straight onto the paper. */
  const insertAsset = useCallback((assetId: string) => {
    if (isPhotoAssetId(assetId)) {
      insert({ ...newItemBounds(draft.current.length, 360, 280), kind: 'photo', assetId });
    } else if (isStickerAssetId(assetId)) {
      insert({ ...newItemBounds(draft.current.length, 240, 240), kind: 'sticker', assetId });
    }
  }, [insert]);

  useEffect(() => {
    if (!insertionRequest) return;
    const { requestId, assetId } = insertionRequest;
    if (!handledRequests.current.has(requestId)) {
      handledRequests.current.add(requestId);
      insertAsset(assetId);
    }
    onInsertionHandled?.(requestId);
  }, [insertionRequest, insertAsset, onInsertionHandled]);

  function addText() {
    insert({
      ...newItemBounds(draft.current.length, 450, 200),
      kind: 'text',
      text: '新文字',
      style: { fontFamily: 'KaiTi, STKaiti, "Kaiti SC", serif' },
    });
  }

  function updateItem(item: CollageItem) {
    commit(draft.current.map((current) => current.id === item.id ? item : current));
  }

  function removeSelected() {
    if (!selectedId) return;
    commit(draft.current.filter((item) => item.id !== selectedId));
    select(null);
  }

  function moveSelected(move: LayerMove) {
    const index = draft.current.findIndex((item) => item.id === selectedId);
    if (index < 0) return;
    const last = draft.current.length - 1;
    const destinations = { up: index + 1, down: index - 1, top: last, bottom: 0 };
    const to = destinations[move];
    if (to === index || to < 0 || to > last) return;
    const next = [...draft.current];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    commit(next);
  }

  return { items, selected, select, addText, insertAsset, updateItem, removeSelected, moveSelected };
}
