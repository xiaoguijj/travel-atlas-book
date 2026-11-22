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

      <div className={styles.closing}>
        <p className={styles.closingMain}>世界的故事，远不止眼前这几座城。</p>
        <p className={styles.closingSub}>更多城市邮票正在绘制中，下一段旅程，敬请期待。</p>
        <p className={styles.closingFoot}>TO BE CONTINUED · 持续更新中</p>
      </div>

      <ul className={styles.roadmap} aria-label="还没上线的功能">
        <li className={styles.roadmapLabel}>还没上线</li>
        {editorRoadmap.map((item) => (
          <li key={item.title}>{item.title}</li>
        ))}
      </ul>
    </div>
  );
}
