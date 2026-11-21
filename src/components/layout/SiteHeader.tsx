import { NavLink } from 'react-router-dom';
import { cities } from '../../data/cities';
import styles from './SiteHeader.module.css';

/** 顶部导航。城市链接指向真实存在的城市页，不做假入口。 */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <NavLink to="/" className={styles.brand} title="回到地球">
        <svg className={styles.emblem} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="13" />
          <path d="M3 16h26" />
          <path d="M16 3c5.2 5.4 5.2 22.6 0 26M16 3c-5.2 5.4-5.2 22.6 0 26" />
          <circle className={styles.emblemDot} cx="21.4" cy="11" r="2.1" />
        </svg>
        <span className={styles.wordmark}>
          Travel Atlas <em>Book</em>
        </span>
      </NavLink>

      <nav className={styles.nav} aria-label="已收录城市">
        <span className={styles.navLabel}>已收录</span>
        <ul className={styles.navList}>
          {cities.map((city) => (
            <li key={city.id}>
              <NavLink
                to={`/city/${city.id}`}
                className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink)}
              >
                {city.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
