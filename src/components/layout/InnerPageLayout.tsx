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
  children,
}: InnerPageLayoutProps) {
  return (
    <div className={styles.page}>
      <div className={styles.bg} aria-hidden="true" />

      <header className={styles.header}>
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
          {rule ? <span className={`${styles.rule} ${styles.ruleRight}`} aria-hidden="true" /> : null}
        </div>
      </header>

      <div className={flush ? `${styles.content} ${styles.contentFlush}` : styles.content} style={maxWidth ? { maxWidth } : undefined}>
        {children}
      </div>
    </div>
  );
}
