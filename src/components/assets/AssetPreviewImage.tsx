import type { AssetQuery } from '../../data/contracts';
import styles from './AssetPreviewImage.module.css';
import { useAssetPreview } from './useAssetPreview';

interface AssetPreviewImageProps {
  assetId: string;
  assets: AssetQuery;
  alt: string;
  className?: string;
}

/** 统一处理照片 Blob、贴纸静态图、缺失素材与读取失败。 */
export function AssetPreviewImage({ assetId, assets, alt, className }: AssetPreviewImageProps) {
  const preview = useAssetPreview(assetId, assets);
  const classes = className ? `${styles.frame} ${className}` : styles.frame;

  if (preview.status === 'ready' && preview.src) {
    return (
      <span className={classes}>
        <img className={styles.image} src={preview.src} alt={alt} loading="lazy" decoding="async" />
      </span>
    );
  }

  return (
    <span
      className={`${classes} ${preview.status === 'error' ? styles.error : styles.missing}`}
      role="img"
      aria-label={preview.status === 'error' ? '素材读取失败' : preview.status === 'loading' ? '素材加载中' : '素材缺失'}
      title={preview.error}
    >
      {preview.status === 'loading' ? '…' : preview.status === 'error' ? '读取失败' : '素材缺失'}
    </span>
  );
}