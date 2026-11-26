import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { stampBookPath } from '../../config/routes';
import type { City } from '../../data/types';
import { CityMotif } from '../city/CityMotif';
import styles from './CityPostcard.module.css';

export interface CityPostcardProps {
  city: City;
  origin?: { x: number; y: number };
  onClose: () => void;
}

/** 点击城市标记后弹出的复古明信片。 */
export function CityPostcard({ city, onClose, origin }: CityPostcardProps) {
  const navigate = useNavigate();
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardPositionRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const position = cardPositionRef.current;
    if (!position || !origin) return;
    const { left, top, width, height } = position.getBoundingClientRect();
    position.style.setProperty('--postcard-from-x', `${origin.x - (left + width / 2)}px`);
    position.style.setProperty('--postcard-from-y', `${origin.y - (top + height / 2)}px`);
  }, [origin]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [city.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const openJournal = () => {
    navigate(stampBookPath(city.id));
  };

  const coordinates = `${Math.abs(city.latitude).toFixed(2)}°${city.latitude >= 0 ? 'N' : 'S'} ${Math.abs(
    city.longitude,
  ).toFixed(2)}°${city.longitude >= 0 ? 'E' : 'W'}`;

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div ref={cardPositionRef} className={styles.cardPosition} onClick={(event) => event.stopPropagation()}>
        <article className={`${styles.card} ${styles.face}`} role="dialog" aria-modal="true" aria-label={`${city.name} 明信片`}>
          <div className={styles.edge} aria-hidden="true" />

          <div className={styles.left}>
            <div className={styles.picture}>
              <CityMotif motif={city.motif} />
            </div>
            <p className={styles.tagline}>{city.tagline}</p>
            <p className={styles.pictureNote}>城市速写 · 手绘剪影</p>
          </div>

          <div className={styles.right}>
            <header className={styles.head}>
              <span className={styles.eyebrow}>TRAVEL ATLAS BOOK</span>
              <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="关闭明信片">
                ✕
              </button>
            </header>

            <div className={styles.mark} aria-hidden="true">
              <span className={styles.stamp}>
                <CityMotif motif={city.motif} minimal />
                <small>{city.nameEn}</small>
              </span>
              <svg className={styles.postmark} viewBox="0 0 100 100">
                <defs>
                  <path id="postmark-arc" d="M50 50 m -34 0 a 34 34 0 1 1 68 0 a 34 34 0 1 1 -68 0" />
                </defs>
                <circle cx="50" cy="50" r="46" />
                <circle cx="50" cy="50" r="34" />
                <text>
                  <textPath href="#postmark-arc" startOffset="6%">
                    POSTED ON THE GLOBE · 手写旅行
                  </textPath>
                </text>
                <path d="M22 62 h56 M22 70 h48" />
              </svg>
            </div>

            <h2 className={styles.name}>
              {city.name}
              <span>{city.nameEn}</span>
            </h2>
            <p className={styles.region}>
              {city.region} · {coordinates}
            </p>

            <p className={styles.intro}>{city.intro}</p>

            <div className={styles.rules} aria-hidden="true">
              <span />
              <span />
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={openJournal}>
                进入旅行手账
              </button>
              <button type="button" className={styles.ghost} onClick={onClose}>
                先留在地球
              </button>
            </div>
          </div>

          <div className={styles.airmail} aria-hidden="true" />
        </article>
      </div>
    </div>
  );
}
