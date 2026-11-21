/**
 * 首页缎带导航的四个栏目（「首页」本身不算栏目，它回到地球）。
 *
 * 第一阶段只有「旅行手账」有真内容：每座城市都有自己的手账页。
 * 另外三个栏目在画面上是可见的导航，所以必须给出诚实的落点，
 * 但不能出现点了没反应的按钮 —— 页面只讲"排上日程了什么"，并留一条回到地球的真链接。
 */

export type SectionId = 'journals' | 'inspiration' | 'plans' | 'account';

export interface SectionMeta {
  id: SectionId;
  /** 缎带上的文案，也是页面主标题 */
  label: string;
  /** 页眉下面那行小字 */
  lede: string;
  /** 第一阶段是否已经能用 */
  ready: boolean;
  /** 栏目说明条目；ready 的栏目由页面自己换成真实内容 */
  items: { title: string; note: string }[];
}

export const sections: SectionMeta[] = [
  {
    id: 'journals',
    label: '旅行手账',
    lede: '每一页手账，都可以从地球上点进来。',
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
    lede: '想把地球上的图钉连成行程，得再等一个阶段。',
    ready: false,
    items: [
      { title: '行程草稿', note: '在地球上按顺序点图钉，自动生成一张航线草图。' },
      { title: '季节提示', note: '按月份给建议：哪座城这时候人少、哪条线正在台风季。' },
      { title: '同行清单', note: '证件、装备、需要预留的天数，出发前勾一遍。' },
    ],
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
