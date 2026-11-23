import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { getCityById } from '../data/cities';
import { searchStickers, stickerAssets, stickerUrl, stickersOf } from './catalog';
import styles from './StickerPicker.module.css';

/**
 * 贴纸盒，Journal 和 Collage 用的是同一个。
 *
 * 打开先给「全域小集」那四张；「城市邮票」那一格给六枚邮票；
 * 搜索框认城市名（中英文都行，Xi'an、xian、西安 都算西安），命中就给那座城市四张文化贴纸。
 * 这里不管你正在写哪座城市——南京的日记照样能贴成都的担担面。
 *
 * 组件不认识宿主的存储格式，点中一张就把 assetId 交出去，
 * 由宿主决定贴到哪一页、怎么存（Journal 走 useStickers.add）。
 */

export interface StickerPickerProps {
  open: boolean;
  /** 点中一张贴纸，宿主把它贴到当前画布上；面板不自动关，方便连贴 */
  onPick: (assetId: string) => void;
  onClose: () => void;
  /** 当前手账的城市，只用来在标题上给一句提示 */
  cityId?: string;
}

type Tab = 'common' | 'stamp';

export function StickerPicker({ open, onPick, onClose, cityId }: StickerPickerProps) {
  const [tab, setTab] = useState<Tab>('common');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const shown = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed) return searchStickers(trimmed);
    return stickersOf(tab);
  }, [query, tab]);

  if (!open) return null;

  function handleSearch(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setQuery(value);
    // 清空搜索框就回到默认的全域小集，不留在上一次的城市结果里
    if (value.trim() === '') setTab('common');
  }

  function switchTab(next: Tab) {
    setTab(next);
    setQuery('');
    searchRef.current?.focus();
  }

  return (
    <div className={styles.backdrop} onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.box} role="dialog" aria-modal="true" aria-label="贴纸盒">
        <header className={styles.head}>
          <h2>贴纸盒</h2>
          <p className={styles.hint}>
            {cityId ? `${cityNameOf(cityId)}的这一页 · ` : ''}点一张就贴上去，可以反复贴、跨城市贴。
          </p>
          <button type="button" className={styles.close} onClick={onClose} aria-label="关闭贴纸盒">
            ✕
          </button>
        </header>

        <div className={styles.tabs}>
          <button type="button" aria-pressed={tab === 'common' && query === ''} className={tab === 'common' && query === '' ? styles.on : ''} onClick={() => switchTab('common')}>
            全域小集
          </button>
          <button type="button" aria-pressed={tab === 'stamp' && query === ''} className={tab === 'stamp' && query === '' ? styles.on : ''} onClick={() => switchTab('stamp')}>
            城市邮票
          </button>
          <label className={styles.search}>
            <span className="srOnly">按城市搜索贴纸</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={handleSearch}
              placeholder="找城市：南京 / Nanjing"
              aria-label="输入城市名搜索贴纸"
            />
          </label>
        </div>

        {shown.length > 0 ? (
          <ul className={styles.grid}>
            {shown.map((asset) => (
              <li key={asset.id}>
                <button type="button" className={styles.tile} onClick={() => onPick(asset.id)} title={`${asset.name} ${asset.nameEn}`}>
                  <img src={stickerUrl(asset.id)} alt="" loading="lazy" decoding="async" draggable={false} />
                  <span className={styles.caption}>{asset.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty} role="status">
            搜不到「{query.trim()}」的贴纸。六座城市都可以用中文名或英文名：北京 Beijing、上海 Shanghai、
            成都 Chengdu、南京 Nanjing、西安 Xi'an、杭州 Hangzhou。
          </p>
        )}

        <footer className={styles.foot}>
          <p>
            共 {stickerAssets.length} 张：全域小集 4 张、城市邮票 6 张、城市文化 24 张。
            {query.trim() ? ` 当前结果 ${shown.length} 张。` : ''}
          </p>
          <button type="button" className={styles.done} onClick={onClose}>
            贴好了
          </button>
        </footer>
      </section>
    </div>
  );
}

function cityNameOf(cityId: string): string {
  return getCityById(cityId)?.name ?? cityId;
}
