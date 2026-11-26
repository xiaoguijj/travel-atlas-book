import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import albumArtwork from '../assets/stamp-album.jpg';
import { PageTurn } from '../components/layout/PageTurn';
import { InnerPageLayout } from '../components/layout/InnerPageLayout';
import { isJournalBlank } from '../components/journal/journalDoc';
import { localDay } from '../config/dates';
import { planCityPath } from '../config/planRoutes';
import { bookPath, cityPath, STAMP_BOOK_PATH } from '../config/routes';
import { albumArt, albumStampBoxes, artBoxStyle } from '../config/journal';
import { backTargets } from '../config/innerLayout';
import { getStampByCity, stampDefinitions } from '../data/catalog';
import { getCityById } from '../data/cities';
import { createBook, listBooksByCity } from '../data/books';
import { isDataError, type StampCollection, type TravelBook } from '../data/contracts';
import { isPlanCity } from '../data/plans';
import { listCollections, collectStamp } from '../data/stamps';
import type { City } from '../data/types';
import styles from './StampBookPage.module.css';

/**
 * 城市邮票收藏册（V1-06）：整张画是本子的一页，六枚邮票画在画上，
 * 热区按量好的坐标盖在票面上，点下去翻开这座城市的手账书架。
 *
 * 牛皮纸本子、六枚热区、收尾文案一个数字都没动（V1-03 只换了外围背景与顶栏）。
 * maxWidth 传 null、flush 打开，是因为本子的大小由 .stage 自己按视口高度算（fit-to-screen），
 * 公共内容区再套一道宽度上限或一档内距都会把画心挤小（实测 853px 窗口下 773 → 738）。
 *
 * 「哪座城有邮票」来自 V1-04 的静态目录，坐标来自 config/journal.ts，
 * 藏没藏、什么时候藏的来自邮票收藏仓储——页面自己不带任何一份城市名单。
 */
export function StampBookPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCity = getCityById(searchParams.get('cityId') ?? undefined);
  const selectedCityId = selectedCity?.id;
  const [collections, setCollections] = useState<StampCollection[]>([]);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listCollections()
      .then((rows) => {
        if (alive) setCollections(rows);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setStorageNotice(readable(error, '收藏册暂时读不到本机记录，邮票仍照常翻开。'));
      });
    return () => {
      alive = false;
    };
  }, []);

  const collectedBy = new Map(collections.map((row) => [row.stampId, row.collectedAt]));
  // 地址里写了册子上没有邮票的城市（例如伦敦）时取不到邮票，书架里的盖章按钮就不出现。
  const selectedStamp = selectedCityId ? getStampByCity(selectedCityId) : undefined;

  const stamps = stampDefinitions.flatMap((stamp) => {
    const city = getCityById(stamp.cityId);
    const box = albumStampBoxes[stamp.cityId];
    return city && box ? [{ stamp, city, box }] : [];
  });

  const toggleShelf = (cityId: string) => {
    const next = new URLSearchParams(searchParams);
    if (next.get('cityId') === cityId) next.delete('cityId');
    else next.set('cityId', cityId);
    setSearchParams(next);
  };

  /**
   * 「盖下这枚收藏章」是用户在书架里显式点的动作，不是点开邮票的副作用（任务卡：盖章由用户显式执行）。
   * 仓储按同一枚邮票只保留第一次的时间，所以连着点也只新增一条、也不会改首次时间。
   * 失败不吞掉：抛回书架，让它就地给出可重试的说明。
   */
  const collect = useCallback(async (stampId: string) => {
    const record = await collectStamp(stampId);
    setCollections((rows) => (rows.some((row) => row.stampId === record.stampId) ? rows : [...rows, record]));
  }, []);

  return (
    <InnerPageLayout back={backTargets.globe} maxWidth={null} flush>
      <div className={styles.page}>
        <PageTurn />

        <div className={styles.stage}>
          <img
            className={styles.art}
            src={albumArtwork}
            width={albumArt.width}
            height={albumArt.height}
            alt="中国城市手账：南京、上海、西安、北京、杭州、成都六枚城市邮票"
          />

          <h1 className="srOnly">中国城市手账 · China Travel Stamps</h1>

          <div className={styles.stamps}>
            {stamps.map(({ stamp, city, box }) => {
              const collectedAt = collectedBy.get(stamp.id);
              return (
                <button
                  key={stamp.id}
                  type="button"
                  className={styles.stamp}
                  style={artBoxStyle(albumArt, box)}
                  onClick={() => toggleShelf(city.id)}
                  aria-expanded={selectedCityId === city.id}
                  aria-label={`${city.name} ${city.nameEn} 邮票，${
                    collectedAt ? `已收藏于 ${localDay(collectedAt)}` : '尚未收藏'
                  }，翻开这一城的手账书架`}
                >
                  <span className={styles.glow} aria-hidden="true" />
                  <span className={styles.cta} aria-hidden="true">
                    翻开这一页
                  </span>
                  {collectedAt ? (
                    <span className={styles.collected} aria-hidden="true">
                      {localDay(collectedAt)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {storageNotice ? (
          <p className={styles.notice} role="status">
            {storageNotice}
          </p>
        ) : null}

        {selectedCity ? (
          <CityShelf
            key={selectedCity.id}
            city={selectedCity}
            collectedAt={selectedStamp ? collectedBy.get(selectedStamp.id) : undefined}
            onClose={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('cityId');
              setSearchParams(next);
            }}
            onCollect={selectedStamp ? () => collect(selectedStamp.id) : undefined}
            onOpenBook={(book) => navigate(bookPath(book.id))}
          />
        ) : null}

        <div className={styles.closing}>
          <p className={styles.closingMain}>世界的故事，远不止眼前这几座城。</p>
          <p className={styles.closingSub}>更多城市邮票正在绘制中，下一段旅程，敬请期待。</p>
          <p className={styles.closingFoot}>TO BE CONTINUED · 持续更新中</p>
        </div>
      </div>
    </InnerPageLayout>
  );
}

/**
 * 一座城市的手账书架：列出已有的本子、新建一本、点开任意一本进模式选择页，
 * 外加这一城的「盖下收藏章」——盖章是显式动作，点开邮票只翻书架，不替用户决定收藏了什么。
 * 书本记录全部走 V1-02 冻结的手账仓储，页面不直接碰数据库。
 */
function CityShelf({
  city,
  collectedAt,
  onClose,
  onCollect,
  onOpenBook,
}: {
  city: City;
  collectedAt?: string;
  onClose: () => void;
  /** 不传表示这一城在册子上没有邮票，盖章按钮不出现。 */
  onCollect?: () => Promise<void>;
  onOpenBook: (book: TravelBook) => void;
}) {
  const [books, setBooks] = useState<TravelBook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [stampError, setStampError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setBooks(null);
    try {
      setBooks(await listBooksByCity(city.id));
    } catch (caught: unknown) {
      setError(readable(caught, '这座城市的手账列表暂时打不开。'));
    }
  }, [city]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const addBook = async () => {
    if (!books) return;
    setBusy(true);
    setError(null);
    try {
      onOpenBook(await createBook(city.id, `${city.name}手账 · 第 ${books.length + 1} 本`));
    } catch (caught: unknown) {
      setError(readable(caught, '新建手账失败，可以再点一次。'));
    } finally {
      setBusy(false);
    }
  };

  const stampIt = async () => {
    if (!onCollect) return;
    setStamping(true);
    setStampError(null);
    try {
      await onCollect();
    } catch (caught: unknown) {
      setStampError(readable(caught, '这枚邮票没能盖上章，可以再点一次。'));
    } finally {
      setStamping(false);
    }
  };

  return (
    <div className={styles.shelf} ref={panelRef}>
      <header className={styles.shelfHead}>
        <h2 className={styles.shelfTitle}>
          {city.name}
          <span>{city.nameEn}</span>
        </h2>

        {onCollect ? (
          <span className={styles.stampActionWrap}>
            <span className={styles.stampState}>{collectedAt ? `已藏于 ${localDay(collectedAt)}` : '尚未收藏'}</span>
            <button type="button" className={styles.stampAction} onClick={() => void stampIt()} disabled={stamping}>
              {stamping ? '正在盖章…' : collectedAt ? '再盖一次章' : '盖下这枚收藏章'}
            </button>
          </span>
        ) : null}

        <button type="button" className={styles.shelfClose} onClick={onClose}>
          收起
        </button>
      </header>

      <nav className={styles.shelfLinks} aria-label={`${city.name}书架导航`}>
        <Link className={styles.shelfClose} to={cityPath(city.id)}>{city.name}城市详情</Link>
        {isPlanCity(city.id) ? (
          <Link className={styles.shelfClose} to={planCityPath(city.id)}>{city.name}旅行计划</Link>
        ) : null}
      </nav>

      {stampError ? (
        <p className={styles.notice} role="alert">
          {stampError}
        </p>
      ) : null}

      {books === null && !error ? <p className={styles.shelfHint}>正在翻开这一页…</p> : null}

      {error ? (
        <p className={styles.notice} role="alert">
          {error}{' '}
          <button type="button" className={styles.shelfRetry} onClick={() => void load()}>
            重试
          </button>
        </p>
      ) : null}

      {books !== null && books.length === 0 && !error ? (
        <p className={styles.shelfHint}>这一城还没有一本手账，新建一本就能开始写。</p>
      ) : null}

      {books !== null && books.length > 0 ? (
        <ul className={styles.bookList}>
          {books.map((book) => (
            <li key={book.id}>
              <button type="button" className={styles.book} onClick={() => onOpenBook(book)}>
                <strong>{book.title}</strong>
                <em>{isJournalBlank(book.journal) ? '还没动笔' : '接着写'}</em>
                <span>上次更新 {localDay(book.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {books !== null && !error ? (
        <button type="button" className={styles.newBook} onClick={() => void addBook()} disabled={busy}>
          {busy ? '正在新建…' : '新建一本'}
        </button>
      ) : null}

      {onCollect ? <p className={styles.shelfFoot}>邮票上的日期是第一次收藏它的那一天，重复盖章不会改时间。</p> : null}
    </div>
  );
}

function readable(error: unknown, fallback: string): string {
  return isDataError(error) ? error.message : fallback;
}

/** `/stamps` 是 `/section/journals` 的别名；保留有效查询参数，丢掉无效 cityId。 */
export function StampsAliasPage() {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  const cityId = next.get('cityId');
  if (cityId && !getCityById(cityId)) next.delete('cityId');
  const query = next.toString();
  return <Navigate replace to={query ? `${STAMP_BOOK_PATH}?${query}` : STAMP_BOOK_PATH} />;
}
