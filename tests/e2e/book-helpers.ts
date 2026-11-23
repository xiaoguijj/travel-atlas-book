import type { Page } from '@playwright/test';
import type { TravelBook } from '../../src/data/contracts';

/** E2E 只通过公开的 IndexedDB Schema 造书，不引入生产测试钩子。 */
export async function seedBooks(page: Page, books: TravelBook[]): Promise<void> {
  // 用一个不需要 WebGL 的轻页面取得同源上下文，避免为造数据先启动地球场景。
  await page.goto('/#/section/inspiration', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (records) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('travel-atlas-book', 1);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('books')) {
          const store = database.createObjectStore('books', { keyPath: 'id' });
          store.createIndex('cityId', 'cityId');
          store.createIndex('planId', 'planId');
        }
        if (!database.objectStoreNames.contains('photos')) {
          database.createObjectStore('photos', { keyPath: 'id' }).createIndex('cityId', 'cityId');
        }
        if (!database.objectStoreNames.contains('stamps')) {
          database.createObjectStore('stamps', { keyPath: 'stampId' });
        }
        if (!database.objectStoreNames.contains('wishes')) {
          database.createObjectStore('wishes', { keyPath: 'cityId' });
        }
        if (!database.objectStoreNames.contains('plans')) {
          database
            .createObjectStore('plans', { keyPath: 'id' })
            .createIndex('cityIds', 'cityIds', { multiEntry: true });
        }
      };

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('books', 'readwrite');
        const store = transaction.objectStore('books');
        for (const record of records) store.put(record);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };
      };
    });
  }, books);
}

export async function readBook(page: Page, bookId: string): Promise<TravelBook | undefined> {
  return page.evaluate(
    (id) =>
      new Promise<TravelBook | undefined>((resolve, reject) => {
        const request = indexedDB.open('travel-atlas-book');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('books', 'readonly');
          const get = transaction.objectStore('books').get(id);
          get.onsuccess = () => {
            database.close();
            resolve(get.result as TravelBook | undefined);
          };
          get.onerror = () => {
            database.close();
            reject(get.error);
          };
        };
      }),
    bookId,
  );
}

export async function readPhotoCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('travel-atlas-book');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('photos', 'readonly');
          const count = transaction.objectStore('photos').count();
          count.onsuccess = () => {
            database.close();
            resolve(count.result);
          };
          count.onerror = () => {
            database.close();
            reject(count.error);
          };
        };
      }),
  );
}

export function seedBook(
  id: string,
  title: string,
  cityId = 'nanjing',
  extra: Partial<TravelBook> = {},
): TravelBook {
  return {
    id,
    cityId,
    title,
    createdAt: '2026-11-22T08:00:00.000Z',
    updatedAt: '2026-11-22T08:00:00.000Z',
    ...extra,
  };
}