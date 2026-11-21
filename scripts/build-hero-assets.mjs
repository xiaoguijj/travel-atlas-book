/**
 * 首页背景素材生成脚本。
 *
 *   node scripts/build-hero-assets.mjs [源图路径]
 *
 * 源图是本次视觉设计唯一的美术来源（见 README 的素材出处说明），
 * 原始 PNG 体积约 2.8MB，直接放进 src/assets 会被打进产物包，
 * 所以这里只做一次离线压缩，产出 src/assets/hero-bg.jpg。
 *
 * 注意：脚本不裁剪、不重绘、不加文字，保证首页看到的画和源图完全一致。
 * 参考图里那个"静态地球"是在浏览器里用 CSS mask 挖掉的，不修改图片本身，
 * 这样以后换一张图或者恢复原图都只需要重跑一次脚本。
 */
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'assets-source/home-hero.png');
const outDir = path.join(root, 'src/assets');
const outFile = path.join(outDir, 'hero-bg.jpg');
const quality = 80;

const image = await Jimp.read(source);
const { width, height } = image.bitmap;

mkdirSync(outDir, { recursive: true });
await image.quality(quality).writeAsync(outFile, Jimp.MIME_JPEG);

/**
 * 下面这组数字是从源图上量出来的，写进 src/config/hero.ts。
 * 圆心与半径用 rim 高光带做最小二乘圆拟合得到（360 条射线，中位残差 2.6px），
 * 其余矩形是逐列像素统计 + 网格裁图核对得到的。
 */
const geometry = {
  art: { width, height },
  globeDisc: { centerX: 993.5, centerY: 461.5, paintedRadius: 282.5, punchedRadius: 292, liveRadius: 300 },
  globeStage: { x: 623, y: 91, size: 741 },
};

console.log(`源图   ${source}`);
console.log(`产物   ${outFile}`);
console.log(`尺寸   ${width}×${height} → ${(statSync(outFile).size / 1024).toFixed(0)} KB（JPEG 质量 ${quality}）`);
console.log('几何   ', JSON.stringify(geometry, null, 2));
