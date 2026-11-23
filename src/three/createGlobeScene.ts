import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { globeConfig, oceanLabels } from '../config/globe';
import { activeTheme } from '../config/theme';
import { worldLandPolygons } from '../data/world';
import type { City } from '../data/types';
import { cameraDistanceForFill, facingTowardCamera, latLonToVector3 } from './coordinates';
import { paintEarthTexture } from './paintEarthTexture';

/**
 * 地球场景的完整生命周期都放在这里（渲染器 / 相机 / 灯光 / 交互 / 每帧投影）。
 * React 组件只负责挂载容器和城市标记 DOM，这样两边职责清晰，
 * 将来要换渲染方案（例如换成 2D 地图）也只动这一层。
 */

export interface GlobeSceneOptions {
  /** 画布会插入这个元素，尺寸也跟着它变化 */
  host: HTMLElement;
  cities: City[];
  /** 由 React 提供：根据城市 id 取到对应的标记 DOM 元素 */
  getMarkerElement: (cityId: string) => HTMLElement | null;
  onCityArrival: (cityId: string) => void;
  /** 用户设置了"减少动效"时不再自动旋转 */
  respectReducedMotion: boolean;
  /** 球体直径占容器短边的比例，省略则用 globeConfig 里的值 */
  fill?: number;
}

export interface GlobeSceneHandle {
  /** 飞到城市正前方，传 null 取消并恢复交互 */
  setTargetCity: (cityId: string | null) => void;
  /** 指针移动进来时告诉场景位置，用来决定哪个图钉算"被指着" */
  setPointer: (clientX: number, clientY: number) => void;
  clearPointer: () => void;
  /** 热区重叠时按"离指针最近"返回真正该响应的城市，点不到就返回 null */
  pickCity: (clientX: number, clientY: number) => string | null;
  /** 键盘焦点进出图钉时调用：聚焦期间停住自转，避免焦点跟着图钉滑走 */
  setFocusHeld: (held: boolean) => void;
  dispose: () => void;
}

interface MarkerBinding {
  cityId: string;
  /** 城市在球体局部坐标系中的位置 */
  local: THREE.Vector3;
  /** 下面三项每帧刷新，点击命中和高亮都靠它们判断 */
  screenX: number;
  screenY: number;
  facing: number;
}

export function createGlobeScene(options: GlobeSceneOptions): GlobeSceneHandle {
  const { host, cities, getMarkerElement, onCityArrival } = options;
  const colors = activeTheme.globe;
  const cfg = globeConfig;

  const reduceMotion =
    options.respectReducedMotion &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  let width = host.clientWidth || 1;
  let height = host.clientHeight || 1;

  // ---------------------------------------------------------------- 渲染器
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true, // 背景交给页面的复古纸质 CSS，球体浮在纸上
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fill = options.fill ?? cfg.camera.fill;
  // 机位由"球体要占画面多少"反算，容器多大都能正好嵌进预留的圆孔
  const distanceForCurrentSize = () =>
    cameraDistanceForFill(fill * Math.min(1, width / height), cfg.camera.fov, cfg.radius);
  let viewDistance = distanceForCurrentSize();
  const camera = new THREE.PerspectiveCamera(cfg.camera.fov, width / height, cfg.camera.near, cfg.camera.far);
  // 初始机位直接由经纬度算出，进场就正对东亚
  camera.position.copy(
    latLonToVector3(cfg.camera.initialView.lat, cfg.camera.initialView.lon, viewDistance),
  );

  // ---------------------------------------------------------------- 贴图
  const textureWidth = (typeof window !== 'undefined' && window.innerWidth < 760 ? 1024 : cfg.texture.width) as number;
  const canvas = document.createElement('canvas');
  canvas.width = textureWidth;
  canvas.height = textureWidth / 2;
  paintEarthTexture(canvas, {
    polygons: worldLandPolygons,
    colors,
    seed: cfg.texture.seed,
    graticule: cfg.texture.graticule,
    labels: oceanLabels,
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const globeGeometry = new THREE.SphereGeometry(cfg.radius, cfg.sphere.widthSegments, cfg.sphere.heightSegments);
  const globeMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: cfg.material.roughness,
    metalness: cfg.material.metalness,
  });
  const globe = new THREE.Mesh(globeGeometry, globeMaterial);
  scene.add(globe);

  // 暖色光晕：稍大一号的反面球体 + 加法混合。
  // 因为背面被地球挡住（深度测试），最终只有贴近轮廓的一圈亮边可见。
  const atmosphereGeometry = new THREE.SphereGeometry(cfg.radius * cfg.atmosphere.scale, 48, 32);
  const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colors.atmosphere),
    transparent: true,
    opacity: cfg.atmosphere.opacity,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

  // ---------------------------------------------------------------- 灯光
  const keyLight = new THREE.DirectionalLight(new THREE.Color(colors.keyLight), cfg.lighting.keyIntensity);
  keyLight.position.set(...cfg.lighting.keyPosition);
  const fillLight = new THREE.DirectionalLight(new THREE.Color(colors.fillLight), cfg.lighting.fillIntensity);
  fillLight.position.set(...cfg.lighting.fillPosition);
  const ambientLight = new THREE.AmbientLight(new THREE.Color(colors.ambient), cfg.lighting.ambientIntensity);
  scene.add(keyLight, fillLight, ambientLight);

  // ---------------------------------------------------------------- 交互
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = cfg.controls.dampingFactor;
  controls.enablePan = false;
  controls.rotateSpeed = cfg.controls.rotateSpeed;
  controls.zoomSpeed = cfg.controls.zoomSpeed;
  controls.minDistance = viewDistance * cfg.camera.zoom.min;
  controls.maxDistance = viewDistance * cfg.camera.zoom.max;
  controls.minPolarAngle = cfg.controls.minPolarAngle;
  controls.maxPolarAngle = cfg.controls.maxPolarAngle;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = cfg.controls.autoRotateSpeed;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  let targetCity: string | null = null;
  let resumeTimer: number | undefined;
  /**
   * 自转会让图钉以每秒十几个像素横穿屏幕，鼠标要"追着点"，键盘焦点也会慢慢移走。
   * 指针落进某个图钉的命中半径、或键盘焦点停在图钉上时先停住自转；
   * 指针移开图钉后仍按原有延时恢复，拖拽和缩放后的自转节奏不变。
   */
  let pointerNearMarker = false;
  let focusHeld = false;
  const rotationAllowed = () => !reduceMotion && targetCity === null && !pointerNearMarker && !focusHeld;
  const scheduleRotationResume = () => {
    window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => {
      controls.autoRotate = rotationAllowed();
    }, cfg.controls.resumeDelayMs);
  };
  const holdRotation = () => {
    controls.autoRotate = false;
    window.clearTimeout(resumeTimer);
  };

  /**
   * 球体本身不转，是相机绕着它转，
   * 所以飞到某座城市 = 把相机沿最短弧转到这座城市的外法线上。
   */
  const FLIGHT_MS = 1150;
  const identityQuat = new THREE.Quaternion();
  const spinScratch = new THREE.Quaternion();
  let flight: {
    cityId: string;
    from: THREE.Vector3;
    turn: THREE.Quaternion;
    distance: number;
    startedAt: number;
    duration: number;
  } | null = null;

  const onEnd = () => scheduleRotationResume();
  const onStart = () => holdRotation();
  controls.addEventListener('start', onStart);
  controls.addEventListener('end', onEnd);

  const updateFlight = () => {
    if (!flight) return null;
    const t = flight.duration ? Math.min(1, (performance.now() - flight.startedAt) / flight.duration) : 1;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.position
      .copy(flight.from)
      .applyQuaternion(spinScratch.slerpQuaternions(identityQuat, flight.turn, eased))
      .multiplyScalar(flight.distance);
    camera.lookAt(controls.target);
    if (t < 1) return null;
    const { cityId } = flight;
    flight = null;
    return cityId;
  };

  // ---------------------------------------------------------------- 标记投影
  const markers: MarkerBinding[] = cities.map((city) => ({
    cityId: city.id,
    local: latLonToVector3(city.latitude, city.longitude, cfg.radius * 1.005),
    screenX: 0,
    screenY: 0,
    facing: -1,
  }));

  const worldScratch = new THREE.Vector3();
  const screenScratch = new THREE.Vector3();

  const flyToCity = (cityId: string) => {
    const marker = markers.find((item) => item.cityId === cityId);
    if (!marker) return;
    onStart();
    // 清除拖动惯性，让相机抵达后精确停住。
    const positionBeforeUpdate = camera.position.clone();
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    camera.position.copy(positionBeforeUpdate);

    const from = camera.position.clone().normalize();
    const to = marker.local.clone().normalize();
    const angle = from.angleTo(to);
    flight = {
      cityId,
      from,
      turn: new THREE.Quaternion().setFromUnitVectors(from, to),
      distance: camera.position.length(),
      startedAt: performance.now(),
      duration: reduceMotion ? 0 : THREE.MathUtils.lerp(380, FLIGHT_MS, angle / Math.PI),
    };
  };

  let pointer: { x: number; y: number } | null = null;
  let highlighted: string | null = null;

  const toHostCoords = (clientX: number, clientY: number) => {
    const rect = host.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  /** 在还看得见（没转到背面）的图钉里，找离给定点最近的那个 */
  const pickRadius = window.matchMedia?.('(pointer: coarse)').matches
    ? cfg.marker.pickRadiusCoarsePx
    : cfg.marker.pickRadiusPx;
  const nearestMarker = (x: number, y: number): string | null => {
    let picked: string | null = null;
    let bestDistance: number = pickRadius;
    for (const marker of markers) {
      if (fadeByFacing(marker.facing) <= 0.5) continue;
      const distance = Math.hypot(marker.screenX - x, marker.screenY - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        picked = marker.cityId;
      }
    }
    return picked;
  };

  /**
   * 每帧把球面上的城市点投影成容器内的像素坐标，写进 DOM 标记的 transform。
   * 只用 transform 和 opacity，不会触发回流；标记的显示内容由 React 负责。
   */
  const updateMarkers = () => {
    globe.updateMatrixWorld();
    for (const marker of markers) {
      const element = getMarkerElement(marker.cityId);
      if (!element) continue;

      worldScratch.copy(marker.local).applyMatrix4(globe.matrixWorld);
      const facing = facingTowardCamera(worldScratch, camera.position);
      screenScratch.copy(worldScratch).project(camera);

      const x = (screenScratch.x * 0.5 + 0.5) * width;
      const y = (-screenScratch.y * 0.5 + 0.5) * height;
      element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;

      const opacity = fadeByFacing(facing);
      const interactive = opacity > 0.5;
      element.style.opacity = opacity.toFixed(2);
      element.style.pointerEvents = interactive ? 'auto' : 'none';
      // 转到背面的图钉看不见，也不能留一个看不见的 Tab 停留点
      element.tabIndex = interactive ? 0 : -1;

      marker.screenX = x;
      marker.screenY = y;
      marker.facing = facing;
    }

    // 高亮跟着指针走，而不是跟着 DOM 叠放顺序走：两个图钉重叠时才不会出现
    // "鼠标指着南京、弹出来的是上海"这种错位
    const hovered = pointer ? nearestMarker(pointer.x, pointer.y) : null;

    for (const marker of markers) {
      const element = getMarkerElement(marker.cityId);
      if (!element) continue;
      // 选中或正被指着的图钉要压在同位置的邻居上面，否则放大和高亮会被盖住
      element.style.zIndex = marker.cityId === targetCity || marker.cityId === hovered
        ? '101'
        : String(Math.round((marker.facing + 1) * 50));
    }

    if (hovered !== highlighted) {
      highlighted = hovered;
      for (const marker of markers) {
        const element = getMarkerElement(marker.cityId);
        if (element) element.dataset.pick = marker.cityId === hovered ? 'true' : 'false';
      }
    }
  };

  const fadeByFacing = (facing: number) => {
    const { fadeFrom, fadeTo } = cfg.marker;
    if (facing <= fadeFrom) return 0;
    if (facing >= fadeTo) return 1;
    return (facing - fadeFrom) / (fadeTo - fadeFrom);
  };

  // ---------------------------------------------------------------- 帧循环
  let previousFrame: number | null = null;
  const renderFrame = (time: number) => {
    const elapsed = previousFrame === null ? 0 : Math.min(0.05, (time - previousFrame) / 1000);
    previousFrame = time;
    const arrivedCity = updateFlight();
    if (!targetCity) controls.update(elapsed);
    camera.updateMatrixWorld();
    updateMarkers();
    renderer.render(scene, camera);
    if (arrivedCity) onCityArrival(arrivedCity);
  };
  renderer.setAnimationLoop(renderFrame);

  const onVisibilityChange = () => {
    previousFrame = null;
    if (document.hidden) renderer.setAnimationLoop(null);
    else renderer.setAnimationLoop(renderFrame);
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // ---------------------------------------------------------------- 尺寸变化
  const resize = () => {
    width = host.clientWidth || 1;
    height = host.clientHeight || 1;
    const resizedDistance = distanceForCurrentSize();
    const resizeRatio = resizedDistance / viewDistance;
    viewDistance = resizedDistance;
    camera.position.multiplyScalar(resizeRatio);
    if (flight) flight.distance *= resizeRatio;
    controls.minDistance = viewDistance * cfg.camera.zoom.min;
    controls.maxDistance = viewDistance * cfg.camera.zoom.max;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  return {
    setTargetCity(cityId) {
      targetCity = cityId;
      controls.enabled = cityId === null;
      if (cityId) {
        flyToCity(cityId);
      } else {
        flight = null;
        controls.autoRotate = rotationAllowed();
      }
    },
    setPointer(clientX, clientY) {
      pointer = toHostCoords(clientX, clientY);
      // 只有指着图钉时才停自转：在空中拖拽、缩放后仍按原有延时恢复
      const nearMarker = nearestMarker(pointer.x, pointer.y) !== null;
      if (nearMarker !== pointerNearMarker) {
        pointerNearMarker = nearMarker;
        if (nearMarker) holdRotation();
        else scheduleRotationResume();
      }
    },
    clearPointer() {
      pointer = null;
      pointerNearMarker = false;
      scheduleRotationResume();
    },
    pickCity(clientX, clientY) {
      const point = toHostCoords(clientX, clientY);
      return nearestMarker(point.x, point.y);
    },
    setFocusHeld(held) {
      focusHeld = held;
      if (held) holdRotation();
      else scheduleRotationResume();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearTimeout(resumeTimer);
      observer.disconnect();
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      controls.dispose();
      globeGeometry.dispose();
      globeMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      texture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    },
  };
}
