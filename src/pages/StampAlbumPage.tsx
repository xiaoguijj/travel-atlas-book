import { useNavigate } from 'react-router-dom';
import albumArtwork from '../assets/stamp-album.jpg';
import { PageTurn } from '../components/layout/PageTurn';
import { albumArt, albumStamps, artBoxStyle } from '../config/journal';
import { getCityById } from '../data/cities';
import { createModePath } from '../data/creationModes';
import { editorRoadmap } from '../data/roadmap';
import type { City } from '../data/types';
import styles from './StampAlbumPage.module.css';

/**
 * 邮票册这一页：整张画是本子的一页，六枚邮票画在画上，
 * 热区按量好的坐标盖在票面上，点下去先问这一页想用哪种写法。
 */
export function StampAlbumPage() {
  const navigate = useNavigate();

  const stamps = albumStamps.reduce<{ box: (typeof albumStamps)[number]; city: City }[]>((acc, box) => {
    const city = getCityById(box.cityId);
    if (city) acc.push({ box, city });
    return acc;
  }, []);

  const openModes = (cityId: string) => navigate(createModePath(cityId));

  return (
    <div className={styles.page}>
      <PageTurn />

      <div className={styles.stage}>
        <img
          className={styles.art}
          src={albumArtwork}
          width={albumArt.width}
          height={albumArt.height}
          alt="中国城市手账：南京、上海、西安、北京、杭州、成都六枚城市邮票"
        />

        <h1 className="srOnly">中国城市手账 · China Travel Stamps</h1>

        <div className={styles.stamps}>
          {stamps.map(({ box, city }) => (
            <button
              key={city.id}
              type="button"
              className={styles.stamp}
              style={artBoxStyle(albumArt, box)}
              onClick={() => openModes(city.id)}
              aria-label={`${city.name} ${city.nameEn} 邮票，选这一页的创作方式`}
            >
              <span className={styles.glow} aria-hidden="true" />
              <span className={styles.cta} aria-hidden="true">
                选创作方式
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className={styles.hint}>
        点一枚邮票先选创作方式：横线日记本现在就能写，自由拼贴还在开发中；写的内容只留在这一台设备上。
      </p>

      <ul className={styles.roadmap} aria-label="还没上线的功能">
        <li className={styles.roadmapLabel}>还没上线</li>
        {editorRoadmap.map((item) => (
          <li key={item.title}>{item.title}</li>
        ))}
      </ul>
    </div>
  );
}
