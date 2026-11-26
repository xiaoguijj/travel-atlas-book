/**
 * Collage 自由拼贴视觉素材处理脚本：
 *
 *   npm run data:collage
 *
 * 从 assets-source/ 读取生成原图并输出至 src/assets/：
 * - collage-desk.jpg：温润牛皮纸与亚麻旅途书桌底纹（1600 宽）
 * - collage-paper.jpg：空白手工复古棉纸/牛皮纸纹理（900×1200，精确 3:4）
 * - collage-cover.png：做旧牛皮手账封皮（外缘去白底透明抠图，保留缝线与黄铜包角）
 * - collage-clip.png：做旧黄铜长尾夹（外缘及金属丝环内孔去白底透明抠图）
 * - collage-paper-mask.png：手撕毛边纸张不规则轮廓遮罩（900×1200）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets-source');
const outDir = path.join(root, 'src/assets');
fs.mkdirSync(outDir, { recursive: true });

async function buildDesk() {
  const image = await Jimp.read(path.join(sourceDir, 'collage-desk.jpg'));
  if (image.bitmap.width > 1600) image.resize(1600, Jimp.AUTO);
  const out = path.join(outDir, 'collage-desk.jpg');
  await image.quality(82).writeAsync(out, Jimp.MIME_JPEG);
  logResult('collage-desk.jpg', image, out);
}

async function buildPaper() {
  const image = await Jimp.read(path.join(sourceDir, 'collage-paper.jpg'));
  // Force exact 3:4 aspect ratio (900x1200) for clean 1200x1600 stage alignment.
  image.cover(900, 1200);
  const out = path.join(outDir, 'collage-paper.jpg');
  await image.quality(84).writeAsync(out, Jimp.MIME_JPEG);
  logResult('collage-paper.jpg', image, out);
}

async function buildCover() {
  const image = await Jimp.read(path.join(sourceDir, 'collage-cover.jpg'));
  const box = cutOutNeutralBackground(image, { minLum: 230, maxSpread: 26, interiorMinPixels: 0 });
  image.crop(box.x, box.y, box.w, box.h);
  image.resize(680, Jimp.AUTO);
  const out = path.join(outDir, 'collage-cover.png');
  await image.deflateLevel(9).writeAsync(out);
  logResult('collage-cover.png', image, out);
}

async function buildClip() {
  const image = await Jimp.read(path.join(sourceDir, 'collage-clip.jpg'));
  const box = cutOutNeutralBackground(image, { minLum: 232, maxSpread: 22, interiorMinPixels: 180 });
  image.crop(box.x, box.y, box.w, box.h);
  image.resize(240, Jimp.AUTO);
  const out = path.join(outDir, 'collage-clip.png');
  await image.deflateLevel(9).writeAsync(out);
  logResult('collage-clip.png', image, out);
}

async function buildPaperMask() {
  const w = 900;
  const h = 1200;
  const mask = new Jimp(w, h, 0x00000000);
  const { data } = mask.bitmap;

  const noise1D = (t, seed) => (
    Math.sin(t * 0.043 + seed) * 1.9
    + Math.sin(t * 0.117 + seed * 2.1) * 1.25
    + Math.sin(t * 0.289 + seed * 3.7) * 0.75
    + Math.sin(t * 0.613 + seed * 5.3) * 0.45
  );

  // Outer ~5-9px organic deckle with subtle worn corners, keeping interior 98%+ completely solid.
  const baseInset = 6.5;
  const topEdge = new Float32Array(w);
  const bottomEdge = new Float32Array(w);
  for (let x = 0; x < w; x += 1) {
    const cornerWear = Math.exp(-Math.min(x, w - 1 - x) / 28) * 3.5;
    topEdge[x] = baseInset + noise1D(x, 1.3) + cornerWear;
    bottomEdge[x] = h - 1 - (baseInset + noise1D(x, 4.7) + cornerWear);
  }
  const leftEdge = new Float32Array(h);
  const rightEdge = new Float32Array(h);
  for (let y = 0; y < h; y += 1) {
    const cornerWear = Math.exp(-Math.min(y, h - 1 - y) / 28) * 3.5;
    leftEdge[y] = baseInset + noise1D(y, 7.9) + cornerWear;
    rightEdge[y] = w - 1 - (baseInset + noise1D(y, 11.4) + cornerWear);
  }

  for (let y = 0; y < h; y += 1) {
    const lx = leftEdge[y];
    const rx = rightEdge[y];
    for (let x = 0; x < w; x += 1) {
      const distLeft = x - lx;
      const distRight = rx - x;
      const distTop = y - topEdge[x];
      const distBottom = bottomEdge[x] - y;
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);
      const alpha = Math.max(0, Math.min(255, Math.round((minDist + 0.6) * 190)));
      const idx = (y * w + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = alpha;
    }
  }

  const out = path.join(outDir, 'collage-paper-mask.png');
  await mask.deflateLevel(9).writeAsync(out);
  logResult('collage-paper-mask.png', mask, out);
}

/**
 * Flood-fill outer neutral light background to transparent, optionally also removing
 * large enclosed neutral holes (e.g. inside binder clip wire handles), then soften 1px edge.
 */
function cutOutNeutralBackground(img, { minLum, maxSpread, interiorMinPixels }) {
  const { width: w, height: h, data } = img.bitmap;
  const total = w * h;
  const isNeutralWhite = (i) => {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const avg = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    return avg >= minLum && spread <= maxSpread;
  };

  const keep = new Uint8Array(total);
  keep.fill(1);
  const visited = new Uint8Array(total);
  const queue = [];
  const push = (i) => {
    if (!visited[i]) {
      visited[i] = 1;
      queue.push(i);
    }
  };

  for (let x = 0; x < w; x += 1) {
    if (isNeutralWhite(x)) push(x);
    const b = (h - 1) * w + x;
    if (isNeutralWhite(b)) push(b);
  }
  for (let y = 1; y < h - 1; y += 1) {
    const l = y * w;
    if (isNeutralWhite(l)) push(l);
    const r = y * w + w - 1;
    if (isNeutralWhite(r)) push(r);
  }

  for (let p = 0; p < queue.length; p += 1) {
    const i = queue[p];
    keep[i] = 0;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0 && isNeutralWhite(i - 1)) push(i - 1);
    if (x < w - 1 && isNeutralWhite(i + 1)) push(i + 1);
    if (y > 0 && isNeutralWhite(i - w)) push(i - w);
    if (y < h - 1 && isNeutralWhite(i + w)) push(i + w);
  }

  if (interiorMinPixels > 0) {
    // Also detect enclosed pure-white holes (wire clip handle loops) above minimum area.
    const holeVisited = new Uint8Array(total);
    for (let start = 0; start < total; start += 1) {
      if (!keep[start] || holeVisited[start] || !isNeutralWhite(start)) continue;
      const comp = [start];
      holeVisited[start] = 1;
      for (let p = 0; p < comp.length; p += 1) {
        const i = comp[p];
        const x = i % w;
        const y = (i - x) / w;
        const neighbors = [
          x > 0 ? i - 1 : -1,
          x < w - 1 ? i + 1 : -1,
          y > 0 ? i - w : -1,
          y < h - 1 ? i + w : -1,
        ];
        for (const n of neighbors) {
          if (n >= 0 && keep[n] && !holeVisited[n] && isNeutralWhite(n)) {
            holeVisited[n] = 1;
            comp.push(n);
          }
        }
      }
      if (comp.length >= interiorMinPixels) {
        for (const i of comp) keep[i] = 0;
      }
    }
  }

  // Erode 1px outer fringe and 3x3 average alpha for clean anti-aliased cutout.
  const eroded = Uint8Array.from(keep);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (!keep[i]) continue;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx >= 0 && xx < w) sum += keep[yy * w + xx];
        }
      }
      eroded[i] = sum >= 8 ? 1 : 0;
    }
  }

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx >= 0 && xx < w) {
            sum += eroded[yy * w + xx];
            count += 1;
          }
        }
      }
      data[i * 4 + 3] = Math.round((255 * sum) / count);
    }
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h };
  minX = Math.max(0, minX - 2);
  minY = Math.max(0, minY - 2);
  maxX = Math.min(w - 1, maxX + 2);
  maxY = Math.min(h - 1, maxY + 2);
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function logResult(name, image, outPath) {
  console.log(`${name}：${image.bitmap.width}×${image.bitmap.height}，${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
}

await buildDesk();
await buildPaper();
await buildCover();
await buildClip();
await buildPaperMask();
