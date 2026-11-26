import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBookRepository, type BookRepository } from '../../../src/data/books';
import { TravelAtlasDatabase } from '../../../src/data/db';
import {
  createClock,
  createCollage,
  createJournal,
  createPlan,
  createTestDatabase,
  destroyTestDatabase,
} from '../helpers';

describe('book repository', () => {
  let database: TravelAtlasDatabase;
  let repository: BookRepository;
  let clock: ReturnType<typeof createClock>;

  beforeEach(() => {
    database = createTestDatabase();
    clock = createClock();
    repository = createBookRepository(database, { now: clock.now });
  });

  afterEach(async () => {
    await destroyTestDatabase(database);
  });

  it('opens an empty v1 database without demo records', async () => {
    await database.open();
    expect(database.verno).toBe(1);
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'books',
      'photos',
      'plans',
      'stamps',
      'wishes',
    ]);
    await expect(database.books.count()).resolves.toBe(0);
    await expect(database.photos.count()).resolves.toBe(0);
    await expect(database.stamps.count()).resolves.toBe(0);
    await expect(database.wishes.count()).resolves.toBe(0);
    await expect(database.plans.count()).resolves.toBe(0);
  });

  it('creates two books in the same city and isolates other cities', async () => {
    const first = await repository.createBook('nanjing', '梧桐手账');
    clock.advance();
    const second = await repository.createBook('nanjing', '玄武湖散步');
    const shanghai = await repository.createBook('shanghai', '外滩的风');

    const nanjingBooks = await repository.listBooksByCity('nanjing');
    expect(nanjingBooks).toHaveLength(2);
    expect(nanjingBooks.map((book) => book.id)).toEqual([second.id, first.id]);
    expect(nanjingBooks.every((book) => book.cityId === 'nanjing')).toBe(true);

    const shanghaiBooks = await repository.listBooksByCity('shanghai');
    expect(shanghaiBooks.map((book) => book.id)).toEqual([shanghai.id]);
  });

  it('rejects invalid cities and invalid titles', async () => {
    await expect(repository.createBook('atlantis', '不存在')).rejects.toMatchObject({
      code: 'INVALID_CITY',
    });
    await expect(repository.listBooksByCity('atlantis')).rejects.toMatchObject({
      code: 'INVALID_CITY',
    });
    await expect(repository.createBook('nanjing', '   ')).rejects.toMatchObject({
      code: 'INVALID_TITLE',
    });
    await expect(database.books.count()).resolves.toBe(0);
  });

  it('validates optional plan association inside a transaction', async () => {
    const plan = createPlan({ cityIds: ['nanjing', 'shanghai'] });
    await database.plans.add(plan);

    const linked = await repository.createBook('nanjing', '关联行程', plan.id);
    expect(linked.planId).toBe(plan.id);

    const byPlan = await repository.listBooksByPlan(plan.id);
    expect(byPlan.map((book) => book.id)).toEqual([linked.id]);

    await expect(repository.createBook('nanjing', '计划不存在', 'missing-plan')).rejects.toMatchObject({
      code: 'INVALID_PLAN',
    });
    const shanghaiOnly = createPlan({ cityIds: ['shanghai'] });
    await database.plans.add(shanghaiOnly);
    await expect(repository.createBook('nanjing', '跨城计划', shanghaiOnly.id)).rejects.toMatchObject({
      code: 'INVALID_RELATION',
    });

    await expect(database.books.count()).resolves.toBe(1);
  });

  it('links, changes and clears a plan without overwriting concurrent book saves', async () => {
    const first = createPlan({ cityIds: ['nanjing', 'xian'] });
    const second = createPlan({ cityIds: ['nanjing'] });
    const otherCity = createPlan({ cityIds: ['xian'] });
    await database.plans.bulkAdd([first, second, otherCity]);
    const book = await repository.createBook('nanjing', '原标题');
    const journal = createJournal();
    const collage = createCollage();

    clock.advance();
    const [linked] = await Promise.all([
      repository.linkBookToPlan(book.id, first.id),
      repository.saveJournal(book.id, journal),
      repository.saveCollage(book.id, collage),
      repository.renameBook(book.id, '最新标题'),
    ]);
    expect(linked.planId).toBe(first.id);
    await expect(repository.listBooksByPlan(first.id)).resolves.toMatchObject([{ id: book.id }]);
    await expect(repository.linkBookToPlan(book.id, 'missing-plan')).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    await expect(repository.linkBookToPlan(book.id, otherCity.id)).rejects.toMatchObject({ code: 'INVALID_RELATION' });
    await expect(repository.linkBookToPlan('missing-book', first.id)).rejects.toMatchObject({ code: 'BOOK_NOT_FOUND' });
    await expect(repository.linkBookToPlan(' ', first.id)).rejects.toMatchObject({ code: 'INVALID_BOOK_ID' });
    await expect(repository.getBook(book.id)).resolves.toMatchObject({ planId: first.id });

    clock.advance();
    const changed = await repository.linkBookToPlan(book.id, second.id);
    expect(changed).toMatchObject({ planId: second.id, title: '最新标题', journal, collage, updatedAt: clock.now() });
    await expect(repository.listBooksByPlan(first.id)).resolves.toEqual([]);
    clock.advance();
    await expect(repository.linkBookToPlan(book.id, second.id)).resolves.toEqual(changed);

    const cleared = await repository.linkBookToPlan(book.id);
    expect(cleared).toEqual({ ...changed, planId: undefined, updatedAt: clock.now() });
    expect((await repository.getBook(book.id))?.planId).toBeUndefined();
    await expect(repository.listBooksByPlan(second.id)).resolves.toEqual([]);
  });

  it('saves journal and collage independently without overwriting other fields', async () => {
    const plan = createPlan({ cityIds: ['nanjing'] });
    await database.plans.add(plan);
    const book = await repository.createBook('nanjing', '原标题', plan.id);
    const journal = createJournal('photo:journal-photo');
    const collage = createCollage('photo:journal-photo');

    clock.advance();
    await repository.saveJournal(book.id, journal);
    clock.advance();
    await repository.saveCollage(book.id, collage);
    clock.advance();
    await repository.renameBook(book.id, '新标题');

    const loaded = await repository.getBook(book.id);
    expect(loaded).toBeDefined();
    expect(loaded?.title).toBe('新标题');
    expect(loaded?.planId).toBe(plan.id);
    expect(loaded?.journal).toEqual(journal);
    expect(loaded?.collage).toEqual(collage);
    expect(loaded?.updatedAt).toBe(clock.now());

    // 再保存一种模式不会回退标题、关联或另一种内容。
    clock.advance();
    const nextJournal = createJournal('photo:journal-photo');
    nextJournal.doc.content?.push({ type: 'paragraph', content: [{ type: 'text', text: '补记' }] });
    await repository.saveJournal(book.id, nextJournal);
    const afterSecondSave = await repository.getBook(book.id);
    expect(afterSecondSave?.title).toBe('新标题');
    expect(afterSecondSave?.planId).toBe(plan.id);
    expect(afterSecondSave?.collage).toEqual(collage);
    expect(afterSecondSave?.journal).toEqual(nextJournal);

    clock.advance();
    const nextCollage = createCollage('photo:journal-photo');
    nextCollage.items = nextCollage.items.slice(0, 1);
    await repository.saveCollage(book.id, nextCollage);
    const afterCollageSave = await repository.getBook(book.id);
    expect(afterCollageSave?.title).toBe('新标题');
    expect(afterCollageSave?.planId).toBe(plan.id);
    expect(afterCollageSave?.journal).toEqual(nextJournal);
    expect(afterCollageSave?.collage).toEqual(nextCollage);
  });

  it('reports missing books and invalid content', async () => {
    const book = await repository.createBook('nanjing', '正常手账');

    await expect(repository.renameBook('missing-book', '改名')).rejects.toMatchObject({
      code: 'BOOK_NOT_FOUND',
    });
    await expect(repository.saveJournal('missing-book', createJournal())).rejects.toMatchObject({
      code: 'BOOK_NOT_FOUND',
    });
    await expect(repository.getBook('missing-book')).resolves.toBeUndefined();

    await expect(
      repository.saveJournal(book.id, { doc: { type: 'paragraph' } } as never),
    ).rejects.toMatchObject({ code: 'INVALID_JOURNAL' });
    await expect(
      repository.saveJournal(book.id, {
        doc: {
          type: 'doc',
          content: [{ type: 'atlasMedia', attrs: {} }],
        },
      } as never),
    ).rejects.toMatchObject({ code: 'INVALID_JOURNAL' });

    const wrongSize = { ...createCollage(), width: 100 };
    await expect(repository.saveCollage(book.id, wrongSize as never)).rejects.toMatchObject({
      code: 'INVALID_COLLAGE',
    });
    const duplicateItems = createCollage();
    duplicateItems.items.push({ ...duplicateItems.items[0] });
    await expect(repository.saveCollage(book.id, duplicateItems)).rejects.toMatchObject({
      code: 'INVALID_COLLAGE',
    });
    const wrongAssetKind = createCollage();
    wrongAssetKind.items[0] = { ...wrongAssetKind.items[0], assetId: 'sticker:x' } as never;
    await expect(repository.saveCollage(book.id, wrongAssetKind)).rejects.toMatchObject({
      code: 'INVALID_COLLAGE',
    });

    const loaded = await repository.getBook(book.id);
    expect(loaded?.journal).toBeUndefined();
    expect(loaded?.collage).toBeUndefined();
  });

  it('rolls back a book write when the surrounding transaction fails', async () => {
    const plan = createPlan({ cityIds: ['nanjing'] });
    await database.plans.add(plan);

    await expect(
      database.transaction('rw', database.books, database.plans, async () => {
        await repository.createBook('nanjing', '应当回滚', plan.id);
        expect(await database.books.count()).toBe(1);
        throw new Error('模拟事务失败');
      }),
    ).rejects.toThrow('模拟事务失败');

    await expect(database.books.count()).resolves.toBe(0);
  });

  it('restores records after closing and reopening the database', async () => {
    const created = await repository.createBook('nanjing', '刷新后仍在');
    await repository.saveJournal(created.id, createJournal());
    await repository.saveCollage(created.id, createCollage());
    const databaseName = database.name;

    database.close();
    database = new TravelAtlasDatabase(databaseName);
    repository = createBookRepository(database);

    const loaded = await repository.getBook(created.id);
    expect(loaded?.title).toBe('刷新后仍在');
    expect(loaded?.journal).toEqual(createJournal());
    expect(loaded?.collage).toEqual(createCollage());
    expect((await repository.listBooksByCity('nanjing')).map((book) => book.id)).toEqual([created.id]);
  });
});
