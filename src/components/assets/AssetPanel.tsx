import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import {
  isDataError,
  type AssetKind,
  type AssetMetadata,
  type AssetQuery,
  type BookMode,
  type PhotoAsset,
} from '../../data/contracts';
import styles from './AssetPanel.module.css';
import { AssetPreviewImage } from './AssetPreviewImage';

interface AssetPanelProps {
  cityId: string;
  cityName: string;
  mode: BookMode;
  assets: AssetQuery;
  initialKind?: AssetKind;
  uploadPhoto(file: File): Promise<PhotoAsset>;
  onSelect(assetId: string): void;
  onClose(): void;
}

function readable(error: unknown, fallback: string): string {
  return isDataError(error) ? error.message : fallback;
}

function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function StickerThumb({ item }: { item: AssetMetadata }) {
  const [broken, setBroken] = useState(false);
  if (!item.src || broken) {
    return <span className={styles.thumbMissing}>素材缺失</span>;
  }
  return (
    <img
      className={styles.stickerImage}
      src={item.src}
      alt={`${item.label} 预览`}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

/**
 * Journal 与 Collage 共用的素材面板。面板只负责上传、浏览、选择与异常状态，
 * 选中后通过回调交给手账壳；具体插入位置由对应编辑器决定。
 */
export function AssetPanel({
  cityId,
  cityName,
  mode,
  assets,
  initialKind,
  uploadPhoto,
  onSelect,
  onClose,
}: AssetPanelProps) {
  const [kind, setKind] = useState<AssetKind>(initialKind ?? 'photo');
  const [items, setItems] = useState<AssetMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const next = await assets.listAssets(cityId);
        if (!alive.current) return;
        setItems(next);
        setLoadError(null);
      } catch (error) {
        if (!alive.current) return;
        setLoadError(readable(error, '素材暂时读不出来，请稍后重试。'));
      } finally {
        if (alive.current) setLoading(false);
      }
    },
    [assets, cityId],
  );

  useEffect(() => {
    alive.current = true;
    closeRef.current?.focus();
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setNotice(null);
    try {
      const photo = await uploadPhoto(file);
      if (!alive.current) return;
      setKind('photo');
      setSelectedId(photo.id);
      setNotice('照片已加入素材，点下面的按钮插到手账里。');
      await load(true);
    } catch (error) {
      if (!alive.current) return;
      setUploadError(readable(error, '照片上传失败，请重试。'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      if (alive.current) setUploading(false);
    }
  }

  const photos = items.filter((item) => item.kind === 'photo');
  const stickers = items.filter((item) => item.kind === 'sticker');
  const visible = kind === 'photo' ? photos : stickers;
  const selected = items.find((item) => item.assetId === selectedId) ?? null;

  return (
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>旅途素材 · {cityName}</p>
            <h2 id={titleId} className={styles.title}>
              挑一张贴进手账
            </h2>
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="关闭素材面板">
            ×
          </button>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="素材类型">
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'photo'}
            className={kind === 'photo' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => {
              setKind('photo');
              setSelectedId(null);
            }}
          >
            照片 <span>{photos.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'sticker'}
            className={kind === 'sticker' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => {
              setKind('sticker');
              setSelectedId(null);
            }}
          >
            贴纸 <span>{stickers.length}</span>
          </button>
        </div>

        <div className={styles.body} role="tabpanel">
          {kind === 'photo' ? (
            <div className={styles.upload}>
              <label className={styles.uploadButton}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => void handleUpload(event)}
                  disabled={uploading}
                />
                <span>{uploading ? '正在收进相册…' : '上传照片'}</span>
              </label>
              <p className={styles.uploadHint}>JPEG / PNG / WebP，单张不超过 10 MB。照片按城市归档，两种模式共用。</p>
              {uploadError ? (
                <p className={styles.error} role="alert">
                  {uploadError}
                </p>
              ) : null}
              {notice ? (
                <p className={styles.notice} role="status">
                  {notice}
                </p>
              ) : null}
            </div>
          ) : (
            <p className={styles.uploadHint}>本城贴纸与通用贴纸都会出现在这里，选中后即可交给 {mode === 'journal' ? '日记本' : '拼贴画布'}。</p>
          )}

          {loadError ? (
            <div className={styles.stateBox} role="alert">
              <p>{loadError}</p>
              <button type="button" className={styles.retry} onClick={() => void load()}>
                重新读取
              </button>
            </div>
          ) : loading ? (
            <p className={styles.stateText} role="status">
              正在翻素材册…
            </p>
          ) : visible.length === 0 ? (
            <p className={styles.stateText}>
              {kind === 'photo' ? '还没有照片。先上传一张，它会留在本城素材里。' : '贴纸目录还在整理中，之后会按城市出现在这里。'}
            </p>
          ) : (
            <ul className={styles.grid}>
              {visible.map((item) => (
                <li key={item.assetId}>
                  <button
                    type="button"
                    className={
                      item.assetId === selectedId ? `${styles.tile} ${styles.tileActive}` : styles.tile
                    }
                    onClick={() => setSelectedId(item.assetId)}
                    aria-pressed={item.assetId === selectedId}
                    aria-label={`选择${item.kind === 'photo' ? '照片' : '贴纸'} ${item.label}`}
                  >
                    <span className={styles.thumb}>
                      {item.kind === 'photo' ? (
                        <AssetPreviewImage
                          assetId={item.assetId}
                          assets={assets}
                          alt={`${item.label} 预览`}
                        />
                      ) : (
                        <StickerThumb item={item} />
                      )}
                    </span>
                    <span className={styles.tileLabel}>{item.label}</span>
                    {item.createdAt ? <span className={styles.tileDate}>{shortDate(item.createdAt)}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className={styles.footer}>
          <span className={styles.selection}>
            {selected ? `已选：${selected.label}` : '点一张素材，再插入手账'}
          </span>
          <button
            type="button"
            className={styles.use}
            disabled={!selected}
            onClick={() => selected && onSelect(selected.assetId)}
          >
            使用这张素材
          </button>
        </footer>
      </section>
    </div>
  );
}