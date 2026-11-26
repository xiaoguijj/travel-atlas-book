import {
  DataError,
  MAX_BOOK_TITLE_LENGTH,
  type CollageCanvas,
  type CollageSavePrecondition,
  type IsoDateTime,
  type JournalContent,
  type JournalSavePrecondition,
  type TravelBook,
} from '../contracts';
import { db as defaultDatabase, toDataError, type TravelAtlasDatabase } from '../db';
import { createStableId } from '../ids';
import {
  assertCollageCanvas,
  assertJournalContent,
  normalizeBookId,
  normalizeBookTitle,
  normalizePlanId,
  planIncludesCity,
  requireCity,
} from '../validation';
import { sameStoredContent } from './contentEquality';

export interface BookRepositoryOptions {
  /** 测试可注入固定时钟；生产缺省使用当前 UTC 时间。 */
  now?: () => IsoDateTime;
}

export interface BookRepository {
  listBooksByCity(cityId: string): Promise<TravelBook[]>;
  listBooksByPlan(planId: string): Promise<TravelBook[]>;
  createBook(cityId: string, title: string, planId?: string): Promise<TravelBook>;
  getBook(bookId: string): Promise<TravelBook | undefined>;
  renameBook(bookId: string, title: string): Promise<TravelBook>;
  linkBookToPlan(bookId: string, planId?: string): Promise<TravelBook>;
  saveJournal(bookId: string, content: JournalContent, precondition?: JournalSavePrecondition): Promise<TravelBook>;
  /** Preserve a conflicting editor draft in a new book, without replacing the source. */
  copyJournalDraft(bookId: string, content: JournalContent): Promise<TravelBook>;
  saveCollage(bookId: string, canvas: CollageCanvas, precondition?: CollageSavePrecondition): Promise<TravelBook>;
  copyCollageDraft(bookId: string, canvas: CollageCanvas): Promise<TravelBook>;
}

function sortByRecentlyUpdated(books: TravelBook[]): TravelBook[] {
  return books.sort((left, right) => {
    const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
    return byUpdatedAt !== 0 ? byUpdatedAt : right.id.localeCompare(left.id);
  });
}

/**
 * 手账仓储。所有写操作只更新目标字段，不接收或回写整本旧对象，
 * 避免用 UI 中过期的副本覆盖另一模式内容或最新关联。
 */
export function createBookRepository(
  database: TravelAtlasDatabase = defaultDatabase,
  options: BookRepositoryOptions = {},
): BookRepository {
  const now = options.now ?? (() => new Date().toISOString());

  // Call from a books + plans transaction so the target cannot change between validation and writing.
  async function requirePlanForCity(planId: string, cityId: string): Promise<void> {
    const plan = await database.plans.get(planId);
    if (!plan) {
      throw new DataError('INVALID_PLAN', '关联的旅行计划不存在', { planId });
    }
    if (!planIncludesCity(plan, cityId)) {
      throw new DataError('INVALID_RELATION', '手账所属城市不在计划城市范围内', {
        bookCityId: cityId,
        planId,
        planCityIds: plan.cityIds,
      });
    }
  }

  async function copyDraft(bookId: string, draft: { journal: JournalContent } | { collage: CollageCanvas }) {
    const label = 'journal' in draft ? '正文' : '拼贴';
    try {
      const id = normalizeBookId(bookId);
      if ('journal' in draft) assertJournalContent(draft.journal);
      else assertCollageCanvas(draft.collage);
      return await database.transaction('rw', database.books, async () => {
        const source = await database.books.get(id);
        if (!source) {
          throw new DataError('BOOK_NOT_FOUND', '原手账不存在或已被删除', { bookId: id });
        }
        const suffix = `（${label}副本）`;
        const timestamp = now();
        const copy: TravelBook = {
          id: createStableId(),
          cityId: source.cityId,
          title: `${(source.title.trim() || '未命名手账').slice(0, MAX_BOOK_TITLE_LENGTH - suffix.length)}${suffix}`,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...draft,
        };
        await database.books.add(copy);
        return copy;
      });
    } catch (error) {
      throw toDataError(error, 'STORAGE_WRITE_FAILED', `${label}副本未能保存，请重试`);
    }
  }

  return {
    async listBooksByCity(cityId) {
      try {
        requireCity(cityId);
        const books = await database.books.where('cityId').equals(cityId).toArray();
        return sortByRecentlyUpdated(books);
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取城市手账列表失败');
      }
    },

    async listBooksByPlan(planId) {
      try {
        const id = normalizePlanId(planId);
        const books = await database.books.where('planId').equals(id).toArray();
        return sortByRecentlyUpdated(books);
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取计划手账列表失败');
      }
    },

    async createBook(cityId, title, planId) {
      try {
        requireCity(cityId);
        const normalizedTitle = normalizeBookTitle(title);
        const timestamp = now();
        const book: TravelBook = {
          id: createStableId(),
          cityId,
          title: normalizedTitle,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        if (planId == null) {
          await database.books.add(book);
          return book;
        }

        const normalizedPlanId = normalizePlanId(planId);
        return await database.transaction('rw', database.books, database.plans, async () => {
          await requirePlanForCity(normalizedPlanId, cityId);
          book.planId = normalizedPlanId;
          await database.books.add(book);
          return book;
        });
      } catch (error) {
        throw toDataError(error, 'TRANSACTION_FAILED', '创建手账失败');
      }
    },

    async getBook(bookId) {
      const id = bookId?.trim();
      if (!id) return undefined;
      try {
        return await database.books.get(id);
      } catch (error) {
        throw toDataError(error, 'DATABASE_UNAVAILABLE', '读取手账失败');
      }
    },

    async renameBook(bookId, title) {
      try {
        const id = normalizeBookId(bookId);
        const nextTitle = normalizeBookTitle(title);
        return await database.transaction('rw', database.books, async () => {
          const book = await database.books.get(id);
          if (!book) {
            throw new DataError('BOOK_NOT_FOUND', '手账不存在或已被删除', { bookId: id });
          }
          const updatedAt = now();
          await database.books.update(id, { title: nextTitle, updatedAt });
          return { ...book, title: nextTitle, updatedAt };
        });
      } catch (error) {
        throw toDataError(error, 'STORAGE_WRITE_FAILED', '修改手账标题失败');
      }
    },

    async linkBookToPlan(bookId, planId) {
      try {
        const id = normalizeBookId(bookId);
        const nextPlanId = planId === undefined ? undefined : normalizePlanId(planId);
        return await database.transaction('rw', database.books, database.plans, async () => {
          const book = await database.books.get(id);
          if (!book) {
            throw new DataError('BOOK_NOT_FOUND', '手账不存在或已被删除', { bookId: id });
          }
          if (nextPlanId !== undefined) await requirePlanForCity(nextPlanId, book.cityId);
          if (book.planId === nextPlanId) return book;

          const patch = { planId: nextPlanId, updatedAt: now() };
          await database.books.update(id, patch);
          return { ...book, ...patch };
        });
      } catch (error) {
        throw toDataError(error, 'TRANSACTION_FAILED', '更新手账的行程关联失败');
      }
    },

    async saveJournal(bookId, content, precondition) {
      try {
        const id = normalizeBookId(bookId);
        assertJournalContent(content);
        return await database.transaction('rw', database.books, async () => {
          const book = await database.books.get(id);
          if (!book) {
            throw new DataError('BOOK_NOT_FOUND', '手账不存在或已被删除', { bookId: id });
          }
          // Check and write in the SAME readwrite transaction. A per-page queue or
          // a separate preflight read cannot protect against two concurrent tabs.
          if (precondition && !sameStoredContent(book.journal, precondition.expected)) {
            if (sameStoredContent(book.journal, content)) return book;
            throw new DataError(
              'JOURNAL_CONFLICT',
              '另一个标签页已更新正文，本页草稿已保留。请先另存本页正文，再打开副本继续编辑。',
              { bookId: id },
            );
          }
          const updatedAt = now();
          await database.books.update(id, { journal: content, updatedAt });
          return { ...book, journal: content, updatedAt };
        });
      } catch (error) {
        throw toDataError(error, 'STORAGE_WRITE_FAILED', '保存 Journal 失败');
      }
    },

    copyJournalDraft: (bookId, content) => copyDraft(bookId, { journal: content }),
    copyCollageDraft: (bookId, canvas) => copyDraft(bookId, { collage: canvas }),

    async saveCollage(bookId, canvas, precondition) {
      try {
        const id = normalizeBookId(bookId);
        assertCollageCanvas(canvas);
        return await database.transaction('rw', database.books, async () => {
          const book = await database.books.get(id);
          if (!book) {
            throw new DataError('BOOK_NOT_FOUND', '手账不存在或已被删除', { bookId: id });
          }
          if (precondition && !sameStoredContent(book.collage, precondition.expected)) {
            if (sameStoredContent(book.collage, canvas)) return book;
            throw new DataError(
              'COLLAGE_CONFLICT',
              '另一个标签页已更新拼贴，本页草稿已保留。可将本页拼贴另存为副本。',
              { bookId: id },
            );
          }
          const updatedAt = now();
          await database.books.update(id, { collage: canvas, updatedAt });
          return { ...book, collage: canvas, updatedAt };
        });
      } catch (error) {
        throw toDataError(error, 'STORAGE_WRITE_FAILED', '保存 Collage 失败');
      }
    },
  };
}

const defaultRepository = createBookRepository(defaultDatabase);

export const listBooksByCity = defaultRepository.listBooksByCity;
export const listBooksByPlan = defaultRepository.listBooksByPlan;
export const createBook = defaultRepository.createBook;
export const getBook = defaultRepository.getBook;
export const renameBook = defaultRepository.renameBook;
export const linkBookToPlan = defaultRepository.linkBookToPlan;
export const saveJournal = defaultRepository.saveJournal;
export const copyJournalDraft = defaultRepository.copyJournalDraft;
export const saveCollage = defaultRepository.saveCollage;
export const copyCollageDraft = defaultRepository.copyCollageDraft;
