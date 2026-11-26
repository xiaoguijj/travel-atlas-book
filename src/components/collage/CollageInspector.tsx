import { useEffect, useState } from 'react';
import type { AssetQuery, CollageItem, CollageTextItem, CollageTextStyle } from '../../data/contracts';
import { AssetPreviewImage } from '../assets/AssetPreviewImage';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CloseIcon,
  LayersIcon,
  ToBottomIcon,
  ToTopIcon,
  TrashIcon,
} from './CollageIcons';
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  type LayerMove,
} from './useCollageEditor';
import styles from './CollageView.module.css';

const ORDER_ACTIONS: { move: LayerMove; label: string; Icon: typeof ToTopIcon }[] = [
  { move: 'top', label: '置顶', Icon: ToTopIcon },
  { move: 'up', label: '上移', Icon: ArrowUpIcon },
  { move: 'down', label: '下移', Icon: ArrowDownIcon },
  { move: 'bottom', label: '置底', Icon: ToBottomIcon },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Rotation sits in [-180, 180] for the slider while Konva may accumulate turns. */
function normalizeRotation(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function baseWidth(item: CollageItem) {
  return item.kind === 'text' ? 450 : item.kind === 'photo' ? 360 : 240;
}

function scaleItem(item: CollageItem, ratio: number): CollageItem {
  const width = item.width * ratio;
  const height = item.height * ratio;
  if (item.kind === 'text') {
    return {
      ...item,
      width,
      height,
      style: {
        ...item.style,
        fontSize: Math.max(1, (item.style?.fontSize ?? DEFAULT_TEXT_SIZE) * ratio),
      },
    };
  }
  if (item.kind === 'photo') return { ...item, width, height };
  return { ...item, width, height };
}

function TextFields({ item, onChange }: { item: CollageTextItem; onChange: (item: CollageTextItem) => void }) {
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);
  const style: CollageTextStyle = item.style ?? {};
  const fontSize = style.fontSize ?? DEFAULT_TEXT_SIZE;

  const commitSize = (raw: string) => {
    setSizeDraft(raw);
    const size = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(size) || size < 1 || size === fontSize) return;
    onChange({ ...item, style: { ...style, fontSize: size } });
  };

  return (
    <fieldset className={styles.textFields}>
      <legend className={styles.sectionTitle}>文字格式</legend>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>文字内容</span>
        <textarea
          className={styles.textarea}
          rows={2}
          value={item.text}
          onChange={(event) => onChange({ ...item, text: event.target.value })}
        />
      </label>

      <div className={styles.fieldRow}>
        <label className={`${styles.field} ${styles.fieldHalf}`}>
          <span className={styles.fieldLabel}>字号</span>
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={sizeDraft ?? String(Math.round(fontSize))}
            onChange={(event) => commitSize(event.target.value)}
            onBlur={() => setSizeDraft(null)}
          />
        </label>
        <label className={`${styles.field} ${styles.fieldHalf}`}>
          <span className={styles.fieldLabel}>文字颜色</span>
          <span className={styles.colorField}>
            <input
              className={styles.colorInput}
              type="color"
              value={style.color ?? DEFAULT_TEXT_COLOR}
              onChange={(event) => onChange({ ...item, style: { ...style, color: event.target.value } })}
            />
            <span className={styles.colorValue}>{style.color ?? DEFAULT_TEXT_COLOR}</span>
          </span>
        </label>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>对齐</span>
        <select
          className={styles.select}
          value={style.align ?? 'left'}
          onChange={(event) =>
            onChange({ ...item, style: { ...style, align: event.target.value as CollageTextStyle['align'] } })
          }
        >
          <option value="left">左对齐</option>
          <option value="center">居中</option>
          <option value="right">右对齐</option>
        </select>
      </label>

      <div className={styles.toggleRow}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={style.fontWeight === 'bold'}
            onChange={(event) =>
              onChange({ ...item, style: { ...style, fontWeight: event.target.checked ? 'bold' : 'normal' } })
            }
          />
          <span>粗体</span>
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={style.fontStyle === 'italic'}
            onChange={(event) =>
              onChange({ ...item, style: { ...style, fontStyle: event.target.checked ? 'italic' : 'normal' } })
            }
          />
          <span>斜体</span>
        </label>
      </div>
    </fieldset>
  );
}

export function CollageInspector({
  open,
  onToggle,
  onClose,
  items,
  selected,
  assets,
  labels,
  canRaise,
  canLower,
  onSelect,
  onUpdate,
  onMove,
  onDelete,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: CollageItem[];
  selected: CollageItem | undefined;
  assets: AssetQuery;
  labels: Map<string, string>;
  canRaise: boolean;
  canLower: boolean;
  onSelect: (id: string | null) => void;
  onUpdate: (item: CollageItem) => void;
  onMove: (move: LayerMove) => void;
  onDelete: () => void;
}) {
  const [rotationDraft, setRotationDraft] = useState<string | null>(null);
  const [scaleDraft, setScaleDraft] = useState<string | null>(null);

  useEffect(() => {
    setRotationDraft(null);
    setScaleDraft(null);
  }, [selected?.id]);

  const rotation = selected ? Math.round(normalizeRotation(selected.rotation)) : 0;
  const percent = selected ? Math.round((selected.width / baseWidth(selected)) * 100) : 100;
  const topFirst = [...items].reverse();

  const commitRotation = (raw: string) => {
    setRotationDraft(raw);
    const value = Number(raw);
    if (!selected || raw.trim() === '' || !Number.isFinite(value)) return;
    if (Math.round(value) === rotation) return;
    onUpdate({ ...selected, rotation: clamp(value, -180, 180) });
  };

  const commitScale = (raw: string) => {
    setScaleDraft(raw);
    const value = Number(raw);
    if (!selected || raw.trim() === '' || !Number.isFinite(value)) return;
    if (value < 20 || value > 300) return;
    if (Math.round(value) === percent) return;
    onUpdate(scaleItem(selected, (baseWidth(selected) * value) / 100 / selected.width));
  };

  return (
    <>
      {open ? null : (
        <button
          type="button"
          className={styles.rightDock}
          onClick={onToggle}
          aria-expanded={false}
          aria-label="图层与属性"
          title="图层与属性"
        >
          <LayersIcon />
          <span className={styles.rightDockLabel}>图层与属性</span>
        </button>
      )}

      {open ? (
        <aside id="collage-inspector" className={styles.inspector} aria-label="图层与属性">
          <header className={styles.panelHead}>
            <div className={styles.panelTitle}>
              <span className={styles.panelGlyph}>
                <LayersIcon />
              </span>
              <div>
                <p className={styles.panelKicker}>这一页</p>
                <h3>图层与属性</h3>
              </div>
            </div>
            <button
              type="button"
              className={styles.panelClose}
              onClick={onClose}
              aria-label="收起图层与属性"
            >
              <CloseIcon />
            </button>
          </header>

          <div className={styles.panelBody}>
            <section className={styles.inspectorSection} aria-label="图层顺序">
              <h4 className={styles.sectionTitle}>图层顺序</h4>
              <div className={styles.orderGrid}>
                {ORDER_ACTIONS.map(({ move, label, Icon }) => (
                  <button
                    key={move}
                    type="button"
                    className={styles.orderButton}
                    onClick={() => onMove(move)}
                    disabled={!selected
                      || ((move === 'up' || move === 'top') && !canRaise)
                      || ((move === 'down' || move === 'bottom') && !canLower)}
                    aria-label={label}
                    title={label}
                  >
                    <Icon />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>

            {selected ? (
              <>
                <section className={styles.inspectorSection} aria-label="旋转与缩放">
                  <h4 className={styles.sectionTitle}>旋转与缩放</h4>
                  <div className={styles.sliderRow}>
                    <label className={styles.sliderLabel} htmlFor="collage-rotation">
                      旋转
                    </label>
                    <input
                      id="collage-rotation"
                      className={styles.range}
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={rotation}
                      onChange={(event) => {
                        setRotationDraft(null);
                        onUpdate({ ...selected, rotation: Number(event.target.value) });
                      }}
                      aria-label="旋转"
                    />
                    <span className={styles.numberWrap}>
                      <input
                        className={styles.numberInput}
                        type="number"
                        min={-180}
                        max={180}
                        step={1}
                        value={rotationDraft ?? String(rotation)}
                        onChange={(event) => commitRotation(event.target.value)}
                        onBlur={() => setRotationDraft(null)}
                        aria-label="旋转角度"
                      />
                      <span className={styles.unit}>°</span>
                    </span>
                  </div>

                  <div className={styles.sliderRow}>
                    <label className={styles.sliderLabel} htmlFor="collage-scale">
                      缩放
                    </label>
                    <input
                      id="collage-scale"
                      className={styles.range}
                      type="range"
                      min={20}
                      max={300}
                      step={1}
                      value={clamp(percent, 20, 300)}
                      onChange={(event) => {
                        if (!selected) return;
                        setScaleDraft(null);
                        const target = Number(event.target.value);
                        onUpdate(scaleItem(selected, (baseWidth(selected) * target) / 100 / selected.width));
                      }}
                      aria-label="缩放"
                    />
                    <span className={styles.numberWrap}>
                      <input
                        className={styles.numberInput}
                        type="number"
                        min={20}
                        max={300}
                        step={1}
                        value={scaleDraft ?? String(percent)}
                        onChange={(event) => commitScale(event.target.value)}
                        onBlur={() => setScaleDraft(null)}
                        aria-label="缩放百分比"
                      />
                      <span className={styles.unit}>%</span>
                    </span>
                  </div>
                </section>

                {selected.kind === 'text' ? (
                  <TextFields key={selected.id} item={selected} onChange={onUpdate} />
                ) : null}

                <button type="button" className={styles.deleteWide} onClick={onDelete}>
                  <TrashIcon />
                  删除这个元素
                </button>
              </>
            ) : (
              <p className={styles.inspectorEmpty}>
                点选纸面上的照片、贴纸或文字，这里会显示旋转、缩放和文字样式。
              </p>
            )}

            <section className={`${styles.inspectorSection} ${styles.layerSection}`} aria-label="图层列表">
              <h4 className={styles.sectionTitle}>
                图层列表
                <span className={styles.count}>{items.length}</span>
              </h4>
              {topFirst.length === 0 ? (
                <p className={styles.panelState}>还没有内容，从左侧挑一张照片，或写下一行字。</p>
              ) : (
                <ul className={styles.layerList} role="listbox" aria-label="图层列表">
                  {topFirst.map((item, index) => {
                    const position = items.length - index;
                    const label = labels.get(
                      item.kind === 'text' ? '' : item.assetId,
                    ) ?? (item.kind === 'text'
                      ? (item.text.trim().slice(0, 14) || '空白文字')
                      : item.kind === 'photo' ? '照片' : '贴纸');
                    return (
                      <li
                        key={item.id}
                        role="option"
                        aria-selected={item.id === selected?.id}
                        tabIndex={0}
                        data-layer-id={item.id}
                        className={
                          item.id === selected?.id
                            ? `${styles.layerRow} ${styles.layerRowActive}`
                            : styles.layerRow
                        }
                        onClick={() => onSelect(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelect(item.id);
                          }
                        }}
                      >
                        <span className={styles.layerThumb}>
                          {item.kind === 'text' ? (
                            <span className={styles.layerTextThumb} aria-hidden="true">
                              文
                            </span>
                          ) : (
                            <AssetPreviewImage assetId={item.assetId} assets={assets} alt="" />
                          )}
                        </span>
                        <span className={styles.layerName}>
                          <b>{position}</b>
                          {label}
                        </span>
                        <span className={styles.layerKind}>
                          {item.kind === 'text' ? '文字' : item.kind === 'photo' ? '照片' : '贴纸'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className={styles.sectionHint}>顶层在前，点一行即可选中。</p>
            </section>
          </div>
        </aside>
      ) : null}
    </>
  );
}
