import { Link, NavLink, useParams } from 'react-router-dom';
import { CityMotif } from '../components/city/CityMotif';
import { cities } from '../data/cities';
import { getSection, sections } from '../data/sections';
import styles from './SectionPage.module.css';

/**
 * 首页缎带上的四个栏目。
 * 「旅行手账」列出真实存在的城市页，其余三个只说明进度 —— 有入口、有内容，
 * 但不放任何点了没反应的按钮。
 */
export function SectionPage() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const section = getSection(sectionId);

  if (!section) return <UnknownSection sectionId={sectionId} />;

  const others = sections.filter((item) => item.id !== section.id);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Travel Atlas Book · 手账本目录</p>
        <h1 className={styles.title}>{section.label}</h1>
        <p className={styles.lede}>{section.lede}</p>
        <span className={section.ready ? `${styles.status} ${styles.statusReady}` : styles.status}>
          {section.ready ? '已开放' : '即将开放'}
        </span>
      </header>

      {section.id === 'journals' ? (
        <ul className={styles.shelf}>
          {cities.map((city) => (
            <li key={city.id}>
              <Link className={styles.journal} to={`/city/${city.id}`}>
                <span className={styles.journalArt} aria-hidden="true">
                  <CityMotif motif={city.motif} />
                </span>
                <strong className={styles.journalName}>
                  {city.name}
                  <em>{city.nameEn}</em>
                </strong>
                <span className={styles.journalRegion}>{city.region}</span>
                <span className={styles.journalCta}>翻开这本 →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.planned}>
          {section.items.map((item) => (
            <li key={item.title} className={styles.plannedItem}>
              <strong>{item.title}</strong>
              <p>{item.note}</p>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.note}>
        {section.ready
          ? '第一阶段能用的就是这些：转动地球、点开图钉、翻开一张明信片，然后走进城市页。'
          : '这个栏目还在后面的阶段里等着。现在能做的，是回到地球逛逛已经收录的城市。'}
      </p>

      <nav className={styles.foot} aria-label="栏目导航">
        <Link className={styles.home} to="/">
          ← 回到地球
        </Link>
        <ul className={styles.otherList}>
          {others.map((item) => (
            <li key={item.id}>
              <NavLink to={`/section/${item.id}`} className={styles.otherLink}>
                {item.label}
                {!item.ready ? <em>待开放</em> : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function UnknownSection({ sectionId }: { sectionId?: string }) {
  return (
    <div className={styles.page}>
      <section className={styles.missing}>
        <h1>目录里没有这一栏</h1>
        <p>{sectionId ? `「${sectionId}」不是这本书的栏目。` : '地址里缺少栏目编号。'}目前已开放的是：</p>
        <ul className={styles.otherList}>
          {sections.map((item) => (
            <li key={item.id}>
              <NavLink to={`/section/${item.id}`} className={styles.otherLink}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <Link className={styles.home} to="/">
          ← 回到地球
        </Link>
      </section>
    </div>
  );
}
