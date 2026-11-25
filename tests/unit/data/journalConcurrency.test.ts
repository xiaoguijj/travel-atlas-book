import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBookRepository, type BookRepository } from '../../../src/data/books';
import { MAX_BOOK_TITLE_LENGTH, type JournalContent, type TravelBook } from '../../../src/data/contracts';
import { TravelAtlasDatabase } from '../../../src/data/db';
import { createBookSaveQueue, type BookSaveQueue, type SaveQueueRepository } from '../../../src/data/saving';
import { createCollage, createTestDatabase, destroyTestDatabase } from '../helpers';

function text(value: string): JournalContent {
  return { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] } };
}

describe('journal concurrency and draft preservation', () => {
  let database: TravelAtlasDatabase;
  let otherConnection: TravelAtlasDatabase;
  let books: BookRepository;
  let otherBooks: BookRepository;
  let queues: BookSaveQueue[];

  beforeEach(() => {
    database = createTestDatabase();
    otherConnection = new TravelAtlasDatabase(database.name);
    books = createBookRepository(database);
    otherBooks = createBookRepository(otherConnection);
    queues = [];
  });

  afterEach(async () => {
    queues.forEach((queue) => queue.dispose());
    otherConnection.close();
    await destroyTestDatabase(database);
  });

  function editor(book: TravelBook, repository: SaveQueueRepository = books): BookSaveQueue {
    const queue = createBookSaveQueue({ bookId: book.id, initialJournal: book.journal, repository });
    queues.push(queue);
    return queue;
  }

  for (const initial of [undefined, text('共同原文')]) {
    it(`rejects one of two simultaneous independent connections with ${initial ? 'existing text' : 'an empty book'}`, async () => {
      let book = await books.createBook('nanjing', '双页并发');
      if (initial) book = await books.saveJournal(book.id, initial);
      const first = editor(book);
      const second = editor((await otherBooks.getBook(book.id))!, otherBooks);
      const drafts = [text('页面 A 的重要内容'), text('页面 B 的重要内容')];
      first.updateJournal(drafts[0]);
      second.updateJournal(drafts[1]);

      const saved = await Promise.all([first.flush(), second.flush()]);
      expect(saved.filter(Boolean)).toHaveLength(1);
      const winnerIndex = saved[0] ? 0 : 1;
      const loser = saved[0] ? second : first;
      const winning = (await books.getBook(book.id))!;
      expect(winning.journal).toEqual(drafts[winnerIndex]);
      expect(loser.getState()).toMatchObject({ status: 'error', journalConflict: true, pending: ['journal'] });
      expect(loser.getState().error?.code).toBe('JOURNAL_CONFLICT');
      expect(loser.getJournalDraft()).toEqual(drafts[1 - winnerIndex]);
      expect(loser.isDirty()).toBe(true);

      // A retry must never silently adopt the foreign baseline and overwrite it.
      await expect(loser.flush()).resolves.toBe(false);
      expect((await books.getBook(book.id))!.journal).toEqual(winning.journal);
    });
  }

  it('compares only the journal and preserves title, plan and Collage fields', async () => {
    let book = await books.createBook('nanjing', '原题');
    book = await books.saveJournal(book.id, text('原文'));
    const queue = editor(book);
    await otherBooks.renameBook(book.id, '另一个页面的新标题');
    const collage = createCollage();
    await otherBooks.saveCollage(book.id, collage);
    await database.books.update(book.id, { planId: 'retained-plan' });
    queue.updateJournal(text('正文新内容'));
    await expect(queue.flush()).resolves.toBe(true);
    expect(await books.getBook(book.id)).toMatchObject({
      title: '另一个页面的新标题', planId: 'retained-plan', collage, journal: text('正文新内容'),
    });
  });

  it('does not rebase a stale editor from the book returned by a title save', async () => {
    let book = await books.createBook('nanjing', '基线隔离');
    book = await books.saveJournal(book.id, text('两页最初共同看到的原文'));
    const stale = editor(book);
    await otherBooks.saveJournal(book.id, text('另一页已经写入的新段落'));
    stale.updateTitle('只改标题');
    await expect(stale.flush()).resolves.toBe(true);
    stale.updateJournal(text('旧页面中的新增内容'));
    await expect(stale.flush()).resolves.toBe(false);
    expect(await books.getBook(book.id)).toMatchObject({ title: '只改标题', journal: text('另一页已经写入的新段落') });
  });

  it('advances its own baseline after success and still protects a later foreign change', async () => {
    const book = await books.createBook('nanjing', '连续编辑');
    const queue = editor(book);
    queue.updateJournal(text('第一段'));
    await expect(queue.flush()).resolves.toBe(true);
    queue.updateJournal(text('第一段和第二段'));
    await expect(queue.flush()).resolves.toBe(true);
    const cleared: JournalContent = { doc: { type: 'doc', content: [{ type: 'paragraph' }] } };
    queue.updateJournal(cleared);
    await expect(queue.flush()).resolves.toBe(true);
    await otherBooks.saveJournal(book.id, text('别页后来的补记'));
    queue.updateJournal(text('又在旧页写一行'));
    await expect(queue.flush()).resolves.toBe(false);
    expect((await books.getBook(book.id))!.journal).toEqual(text('别页后来的补记'));
  });

  it('accepts an identical already-saved draft, then uses that successful baseline', async () => {
    const book = await books.createBook('nanjing', '幂等保存');
    const first = editor(book);
    const second = editor(book, otherBooks);
    first.updateJournal(text('两页写了相同内容'));
    second.updateJournal(text('两页写了相同内容'));
    await expect(Promise.all([first.flush(), second.flush()])).resolves.toEqual([true, true]);
    second.updateJournal(text('相同内容后的新补记'));
    await expect(second.flush()).resolves.toBe(true);
  });

  it('ignores object key order without ignoring unknown stored data', async () => {
    const book = await books.createBook('nanjing', '旧JSON键顺序');
    const stored: JournalContent = { doc: { type: 'doc', content: [{ type: 'atlasMedia', attrs: { assetId: 'photo:one', caption: '照片' } }] } };
    await books.saveJournal(book.id, stored);
    const reordered: JournalContent = { doc: { content: [{ attrs: { caption: '照片', assetId: 'photo:one' }, type: 'atlasMedia' }], type: 'doc' } };
    await expect(books.saveJournal(book.id, text('正常编辑'), { expected: reordered })).resolves.toHaveProperty('journal', text('正常编辑'));
    const current = text('正常编辑');
    await database.books.update(book.id, { journal: { ...current, legacy: '必须保留的元数据' } as JournalContent });
    await expect(books.saveJournal(book.id, text('将覆盖元数据'), { expected: current })).rejects.toMatchObject({ code: 'JOURNAL_CONFLICT' });
  });

  it('keeps the latest draft if a foreign write lands during an earlier in-flight save', async () => {
    const book = await books.createBook('nanjing', '写入中继续打字');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const slow: SaveQueueRepository = {
      ...books,
      async saveJournal(id, content, precondition) {
        await gate;
        return books.saveJournal(id, content, precondition);
      },
    };
    const queue = editor(book, slow);
    queue.updateJournal(text('先输入的版本'));
    const saving = queue.flush();
    queue.updateJournal(text('写入中继续输入的最新版本'));
    await otherBooks.saveJournal(book.id, text('外部已保存的内容'));
    release();
    await expect(saving).resolves.toBe(false);
    expect(queue.getJournalDraft()).toEqual(text('写入中继续输入的最新版本'));
    await expect(queue.flush()).resolves.toBe(false);
    expect((await books.getBook(book.id))!.journal).toEqual(text('外部已保存的内容'));
  });

  it('does not overwrite externally damaged arrays or extra array metadata', async () => {
    let book = await books.createBook('nanjing', '写入时保护损坏旧档');
    book = await books.saveJournal(book.id, text('正常基线'));
    const queue = editor(book);
    const sparse: JournalContent = { doc: { type: 'doc', content: Array(1) } };
    await database.books.update(book.id, { journal: sparse });
    queue.updateJournal(text('不能覆盖损坏旧档'));
    await expect(queue.flush()).resolves.toBe(false);
    expect((await books.getBook(book.id))!.journal).toEqual(sparse);

    const annotated = structuredClone(book.journal!);
    Object.assign(annotated.doc.content!, { recoveryNote: '外部添加的恢复信息' });
    await database.books.update(book.id, { journal: annotated });
    await expect(queue.flush()).resolves.toBe(false);
    expect((await books.getBook(book.id))!.journal).toEqual(annotated);
  });

  it('takes detached snapshots for both the baseline and queued draft', async () => {
    let book = await books.createBook('nanjing', '不可变快照');
    book = await books.saveJournal(book.id, text('最初原文'));
    const queue = editor(book);
    book.journal!.doc.content![0].content![0].text = '调用者修改了原对象';
    const draft = text('准备保存的内容');
    queue.updateJournal(draft);
    draft.doc.content![0].content![0].text = '调用者事后修改了草稿对象';
    queue.getJournalDraft()!.doc.content![0].content![0].text = '读取者也不能修改队列';
    await expect(queue.flush()).resolves.toBe(true);
    expect((await books.getBook(book.id))!.journal).toEqual(text('准备保存的内容'));
  });

  it('atomically preserves a conflicting draft as a separate book without clearing later edits', async () => {
    const source = await books.createBook('nanjing', '长'.repeat(MAX_BOOK_TITLE_LENGTH));
    const queue = editor(source);
    const winner = text('正式版本');
    const draft = text('本页草稿');
    draft.doc.content!.push({ type: 'atlasMedia', attrs: { assetId: 'photo:shared-photo' } });
    await otherBooks.saveJournal(source.id, winner);
    queue.updateJournal(draft);
    await expect(queue.flush()).resolves.toBe(false);

    const clickedSnapshot = queue.getJournalDraft()!;
    const copying = books.copyJournalDraft(source.id, clickedSnapshot);
    queue.updateJournal(text('另存过程中继续输入的文字'));
    const copy = await copying;
    expect(copy.id).not.toBe(source.id);
    expect(copy.cityId).toBe(source.cityId);
    expect(copy.title.length).toBeLessThanOrEqual(MAX_BOOK_TITLE_LENGTH);
    expect(copy.title).toContain('正文副本');
    expect((await books.getBook(copy.id))!.journal).toEqual(draft);
    expect((await books.getBook(source.id))!.journal).toEqual(winner);
    expect(queue.getJournalDraft()).toEqual(text('另存过程中继续输入的文字'));
    expect(queue.isDirty()).toBe(true);
    expect(queue.getState().journalConflict).toBe(true);
    await expect(queue.flush()).resolves.toBe(false);
  });

  it('does not leave an empty copy behind when a copy transaction aborts', async () => {
    const book = await books.createBook('nanjing', '副本失败');
    await expect(database.transaction('rw', database.books, async () => {
      await books.copyJournalDraft(book.id, text('未完成写入的草稿'));
      throw new Error('storage write interrupted');
    })).rejects.toThrow('storage write interrupted');
    expect(await books.listBooksByCity('nanjing')).toHaveLength(1);
    expect((await books.getBook(book.id))!.journal).toBeUndefined();
  });
});
