/**
 * 手账编辑器的规划清单，在邮票册那一页作为"下一版准备贴上的东西"展示。
 *
 * 「照片与文字记录」和「保存与重新编辑」已经随手账页上线，所以不在这里了；
 * 剩下的项目一件都还没实现，列出来只是为了不说空话。
 */
export interface RoadmapItem {
  title: string;
  note: string;
}

export const editorRoadmap: RoadmapItem[] = [
  { title: '城市文化贴纸', note: '建筑、美食、植物与人文历史，可自由拖拽摆放' },
  { title: '旅行计划', note: '出发前先排一条路线' },
  { title: 'Vlog 展示', note: '视频与胶卷照片同台' },
  { title: '多套艺术主题', note: '在复古、油画、彩绘风格之间切换' },
];
