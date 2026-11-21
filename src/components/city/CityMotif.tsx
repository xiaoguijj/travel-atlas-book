import type { CoverMotif as MotifKind } from '../../data/types';
import styles from './CityMotif.module.css';

export interface CityMotifProps {
  motif: MotifKind;
  className?: string;
  /** 邮票等小尺寸场景可以去掉装饰性的太阳与飞鸟 */
  minimal?: boolean;
}

/**
 * 城市地标剪影：全部是手写的 SVG path，没有外部图片，颜色走主题变量。
 * 未来加城市时，只要在这里补一个 motif 分支（或在主题里注册新的图形）。
 */
export function CityMotif({ motif, className, minimal = false }: CityMotifProps) {
  return (
    <svg
      className={className ? `${styles.motif} ${className}` : styles.motif}
      viewBox="0 0 240 132"
      role="img"
      aria-label={ariaLabel(motif)}
      preserveAspectRatio="xMidYMax meet"
    >
      {!minimal && <circle className={styles.sun} cx="188" cy="34" r="17" />}
      {!minimal && (
        <g className={styles.birds}>
          <path d="M40 30 q5 -5 10 0 q5 -5 10 0" />
          <path d="M66 44 q4 -4 8 0 q4 -4 8 0" />
        </g>
      )}
      {motif === 'city-gate' && <CityGate />}
      {motif === 'pearl-tower' && <PearlTower />}
      {motif === 'hall-of-prayer' && <HallOfPrayer />}
      <path className={styles.ground} d="M6 126 H234" />
    </svg>
  );
}

/** 南京：城墙、城门与远山上的小塔 */
function CityGate() {
  return (
    <g>
      <path className={styles.hill} d="M6 126 q40 -46 92 -4" />
      <g className={styles.silhouette}>
        <path d="M112 122 v-30 h7 v30 z M112 96 h7 v-6 h-7 z M108 104 h15 v-5 h-15 z M110 114 h11 v-5 h-11 z" />
        <path d="M22 126 v-40 h196 v40 z" />
      </g>
      {/* 雉堞 */}
      <g className={styles.silhouette}>
        {[22, 44, 66, 88, 132, 154, 176, 198].map((x) => (
          <rect key={x} x={x} y={80} width={12} height={8} />
        ))}
      </g>
      <path className={styles.pavilion} d="M96 86 h48 l-8 -12 h-32 z M104 74 h32 l-6 -10 h-20 z" />
      <path className={styles.opening} d="M108 126 v-22 a12 12 0 0 1 24 0 v22 z" />
    </g>
  );
}

/** 上海：明珠塔与江对岸的楼群 */
function PearlTower() {
  return (
    <g>
      <g className={styles.silhouette}>
        <path d="M86 126 l4 -46 h6 l4 46 z" />
        <rect x="93" y="52" width="5" height="70" />
        <circle cx="95.5" cy="52" r="12" />
        <rect x="93.5" y="24" width="4" height="20" />
        <circle cx="95.5" cy="26" r="7" />
        <path d="M94 12 h3 l-1.5 -10 z" />
      </g>
      <g className={styles.silhouette}>
        <rect x="130" y="74" width="20" height="52" />
        <path d="M156 126 v-62 h20 v62 z" />
        <path d="M156 64 l10 -10 l10 10 z" />
        <rect x="182" y="88" width="16" height="38" />
        <path d="M204 126 v-48 q9 -6 18 0 v48 z" />
      </g>
      <path className={styles.windowRow} d="M160 76 h12 M160 86 h12 M160 96 h12 M160 106 h12" />
    </g>
  );
}

/** 北京：祈年殿的三重檐与台基 */
function HallOfPrayer() {
  return (
    <g className={styles.silhouette}>
      <path d="M118 20 a4 4 0 1 1 0 8 v6 h-2 v-6 z" />
      <path d="M84 58 q34 -18 68 0 l-6 -8 q-28 -14 -56 0 z" />
      <path d="M74 84 q44 -22 88 0 l-8 -12 q-36 -18 -72 0 z" />
      <path d="M62 110 q58 -26 116 0 l-10 -14 q-48 -22 -96 0 z" />
      <rect x="96" y="58" width="44" height="10" />
      <rect x="88" y="84" width="60" height="12" />
      <path d="M48 110 h144 v8 h-144 z M40 118 h160 v8 h-160 z" />
    </g>
  );
}

function ariaLabel(motif: MotifKind): string {
  switch (motif) {
    case 'city-gate':
      return '南京：明城墙与城楼剪影';
    case 'pearl-tower':
      return '上海：明珠塔与外滩楼群剪影';
    case 'hall-of-prayer':
      return '北京：祈年殿三重檐剪影';
  }
}
