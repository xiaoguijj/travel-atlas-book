import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { InnerPageLayout } from '../../components/layout/InnerPageLayout';
import { PlanForm, toPlanDraft } from '../../components/plans/PlanForm';
import { errorMessage } from '../../components/plans/errorMessage';
import { backTargets } from '../../config/innerLayout';
import { PLAN_MAP_PATH, planCityPath } from '../../config/planRoutes';
import { getCityById } from '../../data/cities';
import { CITY_IDS, type TravelPlan } from '../../data/contracts';
import { getPlan } from '../../data/plans';
import styles from './Plans.module.css';

const sixCities = new Set<string>(CITY_IDS);

/** `/plan/:planId` 行程详情：编辑日期、每日景点、顺序与备注，删除前确认影响。 */
export function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const fromCityId = (location.state as { fromCityId?: string } | null)?.fromCityId;
  const fromCity = fromCityId && sixCities.has(fromCityId) ? getCityById(fromCityId) : undefined;

  const [plan, setPlan] = useState<TravelPlan | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = planId?.trim();
    if (!id) {
      setStatus('missing');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const loaded = await getPlan(id);
      if (!loaded) {
        setStatus('missing');
        return;
      }
      setPlan(loaded);
      setStatus('ready');
    } catch (loadError) {
      setError(errorMessage(loadError, '读取行程失败，请重试。'));
      setStatus('error');
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = fromCity
    ? { label: `返回${fromCity.name}计划`, to: planCityPath(fromCity.id) }
    : backTargets.plans;

  if (status === 'loading') {
    return (
      <InnerPageLayout back={back} maxWidth={820}>
        <p className={styles.loading} role="status">
          正在翻到这一页行程…
        </p>
      </InnerPageLayout>
    );
  }

  if (status === 'error') {
    return (
      <InnerPageLayout back={back} maxWidth={820}>
        <div className={styles.errorCard} role="alert">
          <p>{error}</p>
          <button className={styles.retry} type="button" onClick={() => void load()}>
            重新读取
          </button>
        </div>
      </InnerPageLayout>
    );
  }

  if (status === 'missing' || !plan) {
    return (
      <InnerPageLayout back={back} maxWidth={720}>
        <section className={styles.fallback}>
          <h1>没有这趟行程</h1>
          <p>
            {planId ? `计划编号「${planId}」不存在，可能已经被删除。` : '地址里缺少计划编号。'}
            可以回到愿望地图，从城市计划页重新打开或新建。
          </p>
          <div className={styles.links}>
            <Link to={PLAN_MAP_PATH}>返回愿望地图</Link>
            <Link to="/">回到地球探索</Link>
          </div>
        </section>
      </InnerPageLayout>
    );
  }

  const emptyDays = plan.days.filter((day) => day.items.length === 0).length;
  const cityNames = plan.cityIds.map((cityId) => getCityById(cityId)?.name ?? cityId).join(' · ');

  return (
    <InnerPageLayout back={back} maxWidth={920}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>旅行计划 · 行程详情</p>
          <h1 className={styles.title}>{plan.title}</h1>
          <p className={styles.metaLine}>
            {plan.startDate} → {plan.endDate} · {plan.days.length} 天 · {cityNames}
            {emptyDays > 0 ? ` · 其中 ${emptyDays} 天还没有安排` : ' · 每一天都排上了'}
          </p>
          <div className={styles.cityLinks}>
            {plan.cityIds.map((cityId) => {
              const city = getCityById(cityId);
              if (!city) return null;
              return (
                <Link key={cityId} className={styles.cityChip} to={planCityPath(cityId)}>
                  {city.name}计划
                </Link>
              );
            })}
          </div>
        </header>

        <PlanForm
          key={plan.id}
          mode="edit"
          initialDraft={toPlanDraft(plan)}
          cancelTo={back.to}
          cancelLabel={back.label}
          onSaved={(saved) => setPlan(saved)}
          onDeleted={() => navigate(back.to, { replace: true })}
        />
      </div>
    </InnerPageLayout>
  );
}