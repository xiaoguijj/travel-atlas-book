import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetQuery } from '../../../src/data/assets';
import { getStickerAsset, searchStickers, stickerAssets, stickerBox, stickerUrl, stickersOf } from '../../../src/stickers/catalog';
import { readStickerDocument, stickerKey, writeStickerDocument } from '../../../src/stickers/storage';
import type { StickerDocument, StickerScope } from '../../../src/stickers/types';

// These are the IDs stored before the shared catalog was introduced. Keep this
// fixture independent of the current catalog so a renamed ID cannot hide a lost archive.
const legacyArtworkIds = [
  'common-gramophone', 'common-postage-sunflower', 'common-camera', 'common-train',
  'stamp-nanjing', 'stamp-shanghai', 'stamp-xian', 'stamp-beijing', 'stamp-hangzhou', 'stamp-chengdu',
  'beijing-jingju-opera', 'beijing-ditan-park', 'beijing-peking-duck', 'beijing-chrysanthemum',
  'shanghai-qipao-girl', 'shanghai-magnolia', 'shanghai-shengjian', 'shanghai-wukang-mansion',
  'chengdu-wuhou-shrine', 'chengdu-dandan-noodles', 'chengdu-sichuan-opera', 'chengdu-shu-embroidery',
  'nanjing-jimingsi-temple', 'nanjing-duck-vermicelli', 'nanjing-plum-blossom', 'nanjing-yunjin-silk',
  'xian-terracotta-warrior', 'xian-lamb-stew', 'xian-wild-goose-pagoda', 'xian-pomegranate-flower',
  'hangzhou-leifeng-pagoda', 'hangzhou-dongpo-pork', 'hangzhou-osmanthus', 'hangzhou-silk-umbrella',
];

afterEach(() => { vi.unstubAllGlobals(); });

describe('V4 compatibility with shared sticker artwork', () => {
  it('reads and rewrites existing raw-ID archives without changing placement, rotation or layer order', () => {
    const scope: StickerScope = { cityId: 'nanjing', mode: 'journal', journalId: 'existing-book' };
    const key = 'travel-atlas-book.stickers.nanjing.journal.existing-book';
    const legacy: StickerDocument = {
      version: 1,
      pages: [legacyArtworkIds.map((assetId, index) => ({
        instanceId: `old-instance-${index}`,
        assetId,
        x: 0.17 + (index % 5) * 0.1,
        y: 0.23 + (index % 4) * 0.1,
        scale: 0.75 + (index % 4) * 0.25,
        rotation: -46.5 + index * 7.25,
        z: 34 - index,
      }))],
    };
    const raw = JSON.stringify(legacy, null, 2);
    const records = new Map([[key, raw]]);
    const storage = {
      getItem: vi.fn((name: string) => records.get(name) ?? null),
      setItem: vi.fn((name: string, value: string) => { records.set(name, value); }),
    };
    vi.stubGlobal('window', { localStorage: storage });

    expect(stickerKey(scope)).toBe(key);
    const loaded = readStickerDocument(scope);
    expect(loaded).toEqual(legacy);
    expect(records.get(key)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(writeStickerDocument(scope, loaded)).toBe(true);
    expect(readStickerDocument(scope)).toEqual(legacy);
  });

  it('resolves every old raw ID and its public sticker: ID to the same image URL', async () => {
    expect(stickerAssets.map((artwork) => artwork.id)).toEqual(legacyArtworkIds);
    for (const rawId of legacyArtworkIds) {
      expect(getStickerAsset(rawId)?.id).toBe(rawId);
      const resource = await assetQuery.getAsset(`sticker:${rawId}`);
      expect(resource).toMatchObject({
        assetId: `sticker:${rawId}`,
        kind: 'sticker',
        src: stickerUrl(rawId),
      });
    }
  });

  it('keeps the four common artworks, six city stamps and four Nanjing culture search results', () => {
    expect(stickersOf('common').map((artwork) => artwork.id)).toEqual([
      'common-gramophone', 'common-postage-sunflower', 'common-camera', 'common-train',
    ]);
    expect(stickersOf('stamp').map((artwork) => artwork.id)).toEqual([
      'stamp-nanjing', 'stamp-shanghai', 'stamp-xian', 'stamp-beijing', 'stamp-hangzhou', 'stamp-chengdu',
    ]);
    const nanjingIds = ['nanjing-jimingsi-temple', 'nanjing-duck-vermicelli', 'nanjing-plum-blossom', 'nanjing-yunjin-silk'];
    expect(searchStickers('南京').map((artwork) => artwork.id)).toEqual(nanjingIds);
    expect(searchStickers('Nanjing').map((artwork) => artwork.id)).toEqual(nanjingIds);
    expect(searchStickers('南京').every((artwork) => artwork.category === 'culture')).toBe(true);
  });

  it('preserves category sizes, artwork aspect ratios and the unknown-artwork fallback', () => {
    const camera = stickerBox('common-camera', 2);
    expect(camera.w).toBeCloseTo(0.26);
    expect(camera.h).toBeCloseTo(0.26 * 299 / 384);
    const stamp = stickerBox('stamp-nanjing', 1);
    expect(stamp.w).toBeCloseTo(0.19);
    expect(stamp.h).toBeCloseTo(0.19 * 311 / 382);
    expect(stickerBox('unknown-artwork', 1)).toEqual({ w: 0.13, h: 0.13 });
  });
});
