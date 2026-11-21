/** 城市手账的数据结构。第一阶段只有文字与封面配置，未来接后端时字段可以平移扩展。 */

export type CoverMotif = 'city-gate' | 'pearl-tower' | 'hall-of-prayer';

export interface City {
  /** 用于 URL，如 /#/city/nanjing */
  id: string;
  name: string;
  nameEn: string;
  /** 明信片上的地区说明 */
  region: string;
  /** 十进制度，北纬为正 */
  latitude: number;
  /** 十进制度，东经为正 */
  longitude: number;
  /** 明信片标题下的一句话 */
  tagline: string;
  /** 明信片正文 */
  intro: string;
  /** 封面与邮票使用的手绘地标 */
  motif: CoverMotif;
  /** 封面天空渐变的两个颜色 */
  coverTint: [string, string];
  /**
   * 城市名标签放在图钉的哪一侧。
   * 南京和上海在世界视图里只差几个像素，标签分侧才不会互相压住；
   * 图钉本体始终钉在真实经纬度上，只有文字做避让。
   */
  labelSide: 'left' | 'right';
}
