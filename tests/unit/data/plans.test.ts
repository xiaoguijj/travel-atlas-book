import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBookRepository } from '../../../src/data/books';
import type { PlanItem, TravelPlan } from '../../../src/data/contracts';
import { TravelAtlasDatabase } from '../../../src/data/db';
import {
  MAX_PLAN_DAYS,
  createPlanRepository,
  type PlanDraft,
  type PlanRepository,
} from '../../../src/data/plans';
import { createClock, createJournal, createTestDatabase, destroyTestDatabase } from '../helpers';

function item(id: string, title: string, extra: Partial<PlanItem> = {}): PlanItem {
  return { id, title, ...extra };
}

function draft(overrides: Partial<PlanDraft> = {}): PlanDraft {
  return {
    title: '南京两日',
    cityIds: ['nanjing'],
    startDate: '2026-12-01',
    endDate: '2026-12-02',
    days: [
      { date: '2026-12-01', cityId: 'nanjing', items: [item('item-1', '中山陵', { time: '09:30' })] },
      { date: '2026-12-02', items: [item('item-2', '玄武湖', { note: '傍晚看落日' })] },
    ],
    ...overrides,
  };
}

function withId(plan: TravelPlan, overrides: Partial<PlanDraft> = {}): PlanDraft {
  return {
    id: plan.id,
    title: plan.title,
    cityIds: plan.cityIds,
    startDate: plan.startDate,
    endDate: plan.endDate,
    days: plan.days,
    ...overrides,
  };
}

describe('plan repository', () => {
  let database: TravelAtlasDatabase;
  let repository: PlanRepository;
  let books: ReturnType<typeof createBookRepository>;
  let clock: ReturnType<typeof createClock>;

  beforeEach(() => {
    database = createTestDatabase();
    clock = createClock();
    repository = createPlanRepository(database, { now: clock.now });
    books = createBookRepository(database, { now: clock.now });
  });

  afterEach(async () => {
    await destroyTestDatabase(database);
  });

  it('creates a plan with materialized days and lists it for each included city', async () => {
    const created = await repository.savePlan(
      draft({ title: '  南京两日  ', cityIds: ['nanjing', 'xian', 'nanjing'] }),
    );

    expect(created.title).toBe('南京两日');
    expect(created.cityIds).toEqual(['nanjing', 'xian']);
    expect(created.days.map((day) => day.date)).toEqual(['2026-12-01', '2026-12-02']);
    expect(created.days[0].items[0]).toMatchObject({ title: '中山陵', time: '09:30' });
    expect(created.createdAt).toBe('2026-11-22T00:00:00.000Z');

    expect((await repository.listPlans('nanjing')).map((plan) => plan.id)).toEqual([created.id]);
    expect((await repository.listPlans('xian')).map((plan) => plan.id)).toEqual([created.id]);
    expect(await repository.listPlans('shanghai')).toEqual([]);
    expect((await repository.listPlans()).map((plan) => plan.id)).toEqual([created.id]);
    expect(await repository.getPlan(created.id)).toEqual(created);
    expect(await repository.getPlan('  ')).toBeUndefined();
    expect(await repository.getPlan('missing')).toBeUndefined();
    await expect(repository.listPlans('london')).rejects.toMatchObject({ code: 'INVALID_CITY' });
  });

  it('fills empty days, keeps item order and preserves createdAt on update', async () => {
    const created = await repository.savePlan(
      draft({ startDate: '2026-12-01', endDate: '2026-12-03', days: [] }),
    );
    expect(created.days).toHaveLength(3);
    expect(created.days.every((day) => day.items.length === 0)).toBe(true);

    clock.advance(60_000);
    const updated = await repository.savePlan(
      withId(created, {
        days: [
          {
            date: '2026-12-02',
            cityId: 'nanjing',
            items: [item('b', '总统府'), item('a', '1912 街区')],
          },
        ],
      }),
    );

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBe('2026-11-22T00:01:00.000Z');
    expect(updated.days.map((day) => day.date)).toEqual(['2026-12-01', '2026-12-02', '2026-12-03']);
    expect(updated.days[1].items.map((entry) => entry.title)).toEqual(['总统府', '1912 街区']);
    expect(updated.days[0].items).toEqual([]);
  });

  it('requires confirmation before dropping days outside a shortened range', async () => {
    const created = await repository.savePlan(draft());
    const shortened = withId(created, { endDate: '2026-12-01' });

    const preview = await repository.previewPlanChange(shortened);
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.removedDays.map((day) => day.date)).toEqual(['2026-12-02']);
    expect(preview.unlinkedBooks).toEqual([]);

    await expect(repository.savePlan(shortened)).rejects.toMatchObject({
      code: 'INVALID_PLAN',
      details: { reason: 'CONFIRMATION_REQUIRED' },
    });
    expect((await repository.getPlan(created.id))?.days).toHaveLength(2);

    const saved = await repository.savePlan(shortened, {
      removedDates: ['2026-12-02'],
      clearedDates: [],
      unlinkedBookIds: [],
    });
    expect(saved.days.map((day) => day.date)).toEqual(['2026-12-01']);
    expect((await repository.getPlan(created.id))?.days).toHaveLength(1);
  });

  it('does not ask for confirmation when shortening only removes empty days', async () => {
    const created = await repository.savePlan(
      draft({
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        days: [{ date: '2026-12-01', items: [item('item-1', '中山陵')] }],
      }),
    );
    const preview = await repository.previewPlanChange(withId(created, { endDate: '2026-12-01' }));
    expect(preview.requiresConfirmation).toBe(false);
    await expect(repository.savePlan(withId(created, { endDate: '2026-12-01' }))).resolves.toMatchObject({
      startDate: '2026-12-01',
      endDate: '2026-12-01',
    });
  });

  it('discards shortened-out draft days before validating their items', async () => {
    const created = await repository.savePlan(draft());
    const shortened = withId(created, {
      endDate: '2026-12-01',
      days: [
        { date: '2026-12-01', items: [item('item-1', '中山陵')] },
        { date: '2026-12-02', items: [item('item-leftover', '   ')] },
      ],
    });

    const saved = await repository.savePlan(shortened, {
      removedDates: ['2026-12-02'],
      clearedDates: [],
      unlinkedBookIds: [],
    });
    expect(saved.days.map((day) => day.date)).toEqual(['2026-12-01']);
    expect(saved.days[0].items.map((entry) => entry.title)).toEqual(['中山陵']);
  });

  it('clears removed day cities, keeps items and unlinks mismatched books in one transaction', async () => {
    const created = await repository.savePlan(
      draft({
        cityIds: ['nanjing', 'xian'],
        days: [
          { date: '2026-12-01', cityId: 'nanjing', items: [item('item-1', '中山陵')] },
          { date: '2026-12-02', cityId: 'xian', items: [item('item-2', '大雁塔')] },
        ],
      }),
    );
    const nanjingBook = await books.createBook('nanjing', '南京手账', created.id);
    const xianBook = await books.createBook('xian', '西安手账', created.id);
    await books.saveJournal(xianBook.id, createJournal());
    await books.saveCollage(xianBook.id, { width: 1200, height: 1600, items: [] });

    const removedCity = withId(created, { cityIds: ['nanjing'] });
    const preview = await repository.previewPlanChange(removedCity);
    expect(preview.clearedDayDates).toEqual(['2026-12-02']);
    expect(preview.unlinkedBooks.map((book) => book.id)).toEqual([xianBook.id]);
    expect(preview.requiresConfirmation).toBe(true);

    await expect(repository.savePlan(removedCity)).rejects.toMatchObject({
      details: { reason: 'CONFIRMATION_REQUIRED' },
    });
    await expect(
      repository.savePlan(removedCity, {
        removedDates: [],
        clearedDates: [],
        unlinkedBookIds: [],
      }),
    ).rejects.toMatchObject({ details: { reason: 'CONFIRMATION_CHANGED' } });

    const saved = await repository.savePlan(removedCity, {
      removedDates: [],
      clearedDates: ['2026-12-02'],
      unlinkedBookIds: [xianBook.id],
    });
    expect(saved.cityIds).toEqual(['nanjing']);
    expect(saved.days[1]).toMatchObject({ date: '2026-12-02', items: [{ title: '大雁塔' }] });
    expect(saved.days[1].cityId).toBeUndefined();

    const unlinked = await database.books.get(xianBook.id);
    expect(unlinked?.planId).toBeUndefined();
    expect(unlinked?.journal).toEqual(createJournal());
    expect(unlinked?.collage).toEqual({ width: 1200, height: 1600, items: [] });
    expect((await database.books.get(nanjingBook.id))?.planId).toBe(created.id);
  });

  it('deletes a plan while keeping linked books and their content', async () => {
    const created = await repository.savePlan(draft());
    const book = await books.createBook('nanjing', '南京手账', created.id);
    await books.saveJournal(book.id, createJournal());

    const deletePreview = await repository.previewPlanDelete(created.id);
    expect(deletePreview.unlinkedBooks.map((entry) => entry.id)).toEqual([book.id]);

    await repository.deletePlan(created.id);

    expect(await repository.getPlan(created.id)).toBeUndefined();
    const kept = await database.books.get(book.id);
    expect(kept?.planId).toBeUndefined();
    expect(kept?.journal).toEqual(createJournal());
    await expect(repository.deletePlan(created.id)).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    await expect(repository.deletePlan('')).rejects.toMatchObject({ code: 'INVALID_PLAN' });
  });

  it('validates cities, dates, items and day structure', async () => {
    await expect(repository.savePlan(draft({ title: '   ' }))).rejects.toMatchObject({
      code: 'INVALID_TITLE',
    });
    await expect(repository.savePlan(draft({ cityIds: [] }))).rejects.toMatchObject({
      code: 'INVALID_PLAN',
    });
    await expect(repository.savePlan(draft({ cityIds: ['london'] }))).rejects.toMatchObject({
      code: 'INVALID_CITY',
    });
    await expect(repository.savePlan(draft({ cityIds: ['atlantis'] }))).rejects.toMatchObject({
      code: 'INVALID_CITY',
    });
    await expect(repository.savePlan(draft({ startDate: '2026-02-31' }))).rejects.toMatchObject({
      code: 'INVALID_PLAN',
    });
    await expect(repository.savePlan(draft({ startDate: '2026-12-05' }))).rejects.toMatchObject({
      code: 'INVALID_PLAN',
    });
    await expect(
      repository.savePlan(draft({ startDate: '2026-01-01', endDate: '2027-12-31' })),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    expect(MAX_PLAN_DAYS).toBe(366);

    await expect(
      repository.savePlan(
        draft({
          days: [
            { date: '2026-12-01', items: [item('same', '中山陵')] },
            { date: '2026-12-02', items: [item('same', '玄武湖')] },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    await expect(
      repository.savePlan(draft({ days: [{ date: '2026-12-01', items: [item('a', '中山陵', { time: '9:30' })] }] })),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    await expect(
      repository.savePlan(draft({ days: [{ date: '2026-12-01', items: [item('a', '   ')] }] })),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    await expect(
      repository.savePlan(
        draft({
          days: [
            { date: '2026-12-01', items: [item('a', '中山陵')] },
            { date: '2026-12-01', items: [item('b', '玄武湖')] },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    await expect(database.plans.count()).resolves.toBe(0);
  });

  it('rolls back plan writes and unlinks when the surrounding transaction fails', async () => {
    const created = await repository.savePlan(draft({ cityIds: ['nanjing', 'xian'] }));
    const xianBook = await books.createBook('xian', '西安手账', created.id);

    await expect(
      database.transaction('rw', database.plans, database.books, async () => {
        await repository.savePlan(withId(created, { cityIds: ['nanjing'] }), {
          removedDates: [],
          clearedDates: [],
          unlinkedBookIds: [xianBook.id],
        });
        throw new Error('模拟事务失败');
      }),
    ).rejects.toThrow('模拟事务失败');

    expect((await repository.getPlan(created.id))?.cityIds).toEqual(['nanjing', 'xian']);
    expect((await database.books.get(xianBook.id))?.planId).toBe(created.id);
  });
});