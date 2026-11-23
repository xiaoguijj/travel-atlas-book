import { useEffect, useRef, useState } from 'react';
import type { CollageEditorProps } from '../../data/contracts';
import { AssetPreviewImage } from '../assets/AssetPreviewImage';
import styles from './CollageView.module.css';

/**
 * Collage 占位视图。画布、拖拽、缩放与图层全部留给后续编辑器，
 * 这里只认公共 props 并显示「开发中」，确保深链和素材选择协议已经接通。
 */
export function CollageView({
  content,
  assets,
  saveState,
  onOpenAssetPanel,
  insertionRequest,
  onInsertionHandled,
}: CollageEditorProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!insertionRequest) return;
    if (handled.current.has(insertionRequest.requestId)) {
      onInsertionHandled?.(insertionRequest.requestId);
      return;
    }
    handled.current.add(insertionRequest.requestId);
    setPicked(insertionRequest.assetId);
    onInsertionHandled?.(insertionRequest.requestId);
  }, [insertionRequest, onInsertionHandled]);

  return (
    <section className={styles.page} data-save-state={saveState.status} aria-label="Collage 自由拼贴开发中">
      <header className={styles.head}>
        <p className={styles.kicker}>Collage · 自由拼贴</p>
        <h2 className={styles.title}>拼贴画布正在裱糊</h2>
        <p className={styles.lede}>
          画布、拖拽、缩放、旋转与图层顺序稍后接入。现在可以从素材面板预选照片或贴纸，选中的素材会先记在这里。
        </p>
        <button type="button" className={styles.assetButton} onClick={() => onOpenAssetPanel('sticker')}>
          打开素材面板
        </button>
      </header>

      <div className={styles.canvas} aria-hidden="true">
        <span className={styles.frameNote}>开发中</span>
        <span className={styles.frameMeta}>
          {content ? `已存有 ${content.items.length} 个拼贴元素` : '空白画布 · 1200 × 1600'}
        </span>
      </div>

      <section className={styles.picked}>
        <h3>预选素材</h3>
        {picked ? (
          <div className={styles.pickedBody}>
            <AssetPreviewImage assetId={picked} assets={assets} alt="Collage 预选素材" className={styles.thumb} />
            <code>{picked}</code>
          </div>
        ) : (
          <p className={styles.empty}>还没有预选素材。打开素材面板挑一张，等画布接入后直接插入。</p>
        )}
      </section>
    </section>
  );
}