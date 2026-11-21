import type { OceanLabel } from '../config/globe';
import type { GlobeColorToken } from '../config/theme';
import type { LonLat } from '../data/world';

/**
 * 用 Canvas 2D 画一张"油画感"的等距圆柱投影地球贴图。
 *
 * 为什么自己画而不用现成的卫星图：
 * 1. 不需要下载图片，首屏没有额外的网络请求；
 * 2. 完全没有版权风险；
 * 3. 用固定随机种子绘制，每次生成结果一致，风格可随主题配置调整。
 */

export interface EarthTextureOptions {
  /** 陆地多边形，坐标是 [经度, 纬度] */
  polygons: LonLat[][][];
  colors: GlobeColorToken;
  seed: number;
  graticule: { longitudeStep: number; latitudeStep: number };
  labels: OceanLabel[];
}

interface PaintEnv {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** 相对 2048 宽度的尺寸系数，保证换分辨率后笔触密度不变 */
  s: number;
  colors: GlobeColorToken;
  random: () => number;
}

interface LandPath {
  path: Path2D;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const projectX = (lon: number, w: number) => ((lon + 180) / 360) * w;
const projectY = (lat: number, h: number) => ((90 - lat) / 180) * h;

export function paintEarthTexture(canvas: HTMLCanvasElement, options: EarthTextureOptions): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 2D，无法绘制地球贴图');

  const w = canvas.width;
  const h = canvas.height;
  const env: PaintEnv = {
    ctx,
    w,
    h,
    s: w / 2048,
    colors: options.colors,
    random: createRandom(options.seed),
  };

  ctx.clearRect(0, 0, w, h);
  paintOcean(env);
  const land = buildLandPaths(env, options.polygons);
  paintLand(env, land);
  paintIceCaps(env);
  paintGraticule(env, options.graticule);
  paintLabels(env, options.labels);
  paintPaperGrain(env);
}

/* ------------------------------------------------------------------ 海洋 */

function paintOcean(env: PaintEnv): void {
  const { ctx, w, h, colors, random, s } = env;

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, colors.oceanDeep);
  base.addColorStop(0.22, colors.oceanMid);
  base.addColorStop(0.5, colors.oceanShallow);
  base.addColorStop(0.78, colors.oceanMid);
  base.addColorStop(1, colors.oceanDeep);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // 洋流般的短笔触：横向拉长的椭圆，透明度很低，叠出油画的厚薄感
  const currentColors = [colors.oceanMid, colors.oceanShallow, colors.oceanHighlight, colors.oceanDeep];
  for (let i = 0; i < 1100; i += 1) {
    const y = random() * h;
    const latitude = Math.abs(y / h - 0.5) * 2; // 0 赤道 → 1 极点
    brush(
      ctx,
      random() * w,
      y,
      range(random, 14, 62) * s * (1 - latitude * 0.35),
      range(random, 2.5, 8) * s,
      range(random, -0.28, 0.28) + latitude * range(random, -0.5, 0.5),
      pick(random, currentColors),
      range(random, 0.03, 0.075),
    );
  }
}

/* ------------------------------------------------------------------ 陆地 */

/**
 * 把每个 Polygon 转成 Path2D。
 * 跨越 180° 经线的陆地（如俄罗斯楚科奇）在展开时会被切成两段，
 * 这里把环" unwrap "成连续像素坐标，再按需要补一份偏移 w 的副本，
 * 使它在贴图两侧都能接上。
 */
function buildLandPaths(env: PaintEnv, polygons: LonLat[][][]): LandPath[] {
  const { w, h } = env;
  const result: LandPath[] = [];

  for (const rings of polygons) {
    const pixelRings = rings.map((ring) => toPixelRing(ring, w, h));
    const outer = pixelRings[0];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of outer) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const offsets = [0];
    if (minX < 0) offsets.push(w);
    if (maxX > w) offsets.push(-w);

    const path = new Path2D();
    for (const offset of offsets) {
      for (const ring of pixelRings) {
        path.moveTo(ring[0][0] + offset, ring[0][1]);
        for (let i = 1; i < ring.length; i += 1) {
          path.lineTo(ring[i][0] + offset, ring[i][1]);
        }
        path.closePath();
      }
    }

    result.push({ path, minX, maxX, minY, maxY });
  }
  return result;
}

function toPixelRing(ring: LonLat[], w: number, h: number): [number, number][] {
  const points: [number, number][] = [];
  let shift = 0;
  let prevX: number | null = null;

  for (const [lon, lat] of ring) {
    const raw = projectX(lon, w);
    let x = raw + shift;
    // 相邻两点横向跳了大半个贴图宽度，说明越过了 180° 经线
    if (prevX !== null && Math.abs(x - prevX) > w / 2) {
      shift += x > prevX ? -w : w;
      x = raw + shift;
    }
    points.push([x, projectY(lat, h)]);
    prevX = x;
  }
  return points;
}

function paintLand(env: PaintEnv, land: LandPath[]): void {
  const { ctx, w, h, colors, random, s } = env;

  // 随纬度变化的底色：两极冷、回归线一带暖，读起来像老地图的手涂上色
  const fill = ctx.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, colors.landCool);
  fill.addColorStop(0.3, colors.landBase);
  fill.addColorStop(0.5, colors.landWarm);
  fill.addColorStop(0.7, colors.landBase);
  fill.addColorStop(1, colors.landCool);

  ctx.save();
  ctx.fillStyle = fill;
  for (const item of land) ctx.fill(item.path, 'evenodd');
  ctx.restore();

  // 海岸外侧的浅色"洗"，模拟油画堆在边缘的颜料
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = colors.coastWash;
  ctx.lineWidth = Math.max(4, 7 * s);
  ctx.lineJoin = 'round';
  for (const item of land) ctx.stroke(item.path);
  ctx.restore();

  // 墨色海岸线
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = colors.landEdge;
  ctx.lineWidth = Math.max(1.1, 1.9 * s);
  ctx.lineJoin = 'round';
  for (const item of land) ctx.stroke(item.path);
  ctx.restore();

  // 大块陆地内部再叠笔触（小岛略过，省下大量 clip 开销）
  const textureColors = [colors.landWarm, colors.landBase, colors.landCool, colors.coastWash];
  const canvasArea = w * h;
  for (const item of land) {
    const area = (item.maxX - item.minX) * (item.maxY - item.minY);
    if (area < canvasArea * 0.004) continue;

    const boxW = item.maxX - item.minX;
    const boxH = item.maxY - item.minY;
    const dabs = Math.min(300, Math.round((area / canvasArea) * 1400));

    ctx.save();
    ctx.clip(item.path, 'evenodd');
    for (let i = 0; i < dabs; i += 1) {
      brush(
        ctx,
        item.minX + random() * boxW,
        item.minY + random() * boxH,
        range(random, 8, 34) * s,
        range(random, 3, 10) * s,
        range(random, -0.9, 0.9),
        pick(random, textureColors),
        range(random, 0.04, 0.1),
      );
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ 冰与经纬网 */

function paintIceCaps(env: PaintEnv): void {
  const { ctx, w, h, colors, random, s } = env;
  const band = h * 0.115;

  for (const top of [true, false]) {
    for (let i = 0; i < 320; i += 1) {
      const t = random();
      // 越靠近极点越密
      const y = top ? t * t * band : h - t * t * band;
      brush(
        ctx,
        random() * w,
        y,
        range(random, 10, 46) * s,
        range(random, 3, 9) * s,
        range(random, -0.3, 0.3),
        colors.ice,
        range(random, 0.05, 0.16),
      );
    }
  }
}

function paintGraticule(
  env: PaintEnv,
  steps: { longitudeStep: number; latitudeStep: number },
): void {
  const { ctx, w, h, colors, s } = env;
  ctx.save();
  ctx.strokeStyle = colors.graticule;
  ctx.lineWidth = Math.max(1, 1.2 * s);

  for (let lon = -180 + steps.longitudeStep; lon < 180; lon += steps.longitudeStep) {
    const x = projectX(lon, w);
    ctx.globalAlpha = lon === 0 ? 0.13 : 0.05;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  for (let lat = -90 + steps.latitudeStep; lat < 90; lat += steps.latitudeStep) {
    const y = projectY(lat, h);
    ctx.globalAlpha = 0.045;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // 赤道、回归线、极圈是老地图的标志性线条
  const specialParallels = [0, 23.5, -23.5, 66.5, -66.5];
  for (const lat of specialParallels) {
    const isEquator = lat === 0;
    ctx.globalAlpha = isEquator ? 0.17 : 0.11;
    ctx.setLineDash(isEquator ? [] : [9 * s, 9 * s]);
    ctx.beginPath();
    ctx.moveTo(0, projectY(lat, h));
    ctx.lineTo(w, projectY(lat, h));
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function paintLabels(env: PaintEnv, labels: OceanLabel[]): void {
  const { ctx, w, h, colors } = env;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.label;
  ctx.globalAlpha = 0.3;
  // 字距是较新的 Canvas 特性，旧浏览器上会退化成普通排字
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  spaced.letterSpacing = `${Math.round(w * 0.0022)}px`;

  for (const label of labels) {
    const x = projectX(label.lon, w);
    const y = projectY(label.lat, h);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((label.tilt * Math.PI) / 180);
    ctx.font = `italic ${Math.round(h * label.size)}px Georgia, "Times New Roman", serif`;
    ctx.fillText(label.text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ 纸感 */

function paintPaperGrain(env: PaintEnv): void {
  const { ctx, w, h, colors, random, s } = env;

  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = colors.grain;
  for (let i = 0; i < 2400; i += 1) {
    ctx.fillRect(random() * w, random() * h, Math.max(1, s), Math.max(1, s));
  }
  ctx.restore();

  // 一层暖色薄雾统一色调
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, 'rgba(216, 194, 148, 0.3)');
  wash.addColorStop(0.55, 'rgba(216, 194, 148, 0.06)');
  wash.addColorStop(1, 'rgba(132, 145, 122, 0.22)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/* ------------------------------------------------------------------ 小工具 */

function brush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  angle: number,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** mulberry32：短小稳定的伪随机数生成器，固定种子 => 固定画面 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (random: () => number, min: number, max: number) => min + random() * (max - min);
const pick = <T>(random: () => number, list: T[]): T => list[Math.floor(random() * list.length)];
