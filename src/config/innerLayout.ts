/**
 * V1-03 内页视觉规范的唯一出处。
 *
 * 这里只放"页面要消费的东西"：返回按钮的类型与目标、以及已接入统一布局的路径白名单。
 * 背景尺寸、颜色、顶栏尺度写在 InnerPageLayout.module.css 里，并在注释里标注它们是从
 * assets-source/inner-bg-map.png 上量出来的，改图时照着改数值即可。
 */
import { matchPath } from 'react-router-dom';
import { PLAN_MAP_PATH } from './planRoutes';
import { bookPath, stampBookPath, STAMP_BOOK_PATH } from './routes';

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
 * | 城市门户 | 定位该城市的邮票册 | 返回邮票收藏册 |
 * | 栏目页 | 地球探索 | 返回地球探索 |
 * | 创作模式选择页 | 邮票收藏册 | 返回邮票收藏册 |
 * | Journal 横线日记本 / Collage 自由拼贴 | 创作模式选择页 | 返回创作模式 |
 *
 * 收藏册可以带 cityId 复原城市书架位置，创作模式页必须带真实 bookId。
 */
export const backTargets: Record<'globe' | 'journals' | 'plans', BackTarget> = {
  globe: { label: '返回地球探索', to: '/' },
  journals: { label: '返回旅行手账', to: STAMP_BOOK_PATH },
  plans: { label: '返回旅行计划', to: PLAN_MAP_PATH },
};

/** 创作模式页、Journal、Collage 回到收藏册；带 cityId 时保留城市定位。 */
export function albumBack(cityId?: string): BackTarget {
  return { label: '返回邮票收藏册', to: stampBookPath(cityId) };
}

/** 编辑器回到自己那本书的创作模式选择页；地址由 V1-02 冻结的路径助手拼。 */
export function createModeBack(bookId: string): BackTarget {
  return { label: '返回创作模式', to: bookPath(bookId) };
}

/**
 * 已接入 InnerPageLayout 的路径白名单（写法同路由表，:xxx 是参数占位）。
 *
 * App.tsx 的 Shell 据此决定要不要挂全局 SiteHeader：接进来的页面自己就带顶栏，
 * 再挂一条就是两套标题、两个返回入口。页面本身也用同一份名单判断要不要套布局，
 * 所以"隐藏旧导航"和"启用新导航"永远一起生效，不会出现两边不一致的空档。
 * 逐页接入就加一行；没列出的页面完全维持原状，这样"统一背景"是一页一页验收出来的，不是一次性全站替换。
 * 首页 '/' 永远不在名单里：它用的是参考画本身的舞台，画上的缎带就是它的导航。
 *
 * 邮票册、手账、计划页与 /stamps 别名也套同一套背景和顶栏。
 */
const innerLayoutRoutes: string[] = [
  '/section/journals',
  '/section/inspiration',
  '/section/plans',
  '/section/account',
  '/city/:cityId',
  '/book/:bookId',
  '/stamps',
  '/plan/city/:cityId',
  '/plan/new',
  '/plan/:planId',
];

/** 当前路径是否已接入公共内页布局。 */
export function usesInnerLayout(pathname: string): boolean {
  return innerLayoutRoutes.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null);
}
