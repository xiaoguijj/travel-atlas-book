import type { CreationMode } from '../data/creationModes';
import type { StickerArtwork, StickerArtworkCategory } from '../data/catalog/stickerArtwork';

/**
 * 贴纸系统的数据结构，Journal 与 Collage 共用。
 *
 * 这里刻意不出现「页」「横线」「邮票册」这类 Journal 专有概念：
 * 组件只认 StickerInstance 数组，宿主页面自己决定这些实例属于哪一本、哪一页。
 */

/** common＝全域小集（不绑城市的通用贴纸），stamp＝城市邮票，culture＝城市文化贴纸 */
export type StickerCategory = StickerArtworkCategory;

/** 一张可用的贴纸素材（素材库的一行），不是页面上的实例 */
export type StickerAsset = StickerArtwork;

/**
 * 贴在画布上的一张贴纸实例。
 *
 * 位置用相对画布的 0–1 比例、尺寸用倍数存，所以屏幕缩放、换设备、
 * 画布跟着容器缩放都不会跑位——存绝对像素是错的。
 */
export interface StickerInstance {
  instanceId: string;
  assetId: string;
  /** 贴纸中心点相对画布宽度的比例，0–1 */
  x: number;
  /** 贴纸中心点相对画布高度的比例，0–1 */
  y: number;
  /** 相对该素材默认尺寸的倍数 */
  scale: number;
  /** 角度，顺时针为正 */
  rotation: number;
  /** 图层顺序，越大越靠上 */
  z: number;
}

/**
 * 一份贴纸存档归属的作用域：城市 + 创作模式 + 第几本手账。
 *
 * journalId 现在恒为 'default'（每座城市一篇），V1-05 支持多篇手账时
 * 只要把它换成真实编号，键规则和组件都不用再动。
 */
export interface StickerScope {
  cityId: string;
  mode: CreationMode;
  journalId: string;
}

/** 一个作用域下的全部存档，pages 的下标就是页码（Collage 只用 pages[0]） */
export interface StickerDocument {
  version: 1;
  pages: StickerInstance[][];
}

/** 与 Journal 的文字存档一样只有三种状态：存好了、正在存、这台设备存不下 */
export type StickerStatus = 'saved' | 'saving' | 'unavailable';
