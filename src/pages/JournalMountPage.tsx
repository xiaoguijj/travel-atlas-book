import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import journalPageArtwork from '../assets/journal-page.jpg';
import { isJournalBlank, journalDocFor } from '../components/journal/journalDoc';
import { JournalEditor } from '../components/journal/JournalEditor';
import { InnerPageLayout } from '../components/layout/InnerPageLayout';
import { PageTurn } from '../components/layout/PageTurn';
import { localDay } from '../config/dates';
import { createModeBack } from '../config/innerLayout';
import {
  artBoxStyle,
  artCqw,
  journalArt,
  journalBodyFontPx,
  journalDateBox,
  journalFrame,
  journalRules,
  journalTitleBox,
} from '../config/journal';
import { saveJournal } from '../data/books';
import type {
  AssetKind,
  AssetQuery,
  EditorSaveState,
  JournalContent,
  TravelBook,
} from '../data/contracts';
import { isDataError } from '../data/contracts';
import type { City } from '../data/types';
import styles from './JournalMountPage.module.css';

/** 停手这么久才写盘：一边打字一边写 IndexedDB 会卡，太久的间隔又容易在关页面前丢内容。 */
const SAVE_DEBOUNCE_MS = 700;

const assetPanelNote =
  '共用的素材面板（照片上传、贴纸抽屉）由 V1-05 提供，还没接进来。' +
  '正文照写不误，插入的口子已经按 V1-02 冻结的 props 留好了：面板接上以后点这两个按钮就能选素材。';

/**
 * V1-05 负责把照片仓储和贴纸目录组装成 `AssetQuery`。在那之前这里给一份「什么都查不到」的实现，
 * 让正文里的素材格走真实代码路径（按编号占位、ID 原样存进文档），
 * 而不是在本票里另建一个只有 Journal 看得到的假素材库。
 */
const emptyAssets: AssetQuery = {
  listAssets: async () => [],
  getAsset: async () => undefined,
};

/**
 * 横线日记本的临时挂载页（V1-07）。
 *
 * 干的是 V1-05 手账壳的四件事，而且只做这四件：加载内容一次、把编辑器草稿排队写进
 * `book.journal`、给保存反馈与重试、把 Title / Date 两行印好的填空按书记录填上字。
 * 之所以自己顶着，是因为 `/book/:bookId` 的壳（`src/pages/BookPage*`、`src/components/book/`）
 * 归 V1-05 且还没开工，而横线本没有壳就没人能打开它。
 *
 * `BookPage` 落地后：`App.tsx` 里那一行 `element` 换成 `<BookPage />`，本文件整只删掉；
 * `JournalEditor` 与 `AtlasMedia` 不动 —— 它们只认 V1-02 冻结的 `JournalEditorProps`。
 *
 * 标题编辑（`renameBook`）和真正的素材面板都在壳那一侧，所以这里的 Title 一行是照记录写死的字，
 * 不是输入框：本票不重复实现 05 持有的那块。
 */
export function JournalMountPage({ book, city }: { book: TravelBook; city: City }) {
  const [saveState, setSaveState] = useState<EditorSaveState>({ status: 'ready' });
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  const draft = useRef<JournalContent | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  // 这本书打开时有没有内容：空白页上只是点了光标不该算「写过」。
  const hadContent = book.journal !== undefined;

  const write = useCallback(async () => {
    const next = draft.current;
    if (!next) return;
    draft.current = null;
    if (alive.current) setSaveState((state) => ({ ...state, status: 'saving' }));
    try {
      const saved = await saveJournal(book.id, next);
      if (alive.current) setSaveState({ status: 'saved', lastSavedAt: saved.updatedAt });
    } catch (error: unknown) {
      // 存不下就把草稿留在手里，点「重试」还是这一版内容。
      draft.current = next;
      if (alive.current) setSaveState({ status: 'error', error: isDataError(error) ? error : null });
    }
  }, [book.id]);

  const writeLatest = useRef(write);
  writeLatest.current = write;

  const handleChange = useCallback((next: JournalContent) => {
    if (!hadContent && isJournalBlank(next)) return;
    draft.current = next;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void writeLatest.current(), SAVE_DEBOUNCE_MS);
  }, [hadContent]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
      // 离开这一页（回选择页、换书）之前把最后半秒的改动补写下去，不然就是无声丢字。
      void writeLatest.current();
    };
  }, []);

  const openPanel = useCallback((kind?: AssetKind) => {
    setPanelNotice(kind === 'sticker' ? `贴纸这一类：${assetPanelNote}` : assetPanelNote);
  }, []);

  // 读得出来时 journalDocFor 原样返回那份 doc；返回了别的对象就是走了空白退路。
  const recoveredNote =
    book.journal !== undefined && journalDocFor(book.journal) !== book.journal.doc
      ? '这本手账存着的正文读不出形状，这一页从空白开始。再写下去会把原来那份盖掉，先回书架确认一下要不要留着这本。'
      : null;
  const notice = panelNotice ?? recoveredNote;

  const stageVars = {
    '--rule-step': artCqw(journalArt, journalRules.step),
    '--body-size': artCqw(journalArt, journalBodyFontPx),
    '--label-size': artCqw(journalArt, 25),
    '--journal-tilt': `${journalFrame.tiltDeg}deg`,
    '--album-ratio': String(journalFrame.albumStageRatio),
  } as CSSProperties;

  return (
    <InnerPageLayout back={createModeBack(book.id)} maxWidth={null} flush>
      <div className={styles.page}>
        <PageTurn />

        <div className={styles.tilt} style={stageVars}>
          <div className={styles.stage}>
            <img
              className={styles.art}
              src={journalPageArtwork}
              width={journalArt.width}
              height={journalArt.height}
              alt={`${city.name}手账的横线页`}
            />

            <h1 className="srOnly">{`${city.name} · ${book.title} — 横线日记本`}</h1>

            <p className={styles.field} style={artBoxStyle(journalArt, journalTitleBox)}>
              {book.title}
            </p>
            <p className={styles.field} style={artBoxStyle(journalArt, journalDateBox)}>
              {localDay(book.createdAt).replace(/-/g, ' / ')}
            </p>

            <JournalEditor
              bookId={book.id}
              content={book.journal}
              assets={emptyAssets}
              saveState={saveState}
              onChange={handleChange}
              onRetrySave={() => void write()}
              onOpenAssetPanel={openPanel}
            />
          </div>
        </div>

        <p className={styles.nameplate}>
          {city.name}
          <span>
            {city.nameEn} · {city.region}
          </span>
        </p>

        {notice ? (
          <div className={styles.notice} role="status">
            <p>{notice}</p>
            {panelNotice ? (
              <button type="button" className={styles.noticeClose} onClick={() => setPanelNotice(null)}>
                知道了
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </InnerPageLayout>
  );
}
