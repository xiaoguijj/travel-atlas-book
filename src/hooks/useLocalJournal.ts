import { useCallback, useEffect, useRef, useState } from 'react';

export interface JournalEntry {
  title: string;
  date: string;
  /** 一本手账的若干页，下标 0 是第一页；写满一页会自动往后加一页 */
  pages: string[];
}

export type JournalStatus = 'saved' | 'saving' | 'unavailable';

const SAVE_DEBOUNCE_MS = 350;

/**
 * 手账内容按城市存在本机浏览器里。
 *
 * 这一步刻意不碰后端：站点还没有云端存储，写坏一个键也不影响源码和 GitHub。
 * 以后接云端时把 readJournal / writeJournal 换成异步数据源，页面结构不用动。
 */
export function useLocalJournal(cityId: string) {
  const [entry, setEntry] = useState<JournalEntry>(() => readJournal(cityId));
  const [status, setStatus] = useState<JournalStatus>('saved');
  const latest = useRef(entry);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const update = useCallback((patch: Partial<JournalEntry>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setEntry(next);
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setStatus(writeJournal(cityId, next) ? 'saved' : 'unavailable');
    }, SAVE_DEBOUNCE_MS);
  }, [cityId]);

  return { entry, status, update };
}

function readJournal(cityId: string): JournalEntry {
  const empty = { title: '', date: '', pages: [''] };
  try {
    const raw = window.localStorage.getItem(keyFor(cityId));
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const record = parsed as Partial<JournalEntry> & { body?: unknown };
    return {
      title: typeof record.title === 'string' ? record.title : '',
      date: typeof record.date === 'string' ? record.date : '',
      pages: normalizePages(record),
    };
  } catch {
    // 隐私模式或存储被禁用时读取会抛：当作没写过，页面照样能写能看
    return empty;
  }
}

/** 分页之前正文是单个字符串，老数据读进来时当成第一页 */
function normalizePages(record: Partial<JournalEntry> & { body?: unknown }): string[] {
  const pages = Array.isArray(record.pages) ? record.pages.filter((page): page is string => typeof page === 'string') : [];
  if (pages.length > 0) return pages;
  if (typeof record.body === 'string' && record.body !== '') return [record.body];
  return [''];
}

/** 写入失败（配额满、隐私模式）返回 false，由界面如实说明 */
function writeJournal(cityId: string, entry: JournalEntry): boolean {
  try {
    window.localStorage.setItem(keyFor(cityId), JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

function keyFor(cityId: string): string {
  return `travel-atlas-book.journal.${cityId}`;
}
