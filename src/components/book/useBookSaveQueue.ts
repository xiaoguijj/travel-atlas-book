import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { renameBook, saveCollage, saveJournal } from '../../data/books';
import type { TravelBook } from '../../data/contracts';
import { createBookSaveQueue, type SaveField, type SaveQueueState } from '../../data/saving';

const repository = { renameBook, saveJournal, saveCollage };

/**
 * 每个手账壳持有自己的队列。队列在构造时固定 bookId，
 * 换书时旧壳卸载、旧队列只写旧书，新壳拿到新队列。
 */
export function useBookSaveQueue(
  bookId: string,
  onSaved?: (field: SaveField, book: TravelBook) => void,
): { queue: ReturnType<typeof createBookSaveQueue>; state: SaveQueueState } {
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const queue = useMemo(
    () =>
      createBookSaveQueue({
        bookId,
        repository,
        onSaved: (field, book) => onSavedRef.current?.(field, book),
      }),
    [bookId],
  );

  const state = useSyncExternalStore(queue.subscribe, queue.getState, queue.getState);

  useEffect(
    () => () => {
      // 离开编辑器时补写最后一段防抖窗口内的草稿；失败路径由离开守卫和重试按钮兜底。
      void queue.flush();
    },
    [queue],
  );

  return { queue, state };
}