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
      {motif === 'wild-goose-pagoda' && <WildGoosePagoda />}
      {motif === 'hall-of-prayer' && <HallOfPrayer />}
      {motif === 'lake-bridge' && <LakeBridge />}
      {motif === 'alley-lanterns' && <AlleyLanterns />}
      {motif === 'elizabeth-tower' && <ElizabethTower />}
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

/** 伦敦：伊丽莎白塔与威斯敏斯特宫 */
function ElizabethTower() {
  return (
    <g>
      <path
        className={styles.silhouette}
        d="M14 126 V96 h8 v-9 l5 -9 5 9 v9 h22 V80 h7 v-8 l5 -9 5 9 v8 h24 v46 Z
           M86 126 V51 h-4 l8 -11 14 -26 3 -14 3 14 14 26 8 11 h-4 v75 Z
           M120 126 V87 h13 V76 l5 -12 5 12 v11 h18 V75 l5 -10 5 10 v12 h18
           V79 l5 -10 5 10 v8 h17 v39 Z"
      />
      <circle className={styles.opening} cx="107" cy="62" r="10" />
      <path className={styles.windowRow} d="M107 55 v7 l4 2 M96 83 h22 M96 93 h22 M96 104 h22 M96 115 h22 M29 105 h44 M138 97 h62 M138 107 h62" />
    </g>
  );
}

/** 西安：城墙上的大雁塔，逐层收窄的方形砖塔 */
function WildGoosePagoda() {
  return (
    <g>
      <path className={styles.hill} d="M6 126 q34 -30 68 -6" />
      <g className={styles.silhouette}>
        <path d="M18 126 v-22 h204 v22 z" />
        {[18, 40, 62, 178, 200].map((x) => (
          <rect key={x} x={x} y={98} width={12} height={8} />
        ))}
      </g>
      <g className={styles.silhouette}>
        {Array.from({ length: 7 }, (_, i) => {
          const w = 60 - i * 7;
          const y = 96 - i * 11;
          return (
            <g key={i}>
              <rect x={120 - w / 2} y={y - 9} width={w} height={9} />
              <rect x={120 - (w - 12) / 2} y={y} width={w - 12} height={4} />
            </g>
          );
        })}
        <rect x={118} y={14} width={4} height={10} />
      </g>
      <path className={styles.opening} d="M108 126 v-14 a12 12 0 0 1 24 0 v14 z" />
      <path className={styles.windowRow} d="M104 84 h32 M108 62 h24 M110 40 h20" />
    </g>
  );
}

/** 杭州：西湖的拱桥、湖心亭与垂柳 */
function LakeBridge() {
  return (
    <g>
      <g className={styles.hill}>
        <path d="M22 18 q16 30 8 62" />
        <path d="M34 14 q22 26 16 54" />
        <path d="M46 16 q18 22 14 44" />
      </g>
      <g className={styles.silhouette}>
        <path d="M52 126 v-16 q44 -34 88 0 v16 h-14 q-30 -24 -60 0 z" />
      </g>
      <path className={styles.opening} d="M78 126 q26 -22 52 0 z" />
      <g className={styles.silhouette}>
        <rect x="176" y="98" width="4" height="28" />
        <rect x="206" y="98" width="4" height="28" />
      </g>
      <path className={styles.pavilion} d="M168 100 h48 l-10 -14 h-28 z M176 86 h32 l-8 -10 h-16 z" />
      <path className={styles.windowRow} d="M180 112 h26 M6 118 h40" />
    </g>
  );
}

/** 成都：巷子门楼、红灯笼与竹子 */
function AlleyLanterns() {
  return (
    <g>
      <g className={styles.hill}>
        <path d="M18 126 v-72 M30 126 v-64 M42 126 v-78" />
        <path d="M18 62 q10 -8 22 -4 M30 78 q12 -8 24 -2" />
      </g>
      <g className={styles.silhouette}>
        <path d="M64 126 v-52 h156 v52 z" />
        <path d="M56 74 h172 l-14 -14 h-144 z" />
      </g>
      <path className={styles.pavilion} d="M60 62 h164 v-6 h-164 z" />
      <path className={styles.opening} d="M126 126 v-30 a16 16 0 0 1 32 0 v30 z" />
      <g className={styles.pavilion}>
        {[86, 108, 178].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={92} rx={7} ry={9} />
            <rect x={x - 3} y={80} width={6} height={3} />
            <rect x={x - 3} y={101} width={6} height={3} />
          </g>
        ))}
      </g>
    </g>
  );
}

function ariaLabel(motif: MotifKind): string {
  switch (motif) {
    case 'city-gate':
      return '南京：明城墙与城楼剪影';
    case 'pearl-tower':
      return '上海：明珠塔与外滩楼群剪影';
    case 'wild-goose-pagoda':
      return '西安：城墙上的大雁塔剪影';
    case 'hall-of-prayer':
      return '北京：祈年殿三重檐剪影';
    case 'lake-bridge':
      return '杭州：西湖拱桥与湖心亭剪影';
    case 'alley-lanterns':
      return '成都：巷子门楼与红灯笼剪影';
    case 'elizabeth-tower':
      return '伦敦：伊丽莎白塔与威斯敏斯特宫剪影';
  }
}
