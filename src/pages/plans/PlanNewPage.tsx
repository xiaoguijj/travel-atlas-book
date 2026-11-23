import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { InnerPageLayout } from '../../components/layout/InnerPageLayout';
import { PlanForm } from '../../components/plans/PlanForm';
import { backTargets } from '../../config/innerLayout';
import { PLAN_MAP_PATH, planCityPath, planPath } from '../../config/planRoutes';
import { getCityById } from '../../data/cities';
import { CITY_IDS } from '../../data/contracts';
import { addLocalDays, todayLocalDate } from '../../data/plans';
import styles from './Plans.module.css';

const sixCities = new Set<string>(CITY_IDS);

/** `/plan/new?cityId=` 新建行程：城市可预填，保存成功后才生成真实计划 ID。 */
export function PlanNewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawCityId = searchParams.get('cityId');
  const city = getCityById(rawCityId ?? undefined);
  const validCity = city && sixCities.has(city.id) ? city : undefined;

  const initialDraft = useMemo(() => {
    const today = todayLocalDate();
    return {
      title: validCity ? `${validCity.name}之行` : '',
      cityIds: validCity ? [validCity.id] : [],
      startDate: today,
      endDate: addLocalDays(today, 1),
      days: [],
    };
  }, [validCity]);

  const back = validCity
    ? { label: `返回${validCity.name}计划`, to: planCityPath(validCity.id) }
    : backTargets.plans;

  return (
    <InnerPageLayout back={back} maxWidth={920}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>旅行计划 · 新建行程</p>
          <h1 className={styles.title}>{validCity ? `从${validCity.name}出发` : '新建一趟行程'}</h1>
          <p className={styles.lede}>
            选好城市和日期，再按天排景点。保存之前不会写入任何记录，取消也不会留下半条计划。
          </p>
        </header>

        {rawCityId && !validCity ? (
          <p className={styles.warning} role="alert">
            查询里的城市编号「{rawCityId}」不在愿望地图的六城目录中，可以重新选择城市，或回到
            <Link to={PLAN_MAP_PATH}>愿望地图</Link>。
          </p>
        ) : null}

        <PlanForm
          mode="create"
          initialDraft={initialDraft}
          cancelTo={back.to}
          cancelLabel={back.label}
          onSaved={(plan) => navigate(planPath(plan.id), { replace: true })}
        />
      </div>
    </InnerPageLayout>
  );
}