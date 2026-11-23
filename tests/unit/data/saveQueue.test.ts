import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBookRepository, type BookRepository } from '../../../src/data/books';
import {
  DataError,
  type CollageCanvas,
  type JournalContent,
  type TravelBook,
} from '../../../src/data/contracts';
import { TravelAtlasDatabase } from '../../../src/data/db';
import { createPhotoRepository, type PhotoRepository } from '../../../src/data/photos';
import type { PhotoProcessor } from '../../../src/data/photos';
import { createBookSaveQueue, type SaveQueueRepository } from '../../../src/data/saving';
import {
  createClock,
  createCollage,
  createJournal,
  createPngBlob,
  createTestDatabase,
  destroyTestDatabase,
} from '../helpers';

function createFakeRepository() {
  const calls: { method: string; bookId: string; payload: unknown }[] = [];
  let journalFailure: DataError | null = null;
  let stamp = 0;

  const next = (patch: Partial<TravelBook>): TravelBook => {
    stamp += 1;
    return {
      id: 'book-a',
      cityId: 'nanjing',
      title: '原标题',
      createdAt: '2026-11-22T00:00:00.000Z',
      updatedAt: new Date(Date.parse('2026-11-22T00:00:00.000Z') + stamp * 1000).toISOString(),
      ...patch,
    };
  };

  return {
    calls,
    failNextJournal(error = new DataError('STORAGE_WRITE_FAILED', '模拟写入失败')) {
      journalFailure = error;
    },
    async renameBook(bookId: string, title: string) {
      calls.push({ method: 'renameBook', bookId, payload: title });
      return next({ title });
    },
    async saveJournal(bookId: string, content: JournalContent) {
      calls.push({ method: 'saveJournal', bookId, payload: content });
      if (journalFailure) {
        const error = journalFailure;
        journalFailure = null;
        throw error;
      }
      return next({ journal: content });
    },
    async saveCollage(bookId: string, canvas: CollageCanvas) {
      calls.push({ method: 'saveCollage', bookId, payload: canvas });
      return next({ collage: canvas });
    },
  } satisfies SaveQueueRepository & {
    calls: typeof calls;
    failNextJournal(error?: DataError): void;
  };
}

describe('book save queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces edits, keeps only the latest draft per field and reports status', async () => {
    const repository = createFakeRepository();
    const saved: string[] = [];
    const queue = createBookSaveQueue({
      bookId: 'book-a',
      repository,
      debounceMs: 700,
      onSaved: (field) => saved.push(field),
    });

    queue.updateTitle('第一版');
    queue.updateTitle('第二版');
    queue.updateJournal(createJournal('photo:one'));
    expect(queue.getState()).toMatchObject({ status: 'saving', pending: ['title', 'journal'] });

    await vi.advanceTimersByTimeAsync(699);
    expect(repository.calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    await queue.flush();

    expect(repository.calls.map((call) => call.method)).toEqual(['renameBook', 'saveJournal']);
    expect(repository.calls[0].payload).toBe('第二版');
    expect(repository.calls[0].bookId).toBe('book-a');
    expect(saved).toEqual(['title', 'journal']);
    expect(queue.getState()).toMatchObject({ status: 'saved', error: null, pending: [] });
    expect(queue.getState().lastSavedAt).toBeDefined();
    expect(queue.hasPending()).toBe(false);
    expect(queue.isDirty()).toBe(false);
  });

  it('keeps the failed draft and succeeds on retry', async () => {
    const repository = createFakeRepository();
    const onSaved = vi.fn();
    const queue = createBookSaveQueue({ bookId: 'book-a', repository, onSaved });

    repository.failNextJournal();
    queue.updateJournal(createJournal('photo:retry'));
    await expect(queue.flush()).resolves.toBe(false);
    expect(queue.getState()).toMatchObject({ status: 'error', pending: ['journal'] });
    expect(queue.getState().error?.code).toBe('STORAGE_WRITE_FAILED');
    expect(queue.hasPending()).toBe(true);
    expect(queue.isDirty()).toBe(true);

    await expect(queue.flush()).resolves.toBe(true);
    expect(queue.getState()).toMatchObject({ status: 'saved', error: null, pending: [] });
    expect(repository.calls.filter((call) => call.method === 'saveJournal')).toHaveLength(2);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('discards pending drafts without writing them', async () => {
    const repository = createFakeRepository();
    const queue = createBookSaveQueue({ bookId: 'book-a', repository, debounceMs: 20 });

    queue.updateTitle('不想保存的标题');
    queue.discardPending();
    await expect(queue.flush()).resolves.toBe(true);
    expect(repository.calls).toHaveLength(0);
    expect(queue.getState()).toMatchObject({ status: 'ready', error: null, pending: [] });

    queue.updateTitle('后来仍要保存');
    await queue.flush();
    expect(repository.calls).toHaveLength(1);
    expect(repository.calls[0].payload).toBe('后来仍要保存');
  });
});

describe('save queue with the real repositories', () => {
  let database: TravelAtlasDatabase;
  let repository: BookRepository;
  let photos: PhotoRepository;
  let clock: ReturnType<typeof createClock>;

  beforeEach(() => {
    database = createTestDatabase();
    clock = createClock();
    repository = createBookRepository(database, { now: clock.now });
    const processor: PhotoProcessor = {
      process: vi.fn(async (source) => ({
        blob: source.blob,
        mime: source.sourceMime,
        width: 400,
        height: 300,
      })),
    };
    photos = createPhotoRepository(database, { processor, now: clock.now });
  });

  afterEach(async () => {
    await destroyTestDatabase(database);
  });

  it('writes each book to its own id and never crosses drafts', async () => {
    const first = await repository.createBook('nanjing', '梧桐手账');
    const second = await repository.createBook('nanjing', '玄武湖散步');

    const queueA = createBookSaveQueue({ bookId: first.id, repository });
    const queueB = createBookSaveQueue({ bookId: second.id, repository });

    queueA.updateTitle('梧桐手账 · 补记');
    queueA.updateJournal(createJournal());
    queueB.updateCollage(createCollage());

    await expect(queueA.flush()).resolves.toBe(true);
    await expect(queueB.flush()).resolves.toBe(true);

    const loadedA = await repository.getBook(first.id);
    const loadedB = await repository.getBook(second.id);
    expect(loadedA?.title).toBe('梧桐手账 · 补记');
    expect(loadedA?.journal).toEqual(createJournal());
    expect(loadedA?.collage).toBeUndefined();
    expect(loadedB?.title).toBe('玄武湖散步');
    expect(loadedB?.collage).toEqual(createCollage());
    expect(loadedB?.journal).toBeUndefined();
  });

  it('lets Journal and Collage reference the same photo id of one book', async () => {
    const book = await repository.createBook('nanjing', '共用素材');
    const photo = await photos.importPhoto('nanjing', createPngBlob());
    const journal = createJournal(photo.id);
    const collage = createCollage(photo.id);

    const queue = createBookSaveQueue({ bookId: book.id, repository });
    queue.updateJournal(journal);
    await queue.flush();
    queue.updateCollage(collage);
    await queue.flush();

    const loaded = await repository.getBook(book.id);
    expect(loaded?.journal).toEqual(journal);
    expect(loaded?.collage).toEqual(collage);
    expect(loaded?.journal?.doc.content?.some((node) => node.attrs?.assetId === photo.id)).toBe(true);
    const photoItem = loaded?.collage?.items[0];
    expect(photoItem && photoItem.kind === 'photo' ? photoItem.assetId : undefined).toBe(photo.id);

    const restored = await photos.getPhoto(photo.id);
    expect(restored?.blob).toBeInstanceOf(Blob);
    expect((await photos.listPhotosByCity('nanjing')).map((item) => item.id)).toEqual([photo.id]);
  });
});