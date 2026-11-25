/** Shared static artwork metadata; independent of editor state and persistence. */
export type StickerArtworkCategory = 'common' | 'stamp' | 'culture';

export interface StickerArtwork {
  /** Raw artwork ID, equal to the image basename and independent of storage namespaces. */
  id: string;
  name: string;
  nameEn: string;
  category: StickerArtworkCategory;
  cityId?: string;
}

export const stickerArtwork: readonly StickerArtwork[] = [
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

const artworkById = new Map(stickerArtwork.map((artwork) => [artwork.id, artwork]));

/** Vite emits hashed image URLs; eager imports collect strings, not image downloads. */
const urlById = new Map<string, string>(
  Object.entries(
    import.meta.glob('../../assets/stickers/*.+(png|jpg)', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  ).map(([path, url]) => [path.split('/').pop()!.replace(/\.(png|jpg)$/, ''), url]),
);

export function getStickerArtwork(rawId: string): StickerArtwork | undefined {
  return artworkById.get(rawId);
}

export function stickerArtworkUrl(rawId: string): string {
  const url = urlById.get(rawId);
  if (!url) throw new Error(`贴纸素材缺失：${rawId}`);
  return url;
}
