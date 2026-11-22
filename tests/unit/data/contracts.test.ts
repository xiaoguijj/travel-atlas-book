import { describe, expect, it } from 'vitest';
import { getCityById, listStampDefinitions, listStickerDefinitions } from '../../../src/data/catalog';
import { CITY_IDS } from '../../../src/data/contracts';
import { isKnownAssetId, isPhotoAssetId, isStickerAssetId } from '../../../src/data/ids';

describe('frozen data contract constants', () => {
  it('freezes six unique V1 business city ids and resolves existing cities', () => {
    expect(CITY_IDS).toEqual(['nanjing', 'shanghai', 'xian', 'beijing', 'hangzhou', 'chengdu']);
    expect(new Set(CITY_IDS).size).toBe(6);
    expect(getCityById('nanjing')?.name).toBe('南京');
    expect(getCityById('shanghai')?.name).toBe('上海');
    expect(getCityById('beijing')?.name).toBe('北京');
    expect(getCityById('unknown')).toBeUndefined();
  });

  it('keeps static catalogs queryable even before V1-04 fills data', () => {
    expect(Array.isArray(listStampDefinitions('nanjing'))).toBe(true);
    expect(Array.isArray(listStickerDefinitions('nanjing'))).toBe(true);
    expect(Array.isArray(listStickerDefinitions())).toBe(true);
  });

  it('distinguishes photo and sticker asset ids', () => {
    expect(isPhotoAssetId('photo:abc')).toBe(true);
    expect(isPhotoAssetId('sticker:abc')).toBe(false);
    expect(isStickerAssetId('sticker:abc')).toBe(true);
    expect(isStickerAssetId('photo:abc')).toBe(false);
    expect(isKnownAssetId('photo:abc')).toBe(true);
    expect(isKnownAssetId('photo:')).toBe(false);
    expect(isKnownAssetId('abc')).toBe(false);
  });
});