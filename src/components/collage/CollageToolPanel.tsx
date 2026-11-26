import { useState } from 'react';
import type { AssetKind, AssetMetadata, AssetQuery } from '../../data/contracts';
import { AssetPreviewImage } from '../assets/AssetPreviewImage';
import {
  CloseIcon,
  PhotoIcon,
  PlusIcon,
  StampIcon,
  StickerIcon,
  TextIcon,
  UploadIcon,
} from './CollageIcons';
import styles from './CollageView.module.css';

export type CollageTool = 'photo' | 'citySticker' | 'commonSticker' | 'text';

const TOOL_META: { key: CollageTool; label: string; hint: string }[] = [
  { key: 'photo', label: '照片', hint: '点一张照片，直接贴到纸面。' },
  { key: 'citySticker', label: '城市贴纸', hint: '这座城市的限定图案，点一下就能贴上。' },
  { key: 'commonSticker', label: '通用贴纸', hint: '旅途通用的邮戳、花草与小物件。' },
  { key: 'text', label: '文字', hint: '写下这一页的字，再在右侧属性里调样式。' },
];

const TOOL_ICONS = {
  photo: PhotoIcon,
  citySticker: StampIcon,
  commonSticker: StickerIcon,
  text: TextIcon,
} as const;

function StickerThumb({ item }: { item: AssetMetadata }) {
  const [broken, setBroken] = useState(false);
  if (!item.src || broken) return <span className={styles.thumbMissing}>素材缺失</span>;
  return (
    <img
      className={styles.stickerThumb}
      src={item.src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

function AssetGrid({
  items,
  kind,
  assets,
  onInsert,
}: {
  items: AssetMetadata[];
  kind: 'photo' | 'sticker';
  assets: AssetQuery;
  onInsert: (assetId: string) => void;
}) {
  return (
    <ul className={kind === 'photo' ? styles.photoGrid : styles.stickerGrid}>
      {items.map((item) => (
        <li key={item.assetId}>
          <button
            type="button"
            className={styles.assetTile}
            onClick={() => onInsert(item.assetId)}
            aria-label={`插入${kind === 'photo' ? '照片' : '贴纸'} ${item.label}`}
            title={item.label}
          >
            <span className={kind === 'photo' ? styles.photoThumb : styles.stickerTile}>
              {kind === 'photo' ? (
                <AssetPreviewImage assetId={item.assetId} assets={assets} alt="" />
              ) : (
                <StickerThumb item={item} />
              )}
            </span>
            <span className={styles.assetName}>{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CollageToolPanel({
  open,
  onToggle,
  onClose,
  cityName,
  photos,
  cityStickers,
  commonStickers,
  status,
  error,
  assets,
  onInsert,
  onAddText,
  onOpenAssets,
  onRetry,
}: {
  open: CollageTool | null;
  onToggle: (tool: CollageTool) => void;
  onClose: () => void;
  cityName: string;
  photos: AssetMetadata[];
  cityStickers: AssetMetadata[];
  commonStickers: AssetMetadata[];
  status: 'loading' | 'ready' | 'error';
  error?: string;
  assets: AssetQuery;
  onInsert: (assetId: string) => void;
  onAddText: () => void;
  onOpenAssets: (kind: AssetKind) => void;
  onRetry: () => void;
}) {
  const current = open ? TOOL_META.find((tool) => tool.key === open) ?? null : null;
  const CurrentIcon = current ? TOOL_ICONS[current.key] : null;
  const collection = current?.key === 'photo'
    ? photos
    : current?.key === 'citySticker'
      ? cityStickers
      : commonStickers;
  const assetKind = current?.key === 'photo' ? 'photo' : 'sticker';
  const emptyText = current?.key === 'photo'
    ? `还没有照片。打开素材册上传一张，它会留在${cityName}的相册里。`
    : current?.key === 'citySticker'
      ? `${cityName}的城市贴纸还在整理中，先看看通用贴纸吧。`
      : '通用贴纸还在整理中，之后会出现在这里。';

  return (
    <div className={styles.tools}>
      <div className={styles.rail} role="toolbar" aria-label="素材工具" aria-orientation="vertical">
        {TOOL_META.map((tool) => {
          const ToolIcon = TOOL_ICONS[tool.key];
          const active = open === tool.key;
          return (
            <button
              key={tool.key}
              type="button"
              className={active ? `${styles.railButton} ${styles.railButtonActive}` : styles.railButton}
              onClick={() => onToggle(tool.key)}
              aria-pressed={active}
              aria-expanded={active}
              aria-controls={active ? 'collage-tool-panel' : undefined}
              title={tool.label}
            >
              <span className={styles.railIcon}>
                <ToolIcon />
              </span>
              <span className={styles.railLabel}>{tool.label}</span>
            </button>
          );
        })}
      </div>

      {current && CurrentIcon ? (
        <section
          id="collage-tool-panel"
          className={styles.toolPanel}
          aria-label={`${current.label}面板`}
        >
          <header className={styles.panelHead}>
            <div className={styles.panelTitle}>
              <span className={styles.panelGlyph}>
                <CurrentIcon />
              </span>
              <div>
                <p className={styles.panelKicker}>旅途素材 · {cityName}</p>
                <h3>{current.label}</h3>
              </div>
            </div>
            <button
              type="button"
              className={styles.panelClose}
              onClick={onClose}
              aria-label="收起素材面板"
            >
              <CloseIcon />
            </button>
          </header>

          <div className={styles.panelBody}>
            <p className={styles.panelHint}>{current.hint}</p>

            {current.key === 'text' ? (
              <>
                <div className={styles.textSample} aria-hidden="true">
                  <span>旅途</span>
                  <small>从一张空白纸开始</small>
                </div>
                <button type="button" className={styles.panelCta} onClick={onAddText}>
                  <PlusIcon />
                  添加文字
                </button>
              </>
            ) : status === 'loading' ? (
              <p className={styles.panelState} role="status">
                正在翻素材册…
              </p>
            ) : status === 'error' ? (
              <div className={styles.panelError} role="alert">
                <p>{error ?? '素材读取失败，请稍后再试。'}</p>
                <button type="button" className={styles.panelGhost} onClick={onRetry}>
                  重新读取
                </button>
              </div>
            ) : collection.length === 0 ? (
              <p className={styles.panelState}>{emptyText}</p>
            ) : (
              <AssetGrid items={collection} kind={assetKind} assets={assets} onInsert={onInsert} />
            )}

            {current.key !== 'text' ? (
              <button
                type="button"
                className={styles.panelCta}
                onClick={() => onOpenAssets(current.key === 'photo' ? 'photo' : 'sticker')}
              >
                <UploadIcon />
                打开素材册
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
