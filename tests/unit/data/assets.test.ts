import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssetQuery } from '../../../src/data/assets';
import { resolveAssetPreview } from '../../../src/data/assets/preview';
import type { StickerDefinition } from '../../../src/data/contracts';
import { TravelAtlasDatabase } from '../../../src/data/db';
import { createPhotoRepository, type PhotoRepository } from '../../../src/data/photos';
import type { PhotoProcessor } from '../../../src/data/photos';
import {
  createClock,
  createPngBlob,
  createTestDatabase,
  destroyTestDatabase,
} from '../helpers';

const stickers: StickerDefinition[] = [
  { id: 'sticker:nanjing-salt-duck', cityId: 'nanjing', label: '盐水鸭', category: 'food', src: '/stickers/nanjing-duck.png' },
  { id: 'sticker:tape-generic', label: '牛皮胶带', category: 'general', src: '/stickers/tape.png' },
  { id: 'sticker:shanghai-bund', cityId: 'shanghai', label: '外滩', category: 'landmark', src: '/stickers/bund.png' },
];

function listStickers(cityId?: string): StickerDefinition[] {
  return stickers.filter(
    (sticker) => cityId === undefined || sticker.cityId === undefined || sticker.cityId === cityId,
  );
}

function getSticker(stickerId: string): StickerDefinition | undefined {
  return stickers.find((sticker) => sticker.id === stickerId);
}

describe('asset query', () => {
  let database: TravelAtlasDatabase;
  let photos: PhotoRepository;
  let clock: ReturnType<typeof createClock>;
  let query: ReturnType<typeof createAssetQuery>;

  beforeEach(() => {
    database = createTestDatabase();
    clock = createClock();
    const processor: PhotoProcessor = {
      process: vi.fn(async (source) => ({
        blob: source.blob,
        mime: source.sourceMime,
        width: 320,
        height: 240,
      })),
    };
    photos = createPhotoRepository(database, { processor, now: clock.now });
    query = createAssetQuery({
      listPhotosByCity: photos.listPhotosByCity,
      getPhoto: photos.getPhoto,
      listStickerDefinitions: listStickers,
      getStickerDefinition: getSticker,
    });
  });

  afterEach(async () => {
    await destroyTestDatabase(database);
  });

  it('lists this city photos with city and generic stickers, without blobs', async () => {
    const nanjing = await photos.importPhoto('nanjing', createPngBlob());
    await photos.importPhoto('shanghai', createPngBlob());

    const assets = await query.listAssets('nanjing');
    expect(assets.map((asset) => asset.assetId)).toEqual([
      nanjing.id,
      'sticker:nanjing-salt-duck',
      'sticker:tape-generic',
    ]);
    expect(assets[0]).toMatchObject({
      kind: 'photo',
      cityId: 'nanjing',
      mimeType: 'image/png',
      width: 320,
      height: 240,
    });
    expect(assets[0]).not.toHaveProperty('blob');
    expect(assets[1]).toMatchObject({ kind: 'sticker', src: '/stickers/nanjing-duck.png' });
    expect(assets[2].cityId).toBeUndefined();

    await expect(query.listAssets('atlantis')).rejects.toMatchObject({ code: 'INVALID_CITY' });
  });

  it('dispatches getAsset by namespace and reports missing or malformed IDs', async () => {
    const nanjing = await photos.importPhoto('nanjing', createPngBlob());

    const photo = await query.getAsset(nanjing.id);
    expect(photo).toMatchObject({ kind: 'photo', assetId: nanjing.id, mimeType: 'image/png' });
    expect(photo?.kind === 'photo' && photo.blob).toBeInstanceOf(Blob);

    const sticker = await query.getAsset('sticker:tape-generic');
    expect(sticker).toMatchObject({ kind: 'sticker', src: '/stickers/tape.png' });

    await expect(query.getAsset('sticker:missing')).resolves.toBeUndefined();
    await expect(query.getAsset('photo:missing')).resolves.toBeUndefined();
    await expect(query.getAsset('not-an-asset')).rejects.toMatchObject({ code: 'INVALID_ASSET_ID' });
    await expect(query.getAsset('photo:')).rejects.toMatchObject({ code: 'INVALID_ASSET_ID' });
  });
});

describe('asset preview lifecycle', () => {
  it('creates one object URL for photos and revokes it exactly once', async () => {
    const photoBlob = createPngBlob();
    const assets = {
      listAssets: vi.fn(async () => []),
      getAsset: vi.fn(async () => ({
        assetId: 'photo:one',
        kind: 'photo' as const,
        cityId: 'nanjing',
        label: '照片',
        mimeType: 'image/png' as const,
        width: 10,
        height: 10,
        blob: photoBlob,
      })),
    };
    const objectUrls = {
      create: vi.fn(() => 'blob:preview-one'),
      revoke: vi.fn(),
    };

    const preview = await resolveAssetPreview('photo:one', assets, objectUrls);
    expect(preview.missing).toBe(false);
    expect(preview.src).toBe('blob:preview-one');
    expect(objectUrls.create).toHaveBeenCalledWith(photoBlob);

    preview.release();
    preview.release();
    expect(objectUrls.revoke).toHaveBeenCalledTimes(1);
    expect(objectUrls.revoke).toHaveBeenCalledWith('blob:preview-one');
  });

  it('uses the static sticker URL and reports missing assets without object URLs', async () => {
    const objectUrls = { create: vi.fn(), revoke: vi.fn() };
    const stickerAssets = {
      listAssets: vi.fn(async () => []),
      getAsset: vi.fn(async () => ({
        assetId: 'sticker:tape',
        kind: 'sticker' as const,
        label: '胶带',
        src: '/stickers/tape.png',
      })),
    };

    const sticker = await resolveAssetPreview('sticker:tape', stickerAssets, objectUrls);
    expect(sticker.src).toBe('/stickers/tape.png');
    sticker.release();
    expect(objectUrls.create).not.toHaveBeenCalled();
    expect(objectUrls.revoke).not.toHaveBeenCalled();

    const missingAssets = {
      listAssets: vi.fn(async () => []),
      getAsset: vi.fn(async () => undefined),
    };
    const missing = await resolveAssetPreview('photo:missing', missingAssets, objectUrls);
    expect(missing).toMatchObject({ src: null, missing: true });
    expect(objectUrls.create).not.toHaveBeenCalled();
  });
});