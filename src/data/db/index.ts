import Dexie, { type Table } from 'dexie';
import type { CityWish, PhotoAsset, StampCollection, TravelBook, TravelPlan } from '../contracts';

export const DB_NAME = 'travel-atlas-book';
export const DB_VERSION = 1;

/**
 * v1 Schema 只定义一次。新增表、索引或字段时必须提升 DB_VERSION 并追加 version(n)
 * 迁移，不得直接改写已发布版本的形状。
 */
export const DB_STORES = {
  books: 'id, cityId, planId',
  photos: 'id, cityId',
  stamps: 'stampId',
  wishes: 'cityId',
  plans: 'id, *cityIds',
};

export class TravelAtlasDatabase extends Dexie {
  books!: Table<TravelBook, string>;
  photos!: Table<PhotoAsset, string>;
  stamps!: Table<StampCollection, string>;
  wishes!: Table<CityWish, string>;
  plans!: Table<TravelPlan, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(DB_VERSION).stores(DB_STORES);
  }
}

/** 全应用唯一的 Dexie 实例。页面与编辑器不得直接导入它。 */
export const db = new TravelAtlasDatabase();

export { toDataError } from './errors';