# Travel Atlas Book

一本会转的旅行手账。转动地球、翻开城市明信片，从邮票册打开城市书架。你可以写日记、做自由拼贴，也可以在愿望地图安排旅行，再把手账关联到具体行程。

- 视觉主题：Voyage Vintage（午夜蓝 + 旧纸黄 + 陶土红 + 鼠尾草绿）
- 首页就是那张画：油灯、罗盘、帆船、缎带导航、三张明信片原样保留，只有画面中间的地球换成了真的 3D 地球
- 邮票册与旅行计划覆盖南京、上海、西安、北京、杭州、成都。伦敦仍可从地球、明信片和城市页进入手账书架。

## V1 开发文档

[![V1 开发进度（GitHub Pages）](https://xiaoguijj.github.io/travel-atlas-book/v1/progress.svg)](https://xiaoguijj.github.io/travel-atlas-book/v1/)

- [V1 开发看板](https://xiaoguijj.github.io/travel-atlas-book/v1/)查看 11 项任务的实时快照、依赖、认领状态和 PR。
- [双人协作说明](docs/v1/collaboration.md)介绍任务认领、开发、互审和合并。
- [V1 正式开发规划](docs/Travel-Atlas-Book-V1-Development-Plan.md)涵盖分支任务、路由契约与验收标准。
- [V1 技术方案](docs/Travel-Atlas-Book-V1.md)记录技术选型、数据模型与调研来源。

V1 手账流程为邮票收藏册 → 城市手账列表 → 创建或打开手账 → 模式选择页 → Journal 横线日记本或 Collage 自由拼贴。三种页面共用同一本手账的 `bookId`。在 Hash 路由下，模式选择页示例为 `/#/book/abc`，编辑器分别为 `/#/book/abc?mode=journal` 和 `/#/book/abc?mode=collage`。两个模式都已接入正式界面。

## 快速开始

```bash
npm install
npm run dev        # 开发预览，默认 http://localhost:5173
npm run build      # 类型检查 + 产物构建，输出到 dist/
npm run preview    # 本地起静态服务预览 dist/，默认 http://localhost:4173
npm run typecheck  # 只做 tsc --noEmit
npm test           # 单元测试（vitest，纯 node 环境，不需要浏览器）

npm run data:world # 重新生成陆地轮廓 src/data/world.ts（需要联网）
npm run data:hero  # 重新压缩首页背景画 src/assets/hero-bg.jpg
npm run data:inner # 由 assets-source/ 生成内页纯地图背景
npm run data:paper # 由 assets-source/*.png 生成收藏册 / 选择页 / 横线本整画
```

> 本机 Node 没有装到系统 PATH，实际用的是 `C:\Users\huangju\.workbuddy\binaries\node\versions\22.22.2`。
> 在自己的终端里如果 `node -v` 能正常输出版本，上面的命令可以直接跑。

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
assets-source/
  home-hero.png     首页参考原图（1671×941，2.8MB，不参与打包）
src/
  config/
    theme.ts        主题色与字体 token，同时写入 CSS 变量（--tab-*）
    globe.ts        地球参数：半径、贴图尺寸、机位、自转速度、灯光、命中半径
    hero.ts         首页版面的几何：圆孔圆心/半径、导航、铭牌、明信片的热区坐标
  data/
    cities.ts       城市数据（经纬度、简介、封面配色、标签避让方向）
    sections.ts     缎带导航四个栏目的文案与状态
    types.ts        City 等数据类型
    world.ts        世界陆地板块坐标（由脚本生成，不要手改）
  three/
    createGlobeScene.ts  场景生命周期：渲染器/相机/灯光/交互/每帧投影/销毁
    paintEarthTexture.ts Canvas 2D 绘制油画感地球贴图
    coordinates.ts       经纬度 ↔ 球面坐标、朝向判断、"占画面多大→相机多远"
  hooks/
    useMediaQuery.ts     首页用它决定用参考图舞台还是竖版布局
  assets/
    hero-bg.jpg     参考图压缩后的首页背景（446KB，JPEG q80）
  components/
    globe/          Globe（React 与场景的胶水）、CityMarker（图钉按钮）
    postcard/       CityPostcard 复古明信片弹层
    city/           CityMotif 城市剪影 SVG
    layout/         SiteHeader、VintageDecor（装饰层，不参与交互）
  pages/
    HomePage.tsx    两套首页：参考图舞台（宽屏）/ 竖版标题+地球（窄屏）
    HomePageArt.module.css  舞台分层与热区样式
    SectionPage.tsx 旅行手账 / 灵感发现 / 旅行计划 / 我的
    CityPage.tsx    城市门户与手账、计划入口
scripts/
  build-world-data.mjs  从 Natural Earth 1:110m 生成 src/data/world.ts
  build-hero-assets.mjs 把 assets-source/home-hero.png 压成 src/assets/hero-bg.jpg
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

```
dist/index.html                 1.17 kB │ gzip   0.82 kB
dist/assets/hero-bg-*.jpg     456.57 kB          首页背景画（宽屏布局才加载）
dist/assets/index-*.css        30.73 kB │ gzip   7.17 kB
dist/assets/index-*.js        330.83 kB │ gzip 111.05 kB   应用代码 + 世界地图数据
dist/assets/three-*.js        466.37 kB │ gzip 117.45 kB   three 单独分包，便于长期缓存
```

背景画是首屏唯一的大文件（也是唯一的图片请求），地球贴图仍然是运行时画的。
路由是 code-split 之前的单包，`vite build` 已经按 `three` 分包；`index.html` 里内联了背景色，避免白屏一闪。

## 后续阶段的接入点

- **本地存档**　V1 用 IndexedDB 和 Dexie 保存业务数据。静态城市资料继续由 `src/data/cities.ts` 提供，`City` 字段定义在 `src/data/types.ts`。
- **加城市**：往 `cities` 数组里加一条真实经纬度即可，图钉、明信片、导航、图例自动跟上。
  `labelSide` 字段用来避让挤在一起的城市标签。
- **手账编辑器**　`CityPage.tsx` 将承载城市手账列表。创建或打开手账进入模式选择页，两种编辑器通过同一个手账壳接入共享素材和保存队列，各自保存内容。
- **多套艺术主题**：颜色只集中在 `src/config/theme.ts`，`applyThemeToDocument()` 写 CSS 变量，
  地球贴图颜色读同一个 token 对象；换主题就是换一个 `AtlasTheme`，必要时重画贴图。
- **换一张首页画**：`assets-source/` 放原图 → `npm run data:hero` 重新压缩 → 把新量到的圆孔与热区坐标写进
  `src/config/hero.ts`。页面代码不含任何硬编码像素，只消费这个文件。
- **栏目变成真功能**：`src/data/sections.ts` 是缎带导航与 `/section/*` 的唯一出处，加字段、把 `ready` 打开即可。

## 部署

`vite.config.ts` 里 `base: './'`，路由是 hash 形式，`dist/` 目录可以交给任何静态托管；
上面对外站点**尚未发布**，需要先确认内容与域名再操作。

## 已知边界

- 「旅行手账」打开邮票册，「旅行计划」打开中国愿望地图。城市门户提供对应书架和城市计划的入口。「灵感发现」与「我的」暂为栏目说明，手账和计划保存在当前浏览器。
- 首页舞台需要至少 760×430 的视口；再小就换成竖版首页，而不是把整张画缩到看不清。
  两套布局用的是同一份地球场景配置，只有取景比例不同。
- WebGL 不可用时仍可用城市按钮打开明信片，再进入对应书架。
- 交互验证在内置浏览器面板里做的：宽屏舞台与竖版两套布局的几何都逐项量过
  （画布 259.6×259.6、球心与孔心重合、球体屏幕半径 105.1px vs 孔半径 102.3px）、
  缎带五个入口、开始探索、三张明信片、弹层 ESC 关闭、`/#/city/nanjing` 深链都已实测通过，控制台无报错。
  真机手机（触屏拖动、双指缩放）和宽屏截图目测还没做——面板当前处于隐藏状态，截屏接口不可用。
