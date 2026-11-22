import {
  DataError,
  type CollageCanvas,
  type IsoDateTime,
  type JournalContent,
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
  saveJournal(bookId: string, content: JournalContent): Promise<TravelBook>;
  saveCollage(bookId: string, canvas: CollageCanvas): Promise<TravelBook>;
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
          const plan = await database.plans.get(normalizedPlanId);
          if (!plan) {
            throw new DataError('INVALID_PLAN', '关联的旅行计划不存在', { planId: normalizedPlanId });
          }
          if (!planIncludesCity(plan, cityId)) {
            throw new DataError('INVALID_RELATION', '手账所属城市不在计划城市范围内', {
              bookCityId: cityId,
              planId: normalizedPlanId,
              planCityIds: plan.cityIds,
            });
          }
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

    async saveJournal(bookId, content) {
      try {
        const id = normalizeBookId(bookId);
        assertJournalContent(content);
        return await database.transaction('rw', database.books, async () => {
          const book = await database.books.get(id);
          if (!book) {
            throw new DataError('BOOK_NOT_FOUND', '手账不存在或已被删除', { bookId: id });
          }
          const updatedAt = now();
          await database.books.update(id, { journal: content, updatedAt });
          return { ...book, journal: content, updatedAt };
        });
      } catch (error) {
        throw toDataError(error, 'STORAGE_WRITE_FAILED', '保存 Journal 失败');
      }
    },

    async saveCollage(bookId, canvas) {
      try {
        const id = normalizeBookId(bookId);
        assertCollageCanvas(canvas);
        return await database.transaction('rw', database.books, async () => {
          const book = await database.books.get(id);
          if (!book) {
            throw new DataError('BOOK_NOT_FOUND', '手账不存在或已被删除', { bookId: id });
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
export const saveJournal = defaultRepository.saveJournal;
export const saveCollage = defaultRepository.saveCollage;