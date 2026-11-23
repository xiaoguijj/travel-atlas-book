/**
 * 手账流程各页的版面坐标（源图见 docs/v1/design/assets.md）。
 *
 * 和首页一样，这几页也是「整张画 + 叠在画上的真控件」：邮票、卡片和横线都画在图里，
 * 所以热区必须用源图像素量出来，渲染时换算成百分比或容器查询单位，
 * 任何屏幕尺寸下都能和画上的元素对齐。
 *
 * 邮票框量在齿孔内侧：热区压在齿孔上会把相邻的邮票也圈进来，
 * 齿孔本身只是装饰，能点的是整张邮票的票面。
 */

export interface ArtBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const albumArt = { width: 1536, height: 1024 } as const;

/**
 * 六枚邮票在画上的热区，顺序与画面从左到右、从上到下一致，键是 cityId。
 *
 * 坐标和「哪座城市」分开存：城市与邮票定义来自 V1-02 冻结的静态目录
 * （`src/data/catalog/stamps.ts`），这里只补「它在画上的哪一块」。
 * 目录里多出一枚却忘了量坐标，收藏册会跳过它并给出可读的缺口，不会画出一个错位的热区。
 */
export const albumStampBoxes: Record<string, ArtBox> = {
  nanjing: { x: 196, y: 208, w: 342, h: 296 },
  shanghai: { x: 592, y: 208, w: 346, h: 296 },
  xian: { x: 996, y: 208, w: 350, h: 296 },
  beijing: { x: 196, y: 522, w: 342, h: 316 },
  hangzhou: { x: 592, y: 522, w: 346, h: 316 },
  chengdu: { x: 996, y: 522, w: 350, h: 316 },
};

/**
 * 创作方式选择页（assets-source/create-mode.png 1448×1086）的热区。
 *
 * 两张卡片按「离背景色多远」量出来：卡片内部明暗变化大，用亮度阈值会把纹理也算进去，
 * 所以改用与深蓝底色的曼哈顿距离判边界，四条边各自稳定在同一列/行上。
 *
 * 画上的「当前城市：Peru 秘鲁」是画死的，但它必须随点的邮票变，
 * 所以 cityPill 那一块用真实 DOM 整只重画（描边、图钉、文字都在 DOM 里），
 * 覆盖范围取黄铜描边的外缘，比文字本身大一圈，免得露出半个旧城市名。
 */
export const createModeArt = { width: 1448, height: 1086 } as const;

export const createModeZones = {
  /** 左上「← 返回邮票收藏册」描边胶囊，用真 DOM 胶囊整只盖掉重画 */
  backPill: { x: 32, y: 24, w: 225, h: 41 },
  /** 右上「当前城市」描边胶囊，整只盖掉重画 */
  cityPill: { x: 1155, y: 23, w: 265, h: 42 },
  /** 左卡：Journal 横线日记本 */
  journalCard: { x: 42, y: 261, w: 664, h: 778 },
  /** 右卡：Collage 自由拼贴 */
  collageCard: { x: 728, y: 261, w: 679, h: 780 },
} as const;

/** 胶囊周围那块深蓝底色，DOM 重画时用它垫底 */
export const createModePillBg = '#173132';

/** 源图坐标 → 舞台内的百分比定位 */
export function artBoxStyle(art: { width: number; height: number }, box: ArtBox) {
  return {
    left: `${((100 * box.x) / art.width).toFixed(3)}%`,
    top: `${((100 * box.y) / art.height).toFixed(3)}%`,
    width: `${((100 * box.w) / art.width).toFixed(3)}%`,
    height: `${((100 * box.h) / art.height).toFixed(3)}%`,
  };
}

/**
 * 源图长度 → 容器查询单位（cqw）。
 * 舞台按源图等比缩放，所以 1cqw 恒等于源图的 1% 宽度，字号和行高这样换算才不会跑偏。
 */
export function artCqw(art: { width: number }, px: number): string {
  return `${((100 * px) / art.width).toFixed(3)}cqw`;
}
