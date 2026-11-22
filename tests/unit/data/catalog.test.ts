import { describe, expect, it } from 'vitest';
import { getStampByCity, getStampDefinition, listStampDefinitions, stampDefinitions } from '../../../src/data/catalog';
import { getCityById } from '../../../src/data/catalog/cities';
import { CITY_IDS } from '../../../src/data/contracts';

/**
 * V1-04 的验收口径：六城 ID 唯一、经纬度有效，每城能解析到自己的邮票，
 * 目录之外的城市不串数据。贴纸目录（`stickerDefinitions`）留到 V1-04 的下一阶段填。
 */
describe('V1-04 六城城市目录', () => {
  it('每座业务城市都能解析，且经纬度落在合理区间', () => {
    for (const cityId of CITY_IDS) {
      const city = getCityById(cityId);
      expect(city, `城市目录缺少 ${cityId}`).toBeDefined();
      expect(city?.id).toBe(cityId);
      expect(city?.name).toBeTruthy();
      expect(city?.latitude).toBeGreaterThanOrEqual(-90);
      expect(city?.latitude).toBeLessThanOrEqual(90);
      expect(city?.longitude).toBeGreaterThanOrEqual(-180);
      expect(city?.longitude).toBeLessThanOrEqual(180);
    }
  });

  it('新增三城使用 V1-02 冻结的 ID，各自带不同的地标', () => {
    expect(getCityById('xian')?.motif).toBe('wild-goose-pagoda');
    expect(getCityById('hangzhou')?.motif).toBe('lake-bridge');
    expect(getCityById('chengdu')?.motif).toBe('alley-lanterns');
    const motifs = CITY_IDS.map((cityId) => getCityById(cityId)?.motif);
    expect(new Set(motifs).size).toBe(CITY_IDS.length);
  });

  it('保留原有城市 ID，伦敦仍在目录里', () => {
    expect(getCityById('nanjing')?.name).toBe('南京');
    expect(getCityById('london')?.name).toBe('伦敦');
  });
});

describe('V1-04 六城邮票静态目录', () => {
  it('六城各有一枚，ID 用冻结的 <cityId>-postmark 形状', () => {
    expect(stampDefinitions.map((stamp) => stamp.cityId)).toEqual([...CITY_IDS]);
    expect(stampDefinitions.map((stamp) => stamp.id)).toEqual(
      CITY_IDS.map((cityId) => `${cityId}-postmark`),
    );
    expect(new Set(stampDefinitions.map((stamp) => stamp.id)).size).toBe(6);
  });

  it('邮票地标取自城市目录，不会出现邮票和城市对不上', () => {
    for (const stamp of stampDefinitions) {
      expect(stamp.motif).toBe(getCityById(stamp.cityId)?.motif);
      expect(getStampDefinition(stamp.id)).toBe(stamp);
      expect(getStampByCity(stamp.cityId)).toBe(stamp);
    }
  });

  it('按城市查询只返回本城邮票，未发行邮票的城市拿到空表', () => {
    expect(listStampDefinitions('nanjing').map((stamp) => stamp.id)).toEqual(['nanjing-postmark']);
    expect(listStampDefinitions('london')).toEqual([]);
    expect(getStampByCity('london')).toBeUndefined();
    expect(getStampDefinition('london-postmark')).toBeUndefined();
  });
});
