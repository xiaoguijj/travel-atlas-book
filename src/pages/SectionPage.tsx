import { Link, NavLink, useParams } from 'react-router-dom';
import { InnerPageLayout } from '../components/layout/InnerPageLayout';
import { backTargets } from '../config/innerLayout';
import { getSection, sections } from '../data/sections';
import styles from './SectionPage.module.css';

/** 灵感发现和我的栏目说明。旅行手账和旅行计划有独立页面。 */
export function SectionPage() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const section = getSection(sectionId);

  if (!section) return <UnknownSection sectionId={sectionId} />;

  const others = sections.filter((item) => item.id !== section.id);

  return (
    <InnerPageLayout back={backTargets.globe}>
      <div className={styles.pageInner}>
        <header className={styles.head}>
          <p className={styles.kicker}>手账本目录</p>
          <h1 className={styles.title}>{section.label}</h1>
          <p className={styles.lede}>{section.lede}</p>
          <span className={styles.status}>即将开放</span>
        </header>

        <ul className={styles.planned}>
          {section.items.map((item) => (
            <li key={item.title} className={styles.plannedItem}>
              <strong>{item.title}</strong>
              <p>{item.note}</p>
            </li>
          ))}
        </ul>

        <nav className={styles.foot} aria-label="栏目导航">
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
    </InnerPageLayout>
  );
}

function UnknownSection({ sectionId }: { sectionId?: string }) {
  return (
    <div className={styles.page}>
      <section className={styles.missing}>
        <h1>目录里没有这一栏</h1>
        <p>{sectionId ? `「${sectionId}」不是这本书的栏目。` : '地址里缺少栏目编号。'}可以前往以下栏目。</p>
        <ul className={styles.otherList}>
          {sections.map((item) => (
            <li key={item.id}>
              <NavLink to={`/section/${item.id}`} className={styles.otherLink}>
                {item.label}
                {!item.ready ? <em>待开放</em> : null}
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
