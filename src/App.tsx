import { Outlet, RouterProvider, createHashRouter, useLocation, type RouteObject } from 'react-router-dom';
import { SiteHeader } from './components/layout/SiteHeader';
import { heroLayoutQuery, heroLayoutSupported } from './config/hero';
import { usesInnerLayout } from './config/innerLayout';
import { BOOK_ROUTE_SEGMENT } from './config/routes';
import { BookPage } from './pages/BookPage';
import { CityPage } from './pages/CityPage';
import { HomePage } from './pages/HomePage';
import { SectionPage } from './pages/SectionPage';
import { StampBookPage, StampsAliasPage } from './pages/StampBookPage';
import { CityPlanPage } from './pages/plans/CityPlanPage';
import { PlanDetailPage } from './pages/plans/PlanDetailPage';
import { PlanNewPage } from './pages/plans/PlanNewPage';
import { WishMapPage } from './pages/plans/WishMapPage';
import { useMediaQuery } from './hooks/useMediaQuery';
import styles from './App.module.css';

/**
 * 首页用参考图舞台时不挂顶部导航 —— 画上的缎带就是导航，再来一条就是重复导航；
 * 舞台放不下而退回竖版布局时，导航得回来，所以判断条件和 HomePage 用同一个查询。
 *
 * 接入了 InnerPageLayout 的页面（config/innerLayout.ts 的白名单）自己就带公共顶栏，
 * 再挂 SiteHeader 会出现两套标题和两个返回入口，所以同样跳过。
 * 判断查的是 innerLayout.ts 里那份白名单，页面自己查的是同一份，两边不会走偏。
 */
function Shell() {
  const { pathname } = useLocation();
  const artViewport = useMediaQuery(heroLayoutQuery);
  const paintedRibbon = pathname === '/' && artViewport && heroLayoutSupported;
  const ownHeader = usesInnerLayout(pathname);
  return (
    <div className={pathname === '/' ? `${styles.shell} ${styles.home}` : styles.shell}>
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
 */
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      // 邮票册与愿望地图使用各自的页面，动态栏目承接其余入口。
      { path: 'section/journals', element: <StampBookPage /> },
      { path: 'section/plans', element: <WishMapPage /> },
      { path: 'section/:sectionId', element: <SectionPage /> },
      { path: 'city/:cityId', element: <CityPage /> },
      { path: BOOK_ROUTE_SEGMENT, element: <BookPage /> },
      { path: 'stamps', element: <StampsAliasPage /> },
      { path: 'plan/new', element: <PlanNewPage /> },
      { path: 'plan/city/:cityId', element: <CityPlanPage /> },
      { path: 'plan/:planId', element: <PlanDetailPage /> },
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
