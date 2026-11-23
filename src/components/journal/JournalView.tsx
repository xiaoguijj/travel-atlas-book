import { type CSSProperties } from 'react';
import journalPageArtwork from '../../assets/journal-page.jpg';
import { PageTurn } from '../layout/PageTurn';
import { localDay } from '../../config/dates';
import {
  artBoxStyle,
  artCqw,
  journalArt,
  journalBodyFontPx,
  journalDateBox,
  journalFrame,
  journalRules,
  journalTitleBox,
} from '../../config/journal';
import type { JournalEditorProps, TravelBook } from '../../data/contracts';
import type { City } from '../../data/types';
import { StickerLayer } from '../../stickers';
import type { StickerApi } from '../../stickers';
import { JournalEditor } from './JournalEditor';
import { journalDocFor } from './journalDoc';
import styles from './JournalView.module.css';

interface JournalViewProps extends JournalEditorProps {
  /**
   * 纸上的 Title / Date 两行和城市铭牌要的书本与城市信息，由手账壳在冻结的
   * `JournalEditorProps` 之外补传（V1-02 契约不含这两样，缺省时这几处不渲染，
   * 画上的填空线保持留白）；正文、工具条与保存反馈不依赖它们。
   */
  book?: TravelBook;
  city?: City;
  /**
   * V4 通用贴纸系统，由手账壳用 useStickers 建好再传进来；贴纸层挂在纸页
   * 舞台内部，正文本体与保存队列完全不感知它的存在。
   */
  stickers?: StickerApi;
}

/**
 * Journal 横线日记本页（V1-07 版面）。
 *
 * 整张横线纸是画（journal-page.jpg），正文与工具条由 JournalEditor 按
 * `src/config/journal.ts` 量好的坐标贴上去；保存一律走手账壳的队列，
 * 本页只把 onChange 往上传，不碰数据库。
 */
export function JournalView({ content, book, city, stickers, ...editorProps }: JournalViewProps) {
  const stageVars = {
    '--rule-step': artCqw(journalArt, journalRules.step),
    '--body-size': artCqw(journalArt, journalBodyFontPx),
    '--label-size': artCqw(journalArt, 25),
    '--journal-tilt': `${journalFrame.tiltDeg}deg`,
    '--album-ratio': String(journalFrame.albumStageRatio),
  } as CSSProperties;

  // 读不出形状的内容会被 journalDocFor 换成空白页；返回的不是原对象就是走了退路。
  const recovered = content !== undefined && journalDocFor(content) !== content.doc;

  return (
    <section className={styles.page} style={stageVars} aria-label="Journal 横线日记本">
      <PageTurn />

      <div className={styles.tilt}>
        <div className={styles.stage}>
          <img
            className={styles.art}
            src={journalPageArtwork}
            width={journalArt.width}
            height={journalArt.height}
            alt={city ? `${city.name}手账的横线页` : '手账的横线页'}
          />

          <h1 className="srOnly">
            {city && book ? `${city.name} · ${book.title} — 横线日记本` : '横线日记本'}
          </h1>

          {book ? (
            <p className={styles.field} style={artBoxStyle(journalArt, journalTitleBox)}>
              {book.title}
            </p>
          ) : null}
          {book ? (
            <p className={styles.field} style={artBoxStyle(journalArt, journalDateBox)}>
              {localDay(book.createdAt).replace(/-/g, ' / ')}
            </p>
          ) : null}

          <JournalEditor content={content} {...editorProps} />

          {stickers && book && city ? (
            <StickerLayer
              instances={stickers.instances}
              selectedId={stickers.selectedId}
              onSelect={stickers.select}
              onUpdate={stickers.update}
              onRemove={stickers.remove}
              onDuplicate={stickers.duplicate}
              onReorder={stickers.reorder}
            />
          ) : null}
        </div>
      </div>

      {city ? (
        <p className={styles.nameplate}>
          {city.name}
          <span>
            {city.nameEn} · {city.region}
          </span>
        </p>
      ) : null}

      {recovered ? (
        <div className={styles.notice} role="status">
          <p>
            这本手账存着的正文读不出形状，这一页从空白开始。再写下去会把原来那份盖掉，先回书架确认一下要不要留着这本。
          </p>
        </div>
      ) : null}
    </section>
  );
}
