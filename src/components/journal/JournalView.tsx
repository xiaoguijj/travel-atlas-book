import { useEffect, useRef, useState } from 'react';
import type { JournalContent, JournalEditorProps, JournalNode } from '../../data/contracts';
import { AssetPreviewImage } from '../assets/AssetPreviewImage';
import styles from './JournalView.module.css';

interface Draft {
  text: string;
  media: string[];
}

function readDraft(content: JournalContent | undefined): Draft {
  const lines: string[] = [];
  const media: string[] = [];
  for (const node of content?.doc.content ?? []) {
    if (node.type === 'atlasMedia') {
      const assetId = node.attrs?.assetId;
      if (typeof assetId === 'string') media.push(assetId);
      continue;
    }
    if (node.type === 'paragraph') {
      const text = (node.content ?? [])
        .map((child) => (typeof child.text === 'string' ? child.text : ''))
        .join('');
      lines.push(text);
    }
  }
  return { text: lines.join('\n'), media };
}

function buildContent(draft: Draft): JournalContent {
  const lines = draft.text.split('\n');
  const nodes: JournalNode[] = lines.map((line) =>
    line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' },
  );
  for (const assetId of draft.media) {
    nodes.push({ type: 'atlasMedia', attrs: { assetId } });
  }
  return { doc: { type: 'doc', content: nodes } };
}

/**
 * Journal 的最小占位视图：只验证公共壳、保存队列与素材插入协议。
 * 横线纸张、富文本和正式排版由后续编辑器替换本组件，公共 props 已按 V1-02 契约保留。
 */
export function JournalView({
  content,
  assets,
  saveState,
  onChange,
  onRetrySave,
  onOpenAssetPanel,
  insertionRequest,
  onInsertionHandled,
}: JournalEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => readDraft(content));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const handled = useRef(new Set<string>());

  const commit = (next: Draft) => {
    setDraft(next);
    draftRef.current = next;
    onChange(buildContent(next));
  };

  useEffect(() => {
    if (!insertionRequest) return;
    const { requestId, assetId } = insertionRequest;
    if (handled.current.has(requestId)) {
      onInsertionHandled?.(requestId);
      return;
    }
    handled.current.add(requestId);
    const current = draftRef.current;
    commit({ ...current, media: [...current.media, assetId] });
    onInsertionHandled?.(requestId);
    // commit 每次渲染都是新函数；只按插入请求触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertionRequest]);

  return (
    <section className={styles.page} data-save-state={saveState.status} aria-label="Journal 横线日记本预览">
      <header className={styles.head}>
        <p className={styles.kicker}>Journal · 先行预览</p>
        <h2 className={styles.title}>横线日记本正在装订</h2>
        <p className={styles.lede}>
          正式的纸张、富文本与排版稍后接入；这一页可以先用纯文本记录，写下的内容会立刻进入自动保存队列。
        </p>
        <button type="button" className={styles.assetButton} onClick={() => onOpenAssetPanel()}>
          从素材册插入
        </button>
      </header>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>正文草稿</span>
        <textarea
          className={styles.textarea}
          aria-label="正文草稿"
          value={draft.text}
          onChange={(event) => commit({ ...draftRef.current, text: event.target.value })}
          placeholder="随手写几句这一天的风、街道和食物……"
          rows={10}
        />
      </label>

      <section className={styles.media}>
        <div className={styles.mediaHead}>
          <h3>已引用素材</h3>
          <span>{draft.media.length} 件</span>
        </div>
        {draft.media.length === 0 ? (
          <p className={styles.empty}>还没有素材。打开素材面板选一张照片或一枚贴纸。</p>
        ) : (
          <ul className={styles.mediaList}>
            {draft.media.map((assetId, index) => (
              <li key={`${assetId}-${index}`}>
                <AssetPreviewImage assetId={assetId} assets={assets} alt={`已引用素材 ${index + 1}`} className={styles.thumb} />
                <code className={styles.assetId}>{assetId}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      {saveState.status === 'error' ? (
        <div className={styles.error} role="alert">
          <span>这次没存进本子：{saveState.error?.message ?? '请稍后重试。'}</span>
          <button type="button" onClick={onRetrySave}>
            重试保存
          </button>
        </div>
      ) : null}
    </section>
  );
}