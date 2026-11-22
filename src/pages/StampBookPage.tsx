import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import albumArtwork from '../assets/stamp-album.jpg';
import { PageTurn } from '../components/layout/PageTurn';
import { InnerPageLayout } from '../components/layout/InnerPageLayout';
import { bookPath } from '../config/routes';
import { albumArt, albumStampBoxes, artBoxStyle } from '../config/journal';
import { backTargets } from '../config/innerLayout';
import { stampDefinitions } from '../data/catalog';
import { getCityById } from '../data/cities';
import { createBook, listBooksByCity } from '../data/books';
import { isDataError, type StampCollection, type TravelBook } from '../data/contracts';
import { listCollections, collectStamp } from '../data/stamps';
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
  const selectedCityId = searchParams.get('city');
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

  const stamps = stampDefinitions.flatMap((stamp) => {
    const city = getCityById(stamp.cityId);
    const box = albumStampBoxes[stamp.cityId];
    return city && box ? [{ stamp, city, box }] : [];
  });

  const toggleShelf = (cityId: string) => {
    const next = new URLSearchParams(searchParams);
    if (next.get('city') === cityId) next.delete('city');
    else next.set('city', cityId);
    setSearchParams(next);
  };

  /**
   * 点开一枚邮票就是「盖下这枚收藏章」：仓储里同一枚只留第一次的时间，重复盖章不会改。
   * 盖坏了（数据库被别的标签页占住之类）只贴一条说明，书架照样翻开——
   * 收藏是这本册子的副产品，不该挡住人进自己那一城。
   */
  const collect = useCallback((stampId: string) => {
    collectStamp(stampId)
      .then((record) => {
        setCollections((rows) => (rows.some((row) => row.stampId === record.stampId) ? rows : [...rows, record]));
      })
      .catch((error: unknown) => {
        setStorageNotice(readable(error, '这枚邮票没能盖上收藏章，书架照常翻开。'));
      });
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
                  onClick={() => {
                    // 再点一次是把书架合上，那一下不算「到访」，也就不再盖章。
                    const opening = selectedCityId !== city.id;
                    toggleShelf(city.id);
                    if (opening) collect(stamp.id);
                  }}
                  aria-expanded={selectedCityId === city.id}
                  aria-label={`${city.name} ${city.nameEn} 邮票，${
                    collectedAt ? `已收藏于 ${collectedAt.slice(0, 10)}` : '尚未收藏'
                  }，翻开这一城的手账书架`}
                >
                  <span className={styles.glow} aria-hidden="true" />
                  <span className={styles.cta} aria-hidden="true">
                    翻开这一页
                  </span>
                  {collectedAt ? (
                    <span className={styles.collected} aria-hidden="true">
                      {collectedAt.slice(0, 10)}
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

        {selectedCityId ? (
          <CityShelf
            key={selectedCityId}
            cityId={selectedCityId}
            onClose={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('city');
              setSearchParams(next);
            }}
            onOpenBook={(book) => navigate(bookPath(book.id))}
          />
        ) : null}

        <div className={styles.closing}>
          <p className={styles.closingMain}>世界的故事，远不止眼前这几座城。</p>
          <p className={styles.closingSub}>更多城市邮票正在绘制中，下一段旅程，敬请期待。</p>
          <p className={styles.closingFoot}>TO BE CONTINUED · 持续更新中</p>
        </div>

        <ul className={styles.roadmap} aria-label="还没上线的功能">
          <li className={styles.roadmapLabel}>还没上线</li>
          <li>自由拼贴</li>
          <li>照片与贴纸</li>
          <li>旅行计划</li>
        </ul>
      </div>
    </InnerPageLayout>
  );
}

/**
 * 一座城市的手账书架：列出已有的本子、新建一本、点开任意一本进模式选择页。
 * 书本记录全部走 V1-02 冻结的手账仓储，页面不直接碰数据库。
 */
function CityShelf({
  cityId,
  onClose,
  onOpenBook,
}: {
  cityId: string;
  onClose: () => void;
  onOpenBook: (book: TravelBook) => void;
}) {
  const city = getCityById(cityId);
  const [books, setBooks] = useState<TravelBook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!city) return;
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

  if (!city) {
    return (
      <div className={styles.shelf} ref={panelRef}>
        <p className={styles.notice} role="alert">
          地址里的城市编号「{cityId}」不在这本册子里，回到画上再点一枚邮票。
        </p>
        <button type="button" className={styles.shelfClose} onClick={onClose}>
          收起
        </button>
      </div>
    );
  }

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

  return (
    <div className={styles.shelf} ref={panelRef}>
      <header className={styles.shelfHead}>
        <h2 className={styles.shelfTitle}>
          {city.name}
          <span>{city.nameEn}</span>
        </h2>
        <button type="button" className={styles.shelfClose} onClick={onClose}>
          收起
        </button>
      </header>

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
                <em>{book.journal ? '接着写' : '还没动笔'}</em>
                <span>上次更新 {book.updatedAt.slice(0, 10)}</span>
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

      <p className={styles.shelfFoot}>邮票上的日期是第一次收藏它的那一天，重复盖章不会改时间。</p>
    </div>
  );
}

function readable(error: unknown, fallback: string): string {
  return isDataError(error) ? error.message : fallback;
}
