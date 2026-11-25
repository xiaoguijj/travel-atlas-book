import { cities } from '../data/cities';
import { getStickerArtwork, stickerArtwork, stickerArtworkUrl } from '../data/catalog/stickerArtwork';
import type { StickerAsset, StickerCategory } from './types';
import { stickerSizes } from './sizes';

/**
 * 拖拽贴纸沿用原始素材 ID，共享图片与元数据来自 data/catalog/stickerArtwork。
 *
 * 这里保留画布尺寸与搜索接口；不加公共 AssetQuery 使用的 `sticker:` 前缀，
 * 已有 StickerInstance.assetId 和 localStorage 存档因此无需迁移。
 */

/** 每类贴纸的默认长边占画布宽度的比例，scale=1 时用它算实际大小 */
export const stickerBaseLongEdge: Record<StickerCategory, number> = {
  common: 0.13,
  stamp: 0.19,
  culture: 0.15,
};

export const stickerAssets: readonly StickerAsset[] = stickerArtwork;

export function getStickerAsset(assetId: string): StickerAsset | undefined {
  return getStickerArtwork(assetId);
}

export function stickerUrl(assetId: string): string {
  return stickerArtworkUrl(assetId);
}

/** 裁完的真实宽高比，用来把百分比宽度换算成同样的百分比高度 */
export function stickerRatio(assetId: string): number {
  const size = stickerSizes[assetId];
  return size ? size[0] / size[1] : 1;
}

/** 贴纸盒子相对画布的尺寸：长边按类别给默认值，再乘实例的缩放倍数 */
export function stickerBox(assetId: string, scale: number): { w: number; h: number } {
  const asset = getStickerAsset(assetId);
  const ratio = stickerRatio(assetId);
  const long = (stickerBaseLongEdge[asset?.category ?? 'common'] ?? 0.15) * scale;
  return ratio >= 1 ? { w: long, h: long / ratio } : { w: long * ratio, h: long };
}

export function stickersOf(category: StickerCategory): StickerAsset[] {
  return stickerAssets.filter((asset) => asset.category === category);
}

/**
 * 搜索命中规则（选择器只认这一个出处）：
 * 先认城市——命中一座城就给它的四张文化贴纸，说一不二，不多给邮票；
 * 城市没命中才按贴纸名字找，这样输入「南京」是四张，输入「邮票」是六张。
 * 中英文都行：Xi'an、xian、西安 都能找到西安。
 */
export function searchStickers(query: string): StickerAsset[] {
  const raw = query.trim();
  if (!raw) return [];
  const folded = fold(raw);

  const matchedCity = cities.find((city) => cityAliases(city.id, city.name, city.nameEn).includes(folded));
  const cityHits = matchedCity
    ? stickerAssets.filter((asset) => asset.category === 'culture' && asset.cityId === matchedCity.id)
    : [];
  // 伦敦在地球上但没有贴纸，命中空城市时继续按名字找，不给用户一个空白结果
  if (cityHits.length > 0) return cityHits;

  const nameHits = stickerAssets.filter(
    (asset) => asset.name.includes(raw) || fold(asset.nameEn).includes(folded),
  );
  if (nameHits.length > 0) return nameHits;

  // 「北京 京剧」这种带空格的组合：所有词都命中同一座城时按城给
  const words = raw.split(/\s+/).map(fold).filter(Boolean);
  if (words.length > 1) {
    return stickerAssets.filter((asset) => {
      const haystack = [asset.name, asset.nameEn, cityName(asset.cityId)].map(fold).join(' ');
      return words.every((word) => haystack.includes(word));
    });
  }
  return [];
}

/** 城市的可搜写法：中文名、英文名去掉撇号和空格、以及 id */
function cityAliases(id: string, name: string, nameEn: string): string[] {
  return [fold(name), fold(nameEn), id];
}

function cityName(cityId?: string): string {
  return cities.find((city) => city.id === cityId)?.name ?? '';
}

function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}
