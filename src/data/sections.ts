/**
 * 首页缎带导航的四个栏目（「首页」本身不算栏目，它回到地球）。
 *
 * 手账和计划由各自的页面承接，灵感发现和我的保留栏目说明。
 */

export type SectionId = 'journals' | 'inspiration' | 'plans' | 'account';

export interface SectionMeta {
  id: SectionId;
  /** 缎带上的文案，也是页面主标题 */
  label: string;
  /** 页眉下面那行小字 */
  lede: string;
  /** 栏目的功能是否开放 */
  ready: boolean;
  /** 栏目说明条目；ready 的栏目由页面自己换成真实内容 */
  items: { title: string; note: string }[];
}

export const sections: SectionMeta[] = [
  {
    id: 'journals',
    label: '旅行手账',
    lede: '从邮票册打开一座城市的手账书架。',
    ready: true,
    items: [],
  },
  {
    id: 'inspiration',
    label: '灵感发现',
    lede: '还没出发的时候，先看看别人走过的航线。',
    ready: false,
    items: [
      { title: '城市图鉴', note: '每座城市的手绘建筑与小吃图谱，配上真实坐标。' },
      { title: '航线故事', note: '把散点连成一条线：为什么这一年，有人从南京绕到里斯本。' },
      { title: '读者精选', note: '别人贴歪了的贴纸、写糊了的字迹，都会出现在这里。' },
    ],
  },
  {
    id: 'plans',
    label: '旅行计划',
    lede: '在中国愿望地图里记录想去的城市，安排每天的行程。',
    ready: true,
    items: [],
  },
  {
    id: 'account',
    label: '我的',
    lede: '账号与云端存档都还没上线，现在写的手账只留在这台设备上。',
    ready: false,
    items: [
      { title: '我的手账架', note: '登录后把每本手账存到云端，换台电脑接着写。' },
      { title: '贴纸册', note: '收集用过的文化贴纸，按城市归类。' },
      { title: '收藏与分享', note: '把某一页生成一张可以发出去的明信片。' },
    ],
  },
];

export function getSection(id: string | undefined): SectionMeta | undefined {
  return sections.find((section) => section.id === id);
}
