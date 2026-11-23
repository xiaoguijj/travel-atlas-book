import fs from 'node:fs';
import path from 'node:path';
import Jimp from 'jimp';

/**
 * 把需求方给的 34 张贴纸原图处理成 src/assets/stickers 下的带透明 PNG。
 *
 * 原图有三种来历：GPT 生成的 RGBA 抠图件（四周本来就是透明的）、
 * 只有 RGB 的方形生成图（四周是一整片白或米色）、以及 JPEG（不可能带 alpha）。
 * 手账上贴的必须是"按轮廓剪下来"的贴纸，方方正正一块白底贴在横线上就很假，
 * 所以这里统一做：从四边往里漫水填充背景色 → 抠成透明 → 收掉一圈白边晕 → 按包围盒紧裁。
 *
 * 已经带透明的图只做紧裁，不再腐蚀——梅枝、绸伞穗子这类细笔画经不起再削一圈。
 *
 * 底色判定只认"近白"（均值 ≥232 且三通道极差 ≤22）：24 张城市文化贴纸和留声机、
 * 相机、火车是这种白底，抠掉就对了。另外七张不是——六枚城市邮票和那张向日葵邮票
 * 画的就是满幅票面，四周的米黄是邮票自己的纸，抠了等于把邮票抠烂，所以保持矩形。
 *
 * 原图 70MB 不进版本库：解压后放在 .tmp/sticker-source/（已在 .gitignore 里），
 * 重新生成：node scripts/build-sticker-assets.mjs [源目录]
 */

const srcDir = process.argv[2] ?? '.tmp/sticker-source';
const outDir = 'src/assets/stickers';
/**
 * 384px 是量出来的：贴纸在手账纸上最大也就画幅宽度的两成左右（约 160 CSS px），
 * 再按 2 倍屏留一倍余量就够了。
 *
 * 格式只有 PNG 和 JPEG 两种：仓库里的 jimp 0.22 只装了 jpeg/png 两个编解码器，
 * 写 .webp 只会把 PNG 字节挂上 .webp 后缀（浏览器靠嗅探还能显示，但 MIME 和文件名都是骗人的）。
 * 要换 WebP/AVIF 得先给 devDependencies 补编码器，那是后面瘦身的一刀，不在这里偷偷做。
 */
const MAX_EDGE = 384;

/** raw 是 zip 里的原名（不少没有扩展名），id 就是产物文件名，也是 stickerId 的前缀 */
const sources = [
  { raw: 'music.jpg', id: 'common-gramophone' },
  { raw: '邮票.jpg', id: 'common-postage-sunflower' },
  { raw: '相机.jpg', id: 'common-camera' },
  { raw: '火车', id: 'common-train' },

  { raw: '北京5.png', id: 'stamp-beijing' },
  { raw: '上海5.png', id: 'stamp-shanghai' },
  { raw: '成都5', id: 'stamp-chengdu' },
  { raw: '南京5.png', id: 'stamp-nanjing' },
  { raw: '西安5.png', id: 'stamp-xian' },
  { raw: '杭州5.png', id: 'stamp-hangzhou' },

  { raw: '北京1.png', id: 'beijing-ditan-park' },
  { raw: '北京2.png', id: 'beijing-chrysanthemum' },
  { raw: '北京3.png', id: 'beijing-jingju-opera' },
  { raw: '北京4.png', id: 'beijing-peking-duck' },
  { raw: '上海1', id: 'shanghai-magnolia' },
  { raw: '上海2', id: 'shanghai-shengjian' },
  { raw: '上海3.png', id: 'shanghai-wukang-mansion' },
  { raw: '上海4', id: 'shanghai-qipao-girl' },
  { raw: '成都1', id: 'chengdu-wuhou-shrine' },
  { raw: '成都2', id: 'chengdu-dandan-noodles' },
  { raw: '成都3', id: 'chengdu-sichuan-opera' },
  { raw: '成都4', id: 'chengdu-shu-embroidery' },
  { raw: '南京1', id: 'nanjing-jimingsi-temple' },
  { raw: '南京2', id: 'nanjing-duck-vermicelli' },
  { raw: '南京3', id: 'nanjing-plum-blossom' },
  { raw: '南京4', id: 'nanjing-yunjin-silk' },
  { raw: '西安1', id: 'xian-terracotta-warrior' },
  { raw: '西安2', id: 'xian-lamb-stew' },
  { raw: '西安3', id: 'xian-wild-goose-pagoda' },
  { raw: '西安4', id: 'xian-pomegranate-flower' },
  { raw: '杭州1', id: 'hangzhou-leifeng-pagoda' },
  { raw: '杭州2', id: 'hangzhou-dongpo-pork' },
  { raw: '杭州3', id: 'hangzhou-osmanthus' },
  { raw: '杭州4', id: 'hangzhou-silk-umbrella' },
];

fs.mkdirSync(outDir, { recursive: true });

const rows = [];
for (const { raw, id } of sources) {
  const from = path.join(srcDir, raw);
  if (!fs.existsSync(from)) {
    rows.push({ id, raw, note: '源文件缺失' });
    continue;
  }
  const img = await Jimp.read(from);
  const before = { w: img.bitmap.width, h: img.bitmap.height };
  const stat = cutOut(img);
  img.crop(stat.x, stat.y, stat.w, stat.h);
  if (Math.max(img.bitmap.width, img.bitmap.height) > MAX_EDGE) {
    img.resize(img.bitmap.width >= img.bitmap.height ? MAX_EDGE : Jimp.AUTO, img.bitmap.height > img.bitmap.width ? MAX_EDGE : Jimp.AUTO);
  }
  /**
   * 抠完还整幅不透明的只有那七张邮票——票面本来就是矩形，带 alpha 通道纯属浪费，
   * 存 JPEG 单张从 250KB 掉到 30KB 左右。其余一律 PNG，透明是贴纸的命根子。
   */
  const transparent = hasTransparency(img);
  const to = path.join(outDir, `${id}.${transparent ? 'png' : 'jpg'}`);
  if (transparent) await img.deflateLevel(9).writeAsync(to);
  else await img.quality(82).writeAsync(to);
  rows.push({
    id,
    raw,
    note: stat.note,
    src: `${before.w}x${before.h}`,
    cut: `${img.bitmap.width}x${img.bitmap.height}`,
    kb: Math.round(fs.statSync(to).size / 1024),
  });
}

console.table(rows);

/**
 * 顺手把每张贴纸裁完之后的真实尺寸写成 src/stickers/sizes.ts。
 * 页面要靠它算 aspect-ratio 和把手偏移——手写 34 组数字迟早和图对不上，
 * 让脚本在裁完的那一刻一起写出来，图和尺寸就永远不会分家。
 */
const table = rows
  .filter((row) => row.cut)
  .map((row) => {
    const [w, h] = row.cut.split('x').map(Number);
    return `  '${row.id}': [${w}, ${h}],`;
  })
  .join('\n');
fs.mkdirSync('src/stickers', { recursive: true });
fs.writeFileSync(
  'src/stickers/sizes.ts',
  `/** 由 scripts/build-sticker-assets.mjs 生成，改图请重跑脚本，不要手改。 */\n\n` +
    `/** 贴纸 id → 裁切后的像素宽高，用来算长宽比和选中框偏移 */\n` +
    `export const stickerSizes: Readonly<Record<string, readonly [number, number]>> = {\n${table}\n};\n`,
);
console.log(`src/stickers/sizes.ts: ${rows.filter((r) => r.cut).length} 条`);

function hasTransparency(img) {
  const data = img.bitmap.data;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return true;
  return false;
}

/**
 * 漫水填充抠背景，返回抠完之后前景的包围盒。
 * 直接改 bitmap.data 的 alpha，不新建图层，省内存也快。
 */
function cutOut(img) {
  const { width: w, height: h, data } = img.bitmap;
  const alphaAt = (i) => data[i * 4 + 3];
  const seen = new Uint8Array(w * h);
  const queue = [];

  // 1) 四边采样：先分清"本来就抠好的 RGBA"和"一整片白纸底"
  const ring = [];
  for (let x = 0; x < w; x += 1) ring.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y += 1) ring.push(y * w, y * w + w - 1);
  const solidRing = ring.filter((i) => alphaAt(i) >= 200);
  const voidRing = ring.filter((i) => alphaAt(i) < 128);

  if (voidRing.length / ring.length < 0.25) {
    // 边上几乎全是实底，说明有一整片背景可以抠
    const seed = modalColor(solidRing.map((i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]));
    const spread = Math.max(...seed) - Math.min(...seed);
    const nearSeed = solidRing.filter((i) => dist(i, seed) <= 40).length / solidRing.length;
    const isPaperWhite = (seed[0] + seed[1] + seed[2]) / 3 >= 232 && spread <= 22;
    if (!isPaperWhite || nearSeed < 0.6) {
      // 满幅票面不抠底，但原图四周那圈牛皮纸得裁掉：齿孔边才是贴纸自己的边缘
      return { ...trimPaper(img), note: `票面紧裁，去牛皮纸 rgb(${seed.join(',')})` };
    }
    for (const i of solidRing) if (dist(i, seed) <= 40) push(i);
    flood((i) => dist(i, seed) <= 40, /* keyedByColor */ true);
    return { ...shrinkTo(w, h, data), note: `抠底 rgb(${seed.join(',')})` };
  }

  // 2) 原图已经按轮廓抠好：只把 alpha<8 的浮尘清掉，然后紧裁，不再腐蚀
  for (let i = 0; i < w * h; i += 1) if (alphaAt(i) < 8) data[i * 4 + 3] = 0;
  return { ...shrinkTo(w, h, data), note: '原图已透明' };

  function dist(i, rgb) {
    return Math.abs(data[i * 4] - rgb[0]) + Math.abs(data[i * 4 + 1] - rgb[1]) + Math.abs(data[i * 4 + 2] - rgb[2]);
  }
  function push(i) {
    if (!seen[i]) {
      seen[i] = 1;
      queue.push(i);
    }
  }
  /** 从四边往里长，只有"和外部连通"的背景会被抠掉，画内部的白色不会误伤 */
  function flood(isBackground, keyedByColor) {
    const keep = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i += 1) keep[i] = alphaAt(i) > 0 ? 1 : 0;
    for (let p = 0; p < queue.length; p += 1) {
      const i = queue[p];
      if (keyedByColor) data[i * 4 + 3] = 0;
      keep[i] = 0;
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0 && keep[i - 1] && isBackground(i - 1)) push(i - 1);
      if (x < w - 1 && keep[i + 1] && isBackground(i + 1)) push(i + 1);
      if (y > 0 && keep[i - w] && isBackground(i - w)) push(i - w);
      if (y < h - 1 && keep[i + w] && isBackground(i + w)) push(i + w);
    }
    if (keyedByColor) soften(keep);
  }
  /**
   * 色键抠出来的边缘是一圈"画的颜色 + 白底"的过渡像素，留着就是白边晕。
   * 先腐蚀 1px 把最外圈丢掉，再用 3×3 均值把边缘拉软，边缘才不像锯齿剪纸。
   */
  function soften(keep) {
    const src = Uint8Array.from(keep);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (!src[i]) continue;
        let sum = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += src[yy * w + xx];
          }
        }
        keep[i] = sum >= 8 ? 1 : 0;
      }
    }
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += keep[yy * w + xx];
            n += 1;
          }
        }
        data[i * 4 + 3] = Math.round((255 * sum) / n);
      }
    }
  }
}

/** 众数颜色（先量化到 16 级找桶，再在桶内取均值），用来估底色 */
function modalColor(list) {
  const buckets = new Map();
  for (const [r, g, b] of list) {
    const key = `${r >> 4}:${g >> 4}:${b >> 4}`;
    const hit = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    hit.n += 1;
    hit.r += r;
    hit.g += g;
    hit.b += b;
    buckets.set(key, hit);
  }
  let best = { n: 0, r: 255, g: 255, b: 255 };
  for (const hit of buckets.values()) if (hit.n > best.n) best = hit;
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}

/**
 * 满幅票面（邮票）不抠底——齿孔边就是它的外轮廓——但原图四周常带一圈牛皮纸。
 * 牛皮纸认不得颜色距离：它自己就从 rgb(206,139,69) 渐变到 rgb(242,175,98)；
 * 也认不得亮度梯度：纸面有颗粒，逐行平均落差和票面印版一个量级。
 * 能用的是色相——牛皮纸一律暖棕（R−B > 100 且 R > 170），齿孔带和票面纸边是浅色。
 * 按列/行统计牛皮纸占比，从两侧往里找占比 < 0.85 的第一处，就是齿孔的外缘。
 * 每边砍不到 3% 就不动：北京、南京那几张本来就贴边，再裁就削到齿了。
 */
function trimPaper(img) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const { data } = img.bitmap;
  const isKraft = (x, y) => {
    const i = (y * w + x) * 4;
    return data[i] - data[i + 2] > 100 && data[i] > 170 && data[i + 1] > 90;
  };

  const colKraft = new Float64Array(w);
  const rowKraft = new Float64Array(h);
  for (let x = 0; x < w; x += 1) {
    let n = 0;
    for (let y = 0; y < h; y += 2) if (isKraft(x, y)) n += 1;
    colKraft[x] = n / Math.ceil(h / 2);
  }
  for (let y = 0; y < h; y += 1) {
    let n = 0;
    for (let x = 0; x < w; x += 2) if (isKraft(x, y)) n += 1;
    rowKraft[y] = n / Math.ceil(w / 2);
  }

  function span(act, minCut) {
    let from = 0;
    let to = act.length - 1;
    for (let i = 0; i < act.length; i += 1) if (act[i] < 0.85) { from = i; break; }
    for (let i = act.length - 1; i >= 0; i -= 1) if (act[i] < 0.85) { to = i; break; }
    const loose = Math.round(act.length * minCut);
    if (from < loose) from = 0;
    if (act.length - 1 - to < loose) to = act.length - 1;
    return { from, to };
  }

  const x = span(colKraft, 0.03);
  const y = span(rowKraft, 0.03);
  return { x: x.from, y: y.from, w: x.to - x.from + 1, h: y.to - y.from + 1 };
}

/** 前景包围盒，外扩 2px 免得削掉抗锯齿的最外圈 */
function shrinkTo(w, h, data) {
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
