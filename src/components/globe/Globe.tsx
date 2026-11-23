import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { City } from '../../data/types';
import { createGlobeScene, type GlobeSceneHandle } from '../../three/createGlobeScene';
import { CityMarker } from './CityMarker';
import styles from './Globe.module.css';

export interface GlobeProps {
  /** 来自 src/data/cities.ts 的稳定引用，只在挂载时建一次场景 */
  cities: City[];
  targetCityId: string | null;
  activeCityId: string | null;
  onSelectCity: (city: City, opener: HTMLButtonElement) => void;
  onCityArrival: (cityId: string) => void;
  /** 球体直径占容器短边的比例；参考图舞台要按挖孔尺寸反算，竖版布局用默认值 */
  fill?: number;
  /** 底部操作提示，传 null 就不画（参考图里画自己已经说明了玩法） */
  hint?: string | null;
  /**
   * 分层模式：画布沉到背景画之下、城市标记浮到背景画之上。
   * 靠的是这两层都不产生自己的层叠上下文，z-index 直接参与首页舞台的排序。
   */
  layered?: boolean;
}

export interface GlobeHandle {
  getMarkerCenter: (cityId: string) => { x: number; y: number } | undefined;
  focusCity: (cityId: string) => void;
}

interface PointerGesture {
  id: number;
  x: number;
  y: number;
  blocked: boolean;
}

/**
 * 把命令式的 Three.js 场景包进 React。
 *
 * 分工：
 * - 球体、相机、灯光、拖拽缩放 → createGlobeScene.ts
 * - 城市标记的 DOM 结构与点击 → CityMarker.tsx
 * - 每帧把标记"钉"在球面上的哪个像素位置 → createGlobeScene 直接写 DOM 的 transform
 *   （不用 React 状态逐帧更新，避免 60fps 重渲染）
 */
export const Globe = forwardRef<GlobeHandle, GlobeProps>(function Globe(
  {
    cities, targetCityId, activeCityId, onSelectCity, onCityArrival,
    fill, hint = '拖动旋转 · 滚轮缩放 · 点击城市标记', layered = false,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cityButtons = useRef(new Map<string, HTMLButtonElement>());
  const sceneRef = useRef<GlobeSceneHandle | null>(null);
  const pointerGesture = useRef<PointerGesture | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let handle: GlobeSceneHandle | null = null;
    try {
      handle = createGlobeScene({
        host,
        cities,
        getMarkerElement: (cityId) => cityButtons.current.get(cityId) ?? null,
        onCityArrival,
        respectReducedMotion: true,
        fill,
      });
      sceneRef.current = handle;
    } catch (error) {
      // 老浏览器或禁用硬件加速时，退化成可用的城市列表而不是一个空白方块
      console.error('[Travel Atlas] 地球初始化失败，改用静态城市列表：', error);
      setWebglFailed(true);
    }

    return () => {
      handle?.dispose();
      sceneRef.current = null;
    };
  }, [cities, fill, onCityArrival]);

  useEffect(() => {
    if (targetCityId && webglFailed) onCityArrival(targetCityId);
    else sceneRef.current?.setTargetCity(targetCityId);
  }, [targetCityId, webglFailed, cities, fill, onCityArrival]);

  useImperativeHandle(
    ref,
    () => ({
      getMarkerCenter(cityId) {
        const marker = cityButtons.current.get(cityId);
        if (!marker || Number(marker.style.opacity) < 0.5) return;
        const rect = marker.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      },
      focusCity(cityId) {
        cityButtons.current.get(cityId)?.focus();
      },
    }),
    [],
  );

  const registerCityButton = useCallback((cityId: string, button: HTMLButtonElement | null) => {
    if (button) cityButtons.current.set(cityId, button);
    else cityButtons.current.delete(cityId);
  }, []);

  const trackPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = pointerGesture.current;
    if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) {
      gesture.blocked = true;
    }
    sceneRef.current?.setPointer(event.clientX, event.clientY);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.isPrimary && event.button === 0) {
      pointerGesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, blocked: false };
    } else if (pointerGesture.current) {
      pointerGesture.current.blocked = true;
    }
    sceneRef.current?.setPointer(event.clientX, event.clientY);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerGesture.current?.id === event.pointerId) pointerGesture.current.blocked = true;
    sceneRef.current?.clearPointer();
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.buttons & 1) handlePointerCancel(event);
    else sceneRef.current?.clearPointer();
  };

  /**
   * 南京和上海在地球上只差 2.7°，投影到屏幕上图钉会叠在一起，
   * 谁压在上方是随自转变化的。所以点击不认 DOM 目标，只认坐标离哪个城市最近。
   * 判定挂在整个舞台上：命中半径（鼠标 18px、触屏 28px）比图钉 20px 的盒子更宽，
   * 手指点在图钉旁边也能选中，不再是只有精确戳中 20px 方块才算。
   * 一旦手势超过 8px，即使回到按下点，也要拦截拖动产生的 click。
   *
   * detail 为 0 说明是键盘回车触发的，那种情况交给按钮自己的 onClick。
   * 落点附近一个图钉都没有时（例如点在展开的城市名标签上）不拦截事件，
   * 让标签所属的按钮自己处理。
   * 选中后把焦点移到真正被选中的图钉，明信片关闭时才能还给正确的按钮，
   * 而不是叠在最上面的那个邻居。
   */
  const pickMarkerByPosition = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.detail === 0) return;
    const gesture = pointerGesture.current;
    pointerGesture.current = null;
    if (gesture?.blocked) {
      event.stopPropagation();
      return;
    }
    const cityId = sceneRef.current?.pickCity(event.clientX, event.clientY);
    if (!cityId) return;
    event.stopPropagation();
    const city = cities.find((item) => item.id === cityId);
    const opener = cityButtons.current.get(cityId);
    if (city && opener) {
      opener.focus({ preventScroll: true });
      onSelectCity(city, opener);
    }
  };

  if (webglFailed) {
    return (
      <div className={layered ? `${styles.fallback} ${styles.fallbackLayered}` : styles.fallback}>
        <p className={styles.fallbackNote}>
          这个浏览器没能启用 WebGL，地球暂时转不起来。先用手边的城市列表吧。
        </p>
        <ul className={styles.fallbackList}>
          {cities.map((city) => (
            <li key={city.id}>
              <button
                ref={(button) => registerCityButton(city.id, button)}
                type="button"
                onClick={(event) => onSelectCity(city, event.currentTarget)}
              >
                {city.name}
                <span>{city.region}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const stageClass = layered ? `${styles.stage} ${styles.stageLayered}` : styles.stage;

  return (
    <div
      className={stageClass}
      onPointerMove={trackPointer}
      onPointerDownCapture={handlePointerDown}
      onPointerUp={trackPointer}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onClickCapture={pickMarkerByPosition}
    >
      <div
        ref={hostRef}
        className={layered ? `${styles.canvasHost} ${styles.canvasHostBelow}` : styles.canvasHost}
      />

      <div
        className={layered ? `${styles.markerLayer} ${styles.markerLayerAbove}` : styles.markerLayer}
        onFocus={(event) => {
          // 鼠标点出来的焦点不需要让地球停住；只有键盘焦点会跟着图钉漂走，才值得暂停自转
          sceneRef.current?.setFocusHeld(event.target.matches(':focus-visible'));
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            sceneRef.current?.setFocusHeld(false);
          }
        }}
      >
        {cities.map((city) => (
          <CityMarker
            key={city.id}
            city={city}
            active={city.id === activeCityId}
            register={(button) => registerCityButton(city.id, button)}
            onSelect={(button) => onSelectCity(city, button)}
          />
        ))}
      </div>

      {hint ? <p className={styles.hint} aria-hidden="true">{hint}</p> : null}
    </div>
  );
});
