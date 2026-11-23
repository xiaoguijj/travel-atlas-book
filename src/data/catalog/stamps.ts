import type { StampDefinition } from '../contracts';
import { getCityById } from './cities';

/**
 * 每城一款静态邮票定义。V1-04 在这里填充六城数据；
 * 用户是否已收藏只写入 Dexie 的 stamps 表，不与定义混在一起。
 *
 * ID 用 V1-02 冻结的 `<cityId>-postmark` 形状，发布后保持稳定：换图、改标题都不动 ID，
 * 已经写进表里的收藏记录因此不会失效。
 *
 * `motif` 不在这里重复写一遍，直接取城市目录里那条地标——邮票画的地标和地球图钉、
 * 明信片封面必须是同一个，否则会出现「成都的邮票画着别的东西」。
 * 顺序就是邮票册画面上的顺序：从左到右、从上到下。
 */
const stampSpecs: { cityId: string; title: string }[] = [
  { cityId: 'nanjing', title: '南京 · 中华门城墙' },
  { cityId: 'shanghai', title: '上海 · 明珠塔' },
  { cityId: 'xian', title: '西安 · 大雁塔' },
  { cityId: 'beijing', title: '北京 · 祈年殿' },
  { cityId: 'hangzhou', title: '杭州 · 西湖断桥' },
  { cityId: 'chengdu', title: '成都 · 巷子灯笼' },
];

function buildStamp(spec: { cityId: string; title: string }): StampDefinition {
  const city = getCityById(spec.cityId);
  if (!city) throw new Error(`邮票目录引用了城市目录里没有的城市：${spec.cityId}`);
  return { id: `${city.id}-postmark`, cityId: city.id, title: spec.title, motif: city.motif };
}

export const stampDefinitions: readonly StampDefinition[] = stampSpecs.map(buildStamp);

export function listStampDefinitions(cityId?: string): StampDefinition[] {
  return stampDefinitions.filter((stamp) => cityId === undefined || stamp.cityId === cityId);
}

export function getStampDefinition(stampId: string): StampDefinition | undefined {
  return stampDefinitions.find((stamp) => stamp.id === stampId);
}

/** 邮票册和城市页都按城市找它那一枚；这座城市没发行邮票时返回 undefined，页面自己给退路。 */
export function getStampByCity(cityId: string): StampDefinition | undefined {
  return stampDefinitions.find((stamp) => stamp.cityId === cityId);
}
