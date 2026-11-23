import { Link, useParams } from 'react-router-dom';
import { InnerPageLayout } from '../../components/layout/InnerPageLayout';
import { backTargets } from '../../config/innerLayout';
import { getCityById } from '../../data/cities';
import styles from './Plans.module.css';

/**
 * `/plan/city/:cityId` 的城市计划占位页。愿望备注、已有行程与每日安排由后续任务接入，
 * 这里只保留真实可用的返回路线与新建入口。
 */
export function CityPlanPage() {
  const { cityId } = useParams<{ cityId: string }>();
  const city = getCityById(cityId);

  if (!city) {
    return (
      <InnerPageLayout back={backTargets.plans} maxWidth={720}>
        <section className={styles.fallback}>
          <h1>地图里没有这座城</h1>
          <p>{cityId ? `编号「${cityId}」不在六城目录里。` : '地址里缺少城市编号。'}可以回到愿望地图重新挑一座。</p>
          <div className={styles.links}>
            <Link to="/section/plans">返回愿望地图</Link>
            <Link to="/">回到地球探索</Link>
          </div>
        </section>
      </InnerPageLayout>
    );
  }

  return (
    <InnerPageLayout back={backTargets.plans} maxWidth={960}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>旅行计划 · {city.nameEn}</p>
          <h1 className={styles.title}>{city.name}的计划页</h1>
          <p className={styles.lede}>
            这里之后会放愿望备注、已有行程和每天的安排。现在先把入口留好：可以先回到城市手账，或从新建行程的占位页看看之后怎么走。
          </p>
        </header>

        <div className={styles.actions}>
          <Link className={styles.primary} to={`/plan/new?cityId=${encodeURIComponent(city.id)}`}>
            新建一趟行程（即将开放）
          </Link>
          <Link className={styles.secondary} to={`/city/${city.id}`}>
            打开{city.name}城市手账
          </Link>
          <Link className={styles.secondary} to="/section/plans">
            返回愿望地图
          </Link>
        </div>

        <section className={styles.placeholderCard}>
          <h2>愿望与行程还没接入</h2>
          <p>保存愿望、查看已有行程与按天排景点都会在后续版本开放；页面刷新前不会写入任何演示数据。</p>
        </section>
      </div>
    </InnerPageLayout>
  );
}