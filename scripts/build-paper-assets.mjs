/**
 * 手账纸张素材生成脚本（V1-04 素材）。
 *
 *   npm run data:paper
 *
 * 邮票册、创作模式选择页、横线日记本都是「整张画 + 叠在画上的真控件」：六枚邮票、两张卡片、印好的 Title/Date 填空和
 * 横线全在画里，页面靠源图像素坐标量出的热区去对位（坐标见 src/config/journal.ts）。
 * 所以这里只做等比缩放和 JPEG 压缩，**一律不裁切**——裁一刀，画上的邮票和热区就错位了。
 *
 * 源图 PNG 与产物 JPG 一起入库：热区坐标是按源图量的，源图一换就得重量，只留压缩件对不上号。
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  { from: 'assets-source/stamp-album.png', to: 'src/assets/stamp-album.jpg', width: 1440, quality: 78 },
  { from: 'assets-source/create-mode.png', to: 'src/assets/create-mode.jpg', width: 1440, quality: 78 },
  { from: 'assets-source/journal-lines.png', to: 'src/assets/journal-page.jpg', width: 1440, quality: 78 },
];

for (const { from, to, width, quality } of targets) {
  const source = path.join(root, from);
  const out = path.join(root, to);
  const image = await Jimp.read(source);
  if (image.bitmap.width > width) image.resize(width, Jimp.AUTO);
  await image.quality(quality).writeAsync(out, Jimp.MIME_JPEG);
  console.log(
    `${from} → ${to}：${image.bitmap.width}×${image.bitmap.height}，` +
      `${(statSync(out).size / 1024).toFixed(0)} KB（JPEG 质量 ${quality}）`
  );
}
