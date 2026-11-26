import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { InnerPageLayout } from '../../components/layout/InnerPageLayout';
import { WishEditor } from '../../components/plans/WishEditor';
import { errorMessage } from '../../components/plans/errorMessage';
import { backTargets } from '../../config/innerLayout';
import { PLAN_MAP_PATH, planNewPath, planPath } from '../../config/planRoutes';
import { stampBookPath } from '../../config/routes';
import { getCityById } from '../../data/cities';
import type { CityWish, TravelPlan } from '../../data/contracts';
import { isPlanCity, listPlans } from '../../data/plans';
import { getWish } from '../../data/wishes';
import styles from './Plans.module.css';

/**
 * `/plan/city/:cityId` 城市计划页：愿望备注、已有行程与新建入口。
 * 同一份多城行程会在每个包含该城的计划页里出现。
 */
export function CityPlanPage() {
  const { cityId } = useParams<{ cityId: string }>();
  const city = getCityById(cityId);
  const inCatalog = Boolean(city && isPlanCity(city.id));

  const [wish, setWish] = useState<CityWish | undefined>(undefined);
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!city || !inCatalog) return;
    setStatus('loading');
    setError(null);
    try {
      const [loadedWish, loadedPlans] = await Promise.all([getWish(city.id), listPlans(city.id)]);
      setWish(loadedWish);
      setPlans(loadedPlans);
      setStatus('ready');
    } catch (loadError) {
      setError(errorMessage(loadError, '读取城市计划失败，请重试。'));
      setStatus('error');
    }
  }, [city, inCatalog]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!city || !inCatalog) {
    return (
      <InnerPageLayout back={backTargets.plans} maxWidth={720}>
        <section className={styles.fallback}>
          <h1>地图里没有这座城</h1>
          <p>
            {cityId ? `编号「${cityId}」不在愿望地图的六城目录里。` : '地址里缺少城市编号。'}
            可以回到愿望地图重新挑一座。
          </p>
          <div className={styles.links}>
            <Link to={PLAN_MAP_PATH}>返回愿望地图</Link>
            <Link to="/">回到地球探索</Link>
          </div>
        </section>
      </InnerPageLayout>
    );
  }

  const back = { label: '返回愿望地图', to: PLAN_MAP_PATH };

  return (
    <InnerPageLayout back={back} maxWidth={1040}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>旅行计划 · {city.nameEn}</p>
          <h1 className={styles.title}>{city.name}的计划页</h1>
          <p className={styles.lede}>
            {wish
              ? `已经把这趟愿望记下来了：${wish.note || '只留了一个标记，备注还是空的。'}`
              : `还没写愿望？先留一句想做的事，日期可以之后再定。`}
          </p>
        </header>

        <div className={styles.actions}>
          <Link className={styles.primary} to={planNewPath(city.id)}>
            新建一趟行程
          </Link>
          <Link className={styles.secondary} to={stampBookPath(city.id)}>
            打开{city.name}手账书架
          </Link>
          <Link className={styles.secondary} to={PLAN_MAP_PATH}>
            返回愿望地图
          </Link>
        </div>

        {status === 'error' ? (
          <div className={styles.errorCard} role="alert">
            <p>{error}</p>
            <button className={styles.retry} type="button" onClick={() => void load()}>
              重新读取
            </button>
          </div>
        ) : null}

        <div className={styles.cityLayout}>
          {status === 'ready' ? (
            <WishEditor
              key={city.id}
              cityId={city.id}
              cityName={city.name}
              wish={wish}
              onChanged={(next) => setWish(next)}
            />
          ) : (
            <section className={styles.plansCard} aria-label="愿望读取状态">
              <p className={styles.loading} role="status">
                {status === 'error' ? '愿望暂时打不开，可以重新读取。' : '正在读取这趟愿望…'}
              </p>
            </section>
          )}

          <section className={styles.plansCard} aria-labelledby="city-plans-heading">
            <header className={styles.plansHead}>
              <h2 id="city-plans-heading">已有行程</h2>
              <span>{status === 'ready' ? `共 ${plans.length} 趟` : ''}</span>
            </header>

            {status === 'loading' ? (
              <p className={styles.loading} role="status">
                正在取出行程…
              </p>
            ) : null}

            {status === 'ready' && plans.length === 0 ? (
              <div className={styles.emptyState}>
                <p>还没有行程。可以先新建一趟，哪怕只有一天。</p>
                <Link className={styles.secondary} to={planNewPath(city.id)}>
                  新建行程
                </Link>
              </div>
            ) : null}

            {status === 'ready' && plans.length > 0 ? (
              <ul className={styles.planList}>
                {plans.map((plan) => {
                  const itemCount = plan.days.reduce((total, day) => total + day.items.length, 0);
                  return (
                    <li key={plan.id}>
                      <Link
                        className={styles.planRow}
                        to={planPath(plan.id)}
                        state={{ fromCityId: city.id }}
                      >
                        <span className={styles.planTitle}>{plan.title}</span>
                        <span className={styles.planDates}>
                          {plan.startDate} → {plan.endDate}
                        </span>
                        <span className={styles.planCities}>
                          {plan.cityIds.map((id) => getCityById(id)?.name ?? id).join(' · ')}
                        </span>
                        <span className={styles.planMeta}>
                          {plan.days.length} 天 · {itemCount} 个景点
                        </span>
                        <span className={styles.planHint}>打开行程 →</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <p className={styles.plansFoot}>一份多城行程会在每座相关城市的计划页里出现。</p>
          </section>
        </div>
      </div>
    </InnerPageLayout>
  );
}
