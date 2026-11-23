import { CITY_IDS } from '../contracts';
import { getCityById } from '../cities';

/**
 * 本地中国底图使用等距圆柱投影，点位与 SVG 共用同一组经纬度边界，
 * 这样地图图片和城市按钮永远对得上，不依赖任何在线地图服务。
 */
export const CHINA_MAP_BOUNDS = {
  minLon: 73,
  maxLon: 135,
  minLat: 18,
  maxLat: 54,
} as const;

export type MapLabelSide = 'left' | 'right' | 'bottom';

export interface CityMapPoint {
  cityId: string;
  name: string;
  nameEn: string;
  /** 相对底图宽高的百分比，直接用于绝对定位。 */
  xPercent: number;
  yPercent: number;
  labelSide: MapLabelSide;
}

/** 宁沪杭三城点位密集，标签朝向错开，窄屏也不叠字。 */
const LABEL_SIDES: Record<string, MapLabelSide> = {
  nanjing: 'left',
  shanghai: 'right',
  hangzhou: 'bottom',
  beijing: 'right',
  xian: 'left',
  chengdu: 'left',
};

export function projectLonLat(longitude: number, latitude: number): { xPercent: number; yPercent: number } {
  const { minLon, maxLon, minLat, maxLat } = CHINA_MAP_BOUNDS;
  return {
    xPercent: ((longitude - minLon) / (maxLon - minLon)) * 100,
    yPercent: ((maxLat - latitude) / (maxLat - minLat)) * 100,
  };
}

/** 六城在地图上的点位；城市目录缺项时直接跳过，不画假点。 */
export function listCityMapPoints(): CityMapPoint[] {
  const points: CityMapPoint[] = [];
  for (const cityId of CITY_IDS) {
    const city = getCityById(cityId);
    if (!city) continue;
    const { xPercent, yPercent } = projectLonLat(city.longitude, city.latitude);
    points.push({
      cityId,
      name: city.name,
      nameEn: city.nameEn,
      xPercent,
      yPercent,
      labelSide: LABEL_SIDES[cityId] ?? 'right',
    });
  }
  return points;
}