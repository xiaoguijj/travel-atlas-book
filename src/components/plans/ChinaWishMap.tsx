import { Link } from 'react-router-dom';
import chinaMapUrl from '../../assets/maps/china-outline.svg';
import { planCityPath } from '../../config/planRoutes';
import { listCityMapPoints } from '../../data/plans/map';
import styles from './ChinaWishMap.module.css';

export interface ChinaWishMapProps {
  wishedCityIds: ReadonlySet<string>;
}

const sideClass: Record<string, string> = {
  left: styles.sideLeft,
  right: styles.sideRight,
  bottom: styles.sideBottom,
};

/**
 * 本地中国底图 + 六个可操作城市点位。底图随构建产物离线可用，
 * 每个点位都是真实链接，键盘和读屏也能进入城市计划页。
 */
export function ChinaWishMap({ wishedCityIds }: ChinaWishMapProps) {
  const points = listCityMapPoints();

  return (
    <figure className={styles.frame}>
      <div className={styles.canvas}>
        <img className={styles.basemap} src={chinaMapUrl} alt="中国地图底图" draggable={false} />
        {points.map((point) => {
          const wished = wishedCityIds.has(point.cityId);
          return (
            <Link
              key={point.cityId}
              className={`${styles.marker} ${wished ? styles.wished : ''} ${sideClass[point.labelSide] ?? ''}`}
              style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}
              to={planCityPath(point.cityId)}
              aria-label={`${point.name}，${wished ? '已标记愿望' : '未标记愿望'}，进入城市计划页`}
              data-wished={wished ? 'true' : 'false'}
            >
              <span className={styles.dot} aria-hidden="true">
                {wished ? '★' : ''}
              </span>
              <span className={styles.label} aria-hidden="true">
                <strong>{point.name}</strong>
                <em>{point.nameEn}</em>
                {wished ? <span className={styles.flag}>愿望</span> : null}
              </span>
            </Link>
          );
        })}
      </div>
      <figcaption className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendPlain}`} aria-hidden="true" />
          还没标记
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendWished}`} aria-hidden="true">
            ★
          </span>
          已写下愿望
        </span>
        <span className={styles.legendHint}>点城市进入计划页 · 底图随站点离线可用</span>
      </figcaption>
    </figure>
  );
}