import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageTurn } from '../components/layout/PageTurn';
import { getCityById } from '../data/cities';
import { creationModes, editorPath, type CreationModeEntry } from '../data/creationModes';
import type { City } from '../data/types';
import { hasLocalJournal } from '../hooks/useLocalJournal';
import styles from './CreateModePage.module.css';

/**
 * 创作模式选择页：一枚邮票翻开之后先问「这一页想怎么写」。
 *
 * 两张卡片是同一本笔记里的两种写法，所以都做成牛皮纸上的实物感：
 * Journal 是横线页加线圈，Collage 是散着贴的照片、车票和邮票。
 * 还没实现的 Collage 整张卡片做成按钮，点了只说明进度，不跳去空编辑器。
 */
export function CreateModePage() {
  const { cityId } = useParams<{ cityId: string }>();
  const city = getCityById(cityId);
  const [notice, setNotice] = useState<string | null>(null);

  if (!city) return <UnknownCity cityId={cityId} />;

  // 换城市重新挂载：翻页动画要重播，「继续写 / 开始写」也要按新城市重读一次
  return <ChooseEditor key={city.id} city={city} notice={notice} setNotice={setNotice} />;
}

function ChooseEditor({
  city,
  notice,
  setNotice,
}: {
  city: City;
  notice: string | null;
  setNotice: (text: string | null) => void;
}) {
  const resumed = hasLocalJournal(city.id);

  return (
    <div className={styles.page}>
      <PageTurn />

      <div className={styles.topbar}>
        <Link className={styles.back} to="/section/journals">
          ← 回到邮票册
        </Link>
        <p className={styles.stampNote}>
          {city.region} · {Math.abs(city.latitude).toFixed(2)}°
          {city.latitude >= 0 ? 'N' : 'S'}
        </p>
      </div>

      <header className={styles.head}>
        <p className={styles.kicker}>选择创作方式 · Choose how to write</p>
        <h1 className={styles.title}>
          {city.name}
          <span className={styles.titleEn}>{city.nameEn}</span>
        </h1>
        <p className={styles.lede}>{city.tagline}——这一页想怎么填？两种写法都从同一枚邮票开始。</p>
      </header>

      <div className={styles.cards}>
        {creationModes.map((mode) => (
          <ModeCard key={mode.id} mode={mode} city={city} resumed={mode.id === 'journal' && resumed} onWip={setNotice} />
        ))}
      </div>

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

      <p className={styles.hint}>
        横线日记本写的内容只存在这台设备上；自由拼贴接入后，两种写法会共用同一套城市、素材与保存接口。
      </p>
    </div>
  );
}

function ModeCard({
  mode,
  city,
  resumed,
  onWip,
}: {
  mode: CreationModeEntry;
  city: City;
  resumed: boolean;
  onWip: (text: string) => void;
}) {
  const ready = mode.status === 'ready';
  const cta = ready ? (resumed ? '继续写' : '开始写') : '功能开发中';

  const inner = (
    <>
      <span className={styles.badge} data-status={mode.status}>
        {ready ? (resumed ? '已写过' : '可写') : 'V1-08 开发中'}
      </span>

      <span className={styles.preview} aria-hidden="true">
        {mode.id === 'journal' ? <JournalPreview /> : <CollagePreview city={city} />}
      </span>

      <span className={styles.body}>
        <span className={styles.nameEn}>{mode.nameEn}</span>
        <span className={styles.name}>{mode.name}</span>
        <span className={styles.summary}>{mode.summary}</span>
        <span className={styles.points}>
          {mode.points.map((point) => (
            <span key={point} className={styles.point}>
              {point}
            </span>
          ))}
        </span>
      </span>

      <span className={styles.action} data-status={mode.status}>
        <span className={styles.actionText}>{cta}</span>
        <span className={styles.arrow} aria-hidden="true">
          {ready ? '→' : '…'}
        </span>
      </span>
    </>
  );

  if (!ready) {
    return (
      <button
        type="button"
        className={`${styles.card} ${styles.cardWip}`}
        onClick={() => onWip(mode.wipNote ?? '这一种写法还没有实现。')}
        aria-label={`${mode.name} ${mode.nameEn}，功能开发中，点击查看说明`}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link className={styles.card} to={editorPath(mode.id, city.id)} aria-label={`${mode.name} ${mode.nameEn}，${cta}`}>
      {inner}
    </Link>
  );
}

/** 横线页：线圈在左，纸面画横线，Title / Date 两条填空压在上方 */
function JournalPreview() {
  return (
    <span className={styles.journal} aria-hidden="true">
      <span className={styles.coil} />
      <span className={styles.sheet}>
        <span className={styles.ruleTitle} />
        <span className={styles.ruleDate} />
        <span className={styles.written} />
      </span>
    </span>
  );
}

/** 拼贴板：牛皮纸底上散着拍立得、车票和一枚盖了邮戳的邮票 */
function CollagePreview({ city }: { city: City }) {
  return (
    <span className={styles.collage} aria-hidden="true">
      <span className={styles.photo}>
        <span className={styles.photoImage} />
      </span>
      <span className={styles.ticket} />
      <span className={styles.stamp}>
        <span className={styles.postmark}>{city.name}</span>
      </span>
      <span className={styles.tapeA} />
      <span className={styles.tapeB} />
    </span>
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
