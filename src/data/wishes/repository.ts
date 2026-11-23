import { DataError, type CityWish, type IsoDateTime } from '../contracts';
import { db as defaultDatabase, toDataError, type TravelAtlasDatabase } from '../db';
import { requirePlanCity } from '../plans/validation';

export interface WishRepositoryOptions {
  /** 测试可注入固定时钟；生产缺省使用当前 UTC 时间。 */
  now?: () => IsoDateTime;
}

export interface WishRepository {
  listWishes(): Promise<CityWish[]>;
  getWish(cityId: string): Promise<CityWish | undefined>;
  saveWish(cityId: string, note: string): Promise<CityWish>;
  removeWish(cityId: string): Promise<void>;
}

/**
 * 愿望仓储：每城至多一条记录，存在即表示地图已标记。
 * 移除愿望只删这一条记录，从不触碰行程或手账。
 */
export function createWishRepository(
  database: TravelAtlasDatabase = defaultDatabase,
  options: WishRepositoryOptions = {},
): WishRepository {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async listWishes() {
      try {
        const wishes = await database.wishes.toArray();
        return wishes.sort((left, right) => left.cityId.localeCompare(right.cityId));
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取愿望标记失败');
      }
    },

    async getWish(cityId) {
      const id = typeof cityId === 'string' ? cityId.trim() : '';
      if (!id) return undefined;
      try {
        return await database.wishes.get(id);
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取愿望标记失败');
      }
    },

    async saveWish(cityId, note) {
      const id = requirePlanCity(cityId);
      if (typeof note !== 'string') {
        throw new DataError('STORAGE_WRITE_FAILED', '愿望备注必须是文本', { cityId: id });
      }
      const normalizedNote = note.trim();
      try {
        return await database.transaction('rw', database.wishes, async () => {
          const existing = await database.wishes.get(id);
          const timestamp = now();
          const wish: CityWish = {
            cityId: id,
            note: normalizedNote,
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
          };
          await database.wishes.put(wish);
          return wish;
        });
      } catch (error) {
        throw toDataError(error, 'STORAGE_WRITE_FAILED', '保存愿望失败');
      }
    },

    async removeWish(cityId) {
      const id = requirePlanCity(cityId);
      try {
        await database.wishes.delete(id);
      } catch (error) {
        throw toDataError(error, 'STORAGE_WRITE_FAILED', '移除愿望失败');
      }
    },
  };
}

const defaultRepository = createWishRepository(defaultDatabase);

export const listWishes = defaultRepository.listWishes;
export const getWish = defaultRepository.getWish;
export const saveWish = defaultRepository.saveWish;
export const removeWish = defaultRepository.removeWish;