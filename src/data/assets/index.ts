import { getStickerDefinition, listStickerDefinitions } from '../catalog/stickers';
import {
  DataError,
  type AssetMetadata,
  type AssetQuery,
  type AssetResource,
  type PhotoAsset,
  type StickerDefinition,
} from '../contracts';
import { isPhotoAssetId, isStickerAssetId } from '../ids';
import { getPhoto, listPhotosByCity } from '../photos';
import { requireCity } from '../validation';

/**
 * 素材查询的装配层。照片来自 V1-02 的照片仓储，贴纸来自 V1-04 的静态目录；
 * 这里只组合，不新建数据库或素材定义。
 */
export interface AssetQueryDependencies {
  listPhotosByCity(cityId: string): Promise<PhotoAsset[]>;
  getPhoto(assetId: string): Promise<PhotoAsset | undefined>;
  listStickerDefinitions(cityId?: string): StickerDefinition[];
  getStickerDefinition(stickerId: string): StickerDefinition | undefined;
}

const defaultDependencies: AssetQueryDependencies = {
  listPhotosByCity,
  getPhoto,
  listStickerDefinitions,
  getStickerDefinition,
};

function photoMetadata(photo: PhotoAsset): AssetMetadata {
  return {
    assetId: photo.id,
    kind: 'photo',
    cityId: photo.cityId,
    label: photo.originalName ?? '旅途照片',
    mimeType: photo.mime,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
  };
}

function stickerMetadata(sticker: StickerDefinition): AssetMetadata {
  return {
    assetId: sticker.id,
    kind: 'sticker',
    cityId: sticker.cityId,
    label: sticker.label,
    src: sticker.src,
  };
}

/**
 * 同一座城的照片与「本城 + 通用」贴纸组成素材面板的数据源。
 * 照片元数据不携带 Blob，真正需要预览时再通过 getAsset 读取并自行管理 object URL。
 */
export function createAssetQuery(
  dependencies: Partial<AssetQueryDependencies> = {},
): AssetQuery {
  const deps = { ...defaultDependencies, ...dependencies };

  return {
    async listAssets(cityId) {
      requireCity(cityId);
      const [photos, stickers] = await Promise.all([
        deps.listPhotosByCity(cityId),
        Promise.resolve(deps.listStickerDefinitions(cityId)),
      ]);
      return [...photos.map(photoMetadata), ...stickers.map(stickerMetadata)];
    },

    async getAsset(assetId) {
      if (isPhotoAssetId(assetId)) {
        const photo = await deps.getPhoto(assetId);
        if (!photo) return undefined;
        return {
          ...photoMetadata(photo),
          kind: 'photo',
          mimeType: photo.mime,
          width: photo.width,
          height: photo.height,
          blob: photo.blob,
        } satisfies AssetResource;
      }

      if (isStickerAssetId(assetId)) {
        const sticker = deps.getStickerDefinition(assetId);
        if (!sticker) return undefined;
        return {
          ...stickerMetadata(sticker),
          kind: 'sticker',
          src: sticker.src,
        } satisfies AssetResource;
      }

      throw new DataError('INVALID_ASSET_ID', '素材编号格式无效', { assetId });
    },
  };
}

/** 页面只依赖这份查询；测试可以注入独立的照片仓储与贴纸目录。 */
export const assetQuery = createAssetQuery();