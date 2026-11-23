# V1 公共数据与路由契约

2026-11-22 · V1-02 `v1/02-data-contracts` · 基线 `main@1c3f181`

本文冻结 V1 后续任务共同使用的数据形状、Dexie Schema、仓储接口、照片流程、素材查询、编辑器 props、路由和错误模型。V1-04 至 V1-10 的公共接口以本文为准；需要改变已发布契约时，先走单一公共变更 PR 并同步更新本文与迁移。

## 1. 冻结摘要

| 项 | 决定 |
| --- | --- |
| 架构 | React 18 + TypeScript 模块化单体，沿用 Vite 5、HashRouter 6 |
| 数据库 | Dexie 4.4.7；数据库名 `travel-atlas-book`；当前 Schema 版本 `1` |
| 表 | `books`、`photos`、`stamps`、`wishes`、`plans`，只有这一个 Dexie 实例 |
| 业务 ID | 手账、计划、画布元素使用 UUID v4；照片 `photo:<uuid>`；贴纸 `sticker:<local-id>`；邮票 `nanjing-postmark` 一类静态 ID |
| 时间 | 记录时间使用 UTC ISO-8601，如 `2026-11-22T10:00:00.000Z`；计划日期 `YYYY-MM-DD`；计划时间 `HH:mm` |
| 照片 | JPEG / PNG / WebP；单张源文件 ≤ 10 MB；最长边缩到 1600 px；不放大；保留 PNG/WebP 透明通道 |
| 手账路由 | `/book/:bookId`、`/book/:bookId?mode=journal`、`/book/:bookId?mode=collage` |
| 依赖锁 | `package.json` 与 `package-lock.json` 由 Node 22.23.5 / npm 10.9.9 生成 |
| 初始数据 | 首次创建数据库不写入任何演示业务数据 |
| 运行命令 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e` |

锁定依赖：

```text
dexie 4.4.7
@tiptap/core 3.35.0
@tiptap/pm 3.35.0
@tiptap/react 3.35.0
@tiptap/starter-kit 3.35.0
konva 10.10.0
react-konva 18.2.14

vitest 3.2.4
fake-indexeddb 6.2.8
@playwright/test 1.65.1
@types/node 22.20.5
```

Tiptap 3.35.0 支持 React 17/18/19；React Konva 18.2.14 的 peer 允许 Konva `^10.0.0`；Vitest 3.2.4 允许 Vite `^5.0.0`。安装未使用 `--force` 或 `--legacy-peer-deps`。

## 2. 模块边界

```text
路由 / 页面 / 编辑器
  → 公共仓储接口、素材查询、路由助手、编辑器 props
    → src/data 内的 Dexie 实现、静态目录
      → 唯一 Dexie 实例

src/data/db 不导入任何 UI；领域类型不导入 Dexie / Tiptap / Konva 类型。
```

- 页面和编辑器**不得**直接导入 `src/data/db` 或 Dexie 表。
- 仓储接口与 Dexie 实现分离，后续可在不改业务调用方的前提下增加 API 适配层。
- 静态城市、邮票、贴纸定义与用户记录严格分离；Dexie 只存用户数据与引用。
- 手账与计划仓储不互相导入；跨表校验通过数据层规则和显式事务完成。

主要路径：

```text
src/data/contracts.ts             公开类型、常量、DataError
src/data/ids.ts                   ID 生成与前缀判断
src/data/validation.ts            城市、标题、Journal/Collage、计划归属校验
src/data/db/                      Dexie 实例、Schema、错误收敛
src/data/books/                   手账仓储
src/data/photos/                  照片校验、压缩、仓储
src/data/catalog/                 城市、邮票、贴纸静态目录入口
src/config/routes.ts              手账路径助手与 mode 解析
```

## 3. ID 与时间

| 对象 | 格式 | 说明 |
| --- | --- | --- |
| `TravelBook.id` | UUID v4 | 与存储无关，直接进入 `/book/:bookId`；不嵌时间或城市信息 |
| `TravelPlan.id` | UUID v4 | V1-09 用 `createStableId()` 生成 |
| `PlanItem.id` | UUID v4 | 条目在计划内稳定 |
| `CollageItem.id` | UUID v4 或客户端稳定串 | 在单张画布内唯一，不进入素材命名空间 |
| `PhotoAsset.id` | `photo:<uuid>` | 由 `createPhotoAssetId()` 生成 |
| `StickerDefinition.id` | `sticker:<local-id>` | V1-04 静态定义，发布后保持稳定 |
| `StampDefinition.id` | 如 `nanjing-postmark` | V1-04 静态定义，发布后保持稳定 |

- 生成入口：`createStableId()`、`createPhotoAssetId()`。
- 前缀判断：`isPhotoAssetId`、`isStickerAssetId`、`isKnownAssetId`。
- `isoDateTime` 全部为 UTC ISO 字符串，按字符串即可排序。
- `LocalDate` 与 `LocalTime` 是计划专用格式，不使用 UTC 时间戳取本地日期，避免跨日错误。

## 4. Schema

Dexie 版本 `1`，定义于 `src/data/db/index.ts`。首次打开只创建空表；没有 `populate` 演示数据，也没有自动写入的默认书、照片、邮票或愿望。

| 表 | 主键 | 索引 | 用途 |
| --- | --- | --- | --- |
| `books` | `id` | `cityId`, `planId` | 手账及两种内嵌内容 |
| `photos` | `id` | `cityId` | 照片 Blob 与元数据 |
| `stamps` | `stampId` | — | 邮票收藏时间 |
| `wishes` | `cityId` | — | 每城至多一条愿望 |
| `plans` | `id` | `*cityIds` | 旅行计划；`cityIds` 为 multiEntry 索引 |

对应 Dexie stores：

```ts
books: 'id, cityId, planId'
photos: 'id, cityId'
stamps: 'stampId'
wishes: 'cityId'
plans: 'id, *cityIds'
```

### 4.1 TravelBook

```ts
interface TravelBook {
  id: string;
  cityId: string;
  title: string;              // 1–80 字符，首尾空白会被去掉
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  planId?: string;            // 至多一个计划；缺省表示未关联
  journal?: JournalContent;
  collage?: CollageCanvas;
}
```

- 同一城市可有多本手账。
- `journal` 与 `collage` 独立存在，可单独为空；进入模式选择页不会写入任何一种内容。
- `planId` 只由创建手账或 V1-10 的 `linkBookToPlan` 维护；保存内容与改标题不得修改它。
- `listBooksByCity` / `listBooksByPlan` 在内存按 `updatedAt` 降序排列（同时间按 ID 降序）。

### 4.2 JournalContent

```ts
interface JournalContent {
  doc: JournalDocument;       // Tiptap JSON，根节点 type = 'doc'
}
```

媒体块节点名冻结为 `atlasMedia`，属性：

```ts
interface JournalMediaAttrs {
  assetId: string;            // photo:<uuid> 或 sticker:<id>
  caption?: string;
}
```

- 正文只保存素材 ID，不保存 Blob、base64、object URL 或渲染态。
- 保存前会检查 `doc.type === 'doc'`、`content` 为数组、每个 `atlasMedia` 节点具有合法素材 ID。
- 空正文仍应提交完整 Tiptap doc；`journal` 字段缺省表示尚未保存过 Journal。

### 4.3 CollageCanvas

```ts
interface CollageCanvas {
  width: 1200;                // COLLAGE_CANVAS_WIDTH
  height: 1600;               // COLLAGE_CANVAS_HEIGHT
  items: CollageItem[];       // 从底到顶
}
```

元素公共字段 `id / x / y / width / height / rotation`，坐标为逻辑画布坐标，`rotation` 单位为度。三种元素：

- `kind: 'photo'`：必须有 `photo:` 素材 ID。
- `kind: 'sticker'`：必须有 `sticker:` 素材 ID。
- `kind: 'text'`：必须有 `text`，可选有限 `style`（字号、字体、颜色、对齐、斜体、粗体）。

保存时校验固定画布尺寸、元素 ID 唯一、数值有限、宽高大于 0、素材前缀与类型匹配。视口缩放、选中框、Konva 节点、临时 URL 均不入库。

### 4.4 PhotoAsset

```ts
interface PhotoAsset {
  id: string;                 // photo:<uuid>
  cityId: string;
  blob: Blob;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  size: number;               // 入库 Blob 字节数
  originalName?: string;      // 来自 File.name
  createdAt: IsoDateTime;
}
```

### 4.5 邮票、贴纸、愿望与计划

```ts
interface StampDefinition { id; cityId; title; motif }       // 静态目录
interface StampCollection { stampId; collectedAt }            // 用户记录
interface StickerDefinition { id; cityId?; label; category; src } // 静态目录

interface CityWish { cityId; note: string; createdAt; updatedAt }

interface TravelPlan {
  id; title; cityIds: string[];
  startDate: LocalDate; endDate: LocalDate;
  days: PlanDay[];            // 按日期升序
  createdAt; updatedAt;
}
interface PlanDay { date: LocalDate; cityId?: string; items: PlanItem[] }
interface PlanItem { id; title; time?: LocalTime; note? }
```

- `StickerDefinition.cityId` 缺省表示通用贴纸。
- `CityWish.note` 允许空字符串；存在记录即表示地图已标记。
- `PlanDay.cityId`、`PlanItem` 的增删改和事务清理由 V1-09 实现。
- 邮票、愿望、计划仓储不在 V1-02 实现，只冻结表、类型与索引。

## 5. 仓储接口

### 5.1 手账

```ts
listBooksByCity(cityId: string): Promise<TravelBook[]>
listBooksByPlan(planId: string): Promise<TravelBook[]>
createBook(cityId: string, title: string, planId?: string): Promise<TravelBook>
getBook(bookId: string): Promise<TravelBook | undefined>
renameBook(bookId: string, title: string): Promise<TravelBook>
saveJournal(bookId: string, content: JournalContent): Promise<TravelBook>
saveCollage(bookId: string, canvas: CollageCanvas): Promise<TravelBook>
```

实现入口：`src/data/books`。默认实例已绑定唯一 Dexie；测试用 `createBookRepository(database, { now })` 注入独立数据库和时钟。

语义：

- `listBooksByCity`：城市必须能由静态目录解析，否则 `INVALID_CITY`。
- `listBooksByPlan`：空计划 ID 抛 `INVALID_PLAN`；不存在的计划返回空数组。
- `createBook`：去掉标题首尾空白并校验 1–80 字符；可选 `planId` 在 `books + plans` 事务中校验计划存在且包含该书城市，失败不留下记录。
- `getBook`：空 ID 或未知 ID 返回 `undefined`，由手账壳提供退路。
- `renameBook`：只写 `title`、`updatedAt`。
- `saveJournal`：只写 `journal`、`updatedAt`。
- `saveCollage`：只写 `collage`、`updatedAt`。

**保存协议**：所有更新使用 Dexie `update` 的字段级 patch，不允许调用方回传整本旧 `TravelBook`。读取只用于确认存在并返回最新对象；写事务不会把旧对象整体覆盖回去。因此改标题、保存一种模式、更新计划关联三者互不覆盖。

### 5.2 照片

```ts
importPhoto(cityId: string, file: File | Blob): Promise<PhotoAsset>
getPhoto(assetId: string): Promise<PhotoAsset | undefined>
listPhotosByCity(cityId: string): Promise<PhotoAsset[]>
```

实现入口：`src/data/photos`。默认使用浏览器 Canvas / `createImageBitmap`；测试通过 `createPhotoRepository(database, { processor, now })` 注入处理器。

导入顺序：

1. 校验城市。
2. 校验源文件非空且 ≤ 10 MB。
3. 读取文件头，按真实字节识别 JPEG / PNG / WebP，不相信扩展名。
4. 解码并检查实际尺寸。
5. 最长边超过 1600 px 时等比缩放；不超过时保留原始字节。
6. 缩放后按源格式重新编码：JPEG/WebP 质量 0.85，PNG 保持 PNG 以保留 alpha；不放大。若浏览器不支持源编码，则以实际可用的受支持编码结果为准，并把实际 MIME 写入记录。
7. 事务之外完成处理后，写入一条 `photos` 记录。

- `getPhoto` 对未知或非 `photo:` ID 返回 `undefined`。
- `listPhotosByCity` 按 `createdAt` 降序返回。
- 照片按城市归档，可被同城多本书、两种编辑模式共同引用。
- 仓储不创建 object URL；V1-05 的素材面板/预览组件负责创建与释放。
- 仓储不提供删除接口，V1 不做自动资产清理。

### 5.3 素材查询与编辑器 props

V1-05 负责组装素材查询；V1-02 只冻结接口：

```ts
interface AssetQuery {
  listAssets(cityId: string): Promise<AssetMetadata[]>;
  getAsset(assetId: string): Promise<AssetResource | undefined>;
}
```

- `listAssets` 返回轻量元数据：照片不携带 Blob，贴纸可携带构建后静态 `src`。
- `getAsset` 对照片返回 `Blob`，对贴纸返回静态 URL；调用方自己管理预览 URL 生命周期。
- 编辑器 props：

```ts
interface BookEditorProps<TContent> {
  bookId: string;
  content: TContent | undefined;
  assets: AssetQuery;
  saveState: EditorSaveState;          // ready | saving | saved | error
  onChange: (content: TContent) => void;
  onRetrySave: () => void;
  onOpenAssetPanel: (kind?: AssetKind) => void;
  insertionRequest?: { requestId: string; assetId: string } | null;
  onInsertionHandled?: (requestId: string) => void;
}
type JournalEditorProps = BookEditorProps<JournalContent>;
type CollageEditorProps = BookEditorProps<CollageCanvas>;
```

- 手账壳负责加载书与城市、处理无效 ID、初始化内容一次、排队保存和展示反馈。
- 编辑器只上报草稿；不得直接读写 Dexie。首次加载后，保存成功不得触发热重载覆盖正在输入的内容。
- 素材插入由共享面板发起：面板选择素材后，壳传入 `insertionRequest`，编辑器插入后调用 `onInsertionHandled`。

### 5.4 静态目录

`src/data/catalog` 已提供可调用的空入口，V1-04 直接填充数据：

```ts
getCityById(cityId)
listStampDefinitions(cityId?)
getStampDefinition(stampId)
listStickerDefinitions(cityId?)   // 指定城市时返回本城 + 通用
getStickerDefinition(stickerId)
```

城市删除伦敦外的六城 ID 冻结为：`nanjing`、`shanghai`、`xian`、`beijing`、`hangzhou`、`chengdu`。当前 `cities.ts` 已有南京、上海、北京、伦敦；西安、杭州、成都由 V1-04 补入。

**最小兼容决策**：城市校验跟随静态目录 `getCityById`，因此现有伦敦入口继续可用；六城 ID 已冻结，V1-04 补入三城后自动成为合法城市。V1 比赛验收只覆盖六城。

## 6. 路由契约

路由表仍由 `src/App.tsx` 注册，V1-05 负责接入；V1-02 不修改 `App.tsx`。路径助手返回 HashRouter 内部路径，不含 `#`。

| 助手 | 返回值 | 页面 |
| --- | --- | --- |
| `bookPath(bookId)` | `/book/:bookId` | 模式选择页 |
| `journalBookPath(bookId)` | `/book/:bookId?mode=journal` | Journal |
| `collageBookPath(bookId)` | `/book/:bookId?mode=collage` | Collage |
| `bookModePath(bookId, mode)` | 两种模式 URL 的通用构造 | — |
| `readBookMode(params)` | `'journal' \| 'collage' \| undefined` | — |

- `bookPath` 会去除首尾空白、拒绝空 ID，并对路径段做 `encodeURIComponent`。
- 缺省、空值、大小写不符或未知 `mode` 一律返回 `undefined`，由页面显示模式选择页。
- 地址栏示例：`/#/book/<bookId>?mode=collage`。
- `BOOK_ROUTE_SEGMENT = 'book/:bookId'` 供 V1-05 作为 Shell 子路由注册；`BOOK_ROUTE_PATH = '/book/:bookId'` 表示完整 URL 路径。
- 三种 URL 共用同一个 `bookId`、书壳和保存队列；无效书 ID 在三种 URL 下都返回邮票册入口（V1-05 实现）。

## 7. 错误模型

数据层错误统一为 `DataError`：

```ts
class DataError extends Error {
  readonly code: DataErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}
isDataError(value): value is DataError
```

- `DataError.name` 为 `AtlasDataError`，避免与 Dexie 自身的 `DataError` 冲突。
- `toDataError` 会把 Dexie 事务包装的 `inner` 还原，并映射配额、数据库关闭、升级失败、事务中止等底层异常。
- 页面按 `code` 展示可读提示和重试动作，不解析底层异常名称。

| code | 触发场景 | 建议处理 |
| --- | --- | --- |
| `INVALID_CITY` | 城市不在静态目录 | 返回城市/邮票册，不写入 |
| `INVALID_BOOK_ID` | 写操作传入空书 ID | 返回邮票册 |
| `BOOK_NOT_FOUND` | 书已不存在 | 返回城市列表或邮票册 |
| `INVALID_TITLE` | 标题为空或超过 80 字符 | 保留输入并提示 |
| `INVALID_PLAN` | 计划 ID 为空或计划不存在 | 保留表单，提示重新选择 |
| `INVALID_RELATION` | 手账城市不在计划城市集合内 | 阻止关联 |
| `INVALID_JOURNAL` | 正文结构或媒体 ID 无效 | 保留草稿，提示重试 |
| `INVALID_COLLAGE` | 画布尺寸、元素字段、ID 或素材前缀无效 | 保留草稿，提示重试 |
| `INVALID_PHOTO` | 空文件 | 提示重新选择 |
| `UNSUPPORTED_IMAGE_TYPE` | 非 JPEG/PNG/WebP | 提示支持的格式 |
| `PHOTO_TOO_LARGE` | 源文件超过 10 MB | 提示压缩后重试 |
| `IMAGE_DECODE_FAILED` | 实际无法解码 | 提示文件损坏 |
| `PHOTO_PROCESSING_FAILED` | Canvas/编码不可用或处理器异常 | 提示重试 |
| `INVALID_ASSET_ID` | 素材查询或插入时 ID 不符合命名空间（V1-05 使用） | 阻止插入/引用 |
| `STORAGE_QUOTA_EXCEEDED` | 浏览器配额不足 | 提示清理站点数据 |
| `DATABASE_UNAVAILABLE` | 数据库关闭、打开或升级失败 | 提示刷新 |
| `STORAGE_WRITE_FAILED` | 单表写入失败 | 保留草稿并允许重试 |
| `TRANSACTION_FAILED` | 跨表事务失败或被中止 | 保留草稿并允许重试 |

## 8. 事务与一致性

- 照片的解码与压缩在写事务之外完成；失败或超限不会写记录。
- `createBook` 带 `planId` 时在 `books + plans` 事务中校验计划存在、计划包含手账城市，然后新增，避免半条记录。
- 单表写入（标题、Journal、Collage）在短事务中执行“读取存在性 → 字段级 update → 返回最新对象”，只提交目标字段。
- 测试用外层 `rw` 事务抛出错误，验证写入手账会整体回滚。
- 调用方不得用 UI 中缓存的整本书对象回写；Repository 接口本身也不接受整本书更新。
- 保存成功前不得显示“已保存”；浏览器强制关闭时以最后一次成功提交为准。

## 9. 迁移与扩展约束

1. Schema 只能通过 Dexie `version(n)` 追加迁移；禁止直接改写已发布版本的 stores 或清库。
2. 新增字段优先保持向后兼容；改变已发布形状时走公共变更 PR，并补迁移测试。
3. 页面、编辑器和组件不得导入 Dexie；后续 API 适配层应实现相同仓储接口。
4. 业务 ID 与存储实现无关，发布后保持稳定；照片和贴纸继续使用命名空间前缀。
5. 照片 Blob 与编辑器内容分离，未来可迁移到云对象存储而不改内容 JSON。
6. 领域类型不得依赖 Dexie 特有类型；当前除 `PhotoAsset.blob` 外均为 JSON 友好结构。
7. 未来账号、云同步、社区能力应通过新增适配层和迁移实现，V1 不引入后端、认证或同步引擎。

## 10. 测试与验证

```bash
# Node 22 + npm 10
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium   # 首次
npm run test:e2e                  # 先构建再跑生产预览
```

当前测试覆盖：

- 创建两本同城手账、跨城隔离。
- Journal / Collage 独立保存，互不覆盖。
- 改标题不覆盖正文、拼贴和计划关联。
- 照片 Blob 入库、读取、关闭重开恢复。
- 无效城市、无效计划、跨城关联、无效内容。
- 事务失败整体回滚。
- 三种手账 URL 构造、未知 mode 回退。
- 空数据库初始化，五张表存在且无演示数据。
- 生产构建首页启动、无运行时错误、城市 Hash 深链可用。
- 愿望增改删、每城单条、移除愿望不影响行程与手账（V1-09）。
- 计划日期与城市校验、缩短日期/移除城市的影响确认、手账解绑、删除计划保留手账（V1-09）。
- 愿望地图六城点位、刷新恢复、窄屏与静态子路径（V1-09 E2E）。

真实照片解码、Canvas 压缩和 object URL 生命周期属于浏览器路径；Node 单测通过注入 `PhotoProcessor` 验证仓储，V1-05/07/08 接入界面后应在真实浏览器补测。

## 11. 后续任务接入说明

### V1-04 · 城市数据与素材

- 在 `src/data/cities.ts` 补西安、杭州、成都，沿用冻结 ID，不新建城市目录。
- 在 `src/data/catalog/stamps.ts`、`stickers.ts` 填充静态定义；保持 `stamp:` / `sticker:` 命名与城市隔离。
- 不要修改 `contracts.ts` 的字段形状或 Dexie Schema；确需新增字段先走公共变更。

### V1-05 · 路由、手账壳与共享素材

- 用 `src/config/routes.ts` 注册 `/book/:bookId`，用 `readBookMode` 分流模式选择页与编辑器。
- 直接调用 `src/data/books`、`src/data/photos` 的公开接口；不要导入 `src/data/db`。
- 实现 `AssetQuery`：照片元数据来自 `listPhotosByCity`，贴纸来自静态目录；`getAsset` 按前缀分派。
- 保存队列只调用 `saveJournal` / `saveCollage`；标题走 `renameBook`；按 `DataError.code` 展示失败与重试。
- 加载书内容一次；保存成功只更新反馈，不重置编辑器。

### V1-07 / V1-08 · 编辑器

- 实现 `JournalEditorProps` / `CollageEditorProps`，内容只引用素材 ID。
- 不要直接查库或持久化 object URL；插入素材走 `insertionRequest` 协议。
- Collage 使用 `COLLAGE_CANVAS_WIDTH × COLLAGE_CANVAS_HEIGHT` 逻辑坐标，缩放/旋转结束再归一化入库。

### V1-09 · 愿望与行程

- 使用同一 Dexie 实例和本文表/索引；城市校验复用 `requireCity` 与 `planIncludesCity`。
- 计划 ID、条目 ID 使用 `createStableId()`；日期 `YYYY-MM-DD`、时间 `HH:mm`、记录时间 UTC ISO。
- `days` 按日期升序，`items` 顺序即显示顺序；跨表清理与计划保存放同一事务。
- 实装入口：`src/data/wishes`（`listWishes` / `getWish` / `saveWish` / `removeWish`）与 `src/data/plans`（`listPlans` / `getPlan` / `savePlan` / `deletePlan`，另含 `previewPlanChange`、`previewPlanDelete`）。
- 保存需要确认而调用方未提供确认集合时抛 `INVALID_PLAN`，`details.reason` 为 `CONFIRMATION_REQUIRED`；确认期间影响变化时同样抛 `INVALID_PLAN`，`details.reason` 为 `CONFIRMATION_CHANGED` 并附最新 `preview`。
- 草稿带 `baseUpdatedAt`（加载计划时的 `updatedAt`）时，预览与保存都会校验计划版本；其他窗口已保存过计划则抛 `INVALID_PLAN`，`details.reason` 为 `PLAN_CHANGED`，不覆盖新内容。前端表单在保存成功后更新该基准值。

### V1-10 · 关联联动

- `linkBookToPlan(bookId, planId?)` 在 `books + plans` 事务中读取两表，校验书城市属于计划，再只更新 `books.planId`；省略表示解除。
- 不要用旧整本书覆盖其他字段；关联变化不应影响 Journal / Collage 内容。

## 12. 已知问题与风险

- **依赖审计告警**：现有 `react-router-dom@6.28.0` 有高危 open-redirect 公告；`vitest@3.2.4` 的开发依赖 `tinypool` 有 critical 公告；`esbuild`/`vite` 与构建脚本 `jimp` 有 moderate 公告。本次按任务要求锁定既有 Vite 5、Router 6.28 和 Vitest 3.2.4，未做无关升级；建议由公共依赖 PR 统一评估修复，不在业务分支单独升级。
- **三座新城尚未可选**：`xian`、`hangzhou`、`chengdu` 已冻结在 `CITY_IDS`，但在 V1-04 补入静态目录前，`createBook` 等接口会按 `INVALID_CITY` 拒绝。这是依赖顺序的正常状态。
- **伦敦兼容**：城市校验跟随静态目录，伦敦作为基线额外城市仍可使用；V1 比赛业务范围仍为六城。
- **浏览器图片路径未自动化**：Node 环境没有 Canvas，照片真实解码/缩放由浏览器实现；当前 E2E 只做构建与路由冒烟，接入界面后需补真实照片上传回归。
- **计划、愿望仓储已由 V1-09 实装**：实现位于 `src/data/plans`、`src/data/wishes`，沿用 V1-02 冻结的表、索引与类型；邮票仓储仍由 V1-06 完成。