import type { BookMode } from '../data/contracts';
import { normalizeBookId } from '../data/validation';

/**
 * 手账路由契约。返回的是 HashRouter 内部路径（不含 `#`），
 * 例如 `bookJournalPath('abc')` 对应地址栏 `/#/book/abc?mode=journal`。
 */
/** 供 V1-05 作为 Shell 的子路由注册：`{ path: BOOK_ROUTE_SEGMENT }`。 */
export const BOOK_ROUTE_SEGMENT = 'book/:bookId';
export const BOOK_ROUTE_PATH = `/${BOOK_ROUTE_SEGMENT}`;

/** `/book/:bookId`：模式选择页。 */
export function bookPath(bookId: string): string {
  return `/book/${encodeURIComponent(normalizeBookId(bookId))}`;
}

/** `/book/:bookId?mode=journal` 或 `?mode=collage`。 */
export function bookModePath(bookId: string, mode: BookMode): string {
  return `${bookPath(bookId)}?mode=${mode}`;
}

export function journalBookPath(bookId: string): string {
  return bookModePath(bookId, 'journal');
}

export function collageBookPath(bookId: string): string {
  return bookModePath(bookId, 'collage');
}

/** 缺省、空值或未知 mode 一律回到模式选择页。 */
export function readBookMode(searchParams: URLSearchParams): BookMode | undefined {
  const mode = searchParams.get('mode');
  return mode === 'journal' || mode === 'collage' ? mode : undefined;
}