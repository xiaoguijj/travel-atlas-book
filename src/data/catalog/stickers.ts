import type { StickerDefinition } from '../contracts';

/**
 * 静态贴纸目录。V1-04 在这里填充本城与通用贴纸；
 * 编辑器只保存 `sticker:` ID，不把贴纸图片写入用户数据库。
 */
export const stickerDefinitions: readonly StickerDefinition[] = [];

/** 指定城市时返回本城贴纸与通用贴纸；省略城市时返回全量目录。 */
export function listStickerDefinitions(cityId?: string): StickerDefinition[] {
  return stickerDefinitions.filter(
    (sticker) => cityId === undefined || sticker.cityId === undefined || sticker.cityId === cityId,
  );
}

export function getStickerDefinition(stickerId: string): StickerDefinition | undefined {
  return stickerDefinitions.find((sticker) => sticker.id === stickerId);
}