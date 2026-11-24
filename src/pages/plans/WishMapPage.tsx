import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { InnerPageLayout } from '../../components/layout/InnerPageLayout';
import { ChinaWishMap } from '../../components/plans/ChinaWishMap';
import { errorMessage } from '../../components/plans/errorMessage';
import { backTargets } from '../../config/innerLayout';
import { planCityPath } from '../../config/planRoutes';
import { getCityById } from '../../data/cities';
import { CITY_IDS, type CityWish } from '../../data/contracts';
import type { City } from '../../data/types';
import { listWishes } from '../../data/wishes';
import styles from './Plans.module.css';

/**
 * `/section/plans` 中国愿望地图。底图与点位全部来自本地资源，
 * 愿望存在现有 Dexie `wishes` 表里，刷新和离线都不会丢。
 */
export function WishMapPage() {
  const [wishes, setWishes] = useState<CityWish[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setWishes(await listWishes());
      setStatus('ready');
    } catch (loadError) {
      setError(errorMessage(loadError, '读取愿望失败，请重试。'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const wishedCityIds = new Set(wishes.map((wish) => wish.cityId));
  const wishNotes = new Map(wishes.map((wish) => [wish.cityId, wish.note]));
  const mapCities = CITY_IDS.map((cityId) => getCityById(cityId)).filter(
    (city): city is City => Boolean(city),
  );

  return (
    <InnerPageLayout back={backTargets.globe} maxWidth={1120}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>旅行计划 · 中国愿望地图</p>
          <h1 className={styles.title}>中国愿望地图</h1>
          <p className={styles.lede}>
            把想去的地方钉在纸上：点一座城，写下愿望和备注，再顺手排一趟行程。
            地图底图随站点一起打包，断网也能打开。
          </p>
        </header>

        {status === 'loading' ? (
          <p className={styles.loading} role="status">
            正在把愿望别到地图上…
          </p>
        ) : null}

        {status === 'error' ? (
          <div className={styles.errorCard} role="alert">
            <p>{error}</p>
            <button className={styles.retry} type="button" onClick={() => void load()}>
              重新读取
            </button>
          </div>
        ) : null}

        {status === 'ready' ? (
          <>
            <ChinaWishMap wishedCityIds={wishedCityIds} />
            <p className={styles.mapSummary} role="status">
              六座城里有 {wishedCityIds.size} 座写下了愿望。
            </p>
          </>
        ) : null}

        <section className={styles.citySection} aria-labelledby="wish-city-list">
          <h2 id="wish-city-list" className={styles.sectionTitle}>
            城市清单
          </h2>
          <ul className={styles.cityList}>
            {mapCities.map((city) => {
              const note = wishNotes.get(city.id);
              return (
                <li key={city.id}>
                  <Link className={styles.cityRow} to={planCityPath(city.id)}>
                    <span className={styles.cityRowMain}>
                      <span className={styles.cityName}>
                        {city.name}
                        <em>{city.nameEn}</em>
                      </span>
                      <span className={styles.cityRegion}>{city.region}</span>
                      <span className={wishedCityIds.has(city.id) ? styles.cityWished : styles.cityIdle}>
                        {status === 'ready'
                          ? wishedCityIds.has(city.id)
                            ? '已标记愿望'
                            : '还没标记'
                          : '读取中…'}
                      </span>
                    </span>
                    <span className={styles.cityNote}>
                      {note
                        ? note
                        : status === 'ready'
                          ? '点进去写一句愿望，日期可以之后再定。'
                          : '正在读取愿望…'}
                    </span>
                    <span className={styles.cityHint}>进入城市计划 →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <p className={styles.note}>
          愿望与行程只保存在这台设备的浏览器里；地图底图和城市点位随站点离线可用。
        </p>
      </div>
    </InnerPageLayout>
  );
}