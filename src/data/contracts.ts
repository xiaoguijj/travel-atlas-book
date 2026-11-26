import type { CoverMotif } from './types';

/**
 * V1 公共数据契约。
 *
 * 这里是业务对象、素材、错误与编辑器接口的唯一来源。领域类型不得引用 Dexie、
 * Tiptap、Konva 或具体存储实现的类型，后续增加 API 适配层时可以原样复用。
 */

/** V1 业务范围冻结的六座城市 ID。伦敦保留为基线额外城市，不在此列表内。 */
export const CITY_IDS = ['nanjing', 'shanghai', 'xian', 'beijing', 'hangzhou', 'chengdu'] as const;
export type BusinessCityId = (typeof CITY_IDS)[number];

/** UTC ISO-8601 时间戳，例如 2026-11-22T10:00:00.000Z。 */
export type IsoDateTime = string;
/** 本地日历日期，YYYY-MM-DD。行程按本地日历分组，不能用 UTC 时间戳反推。 */
export type LocalDate = `${number}-${number}-${number}`;
/** 本地时间，HH:mm。 */
export type LocalTime = `${number}:${number}`;

export const BOOK_MODES = ['journal', 'collage'] as const;
export type BookMode = (typeof BOOK_MODES)[number];

/** 内容中只保存素材 ID；`photo:` 与 `sticker:` 前缀区分共享素材命名空间。 */
export const PHOTO_ID_PREFIX = 'photo:';
export const STICKER_ID_PREFIX = 'sticker:';
export type AssetKind = 'photo' | 'sticker';

export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

/** 照片导入的暂定上限，可在后续公共变更 PR 中统一调整。 */
export const MAX_PHOTO_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTO_EDGE_PX = 1600;

/** Collage 固定逻辑画布尺寸；视口变化只缩放显示，不修改这里。 */
export const COLLAGE_CANVAS_WIDTH = 1200;
export const COLLAGE_CANVAS_HEIGHT = 1600;

/** Tiptap 中项目自定义媒体块的节点名，媒体属性只保存 `assetId` 和可选说明。 */
export const JOURNAL_MEDIA_NODE_NAME = 'atlasMedia';
export const MAX_BOOK_TITLE_LENGTH = 80;

/* -------------------------------------------------------------------------- */
/* 手账                                                                        */
/* -------------------------------------------------------------------------- */

/** 与 Tiptap JSON 兼容的最小递归结构，不依赖 Tiptap 包类型。 */
export interface JournalNode {
  type: string;
  attrs?: Record<string, unknown> | null;
  content?: JournalNode[];
  text?: string;
  [key: string]: unknown;
}

export interface JournalDocument extends JournalNode {
  type: 'doc';
}

export interface JournalMediaAttrs {
  assetId: string;
  caption?: string;
}

export interface JournalContent {
  doc: JournalDocument;
}

/** A supplied precondition also protects an initially empty (undefined) journal. */
export interface JournalSavePrecondition {
  expected: JournalContent | undefined;
}

export interface CollageTextStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  fontStyle?: 'normal' | 'italic';
  fontWeight?: 'normal' | 'bold';
}

export interface CollageItemBase {
  id: string;
  /** 逻辑画布坐标，与视口缩放无关。 */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 角度，单位为度。 */
  rotation: number;
}

export interface CollagePhotoItem extends CollageItemBase {
  kind: 'photo';
  assetId: string;
}

export interface CollageStickerItem extends CollageItemBase {
  kind: 'sticker';
  assetId: string;
}

export interface CollageTextItem extends CollageItemBase {
  kind: 'text';
  text: string;
  style?: CollageTextStyle;
}

export type CollageItem = CollagePhotoItem | CollageStickerItem | CollageTextItem;

/** `items` 从底到顶排列，数组顺序就是图层顺序。 */
export interface CollageCanvas {
  width: number;
  height: number;
  items: CollageItem[];
}

/** A supplied precondition also protects an initially empty (undefined) collage. */
export interface CollageSavePrecondition {
  expected: CollageCanvas | undefined;
}

export interface TravelBook {
  id: string;
  cityId: string;
  title: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** 可选关联的旅行计划；一本手账至多关联一个计划。 */
  planId?: string;
  journal?: JournalContent;
  collage?: CollageCanvas;
}

/* -------------------------------------------------------------------------- */
/* 照片与素材                                                                  */
/* -------------------------------------------------------------------------- */

export interface PhotoAsset {
  id: string;
  cityId: string;
  blob: Blob;
  mime: SupportedImageMimeType;
  width: number;
  height: number;
  /** 入库 Blob 的字节数。 */
  size: number;
  originalName?: string;
  createdAt: IsoDateTime;
}

/** 素材面板查询返回的轻量元数据；照片的 Blob 由 `getAsset` 按需读取。 */
export interface AssetMetadata {
  assetId: string;
  kind: AssetKind;
  /** 缺省表示通用贴纸。 */
  cityId?: string;
  label: string;
  mimeType?: SupportedImageMimeType;
  width?: number;
  height?: number;
  createdAt?: IsoDateTime;
  /** 贴纸的构建后静态 URL；照片不提供，避免把 Blob 混进元数据。 */
  src?: string;
}

export interface PhotoAssetResource extends AssetMetadata {
  kind: 'photo';
  mimeType: SupportedImageMimeType;
  width: number;
  height: number;
  blob: Blob;
}

export interface StickerAssetResource extends AssetMetadata {
  kind: 'sticker';
  src: string;
}

export type AssetResource = PhotoAssetResource | StickerAssetResource;

export interface AssetQuery {
  listAssets(cityId: string): Promise<AssetMetadata[]>;
  getAsset(assetId: string): Promise<AssetResource | undefined>;
}

/* -------------------------------------------------------------------------- */
/* 静态目录                                                                    */
/* -------------------------------------------------------------------------- */

export interface StampDefinition {
  /** 稳定 ID，例如 nanjing-postmark。 */
  id: string;
  cityId: string;
  title: string;
  motif: CoverMotif;
}

export interface StampCollection {
  stampId: string;
  collectedAt: IsoDateTime;
}

export interface StickerDefinition {
  /** 稳定 ID，`sticker:` 前缀。 */
  id: string;
  /** 缺省表示通用贴纸。 */
  cityId?: string;
  label: string;
  category: string;
  src: string;
}

/* -------------------------------------------------------------------------- */
/* 愿望与旅行计划                                                              */
/* -------------------------------------------------------------------------- */

export interface CityWish {
  cityId: string;
  /** 可为空字符串；有愿望记录即表示地图城市已标记。 */
  note: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface PlanItem {
  id: string;
  title: string;
  time?: LocalTime;
  note?: string;
}

export interface PlanDay {
  date: LocalDate;
  /** 当日所在城市，必须属于计划的 cityIds；可为空。 */
  cityId?: string;
  /** 数组顺序即显示顺序。 */
  items: PlanItem[];
}

export interface TravelPlan {
  id: string;
  title: string;
  /** 去重后的一至多座城市。 */
  cityIds: string[];
  startDate: LocalDate;
  endDate: LocalDate;
  /** 按日期升序。 */
  days: PlanDay[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/* -------------------------------------------------------------------------- */
/* 编辑器公共接口                                                              */
/* -------------------------------------------------------------------------- */

export type EditorSaveStatus = 'ready' | 'saving' | 'saved' | 'error';

export interface EditorSaveState {
  status: EditorSaveStatus;
  error?: DataError | null;
  lastSavedAt?: IsoDateTime;
}

export interface AssetInsertionRequest {
  requestId: string;
  assetId: string;
}

/**
 * V1-05 提供共同视图接口，V1-07 / V1-08 实现具体编辑器。
 * 编辑器只上报草稿，不直接读写数据库，也不创建持久化 object URL。
 */
export interface BookEditorProps<TContent> {
  bookId: string;
  /** 由手账壳加载一次；undefined 表示尚无内容，编辑器使用本地空状态。 */
  content: TContent | undefined;
  assets: AssetQuery;
  saveState: EditorSaveState;
  onChange: (content: TContent) => void;
  onRetrySave: () => void;
  /** 请求打开共用素材面板。 */
  onOpenAssetPanel: (kind?: AssetKind) => void;
  /** 共用素材面板选中的素材，编辑器处理插入后通过 onInsertionHandled 确认。 */
  insertionRequest?: AssetInsertionRequest | null;
  onInsertionHandled?: (requestId: string) => void;
}

export type JournalEditorProps = BookEditorProps<JournalContent>;
export type CollageEditorProps = BookEditorProps<CollageCanvas>;

/* -------------------------------------------------------------------------- */
/* 错误                                                                        */
/* -------------------------------------------------------------------------- */

export type DataErrorCode =
  | 'INVALID_CITY'
  | 'INVALID_BOOK_ID'
  | 'BOOK_NOT_FOUND'
  | 'INVALID_TITLE'
  | 'INVALID_PLAN'
  | 'INVALID_RELATION'
  | 'INVALID_JOURNAL'
  | 'JOURNAL_CONFLICT'
  | 'INVALID_COLLAGE'
  | 'COLLAGE_CONFLICT'
  | 'INVALID_PHOTO'
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'PHOTO_TOO_LARGE'
  | 'IMAGE_DECODE_FAILED'
  | 'PHOTO_PROCESSING_FAILED'
  | 'INVALID_ASSET_ID'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'DATABASE_UNAVAILABLE'
  | 'STORAGE_WRITE_FAILED'
  | 'TRANSACTION_FAILED';

/**
 * 数据层统一错误。页面按 code 决定提示和重试方式，不依赖底层异常名称。
 */
export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: DataErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    // 不能叫 DataError：Dexie 自身有同名错误类，会把事务中的异常重新包装。
    this.name = 'AtlasDataError';
    this.code = code;
    this.details = details;
  }
}

export function isDataError(value: unknown): value is DataError {
  return value instanceof DataError;
}
