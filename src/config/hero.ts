/**
 * 首页版面：参考图（assets-source/home-hero.png，1671×941）上各个区域的坐标。
 *
 * 这些数字是量出来的，不是估的：
 * - 地球圆孔：沿 360 条射线找金色高光带，对中点做最小二乘圆拟合，
 *   得到圆心 (993.5, 461.5)、半径 282.5，外缘约 292（中位残差 2.6px）；
 * - 导航、铭牌、明信片：按列像素统计出文字/边框的起止位置，再用带网格的裁图核对。
 *
 * 全部用源图像素表示，渲染时换算成百分比，舞台按 1671/941 等比缩放，
 * 所以任何尺寸下热区和画面元素都对得上。
 */

export const heroArt = { width: 1671, height: 941 } as const;

export interface HeroBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const heroGlobe = {
  centerX: 993.5,
  centerY: 461.5,
  /** 画里那个静态地球被挖掉的半径（含高光带外缘） */
  holeRadius: 292,
  /** 3D 球体的屏幕半径，比孔略大一点，边缘被画盖住，看不出两个圆 */
  liveRadius: 300,
  /** WebGL 容器的位置：正方形，边长 741，球体占其中 600，缩放时两边都留余量 */
  stage: { x: 623, y: 91, size: 741 },
} as const;

/** 交给地球场景的取景参数：球体直径 / 容器短边 */
export const heroGlobeFill = (heroGlobe.liveRadius * 2) / heroGlobe.stage.size;

const cqw = (px: number) => ((100 * px) / heroArt.width).toFixed(3);

/** 背景画上的透明圆孔 */
export const heroArtMask = `radial-gradient(circle at ${((100 * heroGlobe.centerX) / heroArt.width).toFixed(3)}% ${((
  100 *
  heroGlobe.centerY) /
  heroArt.height).toFixed(3)}%, transparent 0 ${cqw(heroGlobe.holeRadius)}cqw, #000 ${cqw(heroGlobe.holeRadius + 1.5)}cqw)`;

/** 标记层用同一个孔裁剪：放大地球时，转到边缘的图钉不会飘到纸上 */
export const heroPinMask = `radial-gradient(circle at 50% 50%, transparent 0 ${cqw(heroGlobe.holeRadius)}cqw, #000 ${cqw(
  heroGlobe.holeRadius + 1.5,
)}cqw)`;

export interface HeroNavItem extends HeroBox {
  id: string;
  label: string;
  to: string;
}

/** 顶部缎带上的五个入口，全部指向真实路由 */
export const heroNav: HeroNavItem[] = [
  { id: 'home', label: '首页', to: '/', x: 890, y: 6, w: 110, h: 64 },
  { id: 'journals', label: '旅行手账', to: '/section/journals', x: 1020, y: 6, w: 148, h: 64 },
  { id: 'inspiration', label: '灵感发现', to: '/section/inspiration', x: 1185, y: 6, w: 149, h: 64 },
  { id: 'plans', label: '旅行计划', to: '/section/plans', x: 1348, y: 6, w: 148, h: 64 },
  { id: 'account', label: '我的', to: '/section/account', x: 1515, y: 6, w: 107, h: 64 },
];

/** 「开始探索 →」那块皮铭牌 */
export const heroExploreBox: HeroBox = { x: 295, y: 563, w: 345, h: 100 };

/**
 * 圆孔底下垫一层纸色圆盘。
 * 地球缩到比孔小的时候，孔里露出的应该是画周围的纸，而不是页面深处的午夜蓝。
 */
export const heroGlobeBedBox: HeroBox = {
  x: heroGlobe.centerX - heroGlobe.holeRadius,
  y: heroGlobe.centerY - heroGlobe.holeRadius,
  w: heroGlobe.holeRadius * 2,
  h: heroGlobe.holeRadius * 2,
};

/** 右侧三张明信片，按画里从上到下的顺序对应城市数据 */
export const heroCardBoxes: (HeroBox & { cityId: string })[] = [
  { cityId: 'nanjing', x: 1322, y: 228, w: 278, h: 160 },
  { cityId: 'shanghai', x: 1305, y: 393, w: 287, h: 165 },
  { cityId: 'beijing', x: 1278, y: 570, w: 307, h: 175 },
];

/** 把源图坐标换成舞台内的百分比定位 */
export function heroBoxStyle(box: HeroBox): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${((100 * box.x) / heroArt.width).toFixed(3)}%`,
    top: `${((100 * box.y) / heroArt.height).toFixed(3)}%`,
    width: `${((100 * box.w) / heroArt.width).toFixed(3)}%`,
    height: `${((100 * box.h) / heroArt.height).toFixed(3)}%`,
  };
}

/** 地球容器：位置尺寸都按源图坐标换算（舞台是正方形，边长 size） */
export const heroGlobeStageStyle = heroBoxStyle({
  x: heroGlobe.stage.x,
  y: heroGlobe.stage.y,
  w: heroGlobe.stage.size,
  h: heroGlobe.stage.size,
});

/** 画面里地球所在的区域已经足够说明玩法，窄到放不下才换成竖版布局 */
export const heroLayoutQuery = '(min-width: 760px) and (min-height: 430px)';

/**
 * 参考图布局靠 CSS mask 在画上挖孔，容器查询单位（cqw）是它的前提。
 * 不支持就退回竖版布局——宁可换一种排法，也不能让画把整个地球盖住。
 */
export const heroLayoutSupported =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('mask-image', 'radial-gradient(circle, transparent 0 10cqw, #000 11cqw)');
