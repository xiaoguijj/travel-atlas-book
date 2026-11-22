import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import journalArtwork from '../assets/journal-page.jpg';
import { PageTurn } from '../components/layout/PageTurn';
import {
  artBoxStyle,
  artCqw,
  journalArt,
  journalBodyFontPx,
  journalDateBox,
  journalFrame,
  journalRules,
  journalTitleBox,
  journalWritingBox,
} from '../config/journal';
import { cities, getCityById } from '../data/cities';
import type { City } from '../data/types';
import { useLocalJournal, type JournalStatus } from '../hooks/useLocalJournal';
import styles from './CityPage.module.css';

/** 一本手账最多几页：挡住极端粘贴，正常写不到 */
const MAX_PAGES = 200;

/** 镜像层要照抄正文的排版属性，少抄一个折行位置就会和真文本错开 */
const MIRROR_PROPS = [
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'wordSpacing',
  'whiteSpace',
  'wordBreak',
  'overflowWrap',
  'tabSize',
  'textTransform',
] as const;

/**
 * 手账页（参考图 assets-source/journal-lines.png）。
 *
 * 纸、横线、Title / Date 两条填空都画在图上，页面只往上盖三个真输入框：
 * 坐标来自 src/config/journal.ts，正文行高等于印好的线距，字才坐在线上。
 * 写满一页会自动翻到下一页，所以这一页永远不需要滚动条。
 */
export function CityPage() {
  const { cityId } = useParams<{ cityId: string }>();
  const city = getCityById(cityId);

  if (!city) return <UnknownCity cityId={cityId} />;

  // 换城市时整页重新挂载：翻页动画要重播，正文也要按新城市从本机重读一遍
  return <JournalPage key={city.id} city={city} />;
}

function JournalPage({ city }: { city: City }) {
  const { entry, status, update } = useLocalJournal(city.id);
  const [page, setPage] = useState(0);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  // 翻完页光标该落在新页的哪个位置；要等新页的正文框渲染出来才设得进去
  const caretRef = useRef<number | null>(null);

  const pageCount = Math.max(1, entry.pages.length);
  const body = entry.pages[page] ?? '';

  useEffect(() => {
    const offset = caretRef.current;
    if (offset === null) return;
    caretRef.current = null;
    const el = bodyRef.current;
    if (!el) return;
    const clamped = Math.min(offset, el.value.length);
    el.focus();
    el.setSelectionRange(clamped, clamped);
  }, [page]);

  const stageStyle = {
    '--rule-step': artCqw(journalArt, journalRules.step),
    '--body-size': artCqw(journalArt, journalBodyFontPx),
    '--label-size': artCqw(journalArt, 25),
    '--journal-tilt': `${journalFrame.tiltDeg}deg`,
    '--album-ratio': String(journalFrame.albumStageRatio),
  } as CSSProperties;

  /**
   * 正文一改就重新数行：超过 writable 行就把多出来的整行挪到新页。
   * 分页点必须落在行首，所以用二分在镜像层里找第 writable 行的第一个字符。
   */
  function handleBodyChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const el = event.target;
    const value = el.value;
    const caret = el.selectionStart;
    const chunks = splitIntoPages(value);

    if (chunks.length === 1) {
      update({ pages: withPage(entry.pages, page, chunks[0]) });
      return;
    }

    let targetPage = page;
    let targetCaret = caret;
    let start = 0;
    for (let i = 0; i < chunks.length; i += 1) {
      const end = start + chunks[i].length;
      if (caret <= end || i === chunks.length - 1) {
        targetPage = Math.min(page + i, MAX_PAGES - 1);
        targetCaret = Math.max(0, caret - start);
        break;
      }
      start = end;
    }

    const next = [...entry.pages];
    next.splice(page, 1, ...chunks);
    caretRef.current = targetCaret;
    setPage(targetPage);
    update({ pages: next });
  }

  function splitIntoPages(text: string): string[] {
    const el = bodyRef.current;
    const mirror = mirrorRef.current;
    if (!el || !mirror) return [text];
    const step = Number.parseFloat(window.getComputedStyle(el).lineHeight);
    if (!Number.isFinite(step) || step <= 0) return [text];

    syncMirror(mirror, el);
    const chunks: string[] = [];
    let rest = text;
    while (chunks.length < MAX_PAGES && lineIndexOf(mirror, step, rest, rest.length) >= journalRules.writable) {
      const splitAt = findLineStart(mirror, step, rest, journalRules.writable);
      if (splitAt <= 0) break;
      chunks.push(rest.slice(0, splitAt));
      rest = rest.slice(splitAt);
    }
    chunks.push(rest);
    return chunks;
  }

  function goToPage(next: number) {
    const clamped = Math.min(Math.max(0, next), pageCount - 1);
    if (clamped === page) return;
    setPage(clamped);
  }

  return (
    <div className={styles.page}>
      {/* 换页就重挂载一次：翻页动画要跟着每一页重播 */}
      <PageTurn key={`turn-${page}`} />

      <div className={styles.tilt} style={stageStyle}>
        <div className={styles.stage}>
          <img
            className={styles.art}
            src={journalArtwork}
            width={journalArt.width}
            height={journalArt.height}
            alt={`${city.name}手账第 ${page + 1} 页`}
          />

          <h1 className="srOnly">{`${city.name} · ${city.nameEn} 手账 第 ${page + 1} 页，共 ${pageCount} 页`}</h1>

          <input
            className={styles.field}
            style={artBoxStyle(journalArt, journalTitleBox)}
            value={entry.title}
            onChange={(event) => update({ title: event.target.value })}
            placeholder={`${city.name} · ${city.tagline}`}
            aria-label="手账标题"
            maxLength={40}
          />

          <input
            className={styles.field}
            style={artBoxStyle(journalArt, journalDateBox)}
            value={entry.date}
            onChange={(event) => update({ date: event.target.value })}
            placeholder="2026 / 11 / 22"
            aria-label="日期"
            inputMode="numeric"
            maxLength={20}
          />

          <textarea
            ref={bodyRef}
            className={styles.body}
            style={artBoxStyle(journalArt, journalWritingBox)}
            value={body}
            onChange={handleBodyChange}
            placeholder="今天走了哪条路、吃了什么、哪张贴纸贴歪了——写满一页会自动翻到下一页。"
            aria-label={`${city.name}手账第 ${page + 1} 页正文`}
            spellCheck={false}
          />

          <div ref={mirrorRef} className={styles.mirror} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.bar}>
        <Link className={styles.back} to="/section/journals">
          ← 回到邮票册
        </Link>
        <p className={styles.nameplate}>
          {city.name}
          <span className={styles.region}>
            {city.nameEn} · {city.region}
          </span>
          <span className={styles.pager}>
            <button type="button" onClick={() => goToPage(page - 1)} disabled={page === 0} aria-label="上一页">
              ‹
            </button>
            <em>
              {page + 1} / {pageCount}
            </em>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= pageCount - 1}
              aria-label="下一页"
            >
              ›
            </button>
          </span>
        </p>
        <p className={styles.status} data-status={status}>
          {statusLabel(status)}
        </p>
      </div>
    </div>
  );
}

/** 镜像层里放一个零宽标记，看它掉在第几行；折行规则照抄正文，行号才可信 */
function lineIndexOf(mirror: HTMLDivElement, stepPx: number, text: string, offset: number): number {
  mirror.textContent = text.slice(0, offset);
  const marker = document.createElement('span');
  marker.textContent = '';
  mirror.appendChild(marker);
  const index = Math.round(marker.offsetTop / stepPx);
  mirror.textContent = '';
  return index;
}

/** 二分找第 target 行的第一个字符下标 */
function findLineStart(mirror: HTMLDivElement, stepPx: number, text: string, target: number): number {
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lineIndexOf(mirror, stepPx, text, mid) >= target) high = mid;
    else low = mid + 1;
  }
  return low;
}

function syncMirror(mirror: HTMLDivElement, el: HTMLTextAreaElement): void {
  const cs = window.getComputedStyle(el);
  for (const prop of MIRROR_PROPS) {
    mirror.style[prop] = cs[prop];
  }
  mirror.style.boxSizing = 'content-box';
  mirror.style.width = `${el.clientWidth}px`;
}

function withPage(pages: string[], index: number, text: string): string[] {
  const next = [...pages];
  next[index] = text;
  return next;
}

function statusLabel(status: JournalStatus): string {
  if (status === 'saving') return '正在写进这台设备…';
  if (status === 'unavailable') return '这台设备暂时存不下，刷新会丢';
  return '已存到本机，下次打开还在';
}

function UnknownCity({ cityId }: { cityId?: string }) {
  return (
    <div className={styles.page}>
      <section className={styles.missing}>
        <h1>这本手账里还没有这一页</h1>
        <p>{cityId ? `编号「${cityId}」暂时还没有收录。` : '地址里缺少城市编号。'}目前已收录的城市是：</p>
        <ul className={styles.missingList}>
          {cities.map((city) => (
            <li key={city.id}>
              <Link to={`/city/${city.id}`}>
                {city.name}
                <span>{city.nameEn}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link className={styles.back} to="/section/journals">
          ← 回到邮票册
        </Link>
      </section>
    </div>
  );
}
