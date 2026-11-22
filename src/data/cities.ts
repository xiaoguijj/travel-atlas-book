import type { City } from './types';

/**
 * 首页与城市手账共用这份数据。
 *
 * 城市数据与界面完全解耦：以后要从后端或本地存储读取手账内容时，
 * 只要把这里换成异步数据源（例如 loadCities()），Globe / 明信片 / 城市页都不用改结构。
 */
export const cities: City[] = [
  {
    id: 'nanjing',
    name: '南京',
    nameEn: 'Nanjing',
    region: '江苏 · 中国',
    latitude: 32.0603,
    longitude: 118.7969,
    tagline: '梧桐落满六朝的窗台',
    intro:
      '明城墙把山与湖圈进了城里，颐和路的梧桐一年年落下影子。玄武湖的傍晚有风，鸭血粉丝汤的热气糊住了眼镜片——这是一座适合慢慢走的城。',
    motif: 'city-gate',
    coverTint: ['#3E5C5A', '#B08D57'],
    labelSide: 'left',
  },
  {
    id: 'shanghai',
    name: '上海',
    nameEn: 'Shanghai',
    region: '直辖市 · 中国',
    latitude: 31.2304,
    longitude: 121.4737,
    tagline: '江风把旧外滩吹得很亮',
    intro:
      '清晨的苏州河还带着雾，渡轮已经开了。外滩的石头房子排成一行，对岸的塔把天空撑高。弄堂口的一笼小笼包，是这座城市最日常的仪式感。',
    motif: 'pearl-tower',
    coverTint: ['#263F4B', '#A96C50'],
    labelSide: 'right',
  },
  {
    id: 'beijing',
    name: '北京',
    nameEn: 'Beijing',
    region: '直辖市 · 中国',
    latitude: 39.9042,
    longitude: 116.4074,
    tagline: '中轴线上的鸽哨与砖灰',
    intro:
      '从钟鼓楼往南走，屋脊一路低下去。天坛的圆把天空量得很准，胡同里的鸽哨绕着槐树转。冬天风硬，烤红薯的甜却格外清楚。',
    motif: 'hall-of-prayer',
    coverTint: ['#4A3B36', '#BDA06A'],
    labelSide: 'right',
  },
  {
    id: 'london',
    name: '伦敦',
    nameEn: 'London',
    region: '英格兰 · 英国',
    latitude: 51.5074,
    longitude: -0.1278,
    tagline: '跟着钟声走过泰晤士河',
    intro:
      '从威斯敏斯特桥走到南岸，钟楼在水上投下一道长影。细雨刚停，红色巴士从桥上驶过，河风把咖啡香带到了旧书摊边。',
    motif: 'elizabeth-tower',
    coverTint: ['#333E48', '#AE744E'],
    labelSide: 'left',
  },
];

export const cityIds: string[] = cities.map((city) => city.id);

export function getCityById(id: string | undefined): City | undefined {
  if (!id) return undefined;
  return cities.find((city) => city.id === id);
}
