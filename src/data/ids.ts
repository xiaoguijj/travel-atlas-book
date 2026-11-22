import { PHOTO_ID_PREFIX, STICKER_ID_PREFIX } from './contracts';

function createUuidV4Fallback(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * 与存储实现无关的稳定业务 ID。手账、计划、画布元素共用；
 * 照片和贴纸在共享素材命名空间里额外使用前缀。
 */
export function createStableId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return createUuidV4Fallback();
}

export function createPhotoAssetId(): string {
  return `${PHOTO_ID_PREFIX}${createStableId()}`;
}

export function isPhotoAssetId(assetId: string | undefined | null): assetId is string {
  return typeof assetId === 'string' && assetId.startsWith(PHOTO_ID_PREFIX) && assetId.length > PHOTO_ID_PREFIX.length;
}

export function isStickerAssetId(assetId: string | undefined | null): assetId is string {
  return typeof assetId === 'string' && assetId.startsWith(STICKER_ID_PREFIX) && assetId.length > STICKER_ID_PREFIX.length;
}

export function isKnownAssetId(assetId: string | undefined | null): assetId is string {
  return isPhotoAssetId(assetId) || isStickerAssetId(assetId);
}