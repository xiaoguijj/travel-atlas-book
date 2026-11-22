# Travel Atlas Book V1 技术调研与方案

2026 年 11 月 22 日 · V1 技术参考

V1 保留 React 18、Three.js、Vite 和 Hash 路由。Journal 用 Tiptap 3，Collage 用 React Konva 18，用户数据落 Dexie 4，动画沿用 Three.js 与 CSS，计划页用普通 React 表单。开发任务、分支依赖、正式路由契约与发布验收见 [V1 正式开发规划](Travel-Atlas-Book-V1-Development-Plan.md)。

## 1. 原型调研基线

下表记录转场合并前的原型快照 `ea457b3`。当前实施基线与 V1 范围见正式开发规划。[原型快照](https://github.com/xiaoguijj/travel-atlas-book/tree/ea457b3bca97c99f3cf0da6c558a78dc98ca91df)

| 区域 | 原型快照 | V1 接入点 |
| --- | --- | --- |
| 首页和 3D 地球 | 宽屏插画舞台和窄屏布局已实现。地球可转动、缩放与定位，DOM 图钉由场景投影，重叠时按距离选点。WebGL 初始化失败时会渲染城市按钮。 | 复用 `Globe`、现有场景及退路。地球继续负责发现城市，收藏与存档从页面服务接入。[首页](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/pages/HomePage.tsx) · [Globe](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/components/globe/Globe.tsx#L60-L137) · [场景](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/three/createGlobeScene.ts) |
| 明信片和城市页 | 南京、上海、北京已有静态资料、地标剪影与明信片。明信片负责介绍及导航，城市页已有封面和无效 ID 退路，正文仍是占位。邮戳外观已有，收藏记录与收藏册待实现。 | 保留 `City` 和 `getCityById`，在城市页接手账列表与新建入口，复用 `CityMotif` 和主题色。[城市数据](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/data/cities.ts) · [明信片](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/components/postcard/CityPostcard.tsx#L13-L55) · [城市页](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/pages/CityPage.tsx) |
| 栏目与业务 | `/section/journals` 列出城市链接，`/section/plans` 展示规划文案。Dexie、存档、Journal、Collage、素材库和真实行程均待接入。 | 在现有 Hash 路由与 `src/pages` 下接模式选择、编辑视图和计划页，保留原有城市 URL。功能接通后同步更新栏目状态与页面文案。[路由](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/App.tsx#L27-L54) · [栏目页](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/pages/SectionPage.tsx) · [依赖与脚本](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/package.json) |
| 构建与部署 | 主分支锁定 React 18.3.1、Router 6.28、Three.js 0.169、Vite 5.4.11、TypeScript 5.6.3。使用 `base: './'` 和 Three.js 独立分包，尚无自动化测试命令或仓库内部署工作流。 | 保持现有构建方式，添加最少的测试和静态部署验证。主分支已执行 `npm ci` 与 `npm run build`，构建通过。[构建配置](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/vite.config.ts) · [锁文件](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/package-lock.json) |

原型 `Shell` 曾以首页路径为条件调用 `useMediaQuery`，从城市深链返回首页时在模拟 DOM 中复现了 Hook 顺序警告。PR #1 已将 Hook 改为无条件调用，并合入城市到达、标记反馈和明信片展开。当前基线以该合并结果为准，真实设备上的回归验证按正式开发规划执行。[原型 Shell](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/App.tsx#L14-L23) · [首页转场 PR #1](https://github.com/xiaoguijj/travel-atlas-book/pull/1)

## 2. 开源仓库调研与复用判断

九个参考均能读取默认分支树和相关源码。以下链接固定到调研提交。许可判断结合仓库文件树、LICENSE、包清单和项目声明。未逐个部署参考应用。

| 项目 | 源码证据与技术栈 | 对 V1 的取舍 |
| --- | --- | --- |
| Atlas Travel Editor | React 18、Vite、Zod 和 `idb`。`IndexedDbStore` 将一个旅行文档包装后写入 IndexedDB，并携带版本标记，`DocumentStore` 把读取和保存与后端实现隔开。Pages 工作流构建并上传静态产物。[数据定义](https://github.com/hlibsuslov/atlas-travel-editor/blob/1d0928816311066ed1f74d0813947ef59485a8c4/src/domain/schema.ts) · [存储契约](https://github.com/hlibsuslov/atlas-travel-editor/blob/1d0928816311066ed1f74d0813947ef59485a8c4/src/lib/storage/types.ts#L69-L88) · [IndexedDB](https://github.com/hlibsuslov/atlas-travel-editor/blob/1d0928816311066ed1f74d0813947ef59485a8c4/src/lib/storage/stores/IndexedDbStore.ts#L22-L87) · [部署](https://github.com/hlibsuslov/atlas-travel-editor/blob/1d0928816311066ed1f74d0813947ef59485a8c4/.github/workflows/deploy-pages.yml) | MIT。借鉴读写边界和部署检查。其原生 IndexedDB 封装依赖 `idb`，整包文档、云驱动、版本令牌不适合直接移植到 Dexie 多记录模型。 |
| React Image Editor | React 18、Konva 8、React Konva 18 和 Redux Toolkit。`currentStageData` 用实体集合维护对象状态，`useTransformer` 处理选中节点变换，`useImageAsset` 单独按 ID 查图片。[依赖](https://github.com/swimmingkiim/react-image-editor/blob/fe539ef9f104a65b57fdb2d202ee6fedc7288c36/package.json) · [画布状态](https://github.com/swimmingkiim/react-image-editor/blob/fe539ef9f104a65b57fdb2d202ee6fedc7288c36/src/redux/currentStageData.ts#L9-L57) · [Transformer](https://github.com/swimmingkiim/react-image-editor/blob/fe539ef9f104a65b57fdb2d202ee6fedc7288c36/src/hook/useTransformer.ts) · [图片](https://github.com/swimmingkiim/react-image-editor/blob/fe539ef9f104a65b57fdb2d202ee6fedc7288c36/src/hook/useImageAsset.ts) | MIT。采用同类库及对象状态、变换和素材分离的模式。现有 Hook 依赖上游节点属性和配置，V1 独立写最小适配，Redux 与多画布相关切片没有移植价值。 |
| Scrapbook | React 19、CRA、原生 IndexedDB。工具栏将相片、胶带、文字等作为添加操作，拍立得独立渲染，Journal 把页面元素及位置写入存档，并用 FileReader 管理上传。[工具栏](https://github.com/OarisaR/Scrapbook/blob/c893c0040b76d0551ea30ce97a6c6a1799617cd8/src/components/Toolbar.js) · [拍立得](https://github.com/OarisaR/Scrapbook/blob/c893c0040b76d0551ea30ce97a6c6a1799617cd8/src/components/PolaroidElement.js#L4-L40) · [上传](https://github.com/OarisaR/Scrapbook/blob/c893c0040b76d0551ea30ce97a6c6a1799617cd8/src/Journal.js#L392-L425) · [存储](https://github.com/OarisaR/Scrapbook/blob/c893c0040b76d0551ea30ce97a6c6a1799617cd8/src/db.js) | 未找到项目级许可。参考素材面板、照片边框和选中态的交互。图片、音乐和实现代码均由本项目自备。 |
| kzenow/diary | React、Vite、Tiptap 2、`idb` 与可选 Supabase。编辑器用 `setContent` 回填、`getHTML` 保存，照片经 FileReader 存为独立附件并在正文外预览。它能证明编辑器和存档接入顺序，正文的行内图片节点需自行实现。[依赖](https://github.com/kzenow/diary/blob/45dca4bef230e32f8019ed339423082f840b7807/package.json) · [编辑器](https://github.com/kzenow/diary/blob/45dca4bef230e32f8019ed339423082f840b7807/src/components/EntryEditor.tsx#L15-L109) · [附件类型](https://github.com/kzenow/diary/blob/45dca4bef230e32f8019ed339423082f840b7807/src/types.ts) · [存储](https://github.com/kzenow/diary/blob/45dca4bef230e32f8019ed339423082f840b7807/src/db.ts) | README 明示 MIT，树中未找到独立 LICENSE。参考编辑、附件和保存反馈，引用具体代码前应补齐适用许可和版权声明。本方案采用 Tiptap 的官方包。 [许可声明](https://github.com/kzenow/diary/blob/45dca4bef230e32f8019ed339423082f840b7807/README.md#L183-L185) |
| StampQuest | React 19、Vite，浏览器有本地后端，项目还含 Express/SQLite 和 Cloudflare Worker 实现。护照根据已获得邮票统计进度，卡片衍生锁定/已收集状态，SVG 通过城市或地点主体渲染。[护照](https://github.com/shrlak/stampquest/blob/bb853972594b3fa995854151997e541ead5edf8a/client/src/pages/PassportPage.tsx#L50-L70) · [卡片](https://github.com/shrlak/stampquest/blob/bb853972594b3fa995854151997e541ead5edf8a/client/src/components/StampCard.tsx) · [本地存储](https://github.com/shrlak/stampquest/blob/bb853972594b3fa995854151997e541ead5edf8a/client/src/lib/localBackend.ts) · [服务端依赖](https://github.com/shrlak/stampquest/blob/bb853972594b3fa995854151997e541ead5edf8a/server/package.json) | 未找到项目级许可。参考邮票图鉴和已藏/未藏反馈。V1 用显式收集操作，无需位置、到访审核或服务端。 |
| TREK | React/Vite 客户端，NestJS、MikroORM、SQLite 服务端。`tripJournalApi` 把行程关联作为显式操作，日程编辑 Hook 以天和行程条目 ID 移动内容，贴纸目录把分类资源集中并提供查找入口。[手账联动](https://github.com/liketrek/TREK/blob/2bcfc1bfcbbff0affd097c0f789c835396389572/client/src/api/tripJournal.ts#L8-L29) · [行程编辑](https://github.com/liketrek/TREK/blob/2bcfc1bfcbbff0affd097c0f789c835396389572/client/src/pages/tripPlanner/useDayPlanEdits.ts#L77-L117) · [素材目录](https://github.com/liketrek/TREK/blob/2bcfc1bfcbbff0affd097c0f789c835396389572/shared/src/book/stickers/sticker-catalogue.ts) | AGPL v3。参考计划与手账通过 ID 关联、贴纸按主题归档。多人、联网和路线编辑逻辑不移植。 |
| AdventureLog | SvelteKit、Django GIS 和 PostgreSQL 相关字段。数据层将地点与访问记录拆为实体，也通过关系字段连接城市、照片和行程相关对象，行程另有每日与条目模型。[前端清单](https://github.com/seanmorley15/AdventureLog/blob/f92621f07b978765fc1284dc29af0b5e744ae930/frontend/package.json) · [关系模型](https://github.com/seanmorley15/AdventureLog/blob/f92621f07b978765fc1284dc29af0b5e744ae930/backend/server/adventures/models.py#L129-L240) · [行程日期和条目](https://github.com/seanmorley15/AdventureLog/blob/f92621f07b978765fc1284dc29af0b5e744ae930/backend/server/adventures/models.py#L717-L770) | GPL v3。借鉴城市和用户记录拆开、以 ID 引用的设计。V1 通过 Dexie 实现，数据库和服务端模型留在参考范围。 |
| TravelMap | React、Vite、Zod、MapLibre、工作区多应用。`validateDataset` 校验跨记录引用并委托 `validateTrip` 校验单个行程，展示端独立构建静态产物并有 Pages 发布命令。[数据校验](https://github.com/thisispivi/TravelMap/blob/7a8b4a26eb1280dbb331a4ddb56a477dd5db67c4/packages/core/src/validation/validateDataset.ts) · [单行程校验](https://github.com/thisispivi/TravelMap/blob/7a8b4a26eb1280dbb331a4ddb56a477dd5db67c4/packages/core/src/validation/validateTrip.ts) · [构建清单](https://github.com/thisispivi/TravelMap/blob/7a8b4a26eb1280dbb331a4ddb56a477dd5db67c4/apps/travel-map/package.json) | 未找到项目级许可。README 的 CC BY 4.0 对应特定第三方素材。借鉴表单校验与跨实体校验的职责划分，以及静态产物检查。 |
| Turistar | Next.js、Supabase、tRPC；按日期生成每日分组，BoardView 消费每日数据，并将移动回调交回规划模块。[每日数据](https://github.com/andre-lmarinho/turistar/blob/b90b0de935d3b1253911e3d4c456daaeff6e9172/src/features/activity/lib/dayOperations.ts) · [面板](https://github.com/andre-lmarinho/turistar/blob/b90b0de935d3b1253911e3d4c456daaeff6e9172/src/modules/planner/views/BoardView.tsx#L17-L68) · [计划仓库](https://github.com/andre-lmarinho/turistar/blob/b90b0de935d3b1253911e3d4c456daaeff6e9172/src/features/plan/repositories/PlanRepository.ts) | AGPL v3。借鉴日期分组与排序。用现有 React 路由、表单与 Dexie 做每天的行程，省去 Next.js、协作和看板拖拽。 |

可直接复用的代码来自本项目现有地球、城市数据、主题、明信片、地标和路由。两个独立 MIT 项目提供了可按许可复用的源码候选，本次方案选择调用原库接口、独立实现 V1 业务。邮票收集规则、两个编辑器的存档适配、行程联动、素材引用及演示原稿均由本项目实现。

## 3. 最终技术选型

| 能力 | 推荐 | 成本、兼容性和限制 |
| --- | --- | --- |
| Journal | Tiptap 3 的 `@tiptap/react`、`@tiptap/pm`、StarterKit 与同版核心依赖。增加一个带 `assetId` 的媒体块节点，支持照片与贴纸的顺序插入。存 JSON，横线用 CSS 纸页背景。 | 中。已查 npm peer，Tiptap 3.35.0 支持现有 React 18 及其类型包。官方 Image 扩展主要渲染 `src`，不会替项目保存上传内容，所以由媒体节点按 ID 查本地 Blob，工具栏只保留正文、基本排版和插入素材。开发时锁定同一组版本，验证中文输入、粘贴、载入旧文档和长文本滚动。[React 安装](https://tiptap.dev/docs/editor/getting-started/install/react) · [Image 扩展](https://tiptap.dev/docs/editor/extensions/nodes/image) |
| Collage | `react-konva@18.2.14` 配其 peer 支持的 Konva 10，配对验证后锁定。基于 `Stage / Layer / Transformer`，用项目对象列表渲染图片、贴纸、文字。 | 中至高。npm 清单验证了现有 React 18 及 Konva 10 在 peer 范围内。Transformer 要用 ref 绑定选中对象，缩放改变的是 `scaleX/Y`，结束时归一化入库。图层、样式、导出的运行态须区分。移动端重点测选中、缩放与滚动冲突，DOM 工具栏提供图层列表与删除/排序。[版本清单](https://registry.npmjs.org/react-konva/18.2.14) · [Transformer](https://konvajs.org/docs/react/Transformer.html) |
| 动画与转场 | 地球用现有 Three.js，卡片用现有 CSS 动画和少量页面局部状态。V1 先不引入 Motion。 | 低。Motion 12 的 React peer 与现有栈匹配，也提供出场与布局动画，但当前可复用代码已能覆盖到达和明信片展开。转场走单一入口，处理返回、快速选择、减少动效和 WebGL 退路。[现有分支](https://github.com/xiaoguijj/travel-atlas-book/blob/71b88eaea3c97da25df23cd77250adbd8c076cab/src/pages/HomePage.tsx#L28-L89) · [Motion](https://motion.dev/docs/react-installation) |
| 旅行计划 | React 表单、日期与日程分组、增删改及同日上下移动。用小型 TypeScript 校验函数和原生日期输入。 | 低至中。就地校验日期区间、必填项和城市引用。示例以跨两天的行程验收。日历网格、路线优化、外部地图服务、拖拽库均不构成演示依赖。[按日分组参考](https://github.com/andre-lmarinho/turistar/blob/b90b0de935d3b1253911e3d4c456daaeff6e9172/src/features/activity/lib/dayOperations.ts) |
| 图片与素材 | 上传照片用 File + Canvas 压缩为 Blob，Dexie 按 ID 存储，读取后创建临时 object URL。静态贴纸走本地目录和构建时资源。 | 中。优先支持 JPEG、PNG、WebP，解析后检查实际内容。建议先用每图源文件 10 MB、最长边 1600 px、每次选一张作演示参数，按实机表现调整。照片始终等比，透明素材保留透明，离开视图释放 URL。复用同一 Photo ID，刷新时重新解析。[存储配额](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) |
| 状态管理 | React 局部 state 和 Collage `useReducer` 持有工作状态。路由传标识符，Dexie 持有已保存记录。 | 低。初版无需 Redux、Zustand 或全局 Context。进入页面、写入成功时刷新数据。Globe 相机、编辑器实例、选中框均留在模块内。多页面读同一数据时用共同服务，避免重复维护“当前城市”等全局副本。[Dexie schema](https://dexie.org/docs/Version/Version.stores()) |
| 自动化测试与静态部署 | 用 Vitest 跑纯模型和仓储测试，Playwright Chromium 跑演示主链路及刷新。保留 `npm run build`、相对 base 和 Hash 路由。优先以既有说明中的 Qoder Sites 验证静态构建，同时备好同一 `dist/` 的本机静态服务。 | 中。Vitest 可从已核验支持 Vite 5 的 3.2.6 开始验证并锁定，仓储测试可配 `fake-indexeddb`，配额、照片解码与真正的 IndexedDB 重新打开由浏览器验收。Playwright 针对生产构建运行，本地与 CI 使用同一 Node 版本，建议沿用 README 的 Node 22 主线。GitHub Pages 也可托管这份静态产物。[Vite 静态部署](https://vite.dev/guide/static-deploy.html) · [Playwright webServer](https://github.com/microsoft/playwright/blob/main/docs/src/test-webserver-js.md) |

## 4. 数据模型与保存规则

一个手账 ID 挂载两种可独立为空的内容。模式选择页和两种编辑视图共用书的 ID、标题与所属城市。编辑视图共用素材面板与保存队列，各自保存编辑内容。一个城市可创建多本手账，旅行计划支持一座或数座 V1 城市。

| 实体 | 关键字段 | 存放及关系 |
| --- | --- | --- |
| `City` | 保留现有 `id/name/nameEn/region/latitude/longitude/motif/coverTint` 等字段 | 复用静态 `src/data/cities.ts`，用户数据统一引用稳定的 `cityId`。 |
| `StampDefinition` | `id, cityId, title, motif` | 静态目录，每城一款，例如 `nanjing-postmark`。 |
| `StampCollection` | `stampId, collectedAt` | Dexie `stamps: 'stampId'`。用主键保证一款只收集一次，重复操作返回已有记录，保留首次盖章时间。 |
| `TravelBook` | `id, cityId, title, createdAt, updatedAt, planId?, journal?, collage?` | Dexie `books: 'id, cityId, planId'`。按城市查多本并在内存按修改时间排序，按计划查已关联手账。两个内容随同一本书保存。 |
| `JournalContent` | `doc`。Tiptap JSON 包含段落与项目定义的媒体节点，媒体属性为 `assetId` 和可选说明。 | 内嵌于 `TravelBook.journal`。打开书后从 JSON 恢复；媒体按 ID 单独解析。 |
| `CollageCanvas` | `width, height, items[]`。元素有 `id, kind, x, y, width, height, rotation`，素材元素带 `assetId`，文字元素带 `text` 和有限样式。 | 内嵌于 `TravelBook.collage`。逻辑画布固定比例，数组顺序即从底到顶的图层。窗口变化只缩放显示，坐标和元素实际尺寸保持稳定。 |
| `PhotoAsset` | `id, cityId, blob, mime, width, height, createdAt` | Dexie `photos: 'id, cityId'`。同一城市的手账与模式可以复用同一行。Journal、Collage 的引用 ID 可用 `photo:` 前缀区分。 |
| `StickerDefinition` | `id, cityId?, label, category, src` | 静态目录。`sticker:` 前缀的 ID 稳定，`cityId` 缺省表示通用贴纸，城市面板显示本城及通用贴纸。数据库只存引用。 |
| `CityWish` | `cityId, note, createdAt, updatedAt` | Dexie `wishes: 'cityId'`。每城至多一条，备注可空。有记录即点亮地图标记。 |
| `TravelPlan` | `id, title, cityIds[], startDate, endDate, days[], createdAt, updatedAt` | Dexie `plans: 'id, *cityIds'`。一份计划可通过书上的 `planId` 关联多本手账。城市计划列表走 multiEntry 索引。 |
| `PlanDay` 与 `PlanItem` | `PlanDay { date, cityId?, items[] }`，`PlanItem { id, title, time?, note? }` | 行程按自然日升序，条目数组顺序就是显示顺序。日期使用 `YYYY-MM-DD`，可选时间为 `HH:mm`，创建/修改时间戳使用 UTC ISO。按日历日期增减，避免用 UTC 时间戳取本地日期造成跨日。 |

- **保存与恢复。** 用一个 Dexie 实例建立 v1，新增数据形状时按需写迁移。主分支暂无用户数据要搬迁。每本书的保存排队，短防抖合并同一模式的连续输入，写入只更新该模式及时间戳。标题和计划关联单独 patch。同一页从已加载内容初始化一次，防止保存成功触发重新加载并覆盖正在输入的内容。切换模式或路由前先确认待保存写入，保存失败保留草稿并允许重试。页面只在事务完成后显示「已保存」；浏览器强制关闭时以最后一次提交为准。
- **图片一致性。** 解码和压缩在事务之外完成。照片先入共享素材面板，由用户显式插入，两个模式引用同一 `assetId`。移除画布元素或正文媒体只移除引用，避免误删另一模式仍在用的照片。V1 无需自建资产清理任务。异常引用显示带说明的占位，不影响其余内容。
- **引用校验。** 页面读写前检查 cityId 和 stampId。计划的城市去重，行程中的 cityId 必须在计划城市集合中。关联手账前检查书所属城市属于计划。调整计划日期或城市会影响已有行程或手账时，先提示保留或解除关联；涉及书和计划的变更放同一事务，删除计划后清空相关 `planId`，手账仍可打开。城市与素材静态 ID 在发布迭代中保持稳定。
- **存储范围。** localStorage 只放轻量偏好。手账显示的页面由 URL 中的 `mode` 决定。刷新、关页后从相同浏览器配置和来源重新进入可读已保存内容。演示前固定协议、域名、端口，分别准备线上与本地样例。浏览器空间不足或清理站点数据会影响存档，应把错误反馈做成可见状态。[Dexie 索引说明](https://dexie.org/docs/Version/Version.stores()) · [浏览器配额与清理行为](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## 5. 模块接口与依赖关系

继续保留 `src/pages`、`src/components`、`src/data`、`src/three` 和 `src/config`。在 `src/data` 下加本地存储入口及有限的仓储实现，在需要的页面或组件下加业务代码。以下接口名用于明确责任，实际命名可沿用现有仓库风格。

| 模块 | 对外接口示例 | 依赖和跨模块联动 |
| --- | --- | --- |
| 城市与邮票册 | `getCityById(cityId)`、`listStampCards()`、`collectStamp(stampId)` | 城市由现有数据提供；邮票服务读静态定义与 `stamps`。城市页与收藏册调用同一收集接口，收藏册中已藏和未藏邮票均可返回对应城市。 |
| 手账壳与模式选择页 | `listBooksByCity(cityId)`、`createBook(cityId, title, planId?)`、`getBook(bookId)` | 点击邮票进入对应城市手账列表，新建成功或打开旧手账进入 `/book/:bookId`。省略或传入无效 `mode` 时显示模式选择页。手账壳按书记录确定所属城市，无效书 ID 可返回邮票册。 |
| Journal / Collage | `saveJournal(bookId, doc)`、`saveCollage(bookId, canvas)`。视图接收各自的内容、素材、保存回调和状态。 | 通过 `/book/:bookId?mode=journal` 与 `/book/:bookId?mode=collage` 独立延迟加载。共同使用同一个 `bookId`、素材接口和保存队列，各自更新自己的内容。正式接入前 Collage 显示「开发中」。 |
| 素材 | `listAssets(cityId)`、`getAsset(assetId)`、`importPhoto(cityId, file)` | 合并同城照片、本城贴纸和通用贴纸。统一返回渲染需要的元数据；预览组件自行创建和释放 URL。用返回的 ID 插入编辑内容。 |
| 愿望与计划 | `listWishes()`、`getWish(cityId)`、`saveWish(cityId, note)`、`removeWish(cityId)`；`listPlans(cityId?)`、`getPlan(planId)`、`savePlan(draft, confirmation?)`、`deletePlan(planId)` | V1 的 `/section/plans` 进入愿望地图，`/plan/city/:cityId` 显示城市愿望与行程，`/plan/new?cityId=nanjing` 预填城市，`/plan/:planId` 打开已有行程。计划详情可打开已关联手账的模式选择页。 |
| 跨模块操作 | `linkBookToPlan(bookId, planId?)`；计划变更和删除复用关系校验与清理。 | 由页面调用独立的业务操作，统一进入数据层事务。书和计划的仓储无需互相导入。 |
| 页面转场 | `onSelectCity(cityId)`、`onCityArrival(cityId)`、`onOpenCity(cityId)` | Three.js 只报告相机抵达，首页控制卡片显隐，明信片交给路由导航。静态城市入口走同一交互，WebGL 失败或减少动效时直接进入卡片可操作状态。 |

依赖方向为页面和路由 → 业务组件与数据接口 → 静态目录或 Dexie。跨实体命令放在数据事务入口，UI 不直接访问 Dexie 表。主题和素材目录供多个页面共享，Three.js 与场景资源仍独立于业务数据。

## 6. UI 与素材参考

| 区域 | 可供评审的设计方案 |
| --- | --- |
| 城市邮票册 | 沿用现有纸色与城市剪影，统一齿孔、邮票尺寸和排版；已收集显示颜色和日期，未收集保留清晰标签。城市页提供收集按钮，成功后更新收藏册状态。参考 StampQuest 的互动顺序。[护照卡片](https://github.com/shrlak/stampquest/blob/bb853972594b3fa995854151997e541ead5edf8a/client/src/components/StampCard.tsx) |
| 模式选择页 | 显示 Journal 横线日记本与 Collage 自由拼贴两个入口。两种视图可回到同一本书的选择页，选择页可回到所在城市的手账列表。选择页与 Journal 界面可先用本地样例开展视觉与基础交互开发，再接入公共路由、素材和保存框架。 |
| Journal | 用现有城市封面打开横线纸页，保留标题、正文、简短格式工具栏、素材面板和保存反馈。照片与贴纸作为正文中的块，素材插入位置可预期。照片边框可参考拍立得的层次关系，造型使用项目自己的纸纹和色板。[照片样式参考](https://github.com/OarisaR/Scrapbook/blob/c893c0040b76d0551ea30ce97a6c6a1799617cd8/src/components/PolaroidElement.js) |
| Collage | 同一素材面板配便于拖动的空白纸页。选中时显示变换把手和图层操作，手工控制照片、文字和贴纸的位置、大小、旋转与前后顺序。窄屏压缩工具栏空间，画布按比例缩放。 |
| 计划 | 按天显示日期、城市、条目与可选时间，行程卡延续同一纸页风格。城市入口与关联手账放在内容附近，支持看完计划回到对应城市。[每日结构参考](https://github.com/andre-lmarinho/turistar/blob/b90b0de935d3b1253911e3d4c456daaeff6e9172/src/modules/planner/views/BoardView.tsx) |
| 地球转场 | 复用地球镜头、图钉与明信片。确认选城后可直接打开定位该城市的邮票册，明信片保留独立预览。支持 ESC 取消、反复点选、返回及键盘焦点回到触发处。需要实测宽屏、窄屏和 WebGL 退路。[明信片焦点处理](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/components/postcard/CityPostcard.tsx#L17-L39) |
| 城市贴纸 | 六城各备一款地标与一款地方元素，并提供少量通用纸胶带或邮戳。统一视窗尺寸、描边粗细、纸色和阴影，用轮廓与局部城市色区分。可复用已有地标绘制思路，把同一部件输出为项目自有矢量资源供两种编辑器使用。资源按城市和通用分类归档，写明作者、来源、授权及 ID。[现有地标](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/src/components/city/CityMotif.tsx) · [分类参考](https://github.com/liketrek/TREK/blob/2bcfc1bfcbbff0affd097c0f789c835396389572/shared/src/book/stickers/sticker-catalogue.ts) |

## 7. 许可证与技术风险

| 风险 | V1 处理方式 |
| --- | --- |
| 参考项目及第三方资产 | Atlas Travel Editor 和 React Image Editor 都有 MIT LICENSE，可按适用条款保留许可和版权声明。Diary 有 README 的 MIT 声明，独立许可文件及具体素材授权待核实。Scrapbook、StampQuest、TravelMap 未核实到项目级许可证，使用交互和结构思路。TREK、Turistar 为 AGPL v3，AdventureLog 为 GPL v3，本方案只吸收设计思路。公开可访问和允许复制是两项不同的判断。 [Atlas MIT](https://github.com/hlibsuslov/atlas-travel-editor/blob/1d0928816311066ed1f74d0813947ef59485a8c4/LICENSE) · [Image Editor MIT](https://github.com/swimmingkiim/react-image-editor/blob/fe539ef9f104a65b57fdb2d202ee6fedc7288c36/LICENSE) · [TREK](https://github.com/liketrek/TREK/blob/2bcfc1bfcbbff0affd097c0f789c835396389572/LICENSE) · [AdventureLog](https://github.com/seanmorley15/AdventureLog/blob/f92621f07b978765fc1284dc29af0b5e744ae930/LICENSE) · [Turistar](https://github.com/andre-lmarinho/turistar/blob/b90b0de935d3b1253911e3d4c456daaeff6e9172/LICENSE) · [GitHub 许可说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) |
| 本项目素材 | 仓库 README 记载首页原图由需求方提供，公开演示、仓库传播与站点发布的使用范围须核对。主分支未发现项目级 LICENSE。海岸线源自 Natural Earth，生成脚本使用 `world-atlas@2.0.2`，保留来源及 ISC 声明。城市贴纸与演示照片使用原作或有明确授权的资源。[素材条款](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/README.md) · [生成脚本](https://github.com/xiaoguijj/travel-atlas-book/blob/ea457b3bca97c99f3cf0da6c558a78dc98ca91df/scripts/build-world-data.mjs#L1-L15) · [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) |
| 依赖与包体 | 新增直接依赖以锁文件为准。已核验核心候选包许可为 Tiptap 开源包及 Konva/React Konva 的 MIT、Dexie 的 Apache-2.0、Playwright Test 的 Apache-2.0；如使用 Vitest，其许可为 MIT。编辑器按路由或视图延迟加载，首页继续独立分包，部署前检查预览产物中地球、编辑器与图片的请求。 |
| 存档、配额与换域名 | 照片入库前缩放，处理 `QuotaExceededError` 及打开数据库失败，错误时保留正在输入的内容。用单标签页演示并固定访问地址。线上与本地按各自来源准备样例和存档。 [浏览器存储](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) |
| 3D、触屏与动画 | 回归已合入的首页转场与静态城市入口。宽屏检查图钉热区、窄屏实测拖拽和双指缩放。WebGL 不可用时仍能打开明信片，减少动效时不依赖长动画或延时。 |

**核验范围。** 已核对主分支和转场分支差异、九个参考仓库的相关源码与许可、候选依赖的公开接口和关键 peer 范围，并成功构建主分支。本轮产出方案文档，本地无头 Chromium 启动受限，路由复核使用模拟 DOM。实际业务实现、真浏览器交互、触屏和 WebGL 验收见 [正式开发规划的验收章节](Travel-Atlas-Book-V1-Development-Plan.md#8-集成与静态部署验收)。
