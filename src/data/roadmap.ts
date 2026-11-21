/**
 * 手账编辑器的规划清单，只在城市页作为"即将开放"的说明展示。
 * 第一阶段不实现其中任何一项。
 */
export interface RoadmapItem {
  title: string;
  note: string;
}

export const editorRoadmap: RoadmapItem[] = [
  { title: '城市文化贴纸', note: '建筑、美食、植物与人文历史，可自由拖拽摆放' },
  { title: '照片与文字记录', note: '把旅途里的片段贴进当页手账' },
  { title: '保存与重新编辑', note: '手账可以存下来，下次接着写' },
  { title: '旅行计划', note: '出发前先排一条路线' },
  { title: 'Vlog 展示', note: '视频与胶卷照片同台' },
  { title: '多套艺术主题', note: '在复古、油画、彩绘风格之间切换' },
];
