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

/**
 * 横线日记本（assets-source/journal-lines.png 1448×1086）的版面。
 *
 * 正文区不做分页：任务卡要的是「长文滚动」，而 V1-02 冻结的 `JournalContent` 是
 * 一本书一份 Tiptap 文档，没有「第几页」这个概念，所以超出可写行数就在区内滚动。
 */
export const journalArt = { width: 1448, height: 1086 } as const;

/**
 * 画在纸上的 "Title :" 与 "Date :" 两条填空，真控件盖在横线上。
 * 两条印刷下划线都在 y≈98（逐行亮度取极值），控件按单行居中反推基线，让字正好落在线上方。
 */
export const journalTitleBox: ArtBox = { x: 786, y: 66, w: 288, h: 40 };
export const journalDateBox: ArtBox = { x: 1236, y: 66, w: 168, h: 40 };

/**
 * 横线区：画上一共 17 条线，第一条在 y=178，间距 47.6px（逐行亮度取极值得到）。
 * 正文行高必须等于这个间距，字才正好坐在印好的线上。
 *
 * nudge 是行盒顶到基线之间的半 leading 加字体 ascent，得按浏览器的 font box
 * （ascent 0.879em + descent 0.176em）算：补 7 时首行基线落在 170.3、比第一条线高 7.7，
 * 补 12 落在 175.3，字就坐在线上。
 *
 * writable 是能写的行数，比画上的 17 条少 3：左下角的邮票和右下角的罗盘从 y≈843 就开始
 * （x 114..290 与 1240..1420），第 15 条线 843.7 已经压在邮票上，所以写作区只到第 14 条线。
 */
export const journalRules = {
  first: 178,
  step: 47.6,
  writable: 14,
  left: 142,
  right: 1362,
  nudge: 12,
} as const;

/** 正文容器从第一条线往上推一个行高，再补上基线差；高度正好是能写的那几行 */
export const journalWritingBox: ArtBox = {
  x: journalRules.left,
  y: journalRules.first - journalRules.step + journalRules.nudge,
  w: journalRules.right - journalRules.left,
  h: journalRules.step * journalRules.writable,
};

/** 正文字号：约等于行高的 55%，写满一行不会挤到下一根线 */
export const journalBodyFontPx = 26;

/**
 * 工具条与保存状态那一条：摆在最后一条印刷横线（y≈939.6）以下的空白纸边上，
 * 不去压任何一行字。左右让开画上的邮票（x 114..290）和罗盘（x 1240..1420）。
 */
export const journalToolbarBox: ArtBox = { x: 330, y: 958, w: 790, h: 56 };

/**
 * 手账页要看起来和邮票册是同一本笔记，所以本子得一样大、一样斜。
 *
 * 邮票册画框（1536×1024）里的纸面占画框宽 0.8556，顶边斜率 −0.0315（往右上翘 1.8°）；
 * 手账照片（1448×1086）的纸面占自己画框 0.8806，本身几乎是正的（0.07°）。
 * 于是手账舞台宽 = 邮票册舞台宽 × 0.8556 / 0.8806，再转同样的角度，两页的本子才对得上。
 */
export const journalFrame = {
  albumStageRatio: 0.9716,
  tiltDeg: -1.8,
} as const;

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
