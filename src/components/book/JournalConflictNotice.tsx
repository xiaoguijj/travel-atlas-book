import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { journalBookPath } from '../../config/routes';
import { copyJournalDraft } from '../../data/books';
import { isDataError, type TravelBook } from '../../data/contracts';
import type { BookSaveQueue } from '../../data/saving';
import styles from './JournalConflictNotice.module.css';

export function JournalConflictNotice({ bookId, queue }: { bookId: string; queue: BookSaveQueue }) {
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [copy, setCopy] = useState<TravelBook | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preserveDraft = async () => {
    if (busy.current) return;
    const draft = queue.getJournalDraft();
    if (!draft) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      // Preserve exactly the clicked snapshot. Editing may continue while this
      // transaction runs; never discard the queue or rebase it after copying.
      setCopy(await copyJournalDraft(bookId, draft));
    } catch (failure) {
      setError(isDataError(failure) ? failure.message : '正文副本未能保存，请重试。本页草稿仍在。');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <section className={styles.notice} role="alert" aria-labelledby="journal-conflict-title">
      <h2 id="journal-conflict-title">正文有其他版本，本页草稿已保留</h2>
      <p>另一个标签页已保存新正文。本页自动保存已被阻止，可以把本页正文另存到书架，在副本中继续编辑。</p>
      <p>正文副本包含文字和正文内的照片、素材；自由定位贴纸与拼贴画布仍属于原手账。</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => void preserveDraft()} disabled={saving}>
          {saving ? '正在另存正文…' : '另存本页正文'}
        </button>
        {copy ? <Link to={journalBookPath(copy.id)} target="_blank" rel="noopener noreferrer">打开正文副本（新标签页）</Link> : null}
      </div>
      {copy ? <p role="status">已保存刚才点击时的正文。之后在本页继续编辑的内容需要再次另存；原页离开时仍会提示处理未保存修改。</p> : null}
      {error ? <p>{error}</p> : null}
    </section>
  );
}
