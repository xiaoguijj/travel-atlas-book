/**
 * Collage 自由拼贴视觉素材处理脚本：
 *
 *   npm run data:collage
 *
 * 从 assets-source/ 读取生成原图并输出至 src/assets/：
 * - collage-desk.jpg：温润牛皮纸与亚麻旅途书桌底纹（1600 宽）
 * - collage-paper.jpg：空白手工复古棉纸/牛皮纸纹理（1350×1200，精确 9:8 宽幅，无拉伸扩展）
 * - collage-cover.png：做旧牛皮手账封皮（外缘去白底透明抠图，等比拼宽保留缝线与黄铜包角）
 * - collage-clip.png：做旧黄铜长尾夹（外缘及金属丝环内孔去白底透明抠图）
 * - collage-paper-mask.png：手撕毛边纸张不规则轮廓遮罩（1350×1200，精确 9:8）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets-source');
const outDir = path.join(root, 'src/assets');
const stickerOutDir = path.join(outDir, 'collage-stickers');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(stickerOutDir, { recursive: true });

async function buildDesk() {
  const image = await Jimp.read(path.join(sourceDir, 'collage-desk.jpg'));
  if (image.bitmap.width > 1600) image.resize(1600, Jimp.AUTO);
  const out = path.join(outDir, 'collage-desk.jpg');
  await image.quality(82).writeAsync(out, Jimp.MIME_JPEG);
  logResult('collage-desk.jpg', image, out);
}

function cosineBlend(a, b, t) {
  const w = 0.5 - 0.5 * Math.cos(Math.PI * t);
  return Math.round(a * (1 - w) + b * w);
}

function copyBand(src, dst, dstX, srcX, width, height) {
  const srcData = src.bitmap.data;
  const dstData = dst.bitmap.data;
  const srcW = src.bitmap.width;
  const dstW = dst.bitmap.width;
  for (let y = 0; y < height; y += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      const si = (y * srcW + (srcX + dx)) * 4;
      const di = (y * dstW + (dstX + dx)) * 4;
      dstData[di] = srcData[si];
      dstData[di + 1] = srcData[si + 1];
      dstData[di + 2] = srcData[si + 2];
      dstData[di + 3] = srcData[si + 3];
    }
  }
}

async function buildPaper() {
  const source = await Jimp.read(path.join(sourceDir, 'collage-paper.jpg'));
  // Keep 1:1 vertical fiber scale at 1200px height and expand horizontally to 1350×1200 (exact 9:8).
  if (source.bitmap.height !== 1200) source.resize(Jimp.AUTO, 1200);
  const srcW = source.bitmap.width;
  const targetW = 1350;
  const targetH = 1200;
  const image = new Jimp(targetW, targetH, 0xffffffff);

  const srcData = source.bitmap.data;
  const dstData = image.bitmap.data;
  const shiftRight = targetW - srcW;
  const fade1Start = 400;
  const fade1End = 560;
  const fade2Start = 790;
  const fade2End = 950;
  const clampX = (x) => Math.max(0, Math.min(srcW - 1, x));

  for (let y = 0; y < targetH; y += 1) {
    for (let x = 0; x < targetW; x += 1) {
      const di = (y * targetW + x) * 4;
      const sxLeft = clampX(x);
      const sxRight = clampX(x - shiftRight);
      const sxMid = clampX(Math.round(srcW - 1 - (x - shiftRight / 2)));

      let wLeft = 0;
      let wMid = 0;
      let wRight = 0;
      if (x < fade1Start) {
        wLeft = 1;
      } else if (x < fade1End) {
        const t = (x - fade1Start + 0.5) / (fade1End - fade1Start);
        wMid = 0.5 - 0.5 * Math.cos(Math.PI * t);
        wLeft = 1 - wMid;
      } else if (x < fade2Start) {
        wMid = 1;
      } else if (x < fade2End) {
        const t = (x - fade2Start + 0.5) / (fade2End - fade2Start);
        wRight = 0.5 - 0.5 * Math.cos(Math.PI * t);
        wMid = 1 - wRight;
      } else {
        wRight = 1;
      }

      const li = (y * srcW + sxLeft) * 4;
      const mi = (y * srcW + sxMid) * 4;
      const ri = (y * srcW + sxRight) * 4;
      for (let c = 0; c < 3; c += 1) {
        dstData[di + c] = Math.round(srcData[li + c] * wLeft + srcData[mi + c] * wMid + srcData[ri + c] * wRight);
      }
      dstData[di + 3] = 255;
    }
  }

  // 减轻重度污渍与泛黄，保留细腻棉纸纤维，呈现精致旅行纪念手账纸感。
  const { data } = image.bitmap;
  const targetR = 250;
  const targetG = 242;
  const targetB = 224;
  const liftBlend = 0.56;
  for (let i = 0; i < data.length; i += 4) {
    const r = Math.max(168, data[i]);
    const g = Math.max(152, data[i + 1]);
    const b = Math.max(126, data[i + 2]);
    data[i] = Math.round(r + (targetR - r) * liftBlend);
    data[i + 1] = Math.round(g + (targetG - g) * liftBlend);
    data[i + 2] = Math.round(b + (targetB - b) * liftBlend);
  }
  const out = path.join(outDir, 'collage-paper.jpg');
  await image.quality(86).writeAsync(out, Jimp.MIME_JPEG);
  logResult('collage-paper.jpg', image, out);
}

function findBestCoverSeam(img, targetWidth) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const extra = targetWidth - w;
  const { data } = img.bitmap;
  let best = { leftCut: 500, rightResume: 500 - extra, score: Infinity };

  for (let leftCut = 440; leftCut <= 512; leftCut += 1) {
    const rightResume = leftCut - extra;
    if (rightResume < 145 || rightResume > 220) continue;
    let score = 0;
    for (let dx = -4; dx <= 4; dx += 1) {
      const x1 = leftCut + dx;
      const x2 = rightResume + dx;
      for (let y = 0; y < h; y += 1) {
        if (y >= 55 && y <= h - 55) continue;
        const i1 = (y * w + x1) * 4;
        const i2 = (y * w + x2) * 4;
        score += Math.abs(data[i1] - data[i2])
          + Math.abs(data[i1 + 1] - data[i2 + 1])
          + Math.abs(data[i1 + 2] - data[i2 + 2])
          + Math.abs(data[i1 + 3] - data[i2 + 3]) * 2;
      }
    }
    if (score < best.score) best = { leftCut, rightResume, score };
  }
  return best;
}

async function buildCover() {
  const source = await Jimp.read(path.join(sourceDir, 'collage-cover.jpg'));
  const box = cutOutNeutralBackground(source, { minLum: 230, maxSpread: 26, interiorMinPixels: 0 });
  source.crop(box.x, box.y, box.w, box.h);
  source.resize(680, Jimp.AUTO);

  // Widen the leather cover to match the 9:8 wide canvas (~1036×914) without stretching spine, stitching, or brass corners.
  const srcW = source.bitmap.width;
  const h = source.bitmap.height;
  const targetW = 1036;
  const { leftCut, rightResume } = findBestCoverSeam(source, targetW);
  const image = new Jimp(targetW, h, 0x00000000);

  copyBand(source, image, 0, 0, leftCut, h);
  copyBand(source, image, leftCut, rightResume, srcW - rightResume, h);

  const srcData = source.bitmap.data;
  const dstData = image.bitmap.data;
  for (let y = 0; y < h; y += 1) {
    const isBorder = y < 55 || y > h - 55;
    const half = isBorder ? 6 : 36;
    for (let dx = -half; dx < half; dx += 1) {
      const dstX = leftCut + dx;
      const sxLeft = leftCut + dx;
      const sxRight = rightResume + dx;
      if (dstX < 0 || dstX >= targetW || sxLeft < 0 || sxLeft >= srcW || sxRight < 0 || sxRight >= srcW) continue;
      const t = (dx + half + 0.5) / (half * 2);
      const il = (y * srcW + sxLeft) * 4;
      const ir = (y * srcW + sxRight) * 4;
      const di = (y * targetW + dstX) * 4;
      dstData[di] = cosineBlend(srcData[il], srcData[ir], t);
      dstData[di + 1] = cosineBlend(srcData[il + 1], srcData[ir + 1], t);
      dstData[di + 2] = cosineBlend(srcData[il + 2], srcData[ir + 2], t);
      dstData[di + 3] = cosineBlend(srcData[il + 3], srcData[ir + 3], t);
    }
  }

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
  const w = 1350;
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

async function buildDecorativeStickers() {
  const items = [
    { src: 'collage-sticker-washi-tape.jpg', out: 'collage-washi-tape.png', minLum: 234, maxSpread: 22 },
    { src: 'collage-sticker-torn-note.jpg', out: 'collage-torn-note.png', minLum: 238, maxSpread: 18 },
    { src: 'collage-sticker-ginkgo-leaf.jpg', out: 'collage-ginkgo-leaf.png', minLum: 230, maxSpread: 22 },
  ];
  for (const item of items) {
    const from = path.join(sourceDir, item.src);
    if (!fs.existsSync(from)) continue;
    const image = await Jimp.read(from);
    const box = cutOutNeutralBackground(image, { minLum: item.minLum, maxSpread: item.maxSpread, interiorMinPixels: 0 });
    image.crop(box.x, box.y, box.w, box.h);
    if (Math.max(image.bitmap.width, image.bitmap.height) > 384) {
      image.resize(
        image.bitmap.width >= image.bitmap.height ? 384 : Jimp.AUTO,
        image.bitmap.height > image.bitmap.width ? 384 : Jimp.AUTO,
      );
    }
    const out = path.join(stickerOutDir, item.out);
    await image.deflateLevel(9).writeAsync(out);
    logResult(`collage-stickers/${item.out}`, image, out);
  }
}

await buildDesk();
await buildPaper();
await buildCover();
await buildClip();
await buildPaperMask();
await buildDecorativeStickers();
