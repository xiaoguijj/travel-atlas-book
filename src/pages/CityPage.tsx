import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CityMotif } from '../components/city/CityMotif';
import { InnerPageLayout } from '../components/layout/InnerPageLayout';
import { albumBack } from '../config/innerLayout';
import { planCityPath } from '../config/planRoutes';
import { cityPath, stampBookPath } from '../config/routes';
import { cities, getCityById } from '../data/cities';
import { isPlanCity } from '../data/plans';
import styles from './CityPage.module.css';

export function CityPage() {
  const { cityId } = useParams<{ cityId: string }>();
  const city = getCityById(cityId);

  if (!city) return <UnknownCity cityId={cityId} />;

  const others = cities.filter((item) => item.id !== city.id);

  return (
    <InnerPageLayout back={albumBack(city.id)} maxWidth={1280}>
      <div className={styles.pageInner}>
        <div className={styles.spread}>
          <header
            className={styles.cover}
            style={{ '--cover-a': city.coverTint[0], '--cover-b': city.coverTint[1] } as CSSProperties}
          >
            <p className={styles.kicker}>旅行手账 · VOL. I</p>
            <h1 className={styles.cityName}>
              {city.name}
              <span>{city.nameEn}</span>
            </h1>
            <p className={styles.region}>{city.region}</p>

            <div className={styles.coverArt}>
              <CityMotif motif={city.motif} />
            </div>

            <dl className={styles.coords}>
              <div>
                <dt>纬度</dt>
                <dd>
                  {Math.abs(city.latitude).toFixed(4)}°{city.latitude >= 0 ? 'N' : 'S'}
                </dd>
              </div>
              <div>
                <dt>经度</dt>
                <dd>
                  {Math.abs(city.longitude).toFixed(4)}°{city.longitude >= 0 ? 'E' : 'W'}
                </dd>
              </div>
            </dl>

            <span className={styles.seal} aria-hidden="true">
              城市
              <em>旅行档案</em>
            </span>
          </header>

          <section className={styles.notice}>
            <h2>{city.tagline}</h2>
            <p>{city.intro}</p>
            <nav className={styles.portalLinks} aria-label={`${city.name}旅行入口`}>
              <Link to={stampBookPath(city.id)}>{city.name}手账书架</Link>
              {isPlanCity(city.id) ? <Link to={planCityPath(city.id)}>{city.name}旅行计划</Link> : null}
            </nav>
          </section>
        </div>

        <nav className={styles.actions} aria-label="页面导航">
          <div className={styles.others}>
            <span>其他城市</span>
            <ul>
              {others.map((item) => (
                <li key={item.id}>
                  <Link to={cityPath(item.id)}>{item.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </InnerPageLayout>
  );
}

function UnknownCity({ cityId }: { cityId?: string }) {
  return (
    <InnerPageLayout back={albumBack()}>
      <div className={styles.pageInner}>
        <section className={styles.missing}>
          <h1>没有找到这座城市</h1>
          <p>
            {cityId ? `编号「${cityId}」暂时还没有收录。` : '地址里缺少城市编号。'}
            目前已收录的城市是：
          </p>
          <ul className={styles.missingList}>
            {cities.map((city) => (
              <li key={city.id}>
                <Link to={cityPath(city.id)}>
                  {city.name}
                  <span>{city.nameEn}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </InnerPageLayout>
  );
}
