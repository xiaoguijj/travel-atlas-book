import { useEffect, useState } from 'react';
import type { AssetQuery } from '../../data/contracts';
import { resolveAssetPreview } from '../../data/assets/preview';

export type PreviewStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export interface AssetPreviewState {
  status: PreviewStatus;
  src?: string;
  error?: string;
}

/**
 * 素材预览的唯一出口：照片在这里创建 object URL，并在素材变化或组件卸载时释放；
 * 贴纸直接返回静态地址。素材缺失与读取失败分开显示，便于编辑器画占位而不是空白。
 */
export function useAssetPreview(assetId: string | undefined, assets: AssetQuery): AssetPreviewState {
  const [state, setState] = useState<AssetPreviewState>(() =>
    assetId ? { status: 'loading' } : { status: 'idle' },
  );

  useEffect(() => {
    if (!assetId) {
      setState({ status: 'idle' });
      return;
    }

    let alive = true;
    let release: (() => void) | undefined;
    setState({ status: 'loading' });

    resolveAssetPreview(assetId, assets)
      .then((preview) => {
        if (!alive) {
          preview.release();
          return;
        }
        release = preview.release;
        if (preview.missing) setState({ status: 'missing' });
        else setState({ status: 'ready', src: preview.src ?? undefined });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : '素材读取失败',
        });
      });

    return () => {
      alive = false;
      release?.();
    };
  }, [assetId, assets]);

  return state;
}