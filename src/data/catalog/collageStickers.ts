import type { AssetMetadata, StickerDefinition } from '../contracts';

const urlById = new Map<string, string>(
  Object.entries(
    import.meta.glob('../../assets/collage-stickers/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  ).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]),
);

const entries: readonly { id: string; label: string }[] = [
  { id: 'collage-washi-tape', label: '格子纸胶带' },
  { id: 'collage-torn-note', label: '手账撕纸便签' },
  { id: 'collage-vintage-ticket', label: '复古旅行票根' },
  { id: 'collage-map-fragment', label: '手绘地图碎片' },
  { id: 'collage-ginkgo-leaf', label: '银杏叶贴纸' },
];

/** 仅用于 Collage 自由拼贴的静态装饰贴纸，不改变 Journal 既有贴纸目录与测试契约。 */
export const collageStickerDefinitions: readonly StickerDefinition[] = entries.map(({ id, label }) => {
  const src = urlById.get(id);
  if (!src) throw new Error(`拼贴装饰贴纸缺失：${id}`);
  return {
    id: `sticker:${id}`,
    label,
    category: 'common',
    src,
  };
});

export const collageStickerAssets: readonly AssetMetadata[] = collageStickerDefinitions.map((sticker) => ({
  assetId: sticker.id,
  kind: 'sticker',
  label: sticker.label,
  src: sticker.src,
}));
