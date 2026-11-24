import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import type { BookSaveQueue } from '../../data/saving';
import styles from './LeaveGuard.module.css';

interface LeaveGuardProps {
  queue: Pick<BookSaveQueue, 'flush' | 'discardPending' | 'isDirty'>;
  dirty: boolean;
  errorMessage: string | null;
}

/**
 * 离开编辑器前的最后一道闸：还有草稿时先尝试写完；写不进去就留在这里，
 * 由用户选择重试、明确放弃，或返回继续编辑。
 *
 * 队列在离开前把草稿写入它构造时绑定的 bookId，所以不会因为换书把上一本的内容写到新书上。
 */
export function LeaveGuard({ queue, dirty, errorMessage }: LeaveGuardProps) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      queue.isDirty() &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  const [phase, setPhase] = useState<'idle' | 'saving' | 'failed'>('idle');
  const attempt = useRef(0);
  const proceedRef = useRef<(() => void) | undefined>(undefined);
  proceedRef.current = blocker.state === 'blocked' ? blocker.proceed : undefined;

  const saveThenLeave = async () => {
    const currentAttempt = ++attempt.current;
    setPhase('saving');
    let saved = false;
    try {
      saved = await queue.flush();
    } catch {
      // A failed save must keep navigation blocked, including unexpected storage errors.
    }
    if (currentAttempt !== attempt.current) return;
    if (saved) proceedRef.current?.();
    else setPhase('failed');
  };

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      setPhase('idle');
      attempt.current += 1;
      return;
    }
    void saveThenLeave();
    // blocker 对象每次渲染都会变；按状态切换触发一次保存尝试即可。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // Re-check the live queue: a completed flush may precede effect cleanup.
      if (!queue.isDirty()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [queue, dirty]);

  useEffect(() => () => { attempt.current += 1; }, []);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      attempt.current += 1;
      blocker.reset();
      setPhase('idle');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [blocker]);

  if (blocker.state !== 'blocked') return null;

  const failed = phase === 'failed';

  return (
    <div className={styles.overlay}>
      <section role="dialog" aria-modal="true" aria-labelledby="leave-guard-title" className={styles.dialog}>
        <p className={styles.kicker}>{failed ? '最后一页还没干' : '合上本子之前'}</p>
        <h2 id="leave-guard-title">{failed ? '保存失败，暂时不能离开' : '正在保存这一页…'}</h2>
        <p className={styles.body}>
          {failed
            ? errorMessage || '内容还留在本页草稿里。可以重试一次，或明确放弃这次修改再离开。'
            : '把还没写进本子的标题和正文补存一下，通常只要一小会儿。'}
        </p>

        <div className={styles.actions}>
          {failed ? (
            <>
              <button type="button" className={styles.primary} autoFocus onClick={() => void saveThenLeave()}>
                重试保存并离开
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  attempt.current += 1;
                  queue.discardPending();
                  blocker.proceed();
                }}
              >
                放弃修改并离开
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              attempt.current += 1;
              blocker.reset();
              setPhase('idle');
            }}
          >
            留在本页
          </button>
        </div>
      </section>
    </div>
  );
}
