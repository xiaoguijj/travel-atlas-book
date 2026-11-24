import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createAssetQuery } from '../../../src/data/assets';
import {
  getStickerArtwork,
  stickerArtwork,
  stickerArtworkUrl,
} from '../../../src/data/catalog/stickerArtwork';
import {
  getStickerDefinition,
  listStickerDefinitions,
  stickerDefinitions,
} from '../../../src/data/catalog/stickers';
import { CITY_IDS } from '../../../src/data/contracts';

const commonIds = [
  'sticker:common-gramophone',
  'sticker:common-postage-sunflower',
  'sticker:common-camera',
  'sticker:common-train',
];

// Resolve actual image modules independently of the production catalogue glob.
const imageUrls = import.meta.glob('../../../src/assets/stickers/*.+(png|jpg)', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function queryWithoutPhotos() {
  return createAssetQuery({
    listPhotosByCity: async () => [],
    getPhoto: async () => undefined,
  });
}

describe('production sticker artwork and shared asset catalogue', () => {
  it('resolves all 34 unique artwork IDs to real PNG/JPEG resources with no missing or orphaned files', () => {
    const directory = fileURLToPath(new URL('../../../src/assets/stickers/', import.meta.url));
    const files = readdirSync(directory).filter((name) => /\.(png|jpg)$/.test(name));
    const rawIds = stickerArtwork.map((artwork) => artwork.id);
    expect(files).toHaveLength(34);
    expect(stickerArtwork).toHaveLength(34);
    expect(new Set(rawIds).size).toBe(34);
    expect(Object.keys(imageUrls)).toHaveLength(34);
    expect([...rawIds].sort()).toEqual(files.map((file) => file.replace(/\.(png|jpg)$/, '')).sort());

    const resolvedUrls = new Set<string>();
    for (const file of files) {
      const rawId = file.replace(/\.(png|jpg)$/, '');
      const expectedUrl = imageUrls[`../../../src/assets/stickers/${file}`];
      expect(expectedUrl, `Vite URL missing for ${file}`).toBeTruthy();
      expect(stickerArtworkUrl(rawId)).toBe(expectedUrl);
      resolvedUrls.add(stickerArtworkUrl(rawId));
      const bytes = readFileSync(join(directory, file));
      const signature = file.endsWith('.png')
        ? Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        : Buffer.from([0xff, 0xd8, 0xff]);
      expect(bytes.subarray(0, signature.length).equals(signature), `Invalid image header: ${file}`).toBe(true);
    }
    expect(resolvedUrls.size).toBe(34);
  });

  it('maps raw artwork metadata into the frozen sticker namespace without changing IDs or labels', () => {
    expect(stickerDefinitions).toHaveLength(34);
    expect(new Set(stickerDefinitions.map((sticker) => sticker.id)).size).toBe(34);
    expect(listStickerDefinitions()).toEqual(stickerDefinitions);
    for (const artwork of stickerArtwork) {
      expect(getStickerArtwork(artwork.id)).toBe(artwork);
      const definition = getStickerDefinition(`sticker:${artwork.id}`);
      expect(definition).toMatchObject({
        id: `sticker:${artwork.id}`,
        label: artwork.name,
        category: artwork.category,
        src: stickerArtworkUrl(artwork.id),
      });
      expect(definition?.cityId).toBe(artwork.cityId);
      expect(artwork.nameEn).not.toBe('');
    }
    expect(stickerArtwork.filter((artwork) => artwork.category === 'common')).toHaveLength(4);
    expect(stickerArtwork.filter((artwork) => artwork.category === 'stamp')).toHaveLength(6);
    expect(stickerArtwork.filter((artwork) => artwork.category === 'culture')).toHaveLength(24);
  });

  it.each(CITY_IDS)('lists exactly four shared, one stamp and four culture stickers for %s', async (cityId) => {
    const definitions = listStickerDefinitions(cityId);
    expect(definitions).toHaveLength(9);
    expect(definitions.filter((sticker) => sticker.cityId === undefined).map((sticker) => sticker.id)).toEqual(commonIds);
    expect(definitions.filter((sticker) => sticker.category === 'stamp').map((sticker) => sticker.id)).toEqual([
      `sticker:stamp-${cityId}`,
    ]);
    expect(definitions.filter((sticker) => sticker.category === 'culture')).toHaveLength(4);
    expect(definitions.every((sticker) => sticker.cityId === undefined || sticker.cityId === cityId)).toBe(true);

    const assets = await queryWithoutPhotos().listAssets(cityId);
    expect(assets).toHaveLength(9);
    expect(assets.map((asset) => asset.assetId)).toEqual(definitions.map((sticker) => sticker.id));
    for (const asset of assets) {
      expect(asset.kind).toBe('sticker');
      expect(asset.src).toBe(getStickerDefinition(asset.assetId)?.src);
      expect(asset).not.toHaveProperty('blob');
    }
  });

  it('contains no extra city artwork and exposes only shared stickers for London', async () => {
    const artworkCities = [...new Set(stickerArtwork.flatMap((artwork) => artwork.cityId ? [artwork.cityId] : []))];
    expect(artworkCities.sort()).toEqual([...CITY_IDS].sort());
    expect(listStickerDefinitions('london').map((sticker) => sticker.id)).toEqual(commonIds);
    const query = queryWithoutPhotos();
    const london = await query.listAssets('london');
    expect(london.map((asset) => asset.assetId)).toEqual(commonIds);
    expect(london.every((asset) => asset.cityId === undefined)).toBe(true);
    await expect(query.listAssets('atlantis')).rejects.toMatchObject({ code: 'INVALID_CITY' });
  });

  it('resolves every production sticker through getAsset and keeps photo and sticker namespaces separate', async () => {
    const getPhoto = vi.fn(async (_assetId: string) => undefined);
    const query = createAssetQuery({ listPhotosByCity: async () => [], getPhoto });
    for (const artwork of stickerArtwork) {
      await expect(query.getAsset(`sticker:${artwork.id}`)).resolves.toMatchObject({
        assetId: `sticker:${artwork.id}`,
        kind: 'sticker',
        label: artwork.name,
        src: stickerArtworkUrl(artwork.id),
      });
    }
    expect(getPhoto).not.toHaveBeenCalled();
    await expect(query.getAsset('photo:common-camera')).resolves.toBeUndefined();
    expect(getPhoto).toHaveBeenCalledExactlyOnceWith('photo:common-camera');
    await expect(query.getAsset('sticker:missing-artwork')).resolves.toBeUndefined();
    await expect(query.getAsset('common-camera')).rejects.toMatchObject({ code: 'INVALID_ASSET_ID' });
    await expect(query.getAsset('sticker:')).rejects.toMatchObject({ code: 'INVALID_ASSET_ID' });
  });

  it('does not silently substitute artwork for unknown IDs or mix raw and public IDs', () => {
    expect(getStickerArtwork('missing-artwork')).toBeUndefined();
    expect(getStickerArtwork('sticker:common-camera')).toBeUndefined();
    expect(getStickerDefinition('common-camera')).toBeUndefined();
    expect(getStickerDefinition('sticker:missing-artwork')).toBeUndefined();
    expect(() => stickerArtworkUrl('missing-artwork')).toThrow('贴纸素材缺失：missing-artwork');
  });
});
