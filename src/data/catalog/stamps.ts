import type { StampDefinition } from '../contracts';

/**
 * 每城一款静态邮票定义。V1-04 在这里填充六城数据；
 * 用户是否已收藏只写入 Dexie 的 stamps 表，不与定义混在一起。
 */
export const stampDefinitions: readonly StampDefinition[] = [];

export function listStampDefinitions(cityId?: string): StampDefinition[] {
  return stampDefinitions.filter((stamp) => cityId === undefined || stamp.cityId === cityId);
}

export function getStampDefinition(stampId: string): StampDefinition | undefined {
  return stampDefinitions.find((stamp) => stamp.id === stampId);
}