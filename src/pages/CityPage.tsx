import type { CSSProperties } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CityMotif } from '../components/city/CityMotif';
import { InnerPageLayout } from '../components/layout/InnerPageLayout';
import { backTargets, usesInnerLayout } from '../config/innerLayout';
import { cities, getCityById } from '../data/cities';
import { editorRoadmap } from '../data/roadmap';
import styles from './CityPage.module.css';

/**
 * 城市详情占位页（第一阶段）。
 * 只放城市名、封面、坐标和"编辑器即将开放"的说明，没有任何假功能入口。
 *
 * V1-03：接入公共内页布局后，背景与顶栏归 InnerPageLayout 管，这里只留封面和说明两栏；
 * 底部那条「← 回到地球，再挑一座城」和顶栏返回按钮指向同一个地方，所以套了布局就不再重复放。
 * 等邮票收藏册（V1-06）合进来，返回目标要按进入来源切换成「返回邮票收藏册」，
 * 判来源用 Link 的 state，不靠浏览器历史，这样直接输网址也有落点。
 */
export function CityPage() {
  const { cityId } = useParams<{ cityId: string }>();
  const { pathname } = useLocation();
  const city = getCityById(cityId);

  if (!city) return <UnknownCity cityId={cityId} />;

  const adopted = usesInnerLayout(pathname);
  const others = cities.filter((item) => item.id !== city.id);

  const body = (
    <div className={adopted ? styles.pageInner : styles.page}>
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
            编辑功能
            <em>即将开放</em>
          </span>
        </header>

        <section className={styles.notice}>
          <h2>手账编辑器即将开放</h2>
          <p>
            这一页目前只有封面。等编辑器上线，你可以在这里贴照片、写当天的流水账、摆上城市专属的建筑与美食贴纸，
            再把整本手账存下来，下次接着写。
          </p>

          <h3 className={styles.subhead}>已经排上日程</h3>
          <ul className={styles.roadmap}>
            {editorRoadmap.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <em>{item.note}</em>
              </li>
            ))}
          </ul>

          <p className={styles.honestNote}>第一阶段只做三件事：转动地球、翻开城市明信片、走进城市页。</p>
        </section>
      </div>

      <nav className={styles.actions} aria-label="页面导航">
        {adopted ? null : (
          <Link className={styles.backLink} to="/">
            ← 回到地球，再挑一座城
          </Link>
        )}
        <div className={styles.others}>
          <span>其他城市</span>
          <ul>
            {others.map((item) => (
              <li key={item.id}>
                <Link to={`/city/${item.id}`}>{item.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );

  return adopted ? (
    <InnerPageLayout back={backTargets.globe} maxWidth={1280}>
      {body}
    </InnerPageLayout>
  ) : (
    body
  );
}

function UnknownCity({ cityId }: { cityId?: string }) {
  // /city/:cityId 在白名单里，Shell 已经把旧导航收掉了；这一页要是自己不套布局，
  // 就会停在"既没有旧导航、也没有新顶栏"的空档里，所以无条件套上。
  return (
    <InnerPageLayout back={backTargets.globe}>
      <div className={styles.pageInner}>
        <section className={styles.missing}>
          <h1>这本手账里还没有这一页</h1>
          <p>
            {cityId ? `编号「${cityId}」暂时还没有收录。` : '地址里缺少城市编号。'}
            目前已收录的城市是：
          </p>
          <ul className={styles.missingList}>
            {cities.map((city) => (
              <li key={city.id}>
                <Link to={`/city/${city.id}`}>
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
