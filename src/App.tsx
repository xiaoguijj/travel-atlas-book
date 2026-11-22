import { Outlet, RouterProvider, createHashRouter, useLocation, type RouteObject } from 'react-router-dom';
import { SiteHeader } from './components/layout/SiteHeader';
import { heroLayoutQuery, heroLayoutSupported } from './config/hero';
import { hidesSiteHeader } from './config/innerLayout';
import { BookRoutePage } from './pages/BookRoutePage';
import { CityPage } from './pages/CityPage';
import { HomePage } from './pages/HomePage';
import { SectionPage } from './pages/SectionPage';
import { StampBookPage } from './pages/StampBookPage';
import { useMediaQuery } from './hooks/useMediaQuery';
import styles from './App.module.css';

/**
 * 首页用参考图舞台时不挂顶部导航 —— 画上的缎带就是导航，再来一条就是重复导航；
 * 舞台放不下而退回竖版布局时，导航得回来，所以判断条件和 HomePage 用同一个查询。
 *
 * 自己就带一条导航的页面同样要跳过 SiteHeader，否则会出现两套标题和两个返回入口。
 * 这类页面有两种：接了 InnerPageLayout 公共顶栏的，和整张画自己在 DOM 里重画了
 * 标题与返回胶囊的（创作模式选择页）。两种都问 config/innerLayout.ts 的 hidesSiteHeader，
 * 页面自己判断要不要套布局查的是同一份名单，两边不会走偏。
 */
function Shell() {
  const { pathname } = useLocation();
  const artViewport = useMediaQuery(heroLayoutQuery);
  const paintedRibbon = pathname === '/' && artViewport && heroLayoutSupported;
  const ownHeader = hidesSiteHeader(pathname);
  return (
    <div className={styles.shell}>
      {paintedRibbon || ownHeader ? null : <SiteHeader />}
      <main>
        <Outlet />
      </main>
    </div>
  );
}

/**
 * 路由用 hash 形式（/#/city/nanjing），静态托管不需要任何服务端 rewrite；
 * 以后部署环境支持 SPA fallback 时，把 createHashRouter 换成 createBrowserRouter 就行。
 *
 * `section/journals` 排在 `section/:sectionId` 前面：react-router 按静态段优先于动态段匹配，
 * 首页「旅行手账」缎带落的是邮票收藏册（V1-06），另外三个栏目仍由 SectionPage 说明进度。
 * `book/:bookId` 用 V1-02 冻结的 BOOK_ROUTE_PATH，临时由 BookRoutePage 接线，
 * V1-05 的公共手账壳合进来后只把这一行的 element 换成 <BookPage />。
 */
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'section/journals', element: <StampBookPage /> },
      { path: 'section/:sectionId', element: <SectionPage /> },
      { path: 'city/:cityId', element: <CityPage /> },
      { path: 'book/:bookId', element: <BookRoutePage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
];

// 本项目没有 loader / action / fetcher，这些 v7 行为开关只是提前对齐，
// 顺便让 react-router 不在控制台打印迁移提示。
const router = createHashRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});

export function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
