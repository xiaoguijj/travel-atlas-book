import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import createModeArtwork from '../assets/create-mode.jpg';
import { PageTurn } from '../components/layout/PageTurn';
import {
  artBoxStyle,
  createModeArt,
  createModePillBg,
  createModeZones,
} from '../config/journal';
import { getCityById } from '../data/cities';
import { editorPath, getCreationMode } from '../data/creationModes';
import type { City } from '../data/types';
import { hasLocalJournal } from '../hooks/useLocalJournal';
import styles from './CreateModePage.module.css';

/**
 * 创作方式选择页（参考图 assets-source/create-mode.png）。
 *
 * 和邮票册、横线页同一个做法：整张画铺在舞台上，两张卡片和返回按钮是量好坐标的透明热区，
 * 悬停时亮一层暖光并描出边，画面本身不重画。
 *
 * 唯一要盖掉的是右上角「当前城市：Peru 秘鲁」——画上是写死的，但它得跟着点的邮票变，
 * 所以那一整只胶囊用真实 DOM 重画。
 */
export function CreateModePage() {
  const { cityId } = useParams<{ cityId: string }>();
  const city = getCityById(cityId);
  const [notice, setNotice] = useState<string | null>(null);

  if (!city) return <UnknownCity cityId={cityId} />;

  // 换城市重新挂载：翻页动画要重播，城市胶囊和「继续写」也要按新城市重算
  return <ModeStage key={city.id} city={city} notice={notice} setNotice={setNotice} />;
}

function ModeStage({
  city,
  notice,
  setNotice,
}: {
  city: City;
  notice: string | null;
  setNotice: (text: string | null) => void;
}) {
  const collage = getCreationMode('collage');
  const resumed = hasLocalJournal(city.id);

  const openCollage = () => setNotice(collage.wipNote ?? '这一种写法还没有实现。');

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

        <div className={styles.zones}>
          <Link
            className={`${styles.zone} ${styles.zoneReady}`}
            style={artBoxStyle(createModeArt, createModeZones.journalCard)}
            to={editorPath('journal', city.id)}
            aria-label={`Journal 横线日记本，${resumed ? '继续写' : '开始写'}${city.name}这一页`}
          >
            <span className={styles.glow} aria-hidden="true" />
          </Link>

          <button
            type="button"
            className={`${styles.zone} ${styles.zoneWip}`}
            style={artBoxStyle(createModeArt, createModeZones.collageCard)}
            onClick={openCollage}
            aria-label="Collage 自由拼贴，功能开发中，点击查看说明"
          >
            <span className={styles.glow} aria-hidden="true" />
          </button>

          <Link
            className={`${styles.zone} ${styles.zonePill}`}
            style={artBoxStyle(createModeArt, createModeZones.backPill)}
            to="/section/journals"
            aria-label="返回邮票收藏册"
          />
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

function UnknownCity({ cityId }: { cityId?: string }) {
  return (
    <div className={styles.page}>
      <section className={styles.missing}>
        <h1>还不认识这枚邮票</h1>
        <p>{cityId ? `编号「${cityId}」暂时还没有收录。` : '地址里缺少城市编号。'}</p>
        <Link className={styles.back} to="/section/journals">
          ← 回到邮票册
        </Link>
      </section>
    </div>
  );
}
