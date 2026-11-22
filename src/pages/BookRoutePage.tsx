import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { InnerPageLayout } from '../components/layout/InnerPageLayout';
import { albumBack } from '../config/innerLayout';
import { readBookMode } from '../config/routes';
import { getBook } from '../data/books';
import { getCityById } from '../data/cities';
import { isDataError, type TravelBook } from '../data/contracts';
import { CreateModePage } from './CreateModePage';
import { JournalMountPage } from './JournalMountPage';
import styles from './BookRoutePage.module.css';

interface LoadState {
  book?: TravelBook;
  error?: string;
}

/**
 * `/book/:bookId` 的临时接线页（V1-06）。
 *
 * 路径段、`?mode=` 的取值和「缺省 / 空 / 未知 mode 一律回模式选择页」这条规则，
 * 全部取自 V1-02 冻结的 `src/config/routes.ts`，这里没有另外发明任何一种地址。
 * 本页只做三件事：按 ID 读一次书、把书和它属于的城市交给对应页面、给读不出来时的退路。
 *
 * V1-05 的公共手账壳（`src/pages/BookPage*`，含标题编辑、共用素材面板、保存队列）落地以后，
 * 把 App.tsx 里这一行 `element` 换成 `<BookPage />` 就交接完成：
 * URL 不变、mode 语义不变、编辑器 props 不变，这个文件整只删掉即可。
 */
export function BookRoutePage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const mode = readBookMode(searchParams);
  const [state, setState] = useState<LoadState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getBook(bookId ?? '')
      .then((book) => {
        if (alive) setState({ book });
      })
      .catch((error: unknown) => {
        if (alive) setState({ error: readable(error, '这本手账暂时打不开。') });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bookId]);

  if (loading) return <ScreenNote text="正在翻开这本手账…" />;

  if (state.error) {
    return (
      <BookFallback
        title="这本手账没能打开"
        detail={state.error}
        hint="数据库被其它页面占用、或者本机记录被清过，都会出现这一条。回到收藏册再点一次即可。"
      />
    );
  }

  const book = state.book;
  if (!book) return <BookFallback title="没有这本手账" detail={`编号「${bookId ?? '(空)'}」在本机记录里找不到。`} />;

  const city = getCityById(book.cityId);
  if (!city) {
    return (
      <BookFallback
        title="这本手账的城市不在册子里"
        detail={`记录写着城市编号「${book.cityId}」，但当前目录里没有它。`}
      />
    );
  }

  // V1-07 的横线本落在 JournalMountPage：它顶着 V1-05 手账壳的活，壳到位后一起退场。
  if (mode === 'journal') return <JournalMountPage key={book.id} book={book} city={city} />;

  // key=book.id：从书架换一本进来时整页重挂，翻页动画跟着重放一次。
  return <CreateModePage key={book.id} book={book} city={city} />;
}

function ScreenNote({ text }: { text: string }) {
  return (
    <InnerPageLayout back={albumBack()}>
      <p className={styles.note} role="status">
        {text}
      </p>
    </InnerPageLayout>
  );
}

function BookFallback({ title, detail, hint }: { title: string; detail: string; hint?: string }) {
  return (
    <InnerPageLayout back={albumBack()}>
      <section className={styles.fallback}>
        <h1>{title}</h1>
        <p>{detail}</p>
        {hint ? <p className={styles.hint}>{hint}</p> : null}
      </section>
    </InnerPageLayout>
  );
}

function readable(error: unknown, fallback: string): string {
  return isDataError(error) ? error.message : fallback;
}
