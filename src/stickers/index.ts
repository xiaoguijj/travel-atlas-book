/**
 * 贴纸系统对外的唯一出口。
 *
 * Journal 和 Collage 都只从这里 import，不往 src/stickers 里面的文件伸手——
 * 里面怎么拆、怎么改，只要这个出口不变，宿主页面就不用跟着动。
 */

export { StickerLayer } from './StickerLayer';
export type { StickerLayerProps } from './StickerLayer';

export { StickerPicker } from './StickerPicker';
export type { StickerPickerProps } from './StickerPicker';

export { useStickers } from './useStickers';
export type { StickerApi } from './useStickers';

export { createInstanceId, emptyDocument, MAX_SCALE, MIN_SCALE, readStickerDocument, stickerKey, writeStickerDocument } from './storage';

export { getStickerAsset, searchStickers, stickerAssets, stickerBaseLongEdge, stickerBox, stickerRatio, stickerUrl, stickersOf } from './catalog';

export type { StickerAsset, StickerCategory, StickerDocument, StickerInstance, StickerScope, StickerStatus } from './types';
