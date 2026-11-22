/**
 * 内页背景素材生成脚本（V1-03 视觉规范）。
 *
 *   node scripts/build-inner-assets.mjs [源图路径]
 *
 * 源图 assets-source/inner-bg-map.png（1672×941）里烘焙了三样东西：
 * 左上「← 返回上一步」胶囊（x34 y38 w203 h44）、中央地球图标与 *Travel Atlas Book* 标题
 * （y24–81）、以及两侧各一条细金线（y55–56）。
 *
 * V1-03 要求顶栏由真实 DOM 绘制（返回按钮必须能点、文案要跟着返回目标变），
 * 所以这里和首页那张画不一样：**必须裁掉顶部 96px 的装饰带**，
 * 产出一张纯地图纹理，避免 DOM 顶栏和画里的静态文字叠成两套。
 * 原图完整留在 assets-source，随时可以重跑或换回整图。
 *
 * 裁切之后等比缩到 1600 宽并编成 JPEG，运行时用 cover 铺满视口。
 */
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'assets-source/inner-bg-map.png');
const outDir = path.join(root, 'src/assets');
const outFile = path.join(outDir, 'inner-bg-map.jpg');

/** 顶部装饰带高度：画里最下的元素（返回胶囊底边 y=81）留 15px 余量。 */
const headerBandPx = 96;
const targetWidth = 1600;
const quality = 78;

const image = await Jimp.read(source);
const { width, height } = image.bitmap;

image.crop(0, headerBandPx, width, height - headerBandPx).resize(targetWidth, Jimp.AUTO);

mkdirSync(outDir, { recursive: true });
await image.quality(quality).writeAsync(outFile, Jimp.MIME_JPEG);

const out = { width: image.bitmap.width, height: image.bitmap.height };

console.log(`源图   ${source}`);
console.log(`尺寸   ${width}×${height} → 裁掉顶部 ${headerBandPx}px 装饰带 → ${out.width}×${out.height}`);
console.log(`产物   ${outFile}（${(statSync(outFile).size / 1024).toFixed(0)} KB，JPEG 质量 ${quality}）`);
console.log(
  '规格    源图比例 ' +
    (width / height).toFixed(4) +
    '，纹理比例 ' +
    (out.width / out.height).toFixed(4) +
    '；兜底色 #0B2C2C（边缘均值），主色 #103936（全图均值）'
);
