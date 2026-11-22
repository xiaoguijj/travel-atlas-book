import { getStampDefinition } from '../catalog/stamps';
import { DataError, type IsoDateTime, type StampCollection } from '../contracts';
import { db as defaultDatabase, toDataError, type TravelAtlasDatabase } from '../db';
import { requireCity } from '../validation';

export interface StampRepositoryOptions {
  /** 测试可注入固定时钟；生产缺省使用当前 UTC 时间。 */
  now?: () => IsoDateTime;
}

export interface StampRepository {
  /** 全部收藏记录；stampId → 首次收集时间，未登记的旧记录由调用方按目录忽略。 */
  listCollections(): Promise<StampCollection[]>;
  /** 盖下这枚邮票：已藏时原样返回首次记录，不会覆盖时间、也不会新增第二条。 */
  collectStamp(stampId: string): Promise<StampCollection>;
}

/**
 * 邮票收藏仓储（V1-06）。
 *
 * 只写 Dexie 已有的 `stamps` 表（主键 stampId，见 V1-02 冻结的 Schema），
 * 不新增表、不改 DB_VERSION；静态定义留在 `src/data/catalog/stamps.ts`，
 * 这张表只存「谁在什么时候藏了哪一枚」。
 *
 * `stamps` 表按 stampId 建主键，所以「同一枚连点两次」在存储层就被主键挡住了；
 * 这里仍然先查后写，为的是把重复点击变成正常的「返回首次记录」，而不是抛约束冲突。
 */
export function createStampRepository(
  database: TravelAtlasDatabase = defaultDatabase,
  options: StampRepositoryOptions = {},
): StampRepository {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async listCollections() {
      try {
        const collections = await database.stamps.toArray();
        return collections.sort((left, right) => right.collectedAt.localeCompare(left.collectedAt));
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取邮票收藏失败');
      }
    },

    async collectStamp(stampId) {
      try {
        const stamp = getStampDefinition(stampId);
        if (!stamp) {
          throw new DataError('INVALID_ASSET_ID', '这枚邮票不在目录里', { stampId });
        }
        // 城市被摘掉时收藏也要失败，否则会留下一条打不开任何书架的记录。
        requireCity(stamp.cityId);

        return await database.transaction('rw', database.stamps, async () => {
          const existing = await database.stamps.get(stampId);
          if (existing) return existing;
          const record: StampCollection = { stampId, collectedAt: now() };
          await database.stamps.add(record);
          return record;
        });
      } catch (error) {
        throw toDataError(error, 'STORAGE_WRITE_FAILED', '盖章失败');
      }
    },
  };
}

const defaultRepository = createStampRepository(defaultDatabase);

export const listCollections = defaultRepository.listCollections;
export const collectStamp = defaultRepository.collectStamp;
