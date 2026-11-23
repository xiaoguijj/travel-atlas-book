import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TravelAtlasDatabase } from '../../../src/data/db';
import { createWishRepository, type WishRepository } from '../../../src/data/wishes';
import { createClock, createTestDatabase, destroyTestDatabase } from '../helpers';

describe('wish repository', () => {
  let database: TravelAtlasDatabase;
  let repository: WishRepository;
  let clock: ReturnType<typeof createClock>;

  beforeEach(() => {
    database = createTestDatabase();
    clock = createClock();
    repository = createWishRepository(database, { now: clock.now });
  });

  afterEach(async () => {
    await destroyTestDatabase(database);
  });

  it('saves an empty note, updates it once per city and restores after reopen', async () => {
    const created = await repository.saveWish('nanjing', '');
    expect(created).toMatchObject({ cityId: 'nanjing', note: '' });
    expect(created.createdAt).toBe('2026-11-22T00:00:00.000Z');

    clock.advance(60_000);
    const updated = await repository.saveWish('nanjing', '  秋天去看梧桐  ');
    expect(updated.note).toBe('秋天去看梧桐');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBe('2026-11-22T00:01:00.000Z');

    await expect(database.wishes.count()).resolves.toBe(1);

    const databaseName = database.name;
    database.close();
    database = new TravelAtlasDatabase(databaseName);
    repository = createWishRepository(database, { now: clock.now });
    const restored = await repository.getWish('nanjing');
    expect(restored?.note).toBe('秋天去看梧桐');
  });

  it('lists wishes for the map and rejects cities outside the six-city catalog', async () => {
    await repository.saveWish('xian', '城墙骑行');
    clock.advance();
    await repository.saveWish('chengdu', '火锅');

    const wishes = await repository.listWishes();
    expect(wishes.map((wish) => wish.cityId)).toEqual(['chengdu', 'xian']);

    await expect(repository.saveWish('london', '泰晤士河')).rejects.toMatchObject({
      code: 'INVALID_CITY',
    });
    await expect(repository.saveWish('atlantis', '不存在')).rejects.toMatchObject({
      code: 'INVALID_CITY',
    });
    await expect(repository.saveWish('', '空城市')).rejects.toMatchObject({ code: 'INVALID_CITY' });
    expect(await repository.getWish('london')).toBeUndefined();
    expect(await repository.getWish('')).toBeUndefined();
  });

  it('removing a wish never touches plans or books', async () => {
    const plan = {
      id: 'plan-keep',
      title: '南京两日',
      cityIds: ['nanjing'],
      startDate: '2026-12-01' as const,
      endDate: '2026-12-02' as const,
      days: [],
      createdAt: '2026-11-22T00:00:00.000Z',
      updatedAt: '2026-11-22T00:00:00.000Z',
    };
    await database.plans.add(plan);
    await database.books.add({
      id: 'book-keep',
      cityId: 'nanjing',
      title: '梧桐手账',
      createdAt: '2026-11-22T00:00:00.000Z',
      updatedAt: '2026-11-22T00:00:00.000Z',
      planId: plan.id,
    });
    await repository.saveWish('nanjing', '先记一笔');

    await repository.removeWish('nanjing');

    expect(await repository.getWish('nanjing')).toBeUndefined();
    expect(await database.plans.get(plan.id)).toBeDefined();
    expect(await database.books.get('book-keep')).toBeDefined();
    // 重复移除保持幂等。
    await expect(repository.removeWish('nanjing')).resolves.toBeUndefined();
    await expect(repository.removeWish('london')).rejects.toMatchObject({ code: 'INVALID_CITY' });
  });
});