import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from './CollageIcons';
import { CollageInspector } from './CollageInspector';
import { CollageStage } from './CollageStage';
import { CollageToolPanel, type CollageTool } from './CollageToolPanel';
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
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const library = useCityAssets(assets, city?.id);
  const requestId = props.insertionRequest?.requestId;
  const reloadLibrary = library.retry;

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
      className={styles.page}
      data-save-state={saveState.status}
      data-selected={selected ? 'true' : undefined}
      aria-labelledby="collage-heading"
    >
      <h2 id="collage-heading" className="srOnly">
        自由拼贴画布
      </h2>

      <div className={styles.desk} aria-hidden="true">
        <span className={styles.deskCompass} />
        <span className={styles.deskPostmark}>
          <span>TRAVEL ATLAS</span>
          <span>{city?.nameEn ?? 'JOURNAL'}</span>
        </span>
      </div>

      <div className={styles.workspace}>
        <div className={styles.paperWrap}>
          <span className={styles.paperStack} aria-hidden="true" />
          <span className={styles.clip} aria-hidden="true">
            <span className={styles.clipBody} />
          </span>
          <div className={styles.paper}>
            <span className={styles.paperGrain} aria-hidden="true" />
            <CollageStage
              items={items}
              selected={selected}
              assets={assets}
              onSelect={select}
              onChange={updateItem}
            />
            <span className={styles.paperCorner} aria-hidden="true" />
            {items.length === 0 ? (
              <p className={styles.paperHint}>
                <span className={styles.paperHintTitle}>旅途从一张空白纸开始</span>
                <span className={styles.paperHintBody}>从左侧挑选照片、贴纸，或写下一段文字</span>
              </p>
            ) : null}
          </div>
        </div>
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
