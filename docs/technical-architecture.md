# Travel Atlas Book 技术实现与扩展指南

本文档承接并保留原仓库首页的技术实现细节、扩展接入点与素材说明，便于评审及后续开发按源码核对核心工程设计。V1 完整契约、开发规划与发布验收另见：

- [V1 技术方案](Travel-Atlas-Book-V1.md)
- [V1 正式开发规划](Travel-Atlas-Book-V1-Development-Plan.md)
- [V1 公共数据与路由契约](v1/contracts.md)
- [V1-11 发布与演示说明](v1/release.md)
- [V1-04 素材与来源登记](v1/design/assets.md)
- [贴纸系统说明](../src/stickers/README.md)

---

## 1. 首页：一张画 + 一个真地球

首页参考图（`assets-source/home-hero.png`，`1671×941`）中原本包含静态地球、缎带导航、「开始探索」按钮与城市明信片。项目采用**分层 + 挖孔**而非裁图重绘的方式将画面变为真实可交互舞台：

| 层（z-index） | 内容 | 说明 |
| --- | --- | --- |
| 0 | 纸色圆盘 | 垫在圆孔底下，地球缩小时孔内露出暖纸底色而非页面深色背景 |
| 1 | WebGL 画布 | 3D 地球渲染层，`pointer-events` 归它，支持拖拽与缩放 |
| 2 | 背景画 | `src/assets/hero-bg.jpg`，中间由 CSS `mask-image` 挖出透明圆孔，`pointer-events: none` |
| 3 | 城市图钉 | 与背景画共用圆孔遮罩裁剪，放大地球时边缘图钉不会飘到纸面之上 |
| 4 | 热区 | 缎带导航、开始探索、城市明信片均为真实路由链接或透明按钮，位置与画面一一对应 |

关键实现要点：

- **单地球渲染**：静态地球被 CSS `mask-image` 挖空（圆心 `(993.5, 461.5)`，挖孔半径 `292px`），球体屏幕取景按 `src/config/hero.ts` 反算，边缘自然衔接金色高光带。
- **前后景遮挡保留**：地球位于背景画下方，压在地球前端的帆船桅杆、云层与光晕保留在原有前后关系中。
- **像素实测坐标**：圆心 `(993.5, 461.5)` 与半径 `282.5 / 292` 由沿 360 条射线检测金色高光带中点并做最小二乘圆拟合测得（中位残差 `2.6px`）；导航、铭牌与明信片经列像素统计与网格裁图核对，全部集中于 `src/config/hero.ts`，舞台按 `1671:941` 等比缩放。
- **真实交互与无障碍**：缎带五项分别指向 `/`、`/section/journals`、`/section/inspiration`、`/section/plans`、`/section/account`；「开始探索」驱动相机飞向城市并翻开明信片；图上文字均配备 `srOnly` 真实 DOM 文案供读屏与检索使用。
- **窄屏退路**：视口小于 `760×430` 或浏览器不支持容器查询单位 `cqw` 参与 `mask-image` 时，自动切换为竖版首页布局，共用同一个 `Globe` 实例。

---

## 2. 3D 地球场景与相机控制

核心实现位于 `src/three/createGlobeScene.ts` 与 `src/three/paintEarthTexture.ts`：

1. **程序化油画地球贴图**：`createGlobeScene.ts` 构建 `THREE.SphereGeometry` + `MeshStandardMaterial`，球面贴图不在构建期或运行时联网拉取卫星图，而是由 `paintEarthTexture.ts` 使用 Canvas 2D 现场绘制等距圆柱投影贴图（洋流短笔触、陆地多边形堆色、极地冰盖、经纬网、大洋名称与纸张颗粒）。绘制使用固定随机种子（`20260721`），保证每次刷新纹理一致。
2. **相机与取景反算**：交互由 `OrbitControls` 接管（`enablePan = false`，限制俯仰角与缩放倍率）。相机距离不写死像素，而是基于「球体直径占容器短边比例（`fill`）」由 `cameraDistanceForFill()` 反算，使同一套地球场景既能嵌入首页圆孔，也能铺满竖版舞台。
3. **自转暂停与恢复**：指针按下或悬停于图钉附近时暂停 `autoRotate`（暂停时清除阻尼余量防止图钉惯性漂移），交互结束后延时 `1.2s` 恢复；明信片弹层开启及键盘焦点停留期间保持暂停。
4. **飞行转场**：`flyToCity()` 使用四元数插值（`1.15s`，easeInOutQuad）将相机朝向平滑转至目标城市球面法线；在 `prefers-reduced-motion: reduce` 环境下直接落位。
5. **生命周期节能**：页面切至后台时通过 `setAnimationLoop(null)` 停帧，回到前台恢复；容器尺寸变化由 `ResizeObserver` 同步。

---

## 3. 城市图钉投影与点击消歧

核心实现位于 `src/three/coordinates.ts` 与 `src/components/globe/Globe.tsx`：

1. **同源投影**：城市经纬度按 `SphereGeometry` UV 约定换算为三维球面点，与 `paintEarthTexture.ts` 使用同一投影公式，确保图钉精准落于海岸线与地理坐标上。
2. **命令式 DOM 投影**：每帧由 `camera` 将城市坐标投影为屏幕像素，直接写入按钮 DOM 的 `transform`、`opacity` 与 `z-index`，避免 60fps 触发 React 重渲染。
3. **球面背面遮挡**：通过 `dot(球面法线, 点到相机向量)` 判定可见性，转至地球背面的城市透明度归零并禁用 `pointer-events`。
4. **邻近图钉消歧**：南京、上海、杭州等邻近城市在特定角度和缩放下会重叠。`pickCity()` 优先使用指针按下时记录的原始坐标，并在命中半径（鼠标 `18px`、触屏 `28px`）内选取距离最近且面向相机的城市图钉；指针移动超过 `8px` 则拦截随后触发的 `click`。
5. **WebGL 不可用降级**：若浏览器无法创建 WebGL 上下文，`Globe.tsx` 自动降级为一组可点击的城市按钮列表，保证核心探索与进入手账链路仍完整可用。

---

## 4. 数据与素材来源

- **陆地轮廓**：[Natural Earth](https://www.naturalearthdata.com/) 1:110m Cultural（Public Domain），打包源文件取自 `world-atlas@2.0.2`（ISC 许可）的 `land-110m.json`，经 `scripts/build-world-data.mjs` 解码 TopoJSON 后生成 `src/data/world.ts`（约 64 KB，随 JS 一起 gzip 压缩）。可通过 `npm run data:world`（需联网，缓存于 `.tmp/`）重新生成。
- **内联矢量装饰**：城市建筑剪影（`CityMotif`）、邮戳、罗盘与页面装饰线为仓库内手写 SVG。
- **中国愿望地图底图**：`src/assets/maps/china-outline.svg` 随包静态打包，经纬度边界与 `src/data/plans/map.ts` 保持同一套等距圆柱投影。
- **字体**：系统衬线与无衬线字体栈（Georgia / Songti SC / PingFang SC / Segoe UI），无第三方 Web Font 网络请求。
- **首页与手账画作素材**：`assets-source/` 中的原图由项目需求方提供并随库管理，经以下脚本等比压缩至 `src/assets/`：
  - `npm run data:hero` → `src/assets/hero-bg.jpg`
  - `npm run data:inner` → `src/assets/inner-bg-map.jpg`
  - `npm run data:paper` → `src/assets/stamp-album.jpg`、`create-mode.jpg`、`journal-page.jpg`
  - `npm run data:collage` → `src/assets/collage-desk.jpg`、`collage-cover.png`、`collage-paper.jpg`、`collage-paper-mask.png`、`collage-clip.png` 与拼贴装饰贴纸
  - `npm run data:stickers` → 34 张城市文化、邮票与通用贴纸（`src/assets/stickers/`）
- **版权提示**：首页背景画 `assets-source/home-hero.png` 著作财产权归原提供方所有，对外公开发布前需确认具体使用授权；其余地图轮廓、本地插画、贴纸与字体方案均无版权不明的第三方资源。

---

## 5. 构建产物与扩展接入点

### 5.1 最新构建产物概览

以当前主线（含宽幅 1800×1600 Collage 与缩放控制更新）执行 `npm run build`（`tsc --noEmit && vite build`）为例：

```text
✓ 352 modules transformed
dist/index.html                     1.19 kB │ gzip:   0.83 kB
dist/assets/index-*.css            88.17 kB │ gzip:  17.89 kB
dist/assets/JournalView-*.css       8.55 kB │ gzip:   2.33 kB
dist/assets/CollageView-*.css      27.00 kB │ gzip:   6.25 kB
dist/assets/index-*.js            565.29 kB │ gzip: 193.75 kB  (应用主包)
dist/assets/three-*.js            468.09 kB │ gzip: 118.09 kB  (Three.js 独立分包)
dist/assets/JournalView-*.js      438.04 kB │ gzip: 141.65 kB  (Journal 懒加载)
dist/assets/CollageView-*.js      332.32 kB │ gzip: 105.42 kB  (Collage 懒加载)
```

`JournalView` 与 `CollageView` 均按编辑模式延迟加载，首页首屏不加载富文本或拼贴引擎代码；`index.html` 内联背景色与 favicon，避免首屏闪烁及额外 404 请求。

### 5.2 后续扩展接入点

- **本地数据与后端适配**：V1 通过 Dexie 4 管理 IndexedDB（`books`、`photos`、`stamps`、`wishes`、`plans` 五张表），领域契约位于 `src/data/contracts.ts`，不直接耦合 Dexie 或编辑器包类型，便于后续扩展远端 API 适配层。
- **扩充城市**：在 `src/data/cities.ts`、`src/data/contracts.ts`（`CITY_IDS`）及静态目录中新增城市经纬度、地标与 `labelSide` 避让方向即可联动地球图钉、明信片、邮票册与地图。
- **多套视觉主题**：全站颜色与字体 Token 集中于 `src/config/theme.ts`，通过 `applyThemeToDocument()` 注入 CSS 变量，地球 Canvas 贴图读取同一套 Token。
- **更换首页画作**：将新原图放入 `assets-source/`，运行 `npm run data:hero` 并更新 `src/config/hero.ts` 测量坐标即可替换，无需改写页面逻辑。
- **栏目功能开放**：`src/data/sections.ts` 为缎带导航与 `/section/*` 的统一配置出处，将对应栏目 `ready` 设为 `true` 并接入路由即可扩展「灵感发现」与「我的」功能。

---

## 6. 静态托管、离线演示与已知边界

- **静态托管与子路径**：`vite.config.ts` 配置 `base: './'` 并使用 React Router Hash 路由（`createHashRouter`），`dist/` 可部署于任意静态托管服务的根路径或子路径（如 `/atlas/`），无需服务端 rewrite。
- **离线备份**：运行 `npm run demo:backup` 会执行构建并将产物复制至 `demo/current/`（上一版本保留于 `demo/previous/`），随后以固定端口 `http://127.0.0.1:4173/` 启动 `npm run demo:local -- --dist demo/current`。由于浏览器 IndexedDB 按 origin 隔离，演示时必须保持固定端口以保留本机数据。
- **已知边界**：
  - 当前未公开发布线上站点（Qoder Sites 待团队确认授权后部署）；
  - 数据仅存储在当前浏览器 IndexedDB（贴纸独立层同步受控于 localStorage 与跨标签页写锁），不支持账号、云同步、PDF 导出或跨设备共享；
  - 伦敦保留在地球、明信片与城市详情页入口，暂不在六城邮票册与愿望地图业务范围内；
  - 自动化测试（Vitest + Playwright Chromium）已覆盖核心链路、数据并发与静态部署，真机触屏、双指缩放、中文输入法与 Safari/Firefox 仍需在赛前完成实机验收（详见 [V1-11 发布与演示说明](v1/release.md)）。
