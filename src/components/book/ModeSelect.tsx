import { Link } from 'react-router-dom';
import { cityBooksBack } from '../../config/innerLayout';
import { collageBookPath, journalBookPath } from '../../config/routes';
import type { TravelBook } from '../../data/contracts';
import type { City } from '../../data/types';
import { InnerPageLayout } from '../layout/InnerPageLayout';
import styles from './ModeSelect.module.css';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * `/book/:bookId` 的创作模式选择页。只展示属于这本书的城市、标题与两个模式入口，
 * 不写入任何内容；返回按钮落回该城市的手账列表。
 */
export function ModeSelect({ book, city }: { book: TravelBook; city: City }) {
  const hasJournal = book.journal !== undefined;
  const hasCollage = book.collage !== undefined;

  return (
    <InnerPageLayout back={cityBooksBack(city.id)} maxWidth={1120}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>创作模式 · {city.nameEn}</p>
          <h1 className={styles.title}>{book.title}</h1>
          <p className={styles.meta}>
            <span>
              当前城市：{city.name} · {city.region}
            </span>
            <span>建立于 {formatDate(book.createdAt)}</span>
            <span>最后触碰 {formatDate(book.updatedAt)}</span>
          </p>
          <p className={styles.lede}>同一本书、同一册素材。想写字就翻到 Journal，想摆照片就留在 Collage。</p>
        </header>

        <div className={styles.modes}>
          <Link className={`${styles.card} ${styles.journal}`} to={journalBookPath(book.id)}>
            <span className={styles.badge}>{hasJournal ? '继续写' : '开始写'}</span>
            <span className={styles.cardKicker}>MODE 01 · LINED PAGES</span>
            <span className={styles.cardTitle}>Journal</span>
            <span className={styles.cardSub}>横线日记本</span>
            <span className={styles.cardBody}>写下当天的风、街角和食物。照片与贴纸从共用素材册里挑。</span>
            <span className={styles.cardFoot}>{hasJournal ? '已有正文，接着写 →' : '从空白一页开始 →'}</span>
            <span className={styles.journalSpine} aria-hidden="true" />
            <span className={styles.journalMark} aria-hidden="true">
              ✒
            </span>
          </Link>

          <Link className={`${styles.card} ${styles.collage}`} to={collageBookPath(book.id)}>
            <span className={`${styles.badge} ${styles.wipBadge}`}>开发中</span>
            <span className={styles.cardKicker}>MODE 02 · PASTED PIECES</span>
            <span className={styles.cardTitle}>Collage</span>
            <span className={styles.cardSub}>自由拼贴</span>
            <span className={styles.cardBody}>照片、贴纸和短句摊在一张画布上，慢慢挪到顺眼的位置。</span>
            <span className={styles.cardFoot}>{hasCollage ? '已有拼贴草稿，画布接入中 →' : '画布正在接入 →'}</span>
            <span className={styles.scrap} aria-hidden="true" />
            <span className={styles.stampShape} aria-hidden="true" />
            <span className={styles.tape} aria-hidden="true" />
          </Link>
        </div>

        <p className={styles.note}>
          两种模式共用同一座城的照片素材；删掉正文或画布里的引用，照片仍会留在素材册里。
        </p>
      </div>
    </InnerPageLayout>
  );
}