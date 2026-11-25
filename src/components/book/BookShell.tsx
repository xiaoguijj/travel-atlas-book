import { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createModeBack } from '../../config/innerLayout';
import { bookModePath } from '../../config/routes';
import { assetQuery } from '../../data/assets';
import {
  BOOK_MODES,
  MAX_BOOK_TITLE_LENGTH,
  type AssetInsertionRequest,
  type AssetKind,
  type BookMode,
  type CollageCanvas,
  type EditorSaveState,
  type JournalContent,
  type TravelBook,
} from '../../data/contracts';
import { createStableId } from '../../data/ids';
import { importPhoto } from '../../data/photos';
import type { SaveField } from '../../data/saving';
import type { City } from '../../data/types';
import { StickerPicker, useStickers, type StickerApi } from '../../stickers';
import { AssetPanel } from '../assets/AssetPanel';
import { InnerPageLayout } from '../layout/InnerPageLayout';
import { LeaveGuard } from './LeaveGuard';
import { CollageConflictNotice } from './CollageConflictNotice';
import { JournalConflictNotice } from './JournalConflictNotice';
import { StickerRecoveryNotice } from './StickerRecoveryNotice';
import { SaveStatus } from './SaveStatus';
import styles from './BookShell.module.css';
import { useBookSaveQueue } from './useBookSaveQueue';
import { bookSaveFeedback, coordinateBookSaves } from './bookPersistence';

const JournalView = lazy(() =>
  import('../journal/JournalView').then((module) => ({ default: module.JournalView })),
);
const CollageView = lazy(() =>
  import('../collage/CollageView').then((module) => ({ default: module.CollageView })),
);

const MODE_LABELS: Record<BookMode, string> = {
  journal: 'Journal · 横线日记本',
  collage: 'Collage · 自由拼贴',
};

interface BookShellProps {
  book: TravelBook;
  city: City;
  mode: BookMode;
  onBookSaved(book: TravelBook): void;
}

/**
 * Journal 与 Collage 共用的手账壳：标题、模式导航、保存反馈、失败重试、离开守卫和素材面板。
 * 两侧编辑器只拿 V1-02 冻结的 props，不直接查库，也不持有 object URL。
 */
export function BookShell(props: BookShellProps) {
  return props.mode === 'journal' ? <JournalBookShell {...props} /> : <BookEditorShell {...props} />;
}

function JournalBookShell(props: BookShellProps) {
  const stickers = useStickers({ cityId: props.city.id, mode: 'journal', journalId: props.book.id }, 0);
  return <BookEditorShell {...props} stickers={stickers} />;
}

function BookEditorShell({ book, city, mode, onBookSaved, stickers }: BookShellProps & { stickers?: StickerApi }) {
  const handleSaved = useCallback(
    (_field: SaveField, saved: TravelBook) => {
      onBookSaved(saved);
    },
    [onBookSaved],
  );
  const { queue, state } = useBookSaveQueue(book.id, handleSaved, book.journal, book.collage);

  const [title, setTitle] = useState(book.title);
  const lastQueuedTitle = useRef(book.title);
  const [panel, setPanel] = useState<{ kind?: AssetKind } | null>(null);
  const [insertionRequest, setInsertionRequest] = useState<AssetInsertionRequest | null>(null);
  const [journalLoadBlocked, setJournalLoadBlocked] = useState(false);

  const { flush, isDirty, discardPending, retry } = stickers ?? {};
  const persistence = useMemo(
    () => flush && isDirty && discardPending ? coordinateBookSaves(queue, { flush, isDirty, discardPending }) : queue,
    [queue, flush, isDirty, discardPending],
  );
  const feedback = bookSaveFeedback(state, stickers, journalLoadBlocked);

  // 打开时只取一次内容；保存成功后父级即使刷新书对象，也不重置正在编辑的视图。
  const journalContent = useRef<JournalContent | undefined>(book.journal).current;
  const collageContent = useRef<CollageCanvas | undefined>(book.collage).current;

  const saveState: EditorSaveState = {
    status: feedback.state.status,
    error: feedback.state.error,
    lastSavedAt: feedback.state.lastSavedAt,
  };
  const dirty = persistence.isDirty();

  const changeTitle = (value: string) => {
    setTitle(value);
    if (value === lastQueuedTitle.current) return;
    lastQueuedTitle.current = value;
    queue.updateTitle(value);
  };

  const trimTitle = () => {
    const next = title.trim();
    if (next !== title) {
      setTitle(next);
      lastQueuedTitle.current = next;
      queue.updateTitle(next);
    }
  };

  const openAssetPanel = useCallback((kind?: AssetKind) => {
    setPanel(kind ? { kind } : {});
  }, []);

  const closeAssetPanel = useCallback(() => setPanel(null), []);

  const selectAsset = (assetId: string) => {
    setInsertionRequest({ requestId: createStableId(), assetId });
    setPanel(null);
  };

  const handleInsertionHandled = useCallback((requestId: string) => {
    setInsertionRequest((current) => (current?.requestId === requestId ? null : current));
  }, []);

  const retrySave = useCallback(() => {
    void queue.flush().then(() => { retry?.(); });
  }, [queue, retry]);

  const reloadJournal = useCallback(async (): Promise<boolean> => {
    // Preserve pending titles and sticker gestures before rereading the journal.
    const saved = await persistence.flush();
    if (!saved || persistence.isDirty()) return false;
    window.location.reload();
    return true;
  }, [persistence]);

  const uploadPhoto = useCallback((file: File) => importPhoto(city.id, file), [city.id]);

  return (
    <InnerPageLayout back={createModeBack(book.id)} maxWidth={1280}>
      <div className={styles.shell} data-mode={mode}>
        <header className={styles.toolbar}>
          <div className={styles.identity}>
            <p className={styles.cityLine}>
              {city.name}
              <span>{city.nameEn}</span>
            </p>
            <label className={styles.titleField}>
              <span className="srOnly">手账标题</span>
              <input
                className={styles.titleInput}
                value={title}
                onChange={(event) => changeTitle(event.target.value)}
                onBlur={trimTitle}
                maxLength={MAX_BOOK_TITLE_LENGTH}
                aria-label="手账标题"
                aria-invalid={state.error?.code === 'INVALID_TITLE' ? true : undefined}
              />
            </label>
          </div>

          <nav className={styles.modes} aria-label="编辑模式">
            {BOOK_MODES.map((item) => (
              <Link
                key={item}
                to={bookModePath(book.id, item)}
                className={item === mode ? `${styles.modeLink} ${styles.modeActive}` : styles.modeLink}
                aria-current={item === mode ? 'page' : undefined}
              >
                {MODE_LABELS[item]}
              </Link>
            ))}
          </nav>

          <div className={styles.tools}>
            <SaveStatus state={feedback.state}
              message={state.error?.code === 'COLLAGE_CONFLICT' ? '拼贴保存冲突，草稿已保留' : feedback.message}
              onRetry={retrySave} />
            <button type="button" className={styles.assetButton} onClick={() => openAssetPanel()}>
              素材
            </button>
          </div>
        </header>

        {mode === 'journal' && state.journalConflict ? <JournalConflictNotice bookId={book.id} queue={queue} /> : null}
        {mode === 'collage' && state.collageConflict ? <CollageConflictNotice bookId={book.id} queue={queue} /> : null}
        {stickers ? <StickerRecoveryNotice stickers={stickers} /> : null}

        <div className={styles.editor}>
          <Suspense
            fallback={
              <p className={styles.loading} role="status">
                正在铺开纸页…
              </p>
            }
          >
            {mode === 'journal' ? (
              <JournalView
                bookId={book.id}
                content={journalContent}
                assets={assetQuery}
                saveState={saveState}
                onChange={(content) => queue.updateJournal(content)}
                onRetrySave={retrySave}
                onOpenAssetPanel={openAssetPanel}
                insertionRequest={insertionRequest}
                onInsertionHandled={handleInsertionHandled}
                book={book}
                city={city}
                stickers={stickers}
                onLoadBlocked={setJournalLoadBlocked}
                onReloadRequested={reloadJournal}
              />
            ) : (
              <CollageView
                bookId={book.id}
                content={collageContent}
                assets={assetQuery}
                saveState={saveState}
                onChange={(canvas) => queue.updateCollage(canvas)}
                onRetrySave={retrySave}
                onOpenAssetPanel={openAssetPanel}
                insertionRequest={insertionRequest}
                onInsertionHandled={handleInsertionHandled}
              />
            )}
          </Suspense>
        </div>

        {panel ? (
          stickers && panel.kind === 'sticker' ? (
            <StickerPicker
              open
              disabled={stickers.readBlocked}
              cityId={city.id}
              onPick={(assetId) => stickers.add(assetId)}
              onClose={closeAssetPanel}
            />
          ) : (
            <AssetPanel
              cityId={city.id}
              cityName={city.name}
              mode={mode}
              assets={assetQuery}
              initialKind={panel.kind}
              uploadPhoto={uploadPhoto}
              onSelect={selectAsset}
              onClose={closeAssetPanel}
            />
          )
        ) : null}

        <LeaveGuard queue={persistence} dirty={dirty} errorMessage={feedback.state.error?.message ?? null} />
      </div>
    </InnerPageLayout>
  );
}
