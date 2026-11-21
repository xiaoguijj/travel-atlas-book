/**
 * 生成 src/data/world.ts —— 地球陆地轮廓数据（程序化绘制地球贴图用）。
 *
 * 数据来源：Natural Earth 1:110m（public domain），经 world-atlas 打包成 TopoJSON。
 * 许可：数据本身为 public domain；world-atlas 打包脚本为 ISC。产物内不含任何第三方图片。
 *
 * 用法：npm run data:world   （需要网络；已下载过则复用 .tmp/land-110m.json）
 */
import { mkdirSync, readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://unpkg.com/world-atlas@2.0.2/land-110m.json';
const precision = 1; // 保留 1 位小数 ≈ 11km，在 2048px 贴图上不足 1px，肉眼无差别

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = resolve(root, '.tmp/land-110m.json');
const outFile = resolve(root, 'src/data/world.ts');

async function loadTopology() {
  if (existsSync(cacheFile) && statSync(cacheFile).size > 1000) {
    return JSON.parse(readFileSync(cacheFile, 'utf8'));
  }
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`下载失败：${res.status} ${SOURCE_URL}`);
  const json = await res.json();
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(json));
  return json;
}

/** TopoJSON 的 arc 是「量化 + 增量编码」的整数点列，先还原成经纬度。 */
function decodeArc(topology, index) {
  const reverse = index < 0;
  const arc = topology.arcs[reverse ? ~index : index];
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;

  const points = [];
  let x = 0;
  let y = 0;
  for (const [dx, dy] of arc) {
    x += dx;
    y += dy;
    points.push([x * sx + tx, y * sy + ty]);
  }
  return reverse ? points.reverse() : points;
}

function ringFromArcList(topology, arcList) {
  const ring = [];
  for (const index of arcList) {
    const part = decodeArc(topology, index);
    // 相邻 arc 的接点重复，去掉前一段最后一个点
    for (let i = ring.length === 0 ? 0 : 1; i < part.length; i += 1) {
      ring.push(part[i]);
    }
  }
  return ring;
}

function round(coords) {
  const f = 10 ** precision;
  return coords.map(([lon, lat]) => [Math.round(lon * f) / f, Math.round(lat * f) / f]);
}

function serialize(polygons) {
  const lines = [];
  for (const polygon of polygons) {
    const rings = polygon.map((ring) => `[${ring.map(([x, y]) => `[${x},${y}]`).join(',')}]`);
    lines.push(`  [${rings.join(',')}]`);
  }
  return `[\n${lines.join(',\n')},\n]`;
}

const topology = await loadTopology();
const polygons = [];
let pointCount = 0;

for (const geometry of topology.objects.land.geometries) {
  if (geometry.type !== 'MultiPolygon') throw new Error(`未预期的几何类型：${geometry.type}`);
  for (const rings of geometry.arcs) {
    const polygon = rings
      .map((arcList) => round(ringFromArcList(topology, arcList)))
      // 简化后点过少的环（小岛/毛刺）对手绘风地球没有贡献，丢掉以控制体积
      .filter((ring) => ring.length >= 5);
    if (polygon.length === 0) continue;
    pointCount += polygon.reduce((sum, ring) => sum + ring.length, 0);
    polygons.push(polygon);
  }
}

const file = `/**
 * 世界陆地轮廓（Polygon 数组，每个 Polygon 含若干环，第一个环是外轮廓，其余是内洞）。
 * 坐标为 [经度, 纬度]，十进制度，1 位小数。
 *
 * 本文件由 scripts/build-world-data.mjs 自动生成，请不要手工编辑。
 * 数据源：Natural Earth 1:110m（public domain）/ world-atlas@2 land-110m.json（ISC）。
 */
export type LonLat = [number, number];

export const worldLandPolygons: LonLat[][][] = ${serialize(polygons)};
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, file);
console.log(
  `已生成 ${outFile}\n  Polygon: ${polygons.length}  坐标点: ${pointCount}  体积: ${(file.length / 1024).toFixed(1)} KB`,
);
