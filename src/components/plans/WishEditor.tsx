import { useEffect, useState, type FormEvent } from 'react';
import type { CityWish } from '../../data/contracts';
import { removeWish, saveWish } from '../../data/wishes';
import { errorMessage } from './errorMessage';
import styles from './WishEditor.module.css';

export interface WishEditorProps {
  cityId: string;
  cityName: string;
  wish: CityWish | undefined;
  onChanged: (wish: CityWish | undefined) => void;
}

/**
 * 城市愿望编辑器。保存动作是显式的：只有点保存，地图标记才会点亮；
 * 备注可以留空。移除标记只删愿望记录，不碰行程与手账。
 */
export function WishEditor({ cityId, cityName, wish, onChanged }: WishEditorProps) {
  const [note, setNote] = useState(wish?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const persisted = wish !== undefined;
  const remaining = 500 - note.trim().length;

  // 愿望是异步读出来的：初次渲染时可能还是空，读到后要把已保存的备注补进输入框。
  useEffect(() => {
    setNote(wish?.note ?? '');
  }, [cityId, wish?.updatedAt]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const saved = await saveWish(cityId, note);
      onChanged(saved);
      setNote(saved.note);
      setFeedback('愿望已保存，地图上的标记已经点亮。');
    } catch (saveError) {
      setError(errorMessage(saveError, '保存愿望失败，请重试。'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await removeWish(cityId);
      onChanged(undefined);
      setNote('');
      setConfirmingRemove(false);
      setFeedback('愿望标记已移除，已有行程仍然保留。');
    } catch (removeError) {
      setError(errorMessage(removeError, '移除愿望失败，请重试。'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="wish-heading">
      <header className={styles.head}>
        <h2 id="wish-heading">{persisted ? '你写下的愿望' : `想去${cityName}吗`}</h2>
        <p>
          {persisted
            ? '备注可以继续修改，或者关掉这枚地图标记。'
            : '先写一句愿望或备注，保存后地图上就会点亮这座城市。日期可以之后再定。'}
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSave}>
        <label className={styles.label} htmlFor={`wish-note-${cityId}`}>
          愿望备注
        </label>
        <textarea
          id={`wish-note-${cityId}`}
          className={styles.textarea}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          maxLength={500}
          placeholder={`例如：想去${cityName}的旧书店坐一下午，等一场雨停。`}
        />
        <div className={styles.row}>
          <span className={styles.count}>{Math.max(remaining, 0)} 字可用</span>
          <div className={styles.buttons}>
            <button className={styles.primary} type="submit" disabled={saving}>
              {saving ? '正在保存…' : persisted ? '保存修改' : '保存愿望'}
            </button>
            {persisted ? (
              <button
                className={styles.ghost}
                type="button"
                onClick={() => setConfirmingRemove(true)}
                disabled={saving}
              >
                移除标记
              </button>
            ) : null}
          </div>
        </div>
      </form>

      {confirmingRemove ? (
        <div className={styles.confirm} role="alertdialog" aria-label="确认移除愿望标记">
          <p>移除后{ cityName}的地图标记会熄灭，已有的行程和手账都会保留。</p>
          <div className={styles.confirmActions}>
            <button className={styles.danger} type="button" onClick={handleRemove} disabled={saving}>
              {saving ? '正在移除…' : '确认移除'}
            </button>
            <button
              className={styles.ghost}
              type="button"
              onClick={() => setConfirmingRemove(false)}
              disabled={saving}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className={styles.feedback} role="status">
          {feedback}
        </p>
      ) : null}
    </section>
  );
}