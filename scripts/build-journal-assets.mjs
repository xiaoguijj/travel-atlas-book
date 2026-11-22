import Jimp from 'jimp';

/**
 * 把 assets-source 里的三张手账流程参考图压成 src/assets 下的 Web 素材。
 *
 * 邮票册、创作方式选择页、横线页都是整张画，页面上的可点区域靠百分比热区叠在画上，
 * 所以这里只做尺寸与压缩，不裁切——裁了就和画上的邮票、卡片对不齐。
 * 源图和仓库里的 jpg 一起存着：热区是按源图像素量的，图一换坐标就得重量，只留压缩件对不上。
 */
const targets = [
  { from: 'assets-source/stamp-album.png', to: 'src/assets/stamp-album.jpg', width: 1440, quality: 78 },
  { from: 'assets-source/create-mode.png', to: 'src/assets/create-mode.jpg', width: 1440, quality: 78 },
  { from: 'assets-source/journal-lines.png', to: 'src/assets/journal-page.jpg', width: 1440, quality: 78 },
];

for (const { from, to, width, quality } of targets) {
  const img = await Jimp.read(from);
  if (img.bitmap.width > width) img.resize(width, Jimp.AUTO);
  await img.quality(quality).writeAsync(to);
  const out = await Jimp.read(to);
  console.log(`${to}: ${out.bitmap.width}x${out.bitmap.height}`);
}
