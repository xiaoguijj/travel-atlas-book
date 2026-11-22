/**
 * V1-03 内页视觉规范的唯一出处。
 *
 * 这里只放"页面要消费的东西"：返回按钮的类型与目标、以及已接入统一布局的路径白名单。
 * 背景尺寸、颜色、顶栏尺度写在 InnerPageLayout.module.css 里，并在注释里标注它们是从
 * assets-source/inner-bg-map.png 上量出来的，改图时照着改数值即可。
 */
import { matchPath } from 'react-router-dom';
import { bookPath, BOOK_ROUTE_PATH } from './routes';

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
 * 后两行在 V1-06 / V1-07 接入邮票册与横线日记本后落成下面这两个构造函数：它们的落点带参数
 * （收藏册要记住是哪座城、创作模式要记住是哪本书），所以不做成写死的常量。
 * 城市页的返回目标以后要按进入来源在「地球探索」和「邮票收藏册」之间切换，
 * 判来源用 Link 的 state，不靠浏览器历史，这样直接输网址也有落点；那一步归 V1-10 的导航联动。
 */
export const backTargets: Record<'globe' | 'journals' | 'plans', BackTarget> = {
  globe: { label: '返回地球探索', to: '/' },
  journals: { label: '返回旅行手账', to: '/section/journals' },
  plans: { label: '返回旅行计划', to: '/section/plans' },
};

/** 创作模式选择页、Journal、Collage 回到收藏册；带上 cityId 就顺手把那座的书架复原。 */
export function albumBack(cityId?: string): BackTarget {
  const to = backTargets.journals.to;
  return {
    label: '返回邮票收藏册',
    to: cityId ? `${to}?city=${encodeURIComponent(cityId)}` : to,
  };
}

/** 编辑器回到自己那本书的创作模式选择页；地址由 V1-02 冻结的路径助手拼，不在这里手搓字符串。 */
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
 * /section/journals 在 main 上原本是城市卡片书架，V1-06 起这一栏由邮票收藏册（StampBookPage）渲染，
 * 白名单这一行不用改：收藏册套的还是这套顶栏与背景，只是换了本子外围的画。
 * 另外三个栏目仍由 SectionPage 说明进度，它们查的是同一份名单。
 */
const innerLayoutRoutes: string[] = [
  '/section/journals',
  '/section/inspiration',
  '/section/plans',
  '/section/account',
  '/city/:cityId',
];

/**
 * 「整张画自己带导航」的页面：和首页一样，标题、返回胶囊都是照着参考画在 DOM 里重画的
 * （创作模式选择页就是这种画法，画上的胶囊还要盖掉重描），所以既不能套 InnerPageLayout
 * 那套顶栏——会变成两条品牌栏——也不能再挂全局 SiteHeader。
 *
 * 两条写法指的是同一个页面：BOOK_ROUTE_PATH 是路由表里的地址，bookPath(':bookId') 是
 * 页面自己拿真实 bookId 拼出来的那个地址（白名单在路由匹配之前就会被问到，那时手上只有参数位）。
 *
 * 首页 '/' 不在这里：它由 App.tsx 按视口决定要不要用舞台布局，退回竖版时 SiteHeader 得回来。
 */
const paintedArtRoutes: string[] = [BOOK_ROUTE_PATH, bookPath(':bookId')];

/** 当前路径是否已接入公共内页布局。 */
export function usesInnerLayout(pathname: string): boolean {
  return innerLayoutRoutes.some((pattern) => matches(pattern, pathname));
}

/**
 * 这一页要不要由它自己负责导航外观。App.tsx 的 Shell 只问这一个问题，
 * 于是"接了公共顶栏"和"自己画了一套"两种情况都不会再重复挂一条全局导航。
 */
export function hidesSiteHeader(pathname: string): boolean {
  return usesInnerLayout(pathname) || paintedArtRoutes.some((pattern) => matches(pattern, pathname));
}

function matches(pattern: string, pathname: string): boolean {
  return matchPath({ path: pattern, end: true }, pathname) !== null;
}
