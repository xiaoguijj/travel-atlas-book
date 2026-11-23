import type { AssetQuery } from '../contracts';

export interface ObjectUrlApi {
  create(blob: Blob): string;
  revoke(url: string): void;
}

export const browserObjectUrlApi: ObjectUrlApi = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
};

export interface AssetPreview {
  src: string | null;
  missing: boolean;
  /** 照片的 object URL 只能释放一次；贴纸和缺失素材都是空操作。 */
  release(): void;
}

/**
 * 解析素材预览。照片在这里创建 object URL，调用方在卸载或切换素材时释放；
 * 贴纸直接使用构建后的静态地址，不需要释放。
 */
export async function resolveAssetPreview(
  assetId: string,
  assets: AssetQuery,
  objectUrls: ObjectUrlApi = browserObjectUrlApi,
): Promise<AssetPreview> {
  const resource = await assets.getAsset(assetId);
  if (!resource) return { src: null, missing: true, release: () => undefined };
  if (resource.kind === 'sticker') {
    return { src: resource.src, missing: false, release: () => undefined };
  }

  const url = objectUrls.create(resource.blob);
  let released = false;
  return {
    src: url,
    missing: false,
    release() {
      if (released) return;
      released = true;
      objectUrls.revoke(url);
    },
  };
}