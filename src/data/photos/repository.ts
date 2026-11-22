import { DataError, type IsoDateTime, type PhotoAsset } from '../contracts';
import { db as defaultDatabase, toDataError, type TravelAtlasDatabase } from '../db';
import { createPhotoAssetId, isPhotoAssetId } from '../ids';
import { requireCity } from '../validation';
import {
  browserPhotoProcessor,
  isSupportedImageMimeType,
  readPhotoSource,
  type PhotoProcessor,
  type ProcessedPhoto,
} from './image';

export interface PhotoRepositoryOptions {
  /** 测试可注入不依赖 Canvas 的处理器。 */
  processor?: PhotoProcessor;
  /** 测试可注入固定时钟。 */
  now?: () => IsoDateTime;
}

export interface PhotoRepository {
  importPhoto(cityId: string, file: File | Blob): Promise<PhotoAsset>;
  getPhoto(assetId: string): Promise<PhotoAsset | undefined>;
  listPhotosByCity(cityId: string): Promise<PhotoAsset[]>;
}

function assertProcessedPhoto(processed: ProcessedPhoto): void {
  if (!processed || !(processed.blob instanceof Blob)) {
    throw new DataError('PHOTO_PROCESSING_FAILED', '照片处理结果无效');
  }
  if (!isSupportedImageMimeType(processed.mime)) {
    throw new DataError('PHOTO_PROCESSING_FAILED', '照片处理结果格式不受支持');
  }
  if (
    !Number.isFinite(processed.width) ||
    !Number.isFinite(processed.height) ||
    processed.width <= 0 ||
    processed.height <= 0
  ) {
    throw new DataError('PHOTO_PROCESSING_FAILED', '照片处理结果尺寸无效');
  }
  if (processed.blob.size <= 0) {
    throw new DataError('PHOTO_PROCESSING_FAILED', '照片处理结果为空');
  }
}

function sortNewestFirst(photos: PhotoAsset[]): PhotoAsset[] {
  return photos.sort((left, right) => {
    const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
    return byCreatedAt !== 0 ? byCreatedAt : right.id.localeCompare(left.id);
  });
}

/**
 * 照片仓储。Blob 只在这里落库，编辑器内容只保存 `photo:` 素材 ID。
 * 压缩与解码在写事务之外完成，失败时不会留下数据库记录。
 */
export function createPhotoRepository(
  database: TravelAtlasDatabase = defaultDatabase,
  options: PhotoRepositoryOptions = {},
): PhotoRepository {
  const processor = options.processor ?? browserPhotoProcessor;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async importPhoto(cityId, file) {
      try {
        requireCity(cityId);
        const source = await readPhotoSource(file);

        let processed: ProcessedPhoto;
        try {
          processed = await processor.process(source);
        } catch (error) {
          throw toDataError(error, 'PHOTO_PROCESSING_FAILED', '照片处理失败');
        }
        assertProcessedPhoto(processed);

        const blob =
          processed.blob.type === processed.mime
            ? processed.blob
            : new Blob([processed.blob], { type: processed.mime });
        const asset: PhotoAsset = {
          id: createPhotoAssetId(),
          cityId,
          blob,
          mime: processed.mime,
          width: processed.width,
          height: processed.height,
          size: blob.size,
          createdAt: now(),
        };
        if (source.fileName) {
          asset.originalName = source.fileName;
        }

        await database.photos.add(asset);
        return asset;
      } catch (error) {
        throw toDataError(error, 'STORAGE_WRITE_FAILED', '照片保存失败');
      }
    },

    async getPhoto(assetId) {
      if (!isPhotoAssetId(assetId)) return undefined;
      try {
        return await database.photos.get(assetId);
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取照片失败');
      }
    },

    async listPhotosByCity(cityId) {
      try {
        requireCity(cityId);
        const photos = await database.photos.where('cityId').equals(cityId).toArray();
        return sortNewestFirst(photos);
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取城市照片失败');
      }
    },
  };
}

const defaultRepository = createPhotoRepository(defaultDatabase);

export const importPhoto = defaultRepository.importPhoto;
export const getPhoto = defaultRepository.getPhoto;
export const listPhotosByCity = defaultRepository.listPhotosByCity;