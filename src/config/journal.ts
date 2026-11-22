/**
 * 手账两页版面的坐标（assets-source/stamp-album.png 1536×1024、journal-lines.png 1448×1086）。
 *
 * 和首页一样，这两页也是"整张画 + 叠在画上的真控件"：邮票和横线都在画里，
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
export const journalArt = { width: 1448, height: 1086 } as const;

/** 六枚邮票的热区，顺序与画面上从左到右、从上到下一致 */
export const albumStamps: (ArtBox & { cityId: string })[] = [
  { cityId: 'nanjing', x: 196, y: 208, w: 342, h: 296 },
  { cityId: 'shanghai', x: 592, y: 208, w: 346, h: 296 },
  { cityId: 'xian', x: 996, y: 208, w: 350, h: 296 },
  { cityId: 'beijing', x: 196, y: 522, w: 342, h: 316 },
  { cityId: 'hangzhou', x: 592, y: 522, w: 346, h: 316 },
  { cityId: 'chengdu', x: 996, y: 522, w: 350, h: 316 },
];

/**
 * 画在纸上的 "Title :" 与 "Date :" 两条填空，真输入框盖在横线上。
 * 两条印刷下划线都在 y≈98（逐行亮度取极值），输入框按单行居中反推基线，
 * 让打出来的字正好落在线上方 5px 左右。
 */
export const journalTitleBox: ArtBox = { x: 786, y: 66, w: 288, h: 40 };
export const journalDateBox: ArtBox = { x: 1236, y: 66, w: 168, h: 40 };

/**
 * 横线区：画上一共 17 条线，第一条在 y=178，间距 47.6px（逐行亮度取极值得到）。
 * 正文的行高必须等于这个间距，字才正好坐在印好的线上。
 *
 * nudge 是行盒顶到基线之间的半 leading + 字体 ascent。这个差必须按浏览器的
 * font box（ascent 0.879em + descent 0.176em）算，按字形 ink box 估会补少 5px 左右，
 * 实测补 7 时首行基线落在 170.3、比第一条线高 7.7；补 12 落在 175.3，字就坐在线上。
 *
 * writable 是能写字的行数，比画上的 17 条少 3：左下角的邮票和右下角的罗盘从 y≈843
 * 就开始（x 114..290 与 1240..1420），第 15 条线 843.7 已经压在邮票上，
 * 所以写作区只到第 14 条线 795.4，写满就翻页，不让字叠进画好的图案里。
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

/**
 * 手账页要看起来和邮票册是同一本笔记，所以本子得一样大、一样斜。
 *
 * 邮票册画框（1536×1024）里的纸面：左右边用"连续 45px 都亮"的阈值量到 x=106 与 x=1338，
 * 占画框宽 0.8556；顶边斜率 -0.0315，也就是往右上翘 1.8°（照片带点透视，一条 rotate 只能取平均）。
 * 手账页那张照片（1448×1086）的纸面占自己画框 0.8806（x=86..1354），本身几乎是正的（0.07°）。
 * 于是手账舞台宽 = 邮票册舞台宽 × 0.8556 / 0.8806，再转同样的角度，两页的本子才对得上。
 */
export const journalFrame = {
  albumStageRatio: 0.9716,
  tiltDeg: -1.8,
} as const;

/** 正文字号：约等于行高的 55%，写满一行不会挤到下一根线 */
export const journalBodyFontPx = 26;

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
