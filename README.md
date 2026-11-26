# Travel Atlas Book

一本会转的旅行手账。转动地球、翻开城市明信片，从邮票册打开城市书架。你可以写日记、做自由拼贴，也可以在愿望地图安排旅行，再把手账关联到具体行程。

- 视觉主题：Voyage Vintage（午夜蓝 + 旧纸黄 + 陶土红 + 鼠尾草绿）
- 首页就是那张画：油灯、罗盘、帆船、缎带导航、三张明信片原样保留，只有画面中间的地球换成了真的 3D 地球
- 邮票册与旅行计划覆盖南京、上海、西安、北京、杭州、成都。伦敦仍可从地球、明信片和城市页进入手账书架。

V1 的 11 项开发任务已完成，当前分支是比赛演示候选：自动化验收通过，Qoder Sites 与真机验收尚未执行，**站点未公开发布**。完整的构建、部署、演示和限制说明见 [V1-11 发布与演示说明](docs/v1/release.md)。

## V1 开发文档

[![V1 开发进度（GitHub Pages）](https://xiaoguijj.github.io/travel-atlas-book/v1/progress.svg)](https://xiaoguijj.github.io/travel-atlas-book/v1/)

- [V1 开发看板](https://xiaoguijj.github.io/travel-atlas-book/v1/)查看 11 项任务的实时快照、依赖、认领状态和 PR。
- [双人协作说明](docs/v1/collaboration.md)介绍任务认领、开发、互审和合并。
- [V1 正式开发规划](docs/Travel-Atlas-Book-V1-Development-Plan.md)涵盖分支任务、路由契约与验收标准。
- [V1 技术方案](docs/Travel-Atlas-Book-V1.md)记录技术选型、数据模型与调研来源。
- [V1-11 发布与演示说明](docs/v1/release.md)记录运行、Qoder Sites 部署、现场演示、素材来源、验收结果和已知限制。

V1 手账流程为邮票收藏册 → 城市手账列表 → 创建或打开手账 → 模式选择页 → Journal 横线日记本或 Collage 自由拼贴。三种页面共用同一本手账的 `bookId`。在 Hash 路由下，模式选择页示例为 `/#/book/abc`，编辑器分别为 `/#/book/abc?mode=journal` 和 `/#/book/abc?mode=collage`。两个模式都已接入正式界面。

## 快速开始

```bash
npm ci             # 或 npm install
npm run dev        # 开发预览，默认 http://localhost:5173
npm run build      # 类型检查 + 产物构建，输出到 dist/
npm run preview    # 本地预览 dist/，默认 http://localhost:4173
npm run typecheck  # 只做 tsc --noEmit
npm test           # 单元测试（vitest，纯 node 环境，不需要浏览器）

npm run test:e2e    # 生产构建 + Playwright，自动拉起 4173/4174/4175
npm run test:static # 只跑根路径与 /atlas 子路径静态部署用例
npm run demo:backup # 构建并复制到 demo/current/，上一份留在 demo/previous/
npm run demo:local -- --dist demo/current  # http://127.0.0.1:4173/

npm run data:world # 重新生成陆地轮廓 src/data/world.ts（需要联网）
npm run data:hero  # 重新压缩首页背景画 src/assets/hero-bg.jpg
npm run data:inner # 由 assets-source/ 生成内页纯地图背景
npm run data:paper # 由 assets-source/*.png 生成收藏册 / 选择页 / 横线本整画
```

> 运行要求 Node `>=22`。本机实际验证环境是 Node 24.14.1 / npm 11.11.0；**Node 22 下的 `npm ci` 清洁安装尚未执行**，发布前需补证或由 CI 覆盖。
> `npm run preview` 只用于本地验收，不是生产服务器。E2E 会复用已在运行的 4173 服务，并额外启动 4174（根路径静态）和 4175（`/atlas` 子路径静态）。

## 技术选型

| 依赖 | 版本 | 用途 | 为什么用它 |
| --- | --- | --- | --- |
| Vite | 5.4 | 开发服务器 + 打包 | 启动快，产物是纯静态文件，能直接扔到任何静态托管（含 Qoder Sites） |
| React | 18.3 | 页面与组件 | 组件拆分和状态管理心智负担最小，后续加编辑器也够用 |
| TypeScript | 5.6 | 类型 | 城市数据、主题 token、路由参数都靠它约束，长期维护不留字符串坑 |
| three.js | 0.169 | 地球渲染 | 成熟方案，自带球体几何、相机、灯光、`OrbitControls`；不自己写渲染引擎 |
| react-router-dom | 6.28 | 页面路由 | 用 hash 路由（`/#/city/nanjing`），静态托管不需要服务端 rewrite |

开发期脚本另有一个 `jimp`（devDependency，MIT）：只在 `scripts/` 里用来读图、量图、把参考图压成站点用的 JPG，
不进任何运行时产物。

地球贴图、海岸线、插画、字体都不需要联网：**没有任何图片/字体资源来自版权不明的第三方**。

## 目录结构

```
assets-source/      需求方提供的原图，只在素材脚本里使用，不参与打包
docs/               技术方案、V1 规划、契约、发布说明与看板数据
scripts/            素材生成、世界地图数据、静态演示服务、离线备份
src/
  assets/           打包用图片：首页背景、邮票册、编辑纸面、贴纸、地图轮廓
  components/       globe/ postcard/ city/ stamps/ book/ journal/ collage/ plans/ layout/
  config/           主题、地球、首页版面、内页版面、路由、日记纸张参数
  data/             城市、世界轮廓，以及 books/photos/stamps/plans/wishes 的 Dexie 数据层
  pages/            首页、邮票册、城市页、手账壳、愿望地图与行程页
  three/            地球场景、油画贴图、经纬度投影
  styles/           全局样式与主题变量
tests/
  unit/             Vitest 单元测试
  e2e/              Playwright 端到端测试与测试辅助
  fixtures/         测试图片
```

## 首页：一张画 + 一个真地球

参考图里已经有地球、导航、按钮和三张明信片。要把它们变成真交互，同时画面一个像素都不重画，
用的是**分层**而不是抠图：

| 层（z-index） | 内容 | 说明 |
| --- | --- | --- |
| 0 | 纸色圆盘 | 垫在圆孔底下，地球缩小后孔里露出的是纸，不是页面底色 |
| 1 | WebGL 画布 | 3D 地球，`pointer-events` 归它，拖得动 |
| 2 | 背景画 | 原图，中间被 CSS `mask-image` 挖成一个透明圆孔，`pointer-events: none` |
| 3 | 城市图钉 | 同一个圆孔再裁一次，放大地球时图钉不会飘到纸上 |
| 4 | 热区 | 缎带导航、开始探索、三张明信片：透明按钮，位置和画上的元素一一对应 |

几个要点：

- **不会出现两个地球**：画里的静态地球是被 mask 挖空的（挖掉半径 292px，球体屏幕半径 300px），
  挖孔位置与球心严格重合，多出来的 8px 藏在画的边缘下面。
- **前景仍然是前景**：地球在画的下面，所以压在地球上头的帆船桅杆、云、光晕自动留在正确的前后关系里。
- **坐标是量出来的，不是估的**：圆心 (993.5, 461.5)、半径 282.5/292 是沿 360 条射线找金色高光带、
  取每条射线内外缘中点再做最小二乘圆拟合得到的（中位残差 2.6px）；导航、铭牌、明信片按列像素统计 + 带网格的裁图核对。
  全部写在 `src/config/hero.ts`，舞台按 1671:941 等比缩放，所以任何尺寸下热区都和画面对齐。
- **假按钮为零**：缎带五个入口分别指向首页与 `/section/*` 四个真实路由；「开始探索」会让相机转到一座城市并翻开它的明信片；
  三张明信片分别打开南京/上海/北京的弹层。图上烘焙的文字旁边都有一份 `srOnly` 的真实 DOM 文案（标题、副标题、按钮名），
  读屏与 SEO 读到的是文字，不是空元素。
- **窄屏不硬塞**：画需要足够宽才能同时放下地球和右侧明信片，`useMediaQuery` 在放不下时换用竖版首页
  （标题 + 地球 + 城市列表），两套布局共用同一个 `Globe`；浏览器不支持容器查询单位参与 mask 时同样走这条退路。

## 地球是怎么转起来的

1. `createGlobeScene.ts` 建一个 `THREE.SphereGeometry` + `MeshStandardMaterial`，材质贴图不是图片文件，而是
   `paintEarthTexture.ts` 用 Canvas 2D 现画的等距圆柱投影图（洋流笔触、陆地堆色、冰盖、经纬网、大洋名字、纸纹），
   随机数用固定种子，所以每次刷新画面一致。
2. 交互全部交给 `OrbitControls`：`enablePan = false` 只许转和缩放，`minDistance / maxDistance` 限制缩放范围，
   `minPolarAngle / maxPolarAngle` 防止翻到南北极断面，`autoRotate` 负责慢速自转，`enableDamping` 负责惯性。
   机位不写死距离，只写「球体直径占容器短边的比例」，由 `cameraDistanceForFill()` 反算距离，
   所以同一份场景既能铺满竖版布局，也能正好嵌进首页画上的那个圆孔。
3. pointer 按下时 `autoRotate` 关掉，松手后延时 `resumeDelayMs`（1.2s）再恢复，所以拖动和缩放不会被自转干扰。
   明信片打开期间也保持暂停。
4. `flyToCity()` 用一个四元数把相机当前朝向插值到目标城市的法线（1.15s，easeInOutQuad），
   首页的「开始探索」和明信片入口都走这条路径；`prefers-reduced-motion` 下直接落位，不做动画。
5. 页面切到后台时 `setAnimationLoop(null)` 停帧，回来再开；`ResizeObserver` 负责跟随容器尺寸。
   系统开了「减少动效」（`prefers-reduced-motion`）时不自转。

## 城市点是怎么点到的

1. 城市经纬度先按 `SphereGeometry` 的 UV 约定换算成球面上的点（`coordinates.ts`），
   这个换算和贴图绘制用的是同一套投影公式，所以图钉不会漂出海岸线。
2. 每帧把这个点用 `camera` 投影成屏幕像素，直接写进 DOM 按钮的 `transform`/`opacity`/`z-index`。
   标记的显示内容归 React，位置归场景命令式写 DOM，避免 60fps 触发重渲染。
3. 点 `dot(球面法线, 点到相机向量)` 判断朝向：转到背面时透明度归零并 `pointer-events: none`，
   所以地球另一边的城市点不到，符合球面遮挡的直觉。
4. 南京、上海、杭州等邻近城市的图钉会随视角和缩放重叠。点击时，`pickCity` 优先使用按下时记录的坐标，
   避免触屏浏览器调整合成 `click` 的坐标后选到邻城。悬停高亮和点击都在命中半径内取最近的可见图钉
   （鼠标 18px、触屏 28px）。拖动超过 8px 会拦截随后产生的点击，键盘仍可直接激活已聚焦的图钉。
5. WebGL 不可用时不会留一个转不动的空白方块，`Globe.tsx` 会退化成一组真实可用的城市按钮。

## 数据与版权

- 陆地轮廓：[Natural Earth](https://www.naturalearthdata.com/) 1:110m Cultural，公有领域（public domain）。
  打包文件取自 `world-atlas@2.0.2`（ISC 许可）的 `land-110m.json`，由 `scripts/build-world-data.mjs`
  解码 TopoJSON 后写成 `src/data/world.ts`（坐标保留 1 位小数，约 64KB，随 JS 一起 gzip 压缩）。
  重新生成：`npm run data:world`（缓存文件在 `.tmp/`，不会进版本库）。
- 城市插画、邮票、邮戳、罗盘、胶卷等装饰：全部是仓库内手写的内联 SVG。
- 字体：系统字体栈（Georgia / Times New Roman / serif 与系统 UI 字体），未引入 web font。
- **首页背景画**：`assets-source/home-hero.png` 由需求方提供，随项目一起提交；仓库里只做等比压缩与 JPEG 编码
  （`scripts/build-hero-assets.mjs`），没有裁剪、重绘或替换画面内容。这张图的著作财产权归属提供方，
  对外公开发布前需要再确认一次使用范围。

## 构建产物

以 V1-11 发布候选的 `npm run build` 为例（gzip 为构建输出）：

```
dist/index.html                    1.32 kB
dist/assets/index-*.css           88.02 kB │ gzip  17.87 kB
dist/assets/index-*.js           565.24 kB │ gzip 193.73 kB  应用主包
dist/assets/three-*.js           468.09 kB │ gzip 118.09 kB  three 单独分包
dist/assets/JournalView-*.js     438.04 kB │ gzip 141.65 kB  Journal 懒加载
dist/assets/CollageView-*.js     328.02 kB │ gzip 103.94 kB  Collage 懒加载
```

`dist/` 共 57 个文件、约 11.94 MB，包含首页背景、邮票册、编辑纸面和全部贴纸等本地素材。Journal 与 Collage 只在进入对应编辑器时加载，首页不加载编辑器代码；地球贴图仍然是运行时用 Canvas 画的。`index.html` 内联了背景色和 favicon，避免白屏与 favicon 404。

当前 `dist/index.html` 的 SHA-256 为 `055e7afd8c0375bce47069210bb1e9382222bc36dbd686ef0d7e78b57d2eac7e`，可在 `demo/current/BUILD.txt` 中核对。

## 后续阶段的接入点

- **本地存档**　V1 用 IndexedDB 和 Dexie 保存业务数据。静态城市资料继续由 `src/data/cities.ts` 提供，`City` 字段定义在 `src/data/types.ts`。
- **加城市**：往 `cities` 数组里加一条真实经纬度即可，图钉、明信片、导航、图例自动跟上。
  `labelSide` 字段用来避让挤在一起的城市标签。
- **手账编辑器**　邮票册的城市书架负责创建/打开手账，模式选择页统一进入 Journal 或 Collage。两种编辑器共用同一 `bookId`、素材和保存队列，但各自保存内容；手账可关联到具体行程，行程页会反查关联手账。
- **多套艺术主题**：颜色只集中在 `src/config/theme.ts`，`applyThemeToDocument()` 写 CSS 变量，
  地球贴图颜色读同一个 token 对象；换主题就是换一个 `AtlasTheme`，必要时重画贴图。
- **换一张首页画**：`assets-source/` 放原图 → `npm run data:hero` 重新压缩 → 把新量到的圆孔与热区坐标写进
  `src/config/hero.ts`。页面代码不含任何硬编码像素，只消费这个文件。
- **栏目变成真功能**：`src/data/sections.ts` 是缎带导航与 `/section/*` 的唯一出处，加字段、把 `ready` 打开即可。

## 部署与离线演示

`vite.config.ts` 使用 `base: './'`，路由是 hash 形式，`dist/` 可放在任意静态托管的根路径或子路径，**不需要服务端 rewrite**。同一份 `dist/` 已验证根路径和 `/atlas/` 子路径。

Qoder Sites 通过会话内的 Sites Skills 或 `qoder sites` CLI 发布，静态站点的 web 目录指定为 `dist`。步骤、预览检查项和回退方式写在 [docs/v1/release.md](docs/v1/release.md)；仓库不新增平台私有配置文件。**站点目前尚未发布。**

本地离线备份：

```bash
npm run demo:backup                        # 构建并生成 demo/current，旧版移到 demo/previous
npm run demo:local -- --dist demo/current  # 固定 http://127.0.0.1:4173/
```

备份目录只有静态产物和 `BUILD.txt`，已加入 `.gitignore`。演示必须使用固定端口：IndexedDB 按 origin 隔离，换端口会看不到之前准备的数据。

## 已知边界

- 「旅行手账」打开邮票册，「旅行计划」打开中国愿望地图。城市门户提供对应书架和城市计划的入口。「灵感发现」与「我的」暂为栏目说明，手账和计划保存在当前浏览器。
- 数据只存在当前浏览器的 IndexedDB：换浏览器、换端口、清理站点数据都会回到空档案；没有账号、云同步或跨设备。
- 首页舞台需要至少 760×430 的视口，再小换成竖版首页；两套布局共用同一份地球场景配置。WebGL 不可用时退化为城市按钮列表，仍能打开明信片和书架。
- Journal 在窄屏按设计横向滚动，不是重排；Collage 画布是固定 1200×1600 的编辑坐标。
- 自动化验证使用 Playwright 1.65.1 / Chromium 1255：V1-11 共 79 个 E2E 用例，覆盖六城、地球、邮票册、模式选择、两种编辑器、计划联动、失败保护、窄屏和静态部署。
- **真机触屏、双指缩放、手机安全区、中文输入法、Safari/Firefox 未验证**；现有窄屏用例是 Chromium 视口模拟，不能替代真机验收。
- **Node 22 下的清洁安装未执行**：本机验证环境是 Node 24.14.1，`engines` 要求 `>=22`，发布前需补证或由 CI 覆盖。
- 首页背景画由需求方提供，著作财产权归提供方；公开发布前需确认使用范围，其余图片、字体、地图数据均在本地且来源记录在发布说明中。
- 没有导出 PDF、分享链接、后端或多人协作；这些不属于 V1 范围。
