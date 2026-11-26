import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { collageBookPath } from '../../config/routes';
import { copyCollageDraft } from '../../data/books';
import { isDataError } from '../../data/contracts';
import type { BookSaveQueue } from '../../data/saving';
import styles from './JournalConflictNotice.module.css';

export function CollageConflictNotice({ bookId, queue }: { bookId: string; queue: BookSaveQueue }) {
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [copyId, setCopyId] = useState<string>();
  const [error, setError] = useState<string>();

  async function preserveDraft() {
    if (busy.current) return;
    const draft = queue.getCollageDraft();
    if (!draft) return;
    busy.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const copy = await copyCollageDraft(bookId, draft);
      setCopyId(copy.id);
    } catch (failure) {
      setError(isDataError(failure) ? failure.message : '拼贴副本未能保存，请重试。');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <section className={styles.notice} role="alert" aria-labelledby="collage-conflict-title">
      <h2 id="collage-conflict-title">拼贴有其他版本，本页草稿已保留</h2>
      <p>另一个标签页已更新拼贴。将本页拼贴另存到书架后，可以在副本中继续编辑。</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => void preserveDraft()} disabled={saving}>
          {saving ? '正在另存拼贴…' : '另存本页拼贴'}
        </button>
        {copyId ? <Link to={collageBookPath(copyId)} target="_blank" rel="noopener noreferrer">打开拼贴副本（新标签页）</Link> : null}
      </div>
      {copyId ? <p role="status">已另存点击时的草稿。本页之后的修改需要再次另存。</p> : null}
      {error ? <p>{error}</p> : null}
    </section>
  );
}
