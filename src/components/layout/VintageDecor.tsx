import styles from './VintageDecor.module.css';

/**
 * 复古旅行装饰：邮票、邮戳、胶卷、罗盘、航线。
 *
 * 全部是内联 SVG / CSS，不引用任何外部图片；
 * 整体 aria-hidden 且 pointer-events: none —— 纯装饰，不参与交互，也不影响读屏。
 * 小屏幕上会自动隐掉一部分，优先保证地球和文字的可读性。
 */
export function VintageDecor() {
  return (
    <div className={styles.decor} aria-hidden="true">
      <div className={`${styles.stamp} ${styles.stampSea}`}>
        <svg viewBox="0 0 64 72">
          <path d="M4 50 q10 -14 20 -2 q8 10 16 -2 q8 -12 20 2" />
          <circle cx="46" cy="16" r="7" />
          <path d="M6 60 h52" />
          <path d="M14 26 q8 -12 18 -4" />
        </svg>
        <span>PAR AVION</span>
      </div>

      <div className={`${styles.stamp} ${styles.stampLand}`}>
        <svg viewBox="0 0 64 72">
          <path d="M8 56 L24 22 L36 42 L46 28 L58 56 Z" />
          <path d="M20 56 l4 -8 l4 8" />
          <path d="M6 62 h52" />
        </svg>
        <span>VOL · I</span>
      </div>

      <svg className={styles.postmark} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="55" />
        <circle cx="60" cy="60" r="43" />
        <path d="M22 74 h76 M22 82 h60" />
        <text>
          <textPath href="#decor-postmark-arc" startOffset="10%">
            TRAVEL ATLAS BOOK
          </textPath>
        </text>
        <defs>
          <path id="decor-postmark-arc" d="M60 60 m -32 0 a 32 32 0 1 1 64 0" />
        </defs>
      </svg>

      <div className={styles.film}>
        <span className={styles.frame}>
          <i className={styles.frameSea} />
        </span>
        <span className={styles.frame}>
          <i className={styles.frameHill} />
        </span>
        <span className={styles.frame}>
          <i className={styles.frameDusk} />
        </span>
        <em>未冲洗的胶片 · 三格</em>
      </div>

      <svg className={styles.compass} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" />
        <circle cx="50" cy="50" r="30" />
        <path d="M50 6 L57 44 L50 50 L43 44 Z" />
        <path d="M50 94 L43 56 L50 50 L57 56 Z" />
        <path d="M6 50 L44 43 L50 50 L44 57 Z" />
        <path d="M94 50 L56 57 L50 50 L56 43 Z" />
        <text x="50" y="14" textAnchor="middle">
          N
        </text>
      </svg>

      <svg className={styles.route} viewBox="0 0 260 120">
        <path d="M6 106 C 80 12, 180 12, 254 88" />
        <circle cx="6" cy="106" r="4" />
        <circle cx="254" cy="88" r="4" />
        <path d="M128 22 l16 6 l-16 6 l4 -12 z" />
      </svg>

      <span className={styles.tape} />
    </div>
  );
}
