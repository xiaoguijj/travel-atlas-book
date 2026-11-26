import { liveQuery } from 'dexie';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { InnerPageLayout } from '../../components/layout/InnerPageLayout';
import { PlanForm, toPlanDraft } from '../../components/plans/PlanForm';
import { errorMessage } from '../../components/plans/errorMessage';
import { backTargets } from '../../config/innerLayout';
import { PLAN_MAP_PATH, planCityPath } from '../../config/planRoutes';
import { bookPath, stampBookPath } from '../../config/routes';
import { listBooksByPlan } from '../../data/books';
import { getCityById } from '../../data/cities';
import type { TravelBook, TravelPlan } from '../../data/contracts';
import { getPlan, isPlanCity } from '../../data/plans';
import styles from './Plans.module.css';

/** `/plan/:planId` 行程详情：编辑日期、每日景点、顺序与备注，删除前确认影响。 */
export function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  return <PlanDetail key={planId} planId={planId} />;
}

function PlanDetail({ planId }: { planId?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const fromCityId = (location.state as { fromCityId?: string } | null)?.fromCityId;
  const fromCity = fromCityId && isPlanCity(fromCityId) ? getCityById(fromCityId) : undefined;

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
              if (!city || !isPlanCity(city.id)) return null;
              return (
                <Link key={cityId} className={styles.cityChip} to={planCityPath(cityId)}>
                  {city.name}计划
                </Link>
              );
            })}
          </div>
        </header>

        <LinkedBooks plan={plan} />

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

function LinkedBooks({ plan }: { plan: TravelPlan }) {
  const [books, setBooks] = useState<TravelBook[]>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const subscription = liveQuery(() => listBooksByPlan(plan.id)).subscribe({
      next: setBooks,
      error: (cause) => setError(errorMessage(cause, '读取关联手账失败，请重试。')),
    });
    return () => subscription.unsubscribe();
  }, [plan.id, retry]);

  return (
    <section className={styles.plansCard} aria-labelledby="linked-books-heading">
      <header className={styles.plansHead}>
        <h2 id="linked-books-heading">关联手账</h2>
      </header>
      {error ? (
        <div className={styles.errorCard} role="alert">
          <p>{error}</p>
          <button className={styles.retry} type="button" onClick={() => {
            setError(undefined);
            setBooks(undefined);
            setRetry((count) => count + 1);
          }}>重新读取</button>
        </div>
      ) : books === undefined ? (
        <p className={styles.loading} role="status">正在读取关联手账…</p>
      ) : books.length === 0 ? (
        <p className={styles.loading}>还没有关联手账。可以在手账的编辑页选择这趟行程。</p>
      ) : (
        <ul className={styles.planList}>
          {books.map((book) => (
            <li key={book.id}>
              <Link className={styles.planRow} to={bookPath(book.id)}>
                <span className={styles.planTitle}>{book.title}</span>
                <span className={styles.planCities}>{getCityById(book.cityId)?.name ?? book.cityId}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav className={styles.cityLinks} aria-label="行程城市手账书架">
        {plan.cityIds.map((cityId) => {
          const city = getCityById(cityId);
          return city ? (
            <Link key={cityId} className={styles.cityChip} to={stampBookPath(cityId)}>
              {city.name}手账书架
            </Link>
          ) : null;
        })}
      </nav>
    </section>
  );
}
