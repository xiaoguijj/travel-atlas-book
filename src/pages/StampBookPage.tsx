import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { CityMotif } from '../components/city/CityMotif';
import { InnerPageLayout } from '../components/layout/InnerPageLayout';
import { backTargets } from '../config/innerLayout';
import { cities, getCityById } from '../data/cities';
import styles from './StampBookPage.module.css';

/**
 * `/section/journals` 的邮票册占位入口。收藏、盖章与城市书架由后续任务接入；
 * 本页先把路由、城市定位参数和回城链接接好，不放点了没反应的收藏按钮。
 */
export function StampBookPage() {
  const [searchParams] = useSearchParams();
  const cityId = searchParams.get('cityId');
  const located = getCityById(cityId ?? undefined);

  return (
    <InnerPageLayout back={backTargets.globe} maxWidth={1120}>
      <div className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>旅行手账 · 邮票收藏册</p>
          <h1 className={styles.title}>六城邮票册正在装帧</h1>
          <p className={styles.lede}>
            这一册会收齐六座城市的纪念邮票。收藏、盖章与城市书架稍后上线；现在可以先从书架上挑一座城，走进它的手账页。
          </p>
          {located ? (
            <p className={styles.located}>
              已定位到 <strong>{located.name}</strong>
              <Link to={`/city/${located.id}`}>直接翻开这座城 →</Link>
            </p>
          ) : null}
        </header>

        <ul className={styles.shelf} aria-label="六座城市的邮票占位">
          {cities
            .filter((city) => city.id !== 'london')
            .map((city) => (
              <li key={city.id}>
                <Link className={styles.stamp} to={`/city/${city.id}`}>
                  <span className={styles.stampArt} aria-hidden="true">
                    <CityMotif motif={city.motif} minimal />
                  </span>
                  <span className={styles.stampName}>
                    {city.name}
                    <em>{city.nameEn}</em>
                  </span>
                  <span className={styles.stampRegion}>{city.region}</span>
                  <span className={styles.stampHint}>城市书架稍后开放 · 先看城市页</span>
                </Link>
              </li>
            ))}
        </ul>

        <p className={styles.note}>邮票收藏状态只记录在本机，不会上传云端。</p>
      </div>
    </InnerPageLayout>
  );
}

/** `/stamps` 是 `/section/journals` 的别名；保留有效查询参数，丢掉无效 cityId。 */
export function StampsAliasPage() {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  const cityId = next.get('cityId');
  if (cityId && !getCityById(cityId)) next.delete('cityId');
  const query = next.toString();
  return <Navigate replace to={query ? `/section/journals?${query}` : '/section/journals'} />;
}