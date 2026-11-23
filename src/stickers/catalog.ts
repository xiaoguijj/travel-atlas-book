import { cities } from '../data/cities';
import type { StickerAsset, StickerCategory } from './types';
import { stickerSizes } from './sizes';

/**
 * 贴纸素材库的唯一出处。
 *
 * 图片路径不在这里硬编码：文件名就是 stickerId，构建时由 Vite 打上内容哈希，
 * 页面只通过 stickerUrl(id) 取地址。新增一张贴纸要做两件事——
 * 把图放进 src/assets/stickers、在 stickerAssets 里补一行，别处不用改。
 */

/** 每类贴纸的默认长边占画布宽度的比例，scale=1 时用它算实际大小 */
export const stickerBaseLongEdge: Record<StickerCategory, number> = {
  common: 0.13,
  stamp: 0.19,
  culture: 0.15,
};

export const stickerAssets: readonly StickerAsset[] = [
  { id: 'common-gramophone', name: '留声机', nameEn: 'Gramophone', category: 'common' },
  { id: 'common-postage-sunflower', name: '向日葵邮票', nameEn: 'Sunflower Postage', category: 'common' },
  { id: 'common-camera', name: '胶片相机', nameEn: 'Film Camera', category: 'common' },
  { id: 'common-train', name: '绿皮火车', nameEn: 'Slow Train', category: 'common' },

  { id: 'stamp-nanjing', name: '南京邮票', nameEn: 'Nanjing Stamp', category: 'stamp', cityId: 'nanjing' },
  { id: 'stamp-shanghai', name: '上海邮票', nameEn: 'Shanghai Stamp', category: 'stamp', cityId: 'shanghai' },
  { id: 'stamp-xian', name: '西安邮票', nameEn: "Xi'an Stamp", category: 'stamp', cityId: 'xian' },
  { id: 'stamp-beijing', name: '北京邮票', nameEn: 'Beijing Stamp', category: 'stamp', cityId: 'beijing' },
  { id: 'stamp-hangzhou', name: '杭州邮票', nameEn: 'Hangzhou Stamp', category: 'stamp', cityId: 'hangzhou' },
  { id: 'stamp-chengdu', name: '成都邮票', nameEn: 'Chengdu Stamp', category: 'stamp', cityId: 'chengdu' },

  { id: 'beijing-jingju-opera', name: '京剧', nameEn: 'Peking Opera', category: 'culture', cityId: 'beijing' },
  { id: 'beijing-ditan-park', name: '地坛', nameEn: 'Ditan Park', category: 'culture', cityId: 'beijing' },
  { id: 'beijing-peking-duck', name: '北京烤鸭', nameEn: 'Peking Duck', category: 'culture', cityId: 'beijing' },
  { id: 'beijing-chrysanthemum', name: '菊花', nameEn: 'Chrysanthemum', category: 'culture', cityId: 'beijing' },

  { id: 'shanghai-qipao-girl', name: '海派旗袍少女', nameEn: 'Qipao Lady', category: 'culture', cityId: 'shanghai' },
  { id: 'shanghai-magnolia', name: '白玉兰', nameEn: 'White Magnolia', category: 'culture', cityId: 'shanghai' },
  { id: 'shanghai-shengjian', name: '生煎包', nameEn: 'Shengjian Buns', category: 'culture', cityId: 'shanghai' },
  { id: 'shanghai-wukang-mansion', name: '武康大楼', nameEn: 'Wukang Mansion', category: 'culture', cityId: 'shanghai' },

  { id: 'chengdu-wuhou-shrine', name: '武侯祠', nameEn: 'Wuhou Shrine', category: 'culture', cityId: 'chengdu' },
  { id: 'chengdu-dandan-noodles', name: '担担面', nameEn: 'Dandan Noodles', category: 'culture', cityId: 'chengdu' },
  { id: 'chengdu-sichuan-opera', name: '川剧', nameEn: 'Sichuan Opera', category: 'culture', cityId: 'chengdu' },
  { id: 'chengdu-shu-embroidery', name: '蜀绣', nameEn: 'Shu Embroidery', category: 'culture', cityId: 'chengdu' },

  { id: 'nanjing-jimingsi-temple', name: '鸡鸣寺', nameEn: 'Jiming Temple', category: 'culture', cityId: 'nanjing' },
  { id: 'nanjing-duck-vermicelli', name: '鸭血粉丝汤', nameEn: 'Duck Blood Vermicelli', category: 'culture', cityId: 'nanjing' },
  { id: 'nanjing-plum-blossom', name: '梅花', nameEn: 'Plum Blossom', category: 'culture', cityId: 'nanjing' },
  { id: 'nanjing-yunjin-silk', name: '南京云锦', nameEn: 'Yunjin Brocade', category: 'culture', cityId: 'nanjing' },

  { id: 'xian-terracotta-warrior', name: '兵马俑', nameEn: 'Terracotta Warrior', category: 'culture', cityId: 'xian' },
  { id: 'xian-lamb-stew', name: '羊肉泡馍', nameEn: 'Lamb Paomo', category: 'culture', cityId: 'xian' },
  { id: 'xian-wild-goose-pagoda', name: '大雁塔', nameEn: 'Giant Wild Goose Pagoda', category: 'culture', cityId: 'xian' },
  { id: 'xian-pomegranate-flower', name: '石榴花', nameEn: 'Pomegranate Blossom', category: 'culture', cityId: 'xian' },

  { id: 'hangzhou-leifeng-pagoda', name: '雷峰塔', nameEn: 'Leifeng Pagoda', category: 'culture', cityId: 'hangzhou' },
  { id: 'hangzhou-dongpo-pork', name: '东坡肉', nameEn: 'Dongpo Pork', category: 'culture', cityId: 'hangzhou' },
  { id: 'hangzhou-osmanthus', name: '桂花', nameEn: 'Osmanthus', category: 'culture', cityId: 'hangzhou' },
  { id: 'hangzhou-silk-umbrella', name: '西湖绸伞', nameEn: 'West Lake Silk Umbrella', category: 'culture', cityId: 'hangzhou' },
];

const assetById = new Map(stickerAssets.map((asset) => [asset.id, asset]));

/** 文件名 → Vite 处理后的地址；eager 只是收集字符串，图片仍然按需才下载 */
const urlById = new Map<string, string>(
  Object.entries(
    import.meta.glob('../assets/stickers/*.+(png|jpg)', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  ).map(([path, url]) => [path.split('/').pop()!.replace(/\.(png|jpg)$/, ''), url]),
);

export function getStickerAsset(assetId: string): StickerAsset | undefined {
  return assetById.get(assetId);
}

export function stickerUrl(assetId: string): string {
  const url = urlById.get(assetId);
  if (!url) throw new Error(`贴纸素材缺失：${assetId}`);
  return url;
}

/** 裁完的真实宽高比，用来把百分比宽度换算成同样的百分比高度 */
export function stickerRatio(assetId: string): number {
  const size = stickerSizes[assetId];
  return size ? size[0] / size[1] : 1;
}

/** 贴纸盒子相对画布的尺寸：长边按类别给默认值，再乘实例的缩放倍数 */
export function stickerBox(assetId: string, scale: number): { w: number; h: number } {
  const asset = assetById.get(assetId);
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
