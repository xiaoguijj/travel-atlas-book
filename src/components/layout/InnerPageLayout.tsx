import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { BackTarget } from '../../config/innerLayout';
import styles from './InnerPageLayout.module.css';

export interface InnerPageLayoutProps {
  /** 返回按钮的目标与文案；传 null 就不画按钮（例如已经是最上层入口的页面） */
  back?: BackTarget | null;
  /** 顶栏中央品牌标题，默认 Travel Atlas Book；传 null 只留 Logo */
  brand?: string | null;
  /** 标题两侧细金线 */
  rule?: boolean;
  /**
   * 内容区宽度上限（px）。
   * 文字栏目用默认 1080；像邮票册这种"整张画按视口高度自适应收缩"的页面传 null，
   * 让它继续由画面自己的 max-width 公式决定大小，布局不插手。
   */
  maxWidth?: number | null;
  /** 内容区不再额外留内距：整屏画一类的页面自己带排版，多一档就会挤小画面 */
  flush?: boolean;
  /** 视觉变体：default 为全站深青航海底；collage 为两种编辑器共用的暖色地图桌面。 */
  variant?: 'default' | 'collage';
  children: ReactNode;
}

/**
 * 内页公共布局（V1-03）：背景纹理 + 顶栏 + 内容区。
 *
 * 背景 src/assets/inner-bg-map.jpg 是生成时裁掉顶部装饰带的**纯地图纹理**，
 * 画里不再带任何文字或按钮，顶栏三件套全部由这里的 DOM 绘制，
 * 所以不会出现"图片一套、网页一套"的重叠，返回按钮也是真的 <a>。
 *
 * 页面自己的 <h1> 留在 children 里，这里不抢标题层级。
 */
export function InnerPageLayout({
  back = null,
  brand = 'Travel Atlas Book',
  rule = true,
  maxWidth = 1080,
  flush = false,
  variant = 'default',
  children,
}: InnerPageLayoutProps) {
  const isCollage = variant === 'collage';
  return (
    <div className={isCollage ? `${styles.page} ${styles.pageCollage}` : styles.page}>
      <div className={isCollage ? `${styles.bg} ${styles.bgCollage}` : styles.bg} aria-hidden="true" />

      <header className={isCollage ? `${styles.header} ${styles.headerCollage}` : styles.header}>
        {isCollage ? (
          <svg className={styles.collageHeaderLeft} viewBox="0 0 180 64" aria-hidden="true">
            <circle cx="10" cy="30" r="24" />
            <circle cx="10" cy="30" r="18" strokeDasharray="2 3" />
            <path d="M10 4v52M-14 30h48M-7 13l34 34M27 13L-7 47" />
            <path d="M50 48l26-28 18 19 14-14 26 23z" className={styles.collageMountain} />
          </svg>
        ) : null}

        {back ? (
          <Link className={styles.back} to={back.to}>
            <svg className={styles.backArrow} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12H4.5" />
              <path d="M10.5 6 4.5 12l6 6" />
            </svg>
            <span>{back.label}</span>
          </Link>
        ) : null}

        <div className={styles.brand}>
          {rule ? <span className={styles.rule} aria-hidden="true" /> : null}
          <svg className={styles.emblem} viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="13" />
            <path d="M3 16h26" />
            <path d="M16 3c5.2 5.4 5.2 22.6 0 26M16 3c-5.2 5.4-5.2 22.6 0 26" />
            <path d="M8.4 7.2c4.6 2.5 10.6 2.5 15.2 0M8.4 24.8c4.6-2.5 10.6-2.5 15.2 0" />
          </svg>
          {brand ? <span className={styles.wordmark}>{brand}</span> : null}
          {isCollage ? (
            <svg className={styles.collagePostmarkWaves} viewBox="0 0 64 26" aria-hidden="true">
              <path d="M2 5c8-3 14 3 22 0s14 3 22 0 10 2 16 0" />
              <path d="M2 11c8-3 14 3 22 0s14 3 22 0 10 2 16 0" />
              <path d="M2 17c8-3 14 3 22 0s14 3 22 0 10 2 16 0" />
              <path d="M2 23c8-3 14 3 22 0s14 3 22 0 10 2 16 0" />
            </svg>
          ) : null}
          {rule ? <span className={`${styles.rule} ${styles.ruleRight}`} aria-hidden="true" /> : null}
        </div>

        {isCollage ? (
          <svg className={styles.collageHeaderRight} viewBox="0 0 220 56" aria-hidden="true">
            <path d="M8 46h92" />
            <path d="M16 44l10-12h24l8 12z" />
            <path d="M36 10v22M24 30l12-18 12 18zM38 14l14 14-14 2z" />
            <path d="M74 44l4-26h10l4 26zM75 18l8-7 8 7z" />
            <path d="M83 11l14-4M83 11l14 4" strokeDasharray="2 2" />
            <g transform="translate(152 6) rotate(7)">
              <rect x="0" y="0" width="44" height="44" rx="2" strokeDasharray="3 2" />
              <rect x="5" y="5" width="34" height="34" rx="1" />
              <path d="M22 12v19M17 17h10M15 26c0 4 3 6 7 6s7-2 7-6" />
              <circle cx="22" cy="11" r="2.2" />
            </g>
          </svg>
        ) : null}
      </header>

      <div className={flush ? `${styles.content} ${styles.contentFlush}` : styles.content} style={maxWidth ? { maxWidth } : undefined}>
        {children}
      </div>
    </div>
  );
}
