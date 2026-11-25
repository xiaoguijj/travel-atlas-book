import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COLLAGE_CANVAS_HEIGHT,
  COLLAGE_CANVAS_WIDTH,
  type CollageEditorProps,
  type CollageItem,
} from '../../data/contracts';
import { createStableId, isPhotoAssetId, isStickerAssetId } from '../../data/ids';

export type LayerMove = 'up' | 'down' | 'top' | 'bottom';

export const DEFAULT_TEXT_SIZE = 48;
export const DEFAULT_TEXT_COLOR = '#202020';

function newItemBounds(count: number, width: number, height: number) {
  const offset = (count % 8) * 24;
  return { id: createStableId(), x: 120 + offset, y: 140 + offset, width, height, rotation: 0 };
}

export function useCollageEditor({ content, onChange, insertionRequest, onInsertionHandled }: CollageEditorProps) {
  const [items, setItems] = useState(() => content?.items ?? []);
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

  useEffect(() => {
    if (!insertionRequest) return;
    const { requestId, assetId } = insertionRequest;
    if (!handledRequests.current.has(requestId)) {
      handledRequests.current.add(requestId);
      if (isPhotoAssetId(assetId)) {
        insert({ ...newItemBounds(draft.current.length, 360, 280), kind: 'photo', assetId });
      } else if (isStickerAssetId(assetId)) {
        insert({ ...newItemBounds(draft.current.length, 240, 240), kind: 'sticker', assetId });
      }
    }
    onInsertionHandled?.(requestId);
  }, [insertionRequest, insert, onInsertionHandled]);

  function addText() {
    insert({ ...newItemBounds(draft.current.length, 450, 200), kind: 'text', text: '新文字' });
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

  return { items, selected, select, addText, updateItem, removeSelected, moveSelected };
}
