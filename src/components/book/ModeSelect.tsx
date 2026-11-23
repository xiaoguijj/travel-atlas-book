import { useState } from 'react';
import { Link } from 'react-router-dom';
import createModeArtwork from '../../assets/create-mode.jpg';
import { isJournalBlank } from '../journal/journalDoc';
import { PageTurn } from '../layout/PageTurn';
import { albumBack } from '../../config/innerLayout';
import { journalBookPath } from '../../config/routes';
import { artBoxStyle, createModeArt, createModePillBg, createModeZones } from '../../config/journal';
import type { TravelBook } from '../../data/contracts';
import type { City } from '../../data/types';
import styles from './ModeSelect.module.css';

const collageWipNote =
  '自由拼贴编辑器是 V1-08，还在独立开发，之后通过 PR 接入。' + '现在点它只会看到这条说明——不会跳进一个空的假编辑器。';

/**
 * `/book/:bookId` 的创作模式选择页（参考图 assets-source/create-mode.png）。
 *
 * 和邮票册、横线页同一个做法：整张画铺在舞台上，两张卡片是量好坐标的透明热区，
 * 悬停时亮一层暖光并描出边，画面本身不重画。
 *
 * 画上有两处是写死的内容，得用真实 DOM 整只盖掉重画：右上角「当前城市：Peru 秘鲁」
 * 要跟着打开的书变，左上角返回胶囊要和其它页面一样大（画上的那颗会跟着画面一起缩）。
 *
 * 书本记录由 BookPage 读好后传进来（V1-05 壳），本页不碰数据库：
 * 「继续写 / 开始写」看的是这本书记录里有没有真的写过（只剩一个空段落算没动笔），不是本机另存的一份草稿。
 */
export function ModeSelect({ book, city }: { book: TravelBook; city: City }) {
  const [notice, setNotice] = useState<string | null>(null);
  const back = albumBack(city.id);
  const resumed = !isJournalBlank(book.journal);

  return (
    <div className={styles.page}>
      <PageTurn />

      <div className={styles.stage}>
        <img
          className={styles.art}
          src={createModeArtwork}
          width={createModeArt.width}
          height={createModeArt.height}
          alt={`选择你的创作方式：Journal 横线日记本与 Collage 自由拼贴（${city.name}）`}
        />

        <h1 className="srOnly">{`${city.name} · ${city.nameEn} — 选择你的创作方式`}</h1>

        {/* 画上写死的城市名盖不掉文字本身，只能整只胶囊重画 */}
        <span className={styles.cityPill} style={artBoxStyle(createModeArt, createModeZones.cityPill)}>
          <svg className={styles.pin} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" />
            <circle cx="12" cy="9" r="2.6" fill={createModePillBg} />
          </svg>
          <span className={styles.cityLabel}>当前城市：</span>
          <span className={styles.cityName}>
            {city.nameEn} {city.name}
          </span>
        </span>

        {/* 画上的返回胶囊会跟着画面一起缩，换成真 DOM 胶囊才和其它页面一样大 */}
        <span className={styles.backWrap} style={artBoxStyle(createModeArt, createModeZones.backPill)}>
          <Link className={styles.backPill} to={back.to}>
            <svg className={styles.backArrow} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12H4.5" />
              <path d="M10.5 6 4.5 12l6 6" />
            </svg>
            {back.label}
          </Link>
        </span>

        <div className={styles.zones}>
          <Link
            className={`${styles.zone} ${styles.zoneReady}`}
            style={artBoxStyle(createModeArt, createModeZones.journalCard)}
            to={journalBookPath(book.id)}
            aria-label={`Journal 横线日记本，${resumed ? '继续写' : '开始写'}${city.name}这一页`}
          >
            <span className={styles.glow} aria-hidden="true" />
          </Link>

          <button
            type="button"
            className={`${styles.zone} ${styles.zoneWip}`}
            style={artBoxStyle(createModeArt, createModeZones.collageCard)}
            onClick={() => setNotice(collageWipNote)}
            aria-label="Collage 自由拼贴，功能开发中，点击查看说明"
          >
            <span className={styles.glow} aria-hidden="true" />
          </button>
        </div>

        {/* 舞台占满屏幕，画下面没有位置，提示只能浮在画的下沿 */}
        <div className={styles.noticeZone} role="status" aria-live="polite">
          {notice ? (
            <div className={styles.notice}>
              <p className={styles.noticeTitle}>功能开发中</p>
              <p className={styles.noticeBody}>{notice}</p>
              <button type="button" className={styles.noticeClose} onClick={() => setNotice(null)}>
                知道了
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
