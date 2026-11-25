import { useState } from 'react';
import type { CollageEditorProps, CollageTextItem } from '../../data/contracts';
import { CollageStage } from './CollageStage';
import styles from './CollageView.module.css';
import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_SIZE, useCollageEditor } from './useCollageEditor';

function TextFields({ item, onChange }: { item: CollageTextItem; onChange: (item: CollageTextItem) => void }) {
  const { style } = item;
  const fontSize = style?.fontSize ?? DEFAULT_TEXT_SIZE;
  const shownFontSize = Number(fontSize.toFixed(2));
  const [fontSizeDraft, setFontSizeDraft] = useState<string | null>(null);

  return (
    <fieldset className={styles.fields}>
      <legend>文字格式</legend>
      <label className={styles.text}>文字内容
        <textarea rows={2} value={item.text} onChange={(event) => onChange({ ...item, text: event.target.value })} />
      </label>
      <label>字号
        <input type="number" min={1} step="any" value={fontSizeDraft ?? shownFontSize}
          onChange={(event) => {
            const { value, valueAsNumber: size } = event.currentTarget;
            setFontSizeDraft(value);
            if (size >= 1 && Number.isFinite(size) && size !== fontSize) {
              onChange({ ...item, style: { ...style, fontSize: size } });
            }
          }}
          onBlur={() => setFontSizeDraft(null)}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      </label>
      <label>文字颜色
        <input type="color" value={style?.color ?? DEFAULT_TEXT_COLOR}
          onChange={(event) => onChange({ ...item, style: { ...style, color: event.target.value } })} />
      </label>
      <label>对齐
        <select value={style?.align ?? 'left'}
          onChange={(event) => onChange({ ...item, style: { ...style, align: event.target.value as 'left' | 'center' | 'right' } })}>
          <option value="left">左对齐</option>
          <option value="center">居中</option>
          <option value="right">右对齐</option>
        </select>
      </label>
      <label>
        <input type="checkbox" checked={style?.fontWeight === 'bold'}
          onChange={(event) => onChange({ ...item, style: { ...style, fontWeight: event.target.checked ? 'bold' : 'normal' } })} />
        粗体
      </label>
      <label>
        <input type="checkbox" checked={style?.fontStyle === 'italic'}
          onChange={(event) => onChange({ ...item, style: { ...style, fontStyle: event.target.checked ? 'italic' : 'normal' } })} />
        斜体
      </label>
    </fieldset>
  );
}

export function CollageView(props: CollageEditorProps) {
  const { assets, onOpenAssetPanel, saveState } = props;
  const { items, selected, select, addText, updateItem, removeSelected, moveSelected } = useCollageEditor(props);
  const index = selected ? items.indexOf(selected) : -1;
  const canRaise = index >= 0 && index < items.length - 1;
  const canLower = index > 0;

  return (
    <section className={styles.page} data-save-state={saveState.status} aria-labelledby="collage-heading">
      <h2 id="collage-heading">自由拼贴画布</h2>
      <div className={styles.row}>
        <button type="button" onClick={() => onOpenAssetPanel('photo')}>插入照片</button>
        <button type="button" onClick={() => onOpenAssetPanel('sticker')}>插入贴纸</button>
        <button type="button" onClick={addText}>添加文字</button>
      </div>
      <div className={styles.row}>
        <label>图层
          <select value={selected?.id ?? ''} onChange={(event) => select(event.target.value || null)}>
            <option value="">选择元素</option>
            {items.map((item, position) => (
              <option key={item.id} value={item.id}>
                {position + 1}. {item.kind === 'text' ? `文字 ${item.text.slice(0, 18)}` : item.kind === 'photo' ? '照片' : '贴纸'}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => moveSelected('up')} disabled={!canRaise}>上移</button>
        <button type="button" onClick={() => moveSelected('down')} disabled={!canLower}>下移</button>
        <button type="button" onClick={() => moveSelected('top')} disabled={!canRaise}>置顶</button>
        <button type="button" onClick={() => moveSelected('bottom')} disabled={!canLower}>置底</button>
        <button type="button" onClick={removeSelected} disabled={!selected}>删除</button>
      </div>
      <CollageStage items={items} selected={selected} assets={assets} onSelect={select} onChange={updateItem} />
      {selected?.kind === 'text' && <TextFields key={selected.id} item={selected} onChange={updateItem} />}
    </section>
  );
}
