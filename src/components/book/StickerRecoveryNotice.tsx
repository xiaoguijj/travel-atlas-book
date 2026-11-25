import { useState } from 'react';
import { getStickerAsset, stickerUrl, type StickerApi } from '../../stickers';
import styles from './StickerRecoveryNotice.module.css';

interface StickerRecoveryNoticeProps {
  stickers: Pick<StickerApi, 'recoveries' | 'recoveryCount' | 'recoveryError' | 'dirty' | 'readBlocked'
    | 'restoreRecovery' | 'discardRecovery' | 'retry'>;
}

/** Durable drafts stay separate from the page until the user chooses a version. */
export function StickerRecoveryNotice({ stickers }: StickerRecoveryNoticeProps) {
  const [decision, setDecision] = useState<{ key: string; restore: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  if (stickers.recoveryCount === 0 && !stickers.recoveryError) return null;
  const disabled = busy || stickers.dirty || stickers.readBlocked;

  const confirm = async (key: string, restore: boolean) => {
    if (disabled) return;
    setBusy(true);
    try {
      const processed = await (restore ? stickers.restoreRecovery(key) : stickers.discardRecovery(key));
      if (processed) setDecision(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.notice} aria-label="待恢复的贴纸草稿" onKeyDown={(event) => event.stopPropagation()}>
      <header className={styles.header}>
        <h2>还有 {stickers.recoveryCount} 份贴纸草稿待处理</h2>
        <p>页面显示当前正式版本。选择恢复会替换当前贴纸；其他草稿会继续保留，正文不受影响。</p>
      </header>
      {stickers.recoveryError ? <p className={styles.error} role="alert">{stickers.recoveryError}</p> : null}
      {stickers.dirty ? <p className={styles.hint}>请先保存本页修改，再处理这些草稿。</p> : null}
      <ul className={styles.list}>
        {stickers.recoveries.map((candidate, index) => (
          <li key={candidate.key} className={styles.item} data-recovery-key={candidate.key}>
            <div className={styles.summary}>
              <strong>草稿 {index + 1}</strong>
              <span>{candidate.unreadable ? '暂时无法读取，原始记录已保留' : `${candidate.stickerCount} 张贴纸 · ${candidate.pageCount} 页`}</span>
              {!candidate.unreadable ? <div className={styles.preview}>
                {candidate.previewAssetIds.map((id) => <img key={id} src={stickerUrl(id)} alt={getStickerAsset(id)?.name ?? '贴纸预览'} />)}
              </div> : null}
            </div>
            <div className={styles.actions}>
              {decision?.key === candidate.key ? <>
                <p>{decision.restore ? '用这份草稿替换当前全部贴纸？' : '永久放弃这份草稿？当前贴纸和其他草稿会保留。'}</p>
                <button type="button" disabled={disabled} onClick={() => void confirm(candidate.key, decision.restore)}>
                  {busy ? '正在处理…' : decision.restore ? '确认替换当前贴纸' : '确认放弃这份草稿'}
                </button>
                <button type="button" disabled={busy} onClick={() => setDecision(null)}>取消</button>
              </> : <>
                {!candidate.unreadable ? <button type="button" disabled={disabled} onClick={() => setDecision({ key: candidate.key, restore: true })}>用这份替换当前贴纸</button> : null}
                <button type="button" disabled={disabled} onClick={() => setDecision({ key: candidate.key, restore: false })}>放弃这份草稿</button>
              </>}
            </div>
          </li>
        ))}
      </ul>
      {stickers.recoveryError ? <button type="button" className={styles.retry} disabled={busy} onClick={() => { void stickers.retry(); }}>重试读取草稿</button> : null}
    </section>
  );
}
