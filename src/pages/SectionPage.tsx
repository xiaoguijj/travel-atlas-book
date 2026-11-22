import { NavLink, useParams } from 'react-router-dom';
import { getSection, sections } from '../data/sections';
import styles from './SectionPage.module.css';

/**
 * 还没内容的三个栏目（灵感发现 / 旅行计划 / 我的）。
 *
 * 「旅行手账」不在这个页面里了——它有自己的邮票册（StampAlbumPage），
 * 路由在 App.tsx 里直接接管，所以这里只会拿到 ready 为 false 的栏目。
 * 有入口、有诚实的进度说明，但不放任何点了没反应的按钮。
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

      <p className={styles.note}>这个栏目还在后面的阶段里等着。现在能做的，是回到地球逛逛已经收录的城市。</p>

      <nav className={styles.foot} aria-label="栏目导航">
        <NavLink className={styles.home} to="/">
          ← 回到地球
        </NavLink>
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
        <NavLink className={styles.home} to="/">
          ← 回到地球
        </NavLink>
      </section>
    </div>
  );
}
