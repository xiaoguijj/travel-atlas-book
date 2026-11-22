/**
 * V1-03 内页视觉规范的唯一出处。
 *
 * 这里只放"页面要消费的东西"：返回按钮的类型与目标、以及已接入统一布局的路径白名单。
 * 背景尺寸、颜色、顶栏尺度写在 InnerPageLayout.module.css 里，并在注释里标注它们是从
 * assets-source/inner-bg-map.png 上量出来的，改图时照着改数值即可。
 */
import { matchPath } from 'react-router-dom';

/** 返回按钮：label 说清"回到哪儿"，to 是真实存在的哈希路由。 */
export interface BackTarget {
  label: string;
  to: string;
}

/**
 * 返回目标对照表（规范约定，接入每一页时按这张表取 label，不要写通用的「返回上一步」）：
 *
 * | 页面 | 返回到 | label |
 * | --- | --- | --- |
 * | 城市页 / 栏目页 | 地球探索 | 返回地球探索 |
 * | 手账内页 | 所属栏目 | 返回旅行手账 / 返回旅行计划 |
 * | 创作模式选择页 | 邮票收藏册 | 返回邮票收藏册 |
 * | Journal 横线日记本 / Collage 自由拼贴 | 创作模式选择页 | 返回创作模式 |
 *
 * 后两行的落点（邮票收藏册、/book/:id 的模式选择页）还不在 main 上，等 V1-05 / V1-06 / V1-07
 * 的分支合进来后再往这里加常量；现在只定义这条分支上真实存在的目标，免得出现点了去不了的链接。
 * 城市页的返回目标以后要按进入来源在「地球探索」和「邮票收藏册」之间切换，
 * 判来源用 Link 的 state，不靠浏览器历史，这样直接输网址也有落点。
 */
export const backTargets: Record<'globe' | 'journals' | 'plans', BackTarget> = {
  globe: { label: '返回地球探索', to: '/' },
  journals: { label: '返回旅行手账', to: '/section/journals' },
  plans: { label: '返回旅行计划', to: '/section/plans' },
};

/**
 * 已接入 InnerPageLayout 的路径白名单（写法同路由表，:xxx 是参数占位）。
 *
 * App.tsx 的 Shell 据此决定要不要挂全局 SiteHeader：接进来的页面自己就带顶栏，
 * 再挂一条就是两套标题、两个返回入口。页面本身也用同一份名单判断要不要套布局，
 * 所以"隐藏旧导航"和"启用新导航"永远一起生效，不会出现两边不一致的空档。
 * 逐页接入就加一行；没列出的页面完全维持原状，这样"统一背景"是一页一页验收出来的，不是一次性全站替换。
 * 首页 '/' 永远不在名单里：它用的是参考画本身的舞台，画上的缎带就是它的导航。
 *
 * /section/journals 在 main 上还是城市卡片书架，这里一并接入，四个栏目才是同一套外观；
 * V1-06 的邮票收藏册（StampAlbumPage）顶替这一栏时，这条白名单不用改，
 * 收藏册只换本子外围的背景，牛皮纸本子本身不动。
 */
const innerLayoutRoutes: string[] = [
  '/section/journals',
  '/section/inspiration',
  '/section/plans',
  '/section/account',
  '/city/:cityId',
];

/** 当前路径是否已接入公共内页布局。 */
export function usesInnerLayout(pathname: string): boolean {
  return innerLayoutRoutes.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null);
}
