import type { City } from '../../data/types';
import styles from './CityMarker.module.css';

export interface CityMarkerProps {
  city: City;
  active: boolean;
  /** 把 DOM 元素交回给地球场景，由它在每帧写 transform */
  register: (element: HTMLButtonElement | null) => void;
  onSelect: () => void;
}

/**
 * 城市标记是一个真正的按钮：可以点，也可以 Tab 聚焦后用回车打开。
 * 它在球面上的位置不由 React 管理，初始 opacity 设为 0，
 * 等地球场景投影出第一个坐标时再淡入，避免闪现错位。
 */
export function CityMarker({ city, active, register, onSelect }: CityMarkerProps) {
  const coordinates = `${Math.abs(city.latitude).toFixed(2)}°${city.latitude >= 0 ? 'N' : 'S'} · ${Math.abs(
    city.longitude,
  ).toFixed(2)}°${city.longitude >= 0 ? 'E' : 'W'}`;

  return (
    <button
      ref={register}
      type="button"
      className={active ? `${styles.marker} ${styles.markerActive}` : styles.marker}
      style={{ opacity: 0 }}
      onClick={onSelect}
      aria-label={`${city.name}，${coordinates}`}
      aria-pressed={active}
    >
      <span className={styles.pin} aria-hidden="true" />
      <span className={city.labelSide === 'left' ? `${styles.name} ${styles.nameLeft}` : styles.name}>
        {city.name}
        <small>{active ? coordinates : city.nameEn}</small>
      </span>
    </button>
  );
}
