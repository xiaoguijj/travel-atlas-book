/**
 * 地球相关的可调参数集中放在这里：几何、相机、交互、贴图风格。
 * 想微调"转得快一点""贴图更细一点"只需要改这一个文件。
 */

export interface OceanLabel {
  text: string;
  lat: number;
  lon: number;
  /** 手绘感的小角度倾斜（度） */
  tilt: number;
  size: number;
}

export const globeConfig = {
  radius: 1,
  sphere: { widthSegments: 96, heightSegments: 64 },
  texture: {
    /** 等距圆柱投影：宽是高的 2 倍 */
    width: 2048,
    height: 1024,
    /** 固定随机种子，保证每次生成的油画质感一致 */
    seed: 20260721,
    graticule: { longitudeStep: 20, latitudeStep: 15 },
  },
  /**
   * 相机不写死距离，只写"球体直径占容器短边的比例"（fill）。
   * 同一份场景因此既能铺满竖版布局，也能按参考图挖孔的尺寸反算机位；
   * 距离由 cameraDistanceForFill() 换算，缩放范围用相对默认机位的倍率表达。
   */
  camera: {
    fov: 38,
    near: 0.1,
    far: 24,
    fill: 0.8,
    /** 0.58 倍≈放大 1.7 倍，再近就能看到贴图笔触的颗粒；1.42 倍≈缩到 0.7 倍 */
    zoom: { min: 0.58, max: 1.42 },
    /** 进场时正对亚洲，南京/上海/北京一眼可见 */
    initialView: { lat: 31, lon: 108 },
  },
  controls: {
    autoRotateSpeed: 0.65,
    /** 停止操作后隔多久恢复自动旋转 */
    resumeDelayMs: 1200,
    rotateSpeed: 0.52,
    zoomSpeed: 0.55,
    dampingFactor: 0.075,
    /** 限制俯仰，避免转到极点时文字倒置 */
    minPolarAngle: Math.PI * 0.16,
    maxPolarAngle: Math.PI * 0.84,
  },
  /**
   * 参考图里的地球是平涂的，没有明显的明暗交界线，所以环境光占大头。
   * 强度是反推的：环境光 2.6/π ≈ 0.83，主光在正对镜头那面再补 0.18 左右，
   * 合起来接近 1，球面颜色才几乎原样还出贴图，和画上的圆盘接得上。
   */
  lighting: {
    keyIntensity: 1.0,
    fillIntensity: 0.5,
    ambientIntensity: 2.6,
    keyPosition: [-2.6, 1.9, 2.4],
    fillPosition: [2.8, -0.8, -1.6],
  },
  atmosphere: { scale: 1.028, opacity: 0.15 },
  marker: {
    /** 接近球体边缘时开始淡出（1=正对相机，0=切线） */
    fadeFrom: 0.04,
    fadeTo: 0.3,
    /** 命中半径：南京和上海只差 2.7°，图钉会挤在一起，按"最近的一个"决定点谁 */
    pickRadiusPx: 18,
  },
  material: { roughness: 0.94, metalness: 0.02 },
} as const;

/** 贴在海面上的复古地名，纯粹是装饰性排版 */
export const oceanLabels: OceanLabel[] = [
  { text: 'PACIFIC  OCEAN', lat: 2, lon: -156, tilt: -4, size: 0.026 },
  { text: 'ATLANTIC  OCEAN', lat: -14, lon: -32, tilt: 6, size: 0.022 },
  { text: 'INDIAN  OCEAN', lat: -26, lon: 82, tilt: -8, size: 0.022 },
  { text: 'SOUTH  CHINA  SEA', lat: 11, lon: 114, tilt: 3, size: 0.014 },
  { text: 'ARCTIC  OCEAN', lat: 78, lon: -40, tilt: 0, size: 0.018 },
];
