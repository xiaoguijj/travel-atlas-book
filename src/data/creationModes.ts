/**
 * 创作模式清单：「邮票 → 选模式 → 进编辑器」这条链路的唯一出处。
 *
 * 模式名固定为 journal / collage，与队友 V1-05 的公共框架对齐。
 * 这里只放入口需要的信息（叫什么、能不能点、跳到哪），不放手账的数据结构——
 * 统一数据结构由 V1-02 定义在 src/data/types.ts，等它落地后本文件只保留映射函数。
 */

export type CreationMode = 'journal' | 'collage';

/** ready＝有真实编辑器；wip＝只做卡片和接口位，点了不给假编辑器 */
export type ModeStatus = 'ready' | 'wip';

export interface CreationModeEntry {
  id: CreationMode;
  /** 卡片英文名，排在主标题上方当小字 */
  nameEn: string;
  /** 卡片主标题 */
  name: string;
  /** 一句话说清这种写法适合什么 */
  summary: string;
  /** 卡片要点，三条以内 */
  points: string[];
  status: ModeStatus;
  /** status 为 wip 时，点卡片显示给用户的说明 */
  wipNote?: string;
}

export const creationModes: CreationModeEntry[] = [
  {
    id: 'journal',
    nameEn: 'Journal',
    name: '横线日记本',
    summary: '按行写旅行日记，标题、日期和正文坐在同一张牛皮纸上。',
    points: ['写满一页自动翻页', '存本机，下次打开还在', '照片与贴纸随后接入'],
    status: 'ready',
  },
  {
    id: 'collage',
    nameEn: 'Collage',
    name: '自由拼贴',
    summary: '照片、车票、贴纸和文字框随意摆，能拖拽、缩放、旋转。',
    points: ['自由拖拽摆放', '缩放与旋转', '与日记本共用素材'],
    status: 'wip',
    wipNote:
      '自由拼贴编辑器是队友的 V1-08，还在独立开发，之后通过 PR 接入。' +
      '现在点它只会看到这条说明——不会跳进一个空的假编辑器。',
  },
];

export function getCreationMode(id: CreationMode): CreationModeEntry {
  const mode = creationModes.find((entry) => entry.id === id);
  // 清单和类型是同一份出处，找不到说明这里漏了一条，直接抛而不是返回 undefined 让页面猜
  if (!mode) throw new Error(`未登记的创作模式：${id}`);
  return mode;
}

/**
 * 模式 → 编辑器地址。
 *
 * V1-05 落地后签名会变成 editorPath(mode, cityId, journalId)，每座城市能有多篇手账；
 * 改动集中在这一个函数里，页面组件不用重写。
 */
export function editorPath(mode: CreationMode, cityId: string): string {
  switch (mode) {
    case 'journal':
      return `/city/${cityId}`;
    case 'collage':
      // V1-08 的路由名定下来后在这里返回它。status 不是 ready 时页面不会调用到这一支。
      return `/city/${cityId}/collage`;
  }
}

/** 邮票点下去先到的那一页。地址只有这一处出处，邮票册不用自己拼字符串。 */
export function createModePath(cityId: string): string {
  return `/city/${cityId}/create`;
}
