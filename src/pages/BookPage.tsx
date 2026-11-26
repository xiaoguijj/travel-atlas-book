import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookShell } from '../components/book/BookShell';
import { ModeSelect } from '../components/book/ModeSelect';
import { InnerPageLayout } from '../components/layout/InnerPageLayout';
import { albumBack } from '../config/innerLayout';
import { readBookMode, STAMP_BOOK_PATH } from '../config/routes';
import { getBook } from '../data/books';
import { getCityById } from '../data/cities';
import { isDataError, type BookMode, type TravelBook } from '../data/contracts';
import type { SaveField } from '../data/saving';
import styles from './BookPage.module.css';

interface LoadedBook {
  key: string;
  book?: TravelBook;
  error?: string;
}

function readable(error: unknown, fallback: string): string {
  return isDataError(error) ? error.message : fallback;
}

function requestKeyOf(bookId: string | undefined, mode: BookMode | undefined): string {
  return `${bookId ?? '(空)'}:${mode ?? 'select'}`;
}

/**
 * `/book/:bookId` 的统一入口。同一个 bookId 加载一次书与城市：
 * 缺省或未知 mode 交给模式选择页，有效 mode 交给公共手账壳。
 *
 * 键里带 mode 是为了同一本书切换模式时重新读取最新记录，避免用陈旧副本初始化另一侧视图。
 */
export function BookPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const mode = readBookMode(searchParams);
  const requestKey = requestKeyOf(bookId, mode);
  const [loaded, setLoaded] = useState<LoadedBook>({ key: '' });

  useEffect(() => {
    let alive = true;
    getBook(bookId ?? '')
      .then((book) => {
        if (alive) setLoaded({ key: requestKey, book });
      })
      .catch((error: unknown) => {
        if (alive) setLoaded({ key: requestKey, error: readable(error, '这本手账暂时打不开。') });
      });
    return () => {
      alive = false;
    };
  }, [bookId, requestKey]);

  const handleBookSaved = useCallback((field: SaveField | 'planId', saved: TravelBook) => {
    setLoaded((current) => {
      if (current.key !== requestKey || current.book?.id !== saved.id) return current;
      // The edit queue and the explicit plan action can finish independently.
      // Each result is authoritative only for the field it wrote.
      return {
        ...current,
        book: {
          ...current.book,
          [field]: saved[field],
          updatedAt: saved.updatedAt > current.book.updatedAt ? saved.updatedAt : current.book.updatedAt,
        },
      };
    });
  }, [requestKey]);

  if (loaded.key !== requestKey) {
    return (
      <InnerPageLayout back={albumBack()} maxWidth={720}>
        <p className={styles.note} role="status">
          正在翻开这本手账…
        </p>
      </InnerPageLayout>
    );
  }

  if (loaded.error) {
    return (
      <BookFallback
        title="这本手账没能打开"
        detail={loaded.error}
        hint="本机存储被清空、数据库被其它标签页占用，或者浏览器禁止了站点数据，都可能出现这一条。"
      />
    );
  }

  const book = loaded.book;
  if (!book) {
    return (
      <BookFallback
        title="没有这本手账"
        detail={`编号「${bookId ?? '(空)'}」在本机记录里找不到。`}
        hint="可能是它已经被删掉，或者这个链接来自另一台设备。"
      />
    );
  }

  const city = getCityById(book.cityId);
  if (!city) {
    return (
      <BookFallback
        title="这本手账的城市不在册子里"
        detail={`记录写着城市编号「${book.cityId}」，但当前城市目录里没有它。`}
        hint="城市目录升级前建立的旧记录可能遇到这种情况。"
      />
    );
  }

  if (!mode) return <ModeSelect book={book} city={city} />;

  return (
    <BookShell
      key={`${book.id}:${mode}`}
      book={book}
      city={city}
      mode={mode}
      onBookSaved={handleBookSaved}
    />
  );
}

function BookFallback({ title, detail, hint }: { title: string; detail: string; hint?: string }) {
  return (
    <InnerPageLayout back={albumBack()} maxWidth={720}>
      <section className={styles.fallback}>
        <h1>{title}</h1>
        <p>{detail}</p>
        {hint ? <p className={styles.hint}>{hint}</p> : null}
        <div className={styles.links}>
          <Link to={STAMP_BOOK_PATH}>返回邮票收藏册</Link>
          <Link to="/">回到地球探索</Link>
        </div>
      </section>
    </InnerPageLayout>
  );
}
