import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { planCityPath, planPath } from '../../config/planRoutes';
import { getBook, linkBookToPlan } from '../../data/books';
import type { TravelBook, TravelPlan } from '../../data/contracts';
import { listPlans } from '../../data/plans';
import { errorMessage } from '../plans/errorMessage';
import styles from './BookShell.module.css';

export function BookPlanLink({ book, onSaved }: { book: TravelBook; onSaved(book: TravelBook): void }) {
  const { id, cityId } = book;
  const [options, setOptions] = useState<{ planId?: string; plans: TravelPlan[] }>();
  const [loadError, setLoadError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [stored, plans] = await Promise.all([getBook(id), listPlans(cityId)]);
      return { planId: stored?.planId, plans };
    }).subscribe({
      next(loaded) {
        setOptions(loaded);
        setLoadError(undefined);
      },
      error(cause) {
        setOptions(undefined);
        setLoadError(errorMessage(cause, '暂时无法读取可关联的行程。'));
      },
    });
    return () => subscription.unsubscribe();
  }, [id, cityId, retry]);

  const changePlan = async (planId: string) => {
    setSaving(true);
    setSaveError(undefined);
    try {
      onSaved(await linkBookToPlan(id, planId || undefined));
    } catch (cause) {
      setSaveError(errorMessage(cause, '更新行程关联失败，请重试。'));
    } finally {
      setSaving(false);
    }
  };

  const planId = options ? options.planId : book.planId;
  const currentPlan = options?.plans.find((plan) => plan.id === planId);

  return (
    <div className={styles.planLink}>
      <label>
        <span>关联行程</span>
        <select
          value={planId ?? ''}
          disabled={!options || saving}
          onChange={(event) => void changePlan(event.target.value)}
        >
          <option value="">{planId ? '解除关联' : '未关联行程'}</option>
          {planId && !currentPlan ? (
            <option value={planId} disabled>{options || loadError ? '当前行程不可用' : '正在读取行程…'}</option>
          ) : null}
          {options?.plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.title} · {plan.startDate}</option>
          ))}
        </select>
      </label>
      {currentPlan ? (
        <Link to={planPath(currentPlan.id)} state={{ fromCityId: cityId }}>
          打开关联行程
        </Link>
      ) : options?.plans.length === 0 ? (
        <Link to={planCityPath(cityId)}>查看本城计划</Link>
      ) : null}
      {saving ? <span role="status">正在更新关联…</span> : null}
      {loadError ? (
        <span role="alert">
          {loadError}{' '}
          <button type="button" onClick={() => { setLoadError(undefined); setRetry((count) => count + 1); }}>重试</button>
        </span>
      ) : null}
      {saveError ? <span role="alert">{saveError}</span> : null}
    </div>
  );
}
