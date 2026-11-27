import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import collageClipArt from '../../assets/collage-clip.png';
import collageCoverArt from '../../assets/collage-cover.png';
import type { AssetMetadata, AssetQuery, CollageEditorProps, CollageItem } from '../../data/contracts';
import type { City } from '../../data/types';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FitIcon,
  LayersIcon,
  SlidersIcon,
  ToBottomIcon,
  ToTopIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './CollageIcons';
import { CollageInspector } from './CollageInspector';
import { CollageStage } from './CollageStage';
import { CollageToolPanel, type CollageTool } from './CollageToolPanel';
import {
  DEFAULT_COLLAGE_ZOOM,
  MAX_COLLAGE_ZOOM,
  MIN_COLLAGE_ZOOM,
  computeFitPaperSize,
  formatZoomPercent,
  stepZoomIn,
  stepZoomOut,
} from './collageViewport';
import { fitItemToCanvas, useCollageEditor } from './useCollageEditor';
import styles from './CollageView.module.css';

type CollageViewProps = CollageEditorProps & { city?: City };

interface AssetLibraryState {
  status: 'loading' | 'ready' | 'error';
  items: AssetMetadata[];
  error?: string;
}

function useCityAssets(assets: AssetQuery, cityId: string | undefined) {
  const [state, setState] = useState<AssetLibraryState>({ status: 'loading', items: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!cityId) {
      setState({ status: 'error', items: [], error: '缺少城市信息，暂时读不到素材。' });
      return;
    }
    let alive = true;
    setState({ status: 'loading', items: [] });
    assets.listAssets(cityId)
      .then((items) => {
        if (alive) setState({ status: 'ready', items });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setState({
          status: 'error',
          items: [],
          error: error instanceof Error ? error.message : '素材读取失败，请稍后再试。',
        });
      });
    return () => {
      alive = false;
    };
  }, [assets, cityId, attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  return { ...state, retry: reload };
}

/** 选中元素时浮在纸面上方的常用操作，取消选中即消失。 */
function SelectionToolbar({
  item,
  canRaise,
  canLower,
  canFit,
  onMove,
  onFit,
  onDelete,
  onEditText,
  onOpenInspector,
}: {
  item: CollageItem | undefined;
  canRaise: boolean;
  canLower: boolean;
  canFit: boolean;
  onMove: (move: 'up' | 'down' | 'top' | 'bottom') => void;
  onFit: () => void;
  onDelete: () => void;
  onEditText: () => void;
  onOpenInspector: () => void;
}) {
  if (!item) return null;
  return (
    <div className={styles.selectionBar} role="toolbar" aria-label="选中元素操作">
      <div className={styles.selectionGroup}>
        <button type="button" className={styles.barButton} onClick={() => onMove('top')} disabled={!canRaise} aria-label="置顶" title="置顶">
          <ToTopIcon />
        </button>
        <button type="button" className={styles.barButton} onClick={() => onMove('up')} disabled={!canRaise} aria-label="上移" title="上移">
          <ArrowUpIcon />
        </button>
        <button type="button" className={styles.barButton} onClick={() => onMove('down')} disabled={!canLower} aria-label="下移" title="下移">
          <ArrowDownIcon />
        </button>
        <button type="button" className={styles.barButton} onClick={() => onMove('bottom')} disabled={!canLower} aria-label="置底" title="置底">
          <ToBottomIcon />
        </button>
      </div>
      <span className={styles.barDivider} aria-hidden="true" />
      {item.kind === 'text' ? (
        <button type="button" className={styles.barTextButton} onClick={onEditText}>
          <SlidersIcon />
          <span>编辑文字</span>
        </button>
      ) : null}
      {canFit ? (
        <button type="button" className={styles.barTextButton} onClick={onFit}>
          <FitIcon />
          <span>适应画布</span>
        </button>
      ) : null}
      <button type="button" className={styles.barTextButtonDanger} onClick={onDelete} aria-label="删除" title="删除">
        <TrashIcon />
        <span aria-hidden="true">删除</span>
      </button>
      <span className={styles.barDivider} aria-hidden="true" />
      <button type="button" className={styles.barButton} onClick={onOpenInspector} aria-label="图层与属性" title="图层与属性">
        <LayersIcon />
      </button>
    </div>
  );
}

export function CollageView(props: CollageViewProps) {
  const { assets, city, onOpenAssetPanel, saveState } = props;
  const {
    items,
    selected,
    select,
    addText,
    insertAsset,
    updateItem,
    removeSelected,
    moveSelected,
  } = useCollageEditor(props);
  const [tool, setTool] = useState<CollageTool | null>(null);
  // 桌面上属性栏默认展开，与左侧工具轨、中间纸面构成固定三栏；窄屏仍是点开才出现的底部浮层。
  const [inspectorOpen, setInspectorOpen] = useState(() => window.matchMedia('(min-width: 901px)').matches);
  const [zoom, setZoom] = useState<number>(DEFAULT_COLLAGE_ZOOM);
  const [fitSize, setFitSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const pageRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const pendingScrollCenter = useRef<{ x: number; y: number; reset: boolean } | null>(null);
  const library = useCityAssets(assets, city?.id);
  const requestId = props.insertionRequest?.requestId;
  const reloadLibrary = library.retry;

  useLayoutEffect(() => {
    const pageEl = pageRef.current;
    const workspaceEl = workspaceRef.current;
    if (!pageEl || !workspaceEl) return;

    const measure = () => {
      const desktopBounded = window.innerWidth > 900 && window.innerHeight > 500;
      // 桌面三栏布局下按工作区（中栏）实测尺寸计算，左右栏已由页面留白让出。
      const availHeight = desktopBounded
        ? workspaceEl.clientHeight
        : Math.max(0, window.innerHeight - workspaceEl.getBoundingClientRect().top);
      const next = computeFitPaperSize({
        workspaceWidth: workspaceEl.clientWidth,
        workspaceHeight: availHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });
      setFitSize((current) => (current.width === next.width && current.height === next.height ? current : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pageEl);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const paperWidth = fitSize.width > 0 ? Math.round(fitSize.width * zoom) : 0;
  const paperScale = paperWidth > 0 ? paperWidth / 780 : 1;

  const applyZoom = useCallback((nextZoom: number, resetScroll = false) => {
    const workspaceEl = workspaceRef.current;
    if (workspaceEl) {
      pendingScrollCenter.current = resetScroll
        ? { x: 0.5, y: 0.5, reset: true }
        : {
          x: workspaceEl.scrollWidth > workspaceEl.clientWidth
            ? (workspaceEl.scrollLeft + workspaceEl.clientWidth / 2) / workspaceEl.scrollWidth
            : 0.5,
          y: workspaceEl.scrollHeight > workspaceEl.clientHeight
            ? (workspaceEl.scrollTop + workspaceEl.clientHeight / 2) / workspaceEl.scrollHeight
            : 0.5,
          reset: false,
        };
    }
    setZoom(nextZoom);
  }, []);

  const handleZoomOut = useCallback(() => {
    applyZoom(stepZoomOut(zoom));
  }, [applyZoom, zoom]);

  const handleZoomIn = useCallback(() => {
    applyZoom(stepZoomIn(zoom));
  }, [applyZoom, zoom]);

  const handleFitScreen = useCallback(() => {
    applyZoom(DEFAULT_COLLAGE_ZOOM, true);
  }, [applyZoom]);

  useLayoutEffect(() => {
    const pending = pendingScrollCenter.current;
    const workspaceEl = workspaceRef.current;
    if (!pending || !workspaceEl) return;
    pendingScrollCenter.current = null;
    if (pending.reset || zoom <= DEFAULT_COLLAGE_ZOOM) {
      workspaceEl.scrollLeft = 0;
      workspaceEl.scrollTop = 0;
      return;
    }
    workspaceEl.scrollLeft = Math.max(0, pending.x * workspaceEl.scrollWidth - workspaceEl.clientWidth / 2);
    workspaceEl.scrollTop = Math.max(0, pending.y * workspaceEl.scrollHeight - workspaceEl.clientHeight / 2);
  }, [zoom, paperWidth]);

  useEffect(() => {
    const workspaceEl = workspaceRef.current;
    if (!workspaceEl) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (event.deltaY < 0) applyZoom(stepZoomIn(zoom));
      else if (event.deltaY > 0) applyZoom(stepZoomOut(zoom));
    };
    workspaceEl.addEventListener('wheel', onWheel, { passive: false });
    return () => workspaceEl.removeEventListener('wheel', onWheel);
  }, [applyZoom, zoom]);

  useEffect(() => {
    // 素材册里刚上传的照片也要出现在左侧素材面板里。
    if (!requestId) return;
    reloadLibrary();
  }, [requestId, reloadLibrary]);

  const labels = useMemo(
    () => new Map(library.items.map((item) => [item.assetId, item.label])),
    [library.items],
  );
  const photos = useMemo(
    () => library.items.filter((item) => item.kind === 'photo'),
    [library.items],
  );
  const cityStickers = useMemo(
    () => library.items.filter((item) => item.kind === 'sticker' && item.cityId === city?.id),
    [library.items, city?.id],
  );
  const commonStickers = useMemo(
    () => library.items.filter((item) => item.kind === 'sticker' && !item.cityId),
    [library.items],
  );

  const index = selected ? items.indexOf(selected) : -1;
  const canRaise = index >= 0 && index < items.length - 1;
  const canLower = index > 0;
  const fitted = selected ? fitItemToCanvas(selected) : undefined;

  useEffect(() => {
    // 窄屏上属性面板是底部浮层，自动展开会整块盖住纸面，交给用户点“编辑文字”。
    if (selected?.kind !== 'text') return;
    if (!window.matchMedia('(min-width: 901px)').matches) return;
    setInspectorOpen(true);
  }, [selected?.id, selected?.kind]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setTool(null);
      setInspectorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleTool = (next: CollageTool) => {
    setTool((current) => (current === next ? null : next));
    setInspectorOpen(false);
  };
  const toggleInspector = () => {
    setInspectorOpen((open) => !open);
    setTool(null);
  };
  const handleAddText = () => {
    addText();
    setTool(null);
  };
  const openInspector = () => {
    setInspectorOpen(true);
    setTool(null);
  };

  return (
    <section
      ref={pageRef}
      className={styles.page}
      data-save-state={saveState.status}
      data-selected={selected ? 'true' : undefined}
      data-panel={tool ?? (inspectorOpen ? 'inspector' : undefined)}
      aria-labelledby="collage-heading"
    >
      <h2 id="collage-heading" className="srOnly">
        自由拼贴画布
      </h2>

      <div className={styles.desk} aria-hidden="true">
        <span className={styles.deskAirmailEdge} />
        <div className={styles.deskWatermark}>
          <span className={styles.deskCityScript}>{city?.nameEn ?? 'Travel Atlas'}</span>
          <span className={styles.deskPostmarkTag}>TRAVEL ATLAS · {city?.name ?? 'JOURNAL'}</span>
        </div>
      </div>

      <div ref={workspaceRef} className={styles.workspace}>
        <div
          className={styles.workspaceInner}
          style={{ '--paper-scale': `${paperScale}` } as CSSProperties}
        >
          <div
            className={styles.paperWrap}
            style={paperWidth > 0 ? ({ width: `${paperWidth}px`, '--paper-scale': `${paperScale}` } as CSSProperties) : undefined}
          >
            <img className={styles.journalCover} src={collageCoverArt} alt="" aria-hidden="true" />
            <span className={styles.paperStackBack} aria-hidden="true" />
            <span className={styles.paperStackMid} aria-hidden="true" />
            <img className={styles.clip} src={collageClipArt} alt="" aria-hidden="true" />
            <div className={styles.paperShadow}>
              <div className={styles.paper}>
                <span className={styles.paperPatina} aria-hidden="true" />
                <svg className={styles.paperWatermark} viewBox="0 0 900 800" preserveAspectRatio="none" aria-hidden="true">
                  <rect x="22" y="22" width="856" height="756" rx="2" />
                  <rect x="28" y="28" width="844" height="744" rx="1" strokeDasharray="3 5" opacity="0.55" />
                  <g transform="translate(86 714)" opacity="0.72">
                    <circle cx="0" cy="0" r="34" />
                    <circle cx="0" cy="0" r="26" strokeDasharray="2 3" />
                    <path d="M0-42v84M-42 0h84M-22-22l44 44M22-22l-44 44" />
                    <polygon points="0,-32 5,-7 0,-12 -5,-7" fill="currentColor" opacity="0.45" />
                  </g>
                  <g transform="translate(814 82) rotate(-8)" opacity="0.58">
                    <rect x="-26" y="-20" width="52" height="40" rx="2" strokeDasharray="3 2" />
                    <path d="M-16 0h32M-12-8h24M-12 8h20" />
                  </g>
                </svg>
                <CollageStage
                  items={items}
                  selected={selected}
                  assets={assets}
                  displayWidthHint={paperWidth}
                  onSelect={select}
                  onChange={updateItem}
                />
                <span className={styles.paperCorner} aria-hidden="true" />
                {items.length === 0 ? (
                  <p className={styles.paperHint}>
                    <span className={styles.paperHintOrnaments} aria-hidden="true">✦</span>
                    <span className={styles.paperHintTitle}>旅途从一张空白纸开始</span>
                    <span className={styles.paperHintBody}>从左侧挑选照片、贴纸，或写下一段文字</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.zoomBar} role="toolbar" aria-label="画布缩放控制">
        <button
          type="button"
          className={styles.zoomButton}
          onClick={handleZoomOut}
          disabled={zoom <= MIN_COLLAGE_ZOOM}
          aria-label="缩小画布"
          title="缩小画布"
        >
          <ZoomOutIcon />
        </button>
        <span className={styles.zoomPercent} aria-label="当前缩放比例" aria-live="polite">
          {formatZoomPercent(zoom)}
        </span>
        <button
          type="button"
          className={styles.zoomButton}
          onClick={handleZoomIn}
          disabled={zoom >= MAX_COLLAGE_ZOOM}
          aria-label="放大画布"
          title="放大画布"
        >
          <ZoomInIcon />
        </button>
        <span className={styles.barDivider} aria-hidden="true" />
        <button
          type="button"
          className={styles.zoomFitButton}
          onClick={handleFitScreen}
          aria-label="适应屏幕"
          title="适应屏幕"
        >
          <FitIcon />
          <span>适应屏幕</span>
        </button>
      </div>

      <SelectionToolbar
        item={selected}
        canRaise={canRaise}
        canLower={canLower}
        canFit={Boolean(fitted)}
        onMove={moveSelected}
        onFit={() => fitted && updateItem(fitted)}
        onDelete={removeSelected}
        onEditText={openInspector}
        onOpenInspector={toggleInspector}
      />

      <CollageToolPanel
        open={tool}
        onToggle={toggleTool}
        onClose={() => setTool(null)}
        cityName={city?.name ?? '这一页'}
        photos={photos}
        cityStickers={cityStickers}
        commonStickers={commonStickers}
        status={library.status}
        error={library.error}
        assets={assets}
        onInsert={insertAsset}
        onAddText={handleAddText}
        onOpenAssets={onOpenAssetPanel}
        onRetry={library.retry}
      />

      <CollageInspector
        open={inspectorOpen}
        onToggle={toggleInspector}
        onClose={() => setInspectorOpen(false)}
        items={items}
        selected={selected}
        assets={assets}
        labels={labels}
        canRaise={canRaise}
        canLower={canLower}
        onSelect={select}
        onUpdate={updateItem}
        onMove={moveSelected}
        onDelete={removeSelected}
      />
    </section>
  );
}
