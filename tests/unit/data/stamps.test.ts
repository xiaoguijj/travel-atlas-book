import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStampRepository, type StampRepository } from '../../../src/data/stamps';
import { DataError, isDataError } from '../../../src/data/contracts';
import { TravelAtlasDatabase } from '../../../src/data/db';
import { createClock, createTestDatabase, destroyTestDatabase } from '../helpers';

describe('stamp collection repository', () => {
  let database: TravelAtlasDatabase;
  let repository: StampRepository;
  let clock: ReturnType<typeof createClock>;

  beforeEach(() => {
    database = createTestDatabase();
    clock = createClock();
    repository = createStampRepository(database, { now: clock.now });
  });

  afterEach(async () => {
    await destroyTestDatabase(database);
  });

  it('starts with an empty collection', async () => {
    await expect(repository.listCollections()).resolves.toEqual([]);
  });

  it('collects a stamp with the current timestamp', async () => {
    const record = await repository.collectStamp('nanjing-postmark');
    expect(record).toEqual({ stampId: 'nanjing-postmark', collectedAt: '2026-11-22T00:00:00.000Z' });
    await expect(database.stamps.count()).resolves.toBe(1);
  });

  it('keeps the first timestamp and adds no second row when the same stamp is collected again', async () => {
    await repository.collectStamp('nanjing-postmark');
    clock.advance(60_000);
    const second = await repository.collectStamp('nanjing-postmark');
    expect(second.collectedAt).toBe('2026-11-22T00:00:00.000Z');
    clock.advance(60_000);
    const third = await repository.collectStamp('nanjing-postmark');
    expect(third.collectedAt).toBe('2026-11-22T00:00:00.000Z');
    await expect(database.stamps.count()).resolves.toBe(1);
  });

  it('collects every business city as its own record', async () => {
    const cityIds = ['nanjing', 'shanghai', 'xian', 'beijing', 'hangzhou', 'chengdu'];
    for (const cityId of cityIds) {
      clock.advance(1000);
      await repository.collectStamp(`${cityId}-postmark`);
    }
    const collections = await repository.listCollections();
    expect(collections).toHaveLength(6);
    // 最近收藏在前，收藏册用它排「收集时间」
    expect(collections[0].stampId).toBe('chengdu-postmark');
    expect(collections[5].stampId).toBe('nanjing-postmark');
  });

  it('rejects a stamp id that is not in the catalogue and writes nothing', async () => {
    const error = await repository.collectStamp('london-postmark').catch((caught) => caught);
    expect(isDataError(error)).toBe(true);
    expect((error as DataError).code).toBe('INVALID_ASSET_ID');
    await expect(database.stamps.count()).resolves.toBe(0);
  });
});
