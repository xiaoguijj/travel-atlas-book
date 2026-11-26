import type { StickerDefinition } from '../contracts';
import { collageStickerDefinitions } from './collageStickers';
import { stickerArtwork, stickerArtworkUrl } from './stickerArtwork';

/**
 * 公共素材面板使用的静态贴纸目录：六城邮票、城市文化与通用贴纸。
 * 编辑器只保存 `sticker:` ID，不把贴纸图片写入用户数据库。
 */
export const stickerDefinitions: readonly StickerDefinition[] = stickerArtwork.map((artwork) => ({
  id: `sticker:${artwork.id}`,
  ...(artwork.cityId === undefined ? {} : { cityId: artwork.cityId }),
  label: artwork.name,
  category: artwork.category,
  src: stickerArtworkUrl(artwork.id),
}));

/** 指定城市时返回本城贴纸与通用贴纸；省略城市时返回全量目录。 */
export function listStickerDefinitions(cityId?: string): StickerDefinition[] {
  return stickerDefinitions.filter(
    (sticker) => cityId === undefined || sticker.cityId === undefined || sticker.cityId === cityId,
  );
}

export function getStickerDefinition(stickerId: string): StickerDefinition | undefined {
  return stickerDefinitions.find((sticker) => sticker.id === stickerId)
    ?? collageStickerDefinitions.find((sticker) => sticker.id === stickerId);
}
