/**
 * Voyage Vintage —— 全站唯一的颜色与字体出处。
 *
 * 这里定义的颜色会在应用启动时写成 CSS 自定义属性（--tab-*），
 * CSS Modules 与 Three.js 都从这里取值，因此以后换主题只需要新增一个主题对象。
 */

export interface ThemeColorToken {
  /** 午夜蓝：页面主底色 */
  midnightBlue: string;
  /** 比午夜蓝更深一层，用于背景渐变与阴影 */
  deepSea: string;
  /** 旧纸黄：卡片、装饰的底色 */
  oldPaper: string;
  /** 奶油白：正文卡片面 */
  cream: string;
  /** 略暗的奶油，用于卡片的次级面 */
  creamSoft: string;
  /** 陶土红：主要强调色（按钮、图钉、印章） */
  terracotta: string;
  /** 更深的陶土红，用于 hover 与描边 */
  terracottaDeep: string;
  /** 鼠尾草绿：辅助色 */
  sage: string;
  /** 黄铜色：邮戳、装饰线 */
  brass: string;
  /** 墨色：浅底上的正文 */
  ink: string;
  /** 次级墨色：浅底上的说明文字 */
  inkSoft: string;
  /** 纸缝色：折痕、内阴影 */
  seam: string;
}

/** 地球贴图与球体光照用到的颜色（只在 Canvas / Three.js 中使用）。 */
export interface GlobeColorToken {
  oceanDeep: string;
  oceanMid: string;
  oceanShallow: string;
  oceanHighlight: string;
  landBase: string;
  landWarm: string;
  landCool: string;
  landEdge: string;
  coastWash: string;
  ice: string;
  graticule: string;
  label: string;
  grain: string;
  atmosphere: string;
  keyLight: string;
  fillLight: string;
  ambient: string;
}

export interface AtlasTheme {
  id: string;
  label: string;
  colors: ThemeColorToken;
  globe: GlobeColorToken;
  fonts: {
    /** 标题与展示文字：系统自带衬线，不引入外部字体 */
    display: string;
    /** 小字号 UI 文字：优先保证中文可读性 */
    ui: string;
  };
}

export const voyageVintage: AtlasTheme = {
  id: 'voyage-vintage',
  label: 'Voyage Vintage',
  colors: {
    midnightBlue: '#263F4B',
    deepSea: '#182B36',
    oldPaper: '#E8D9B8',
    cream: '#F7F0E3',
    creamSoft: '#EDE3D0',
    terracotta: '#A96C50',
    terracottaDeep: '#8A5238',
    sage: '#84917A',
    brass: '#B08D57',
    ink: '#1F2E36',
    inkSoft: '#4B5D66',
    seam: '#D6C29A',
  },
  /**
   * 取自首页参考图（assets-source/home-hero.png）上量到的颜色：
   * 海洋是低饱和的蓝绿而不是深海蓝，陆地是暖棕与土黄，轮廓一圈金色高光。
   * 换成高饱和的现代卫星配色会立刻和这张画脱节。
   */
  globe: {
    oceanDeep: '#4C5B4A',
    oceanMid: '#677660',
    oceanShallow: '#7E7D65',
    oceanHighlight: '#959877',
    landBase: '#B98959',
    landWarm: '#D6A462',
    landCool: '#9C8358',
    landEdge: '#6E4526',
    coastWash: '#E3AF77',
    ice: '#E4D8BC',
    graticule: '#E8D9B8',
    label: '#F2E7CB',
    grain: '#F7F0E3',
    atmosphere: '#E3AF77',
    /**
     * 灯光颜色刻意接近中性：贴图本身已经是参考图上的复古色，
     * 再用暖色打光会把画里的蓝绿海染成橄榄棕，颜色也就不再是量出来的那组。
     */
    keyLight: '#F5EEDD',
    fillLight: '#BFC9A8',
    ambient: '#F2F2EC',
  },
  fonts: {
    display:
      'Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", "Songti SC", "STZhongsong", serif',
    ui: '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif',
  },
};

/** 当前启用的主题；未来做多主题时在这里切换。 */
export const activeTheme: AtlasTheme = voyageVintage;

export function applyThemeToDocument(theme: AtlasTheme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--tab-${kebabCase(key)}`, value);
  }
  root.style.setProperty('--tab-font-display', theme.fonts.display);
  root.style.setProperty('--tab-font-ui', theme.fonts.ui);
  root.style.colorScheme = 'dark';
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}
