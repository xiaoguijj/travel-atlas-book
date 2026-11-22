import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import heroBg from '../assets/hero-bg.jpg';
import { CityMotif } from '../components/city/CityMotif';
import { Globe, type GlobeHandle } from '../components/globe/Globe';
import { VintageDecor } from '../components/layout/VintageDecor';
import { CityPostcard } from '../components/postcard/CityPostcard';
import { cities, getCityById } from '../data/cities';
import type { City } from '../data/types';
import {
  heroArt,
  heroArtMask,
  heroBoxStyle,
  heroCardBoxes,
  heroExploreBox,
  heroGlobeBedBox,
  heroGlobeFill,
  heroGlobeStageStyle,
  heroLayoutQuery,
  heroLayoutSupported,
  heroNav,
  heroPinMask,
} from '../config/hero';
import { useMediaQuery } from '../hooks/useMediaQuery';
import artStyles from './HomePageArt.module.css';
import classicStyles from './HomePage.module.css';

type Point = { x: number; y: number };
type CityJourney =
  | { city: City; phase: 'flying' | 'arrived' }
  | { city: City; phase: 'open'; origin?: Point };

export function HomePage() {
  const [journey, setJourney] = useState<CityJourney | null>(null);
  const globeRef = useRef<GlobeHandle>(null);
  const exploreIndex = useRef(0);
  const classicGlobeRef = useRef<HTMLElement>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  // 画布要等比铺满 1671×941 才压得住参考图上的坐标，屏幕小到地球转不开就换竖版布局
  const artViewport = useMediaQuery(heroLayoutQuery);
  const useArtLayout = artViewport && heroLayoutSupported;

  const focusedCity = journey?.city ?? null;
  const activeCityId = journey && journey.phase !== 'flying' ? journey.city.id : null;
  const closePostcard = useCallback(() => setJourney(null), []);

  const selectCity = (city: City) => {
    const globe = classicGlobeRef.current;
    if (globe) {
      const { top, height } = globe.getBoundingClientRect();
      const center = top + height / 2;
      if (center < 70 || center > window.innerHeight - 70) {
        globe.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'instant' : 'smooth' });
      }
    }
    setJourney((current) => current?.city.id === city.id ? current : { city, phase: 'flying' });
  };

  const handleCityArrival = useCallback((cityId: string) => {
    setJourney((current) => current?.city.id === cityId && current.phase === 'flying'
      ? { city: current.city, phase: 'arrived' }
      : current);
  }, []);

  useEffect(() => {
    if (journey?.phase !== 'arrived') return;
    const { city } = journey;
    const timer = window.setTimeout(() => {
      const origin = globeRef.current?.getMarkerCenter(city.id);
      setJourney((current) => current === journey ? { city, phase: 'open', origin } : current);
    }, reduceMotion ? 250 : 640);
    return () => window.clearTimeout(timer);
  }, [journey, reduceMotion, useArtLayout]);

  useEffect(() => {
    if (!journey || journey.phase === 'open') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePostcard();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [journey, closePostcard]);

  const globeProps = {
    cities,
    targetCityId: focusedCity?.id ?? null,
    activeCityId,
    onSelectCity: selectCity,
    onCityArrival: handleCityArrival,
  };
  const postcard = journey?.phase === 'open'
    ? <CityPostcard city={journey.city} onClose={closePostcard} origin={journey.origin} />
    : null;

  /** 「开始探索」：镜头转到一座城市并翻开它的明信片，每多点一次换下一座 */
  const startExploring = () => {
    const city = cities[exploreIndex.current % cities.length];
    exploreIndex.current += 1;
    selectCity(city);
  };

  if (useArtLayout) {
    return (
      <>
        <section
          className={artStyles.stage}
          style={{ '--hero-pin-mask': heroPinMask } as CSSProperties}
          aria-label="Travel Atlas Book 首页"
        >
          {/* 背景画保持原样，只把画里那个静态地球挖成透明圆孔，下面的 3D 地球从孔里露出来。
              帆船桅杆、云这些压在地球前面的笔触因此自动留在正确的前后关系里。 */}
          <img
            className={artStyles.art}
            src={heroBg}
            width={heroArt.width}
            height={heroArt.height}
            alt=""
            style={{ maskImage: heroArtMask, WebkitMaskImage: heroArtMask }}
          />

          {/* 孔底垫一张纸：地球缩小时孔里露出的是纸色，不是页面深处的午夜蓝 */}
          <div className={artStyles.globeBed} style={heroBoxStyle(heroGlobeBedBox)} aria-hidden="true" />

          <div className={artStyles.globeSlot} style={heroGlobeStageStyle}>
            <Globe
              ref={globeRef}
              {...globeProps}
              fill={heroGlobeFill}
              hint={null}
              layered
            />
          </div>

          {/* 画上的缎带、铭牌、明信片都是真的按钮，只是皮肤来自画本身 */}
          <nav className={artStyles.nav} aria-label="主导航">
            {heroNav.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className={artStyles.navItem}
                style={heroBoxStyle(item)}
                aria-label={item.label}
              />
            ))}
          </nav>

          <button
            type="button"
            className={artStyles.explore}
            style={heroBoxStyle(heroExploreBox)}
            onClick={startExploring}
          >
            <span className="srOnly">开始探索，转动地球并翻开一座城市的明信片</span>
          </button>

          <div className={artStyles.cards}>
            {heroCardBoxes.map((box) => {
              const city = getCityById(box.cityId);
              if (!city) return null;
              const needsArtwork = box.painted === false;
              const selected = box.cityId === focusedCity?.id;
              const cardClasses = [artStyles.card];
              if (needsArtwork) cardClasses.push(artStyles.londonCard);
              if (selected) cardClasses.push(artStyles.cardActive);
              return (
                <button
                  key={box.cityId}
                  type="button"
                  className={cardClasses.join(' ')}
                  style={heroBoxStyle(box)}
                  onClick={() => selectCity(city)}
                  aria-label={`${city.name}，${city.region}，翻开这张明信片`}
                  aria-pressed={selected}
                >
                  {needsArtwork && (
                    <span className={artStyles.londonArtwork} aria-hidden="true">
                      <span className={artStyles.londonName}>{city.name}<small>{city.nameEn}</small></span>
                      <CityMotif motif={city.motif} minimal />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 标题与副标题画在图上，DOM 里只保留给读屏和 SEO 的文字 */}
          <h1 className="srOnly">Travel Atlas Book</h1>
          <p className="srOnly">把世界装进一本旅行手账</p>
        </section>

        {postcard}
      </>
    );
  }

  return (
    <div className={classicStyles.page}>
      <VintageDecor />

      <section className={classicStyles.intro}>
        <p className={classicStyles.eyebrow}>EST. 2026 · 一本会转的旅行手账</p>
        <h1 className={classicStyles.title}>Travel Atlas Book</h1>
        <p className={classicStyles.subtitle}>把世界装进一本旅行手账</p>
      </section>

      <section ref={classicGlobeRef} className={classicStyles.globeStage} aria-label="交互式地球，拖动可以旋转">
        <Globe ref={globeRef} {...globeProps} />
      </section>

      <section className={classicStyles.legend} aria-label="城市快捷入口">
        <h2 className={classicStyles.legendTitle}>城市明信片</h2>
        <ul className={classicStyles.legendList}>
          {cities.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                onClick={() => selectCity(city)}
                className={
                  focusedCity?.id === city.id
                    ? `${classicStyles.cityButton} ${classicStyles.cityButtonActive}`
                    : classicStyles.cityButton
                }
                aria-pressed={focusedCity?.id === city.id}
              >
                {city.name}
                <span>{city.tagline}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={classicStyles.legendNote}>
          找不到标记也没关系，点上面的城市名同样能翻开那张明信片。
        </p>
      </section>

      {postcard}
    </div>
  );
}
