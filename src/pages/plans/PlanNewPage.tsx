import { Link, useSearchParams } from 'react-router-dom';
import { InnerPageLayout } from '../../components/layout/InnerPageLayout';
import { backTargets } from '../../config/innerLayout';
import { getCityById } from '../../data/cities';
import styles from './Plans.module.css';

/** `/plan/new?cityId=` 的新建行程占位页：只验证路由与预填城市，不保存任何计划。 */
export function PlanNewPage() {
  const [searchParams] = useSearchParams();
  const cityId = searchParams.get('cityId');
  const city = getCityById(cityId ?? undefined);
  const back = city
    ? { label: '返回城市计划', to: `/plan/city/${encodeURIComponent(city.id)}` }
    : backTargets.plans;

  return (
    <InnerPageLayout back={back} maxWidth={820}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>旅行计划 · 新建行程</p>
          <h1 className={styles.title}>{city ? `从${city.name}出发` : '新建一趟行程'}</h1>
          <p className={styles.lede}>
            日期、每日景点、时间与备注的表单正在制作中。这里先保留城市预填与返回路线，不会写入空的计划记录。
          </p>
        </header>

        {cityId && !city ? (
          <p className={styles.warning} role="alert">
            查询里的城市编号「{cityId}」不在目录中，可以回到愿望地图重新选择。
          </p>
        ) : null}

        <section className={styles.placeholderCard}>
          <h2>{city ? `预填城市：${city.name}` : '还没有选择城市'}</h2>
          <p>表单接入后，这里会显示起止日期、每日城市与景点条目。取消或直接离开不会留下半条计划。</p>
        </section>

        <div className={styles.actions}>
          {city ? (
            <Link className={styles.secondary} to={`/plan/city/${encodeURIComponent(city.id)}`}>
              回到{city.name}计划页
            </Link>
          ) : null}
          <Link className={styles.secondary} to="/section/plans">
            返回愿望地图
          </Link>
        </div>
      </div>
    </InnerPageLayout>
  );
}