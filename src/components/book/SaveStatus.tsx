import type { SaveQueueState } from '../../data/saving';
import styles from './SaveStatus.module.css';

function savedTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function SaveStatus({ state, onRetry }: { state: SaveQueueState; onRetry: () => void }) {
  const time = savedTime(state.lastSavedAt);
  const failed = state.status === 'error';

  return (
    <div
      className={failed ? `${styles.status} ${styles.failed}` : styles.status}
      role="status"
      aria-live="polite"
      data-state={state.status}
    >
      <span className={styles.dot} aria-hidden="true" />
      {failed ? (
        <>
          <span className={styles.text} title={state.error?.message}>
            保存失败
          </span>
          <button type="button" className={styles.retry} onClick={onRetry}>
            重试
          </button>
        </>
      ) : state.status === 'saving' ? (
        <span className={styles.text}>正在保存…</span>
      ) : state.status === 'saved' ? (
        <span className={styles.text}>已保存{time ? ` ${time}` : ''}</span>
      ) : (
        <span className={styles.text}>自动保存已开启</span>
      )}
    </div>
  );
}