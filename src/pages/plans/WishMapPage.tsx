import { Link } from 'react-router-dom';
import { InnerPageLayout } from '../../components/layout/InnerPageLayout';
import { backTargets } from '../../config/innerLayout';
import { cities } from '../../data/cities';
import styles from './Plans.module.css';

/**
 * `/section/plans` 的愿望地图占位入口。地图底图、愿望标记与城市计划由后续任务接入；
 * 本页先把城市入口和真实路由接好。
 */
export function WishMapPage() {
  return (
    <InnerPageLayout back={backTargets.globe} maxWidth={1120}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>旅行计划 · 中国愿望地图</p>
          <h1 className={styles.title}>愿望地图正在绘制</h1>
          <p className={styles.lede}>
            底图、城市标记和愿望备注稍后上线。现在可以先挑一座想去的城，看看它的计划页入口。
          </p>
        </header>

        <ul className={styles.cityGrid} aria-label="城市计划入口">
          {cities
            .filter((city) => city.id !== 'london')
            .map((city) => (
              <li key={city.id}>
                <Link className={styles.cityCard} to={`/plan/city/${city.id}`}>
                  <span className={styles.cityName}>
                    {city.name}
                    <em>{city.nameEn}</em>
                  </span>
                  <span className={styles.cityRegion}>{city.region}</span>
                  <span className={styles.cityHint}>查看城市计划 →</span>
                </Link>
              </li>
            ))}
        </ul>

        <p className={styles.note}>愿望与行程只保存在本机；地图底图也会随站点一起离线可用。</p>
      </div>
    </InnerPageLayout>
  );
}