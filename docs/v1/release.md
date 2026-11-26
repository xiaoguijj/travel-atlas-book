# V1-11 发布与演示说明

2026-11-26 · 分支 `v1/11-demo-release` · 基线 `origin/main@7c09576`（V1-10 已合并）

这份文档记录 V1 比赛候选的**构建产物、运行方式、Qoder Sites 静态部署步骤、现场演示流程、验收结果、素材来源和已知限制**。原则只有一条：**没有实际做过的验收写“未执行”，不把自动化结果说成真机结果。**

## 1. 当前状态

| 项目 | 状态 |
| --- | --- |
| 代码基线 | `origin/main@7c09576`，已包含 V1-01 至 V1-10 |
| 发布候选 | 本分支 PR 的 HEAD；生产构建与 E2E 均针对同一工作树完成 |
| 自动化测试 | 类型检查、单测、生产构建、Playwright E2E 通过（结果见第 5 节） |
| Node 22 CI | PR CI 在 Node 22 上 `npm ci`、类型检查、单测、构建、完整 E2E 通过 |
| 静态部署 | 已准备根路径与 `/atlas` 子路径的本地静态服务；Qoder Sites **尚未发布** |
| 本地离线备份 | `demo/current/`（gitignored），含 `BUILD.txt`；上一份保留在 `demo/previous/` |
| 真机触屏 | **未执行**（没有真实触屏设备证据） |
| 主持机完整彩排 | **未执行**（仅有自动化主路径检查） |
| 正式公开发布 | **未执行**，等待团队授权 |

> 结论：自动化覆盖的流程可判为通过；第 5 节中标为“未执行”的项目必须在比赛前由人完成，不能引用本文档代替。

## 2. 产物与运行环境

- 构建命令：`npm run build`（`tsc --noEmit && vite build`）
- 输出目录：`dist/`，共 57 个文件，约 11.94 MB
- `dist/index.html`：1,320 B，SHA-256 `055e7afd8c0375bce47069210bb1e9382222bc36dbd686ef0d7e78b57d2eac7e`
- 本地验证环境：Windows，Node v24.14.1，npm 11.11.0，Playwright 1.65.1 / Chromium 1255
- 项目要求 Node `>=22`。本机没有 Node 22，未在本机执行 Node 22 下的 `npm ci`；**PR CI 已在 Node 22 上通过 `npm ci`、类型检查、单测、构建和完整 E2E**，Node 22 清洁安装一项以 CI 结果为准。

构建分包（gzip 为构建输出）：

| 文件 | 原始大小 | gzip | 说明 |
| --- | --- | --- | --- |
| `dist/assets/index-*.js` | 565.24 kB | 193.73 kB | 应用主包 |
| `dist/assets/three-*.js` | 468.09 kB | 118.09 kB | Three.js 单独分包 |
| `dist/assets/JournalView-*.js` | 438.04 kB | 141.65 kB | Journal 懒加载 |
| `dist/assets/CollageView-*.js` | 328.02 kB | 103.94 kB | Collage 懒加载 |
| `dist/assets/index-*.css` | 88.02 kB | 17.87 kB | 全局样式 |

编辑器只在进入对应视图时加载；首页不加载 Journal / Collage 代码。全部图片、字体、地图数据在本地，运行时不请求第三方 CDN。

## 3. 运行方式

### 3.1 开发与测试

```bash
npm ci             # 或 npm install；Node >=22
npm run dev        # http://localhost:5173
npm run typecheck
npm test           # Vitest，20 个文件 / 181 个用例
npm run build
npm run preview    # 本地预览 dist/，http://localhost:4173
npm run test:e2e   # 先 build，再跑 Playwright（79 个用例）
npm run test:static # 只跑根路径/子路径静态部署用例
```

`npm run preview` 只用于本地验收，不是生产服务器。E2E 会自动拉起三个服务：`vite preview`（4173）、根路径静态服务（4174）和 `/atlas` 子路径静态服务（4175）。

### 3.2 本地离线演示

```bash
npm run demo:backup
# 等价于：npm run build && node scripts/prepare-demo.mjs
# 产物：demo/current/，上一份自动移到 demo/previous/

npm run demo:local -- --dist demo/current
# 打开 http://127.0.0.1:4173/
```

- 备份里只有静态产物和 `BUILD.txt`，不含源码、`node_modules`、密钥。
- 必须使用**固定端口 4173**：IndexedDB 按 origin 隔离，换端口会看不到之前准备的数据。
- 本地静态服务使用 hash 路由和 `base: './'`，根路径可直接运行；也支持子路径：

```bash
node scripts/serve-dist.mjs --dist demo/current --base-path /atlas --port 4175
# http://127.0.0.1:4175/atlas/
```

- 断网后本机静态服务与全部素材仍然可用；演示前请实际断网走一遍，确认没有隐藏的外网依赖。

## 4. Qoder Sites 静态部署

Qoder Sites 通过会话内 Sites Skills 或 `qoder sites` CLI 发布，静态站点使用参数 `webDirectory: dist`。仓库**不新增平台私有的配置文件**：当前没有公开文档要求提交此类文件，伪造一个格式只会增加误导。

### 4.1 发布步骤（等待授权后执行）

1. 确认要发布的 commit 已通过第 5 节全部自动化检查，并记录 commit。
2. `npm run build`，确认 `dist/index.html` 与 `dist/assets/` 存在；不要把仓库根目录当作 web 目录上传。
3. 在 Qoder 会话中触达 Sites 发布流程，指定 `webDirectory: dist`，站点类型为静态站点。
4. 先用预览地址验证，不立即公开：
   - 根路径 `/` 或子路径 `/atlas/` 能打开首页；
   - `/#/section/journals`、`/#/section/plans`、`/#/city/nanjing`、`/#/book/<id>?mode=journal`、`/#/book/<id>?mode=collage`、`/#/plan/<id>` 直接打开并刷新；
   - 浏览器网络面板没有 404，图片全部来自本站；
   - 不配置 SPA rewrite（hash 路由不需要）。
5. 访问策略保持私有或指定范围，直到团队明确同意公开；公开前再次确认首页背景画授权（见第 7 节）。
6. 发布后记录：站点地址、发布 commit、构建时间、`index.html` 哈希、操作人。

### 4.2 子路径

`vite.config.ts` 使用 `base: './'`，因此同一份 `dist/` 可放在根路径或 `/atlas/` 等子路径。子路径部署时入口是 `https://<站点>/atlas/`，资源使用相对路径；不需要改构建配置。发布前用 `scripts/serve-dist.mjs --base-path /atlas` 在本地模拟，E2E 已覆盖。

### 4.3 回退

- 线上：保留上一份已验证的 `dist/`；若 Qoder 控制台提供版本/发布记录，回退到上一版本；没有版本记录时，用上一份产物重新发布同一 `webDirectory`。
- 本地：`demo/previous/` 是上一份备份，运行 `npm run demo:local -- --dist demo/previous` 即可回到上一版。

## 5. 验收结果

执行日期 2026-11-26，发布候选工作树。自动化命令与结果：

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | 无输出错误 |
| `npm test` | 通过 | 20 个文件 / 181 个用例 |
| `npm run build` | 通过 | 351 modules；产物见第 2 节 |
| `npm run test:e2e` | 通过 | 79 个用例，Chromium 1255，16 workers |
| 静态根路径 | 通过 | `static-deploy.spec.ts`，4174 根路径 + hash 深链 + 本地图片 |
| 静态子路径 `/atlas` | 通过 | `static-deploy.spec.ts`，4175 子路径 + 深链 + 无 404 |
| 主演示路径 | 通过（自动化） | `demo-path.spec.ts`：建行程 → 邮票册 → 新建手账 → 模式选择 → Journal → 关联 → Collage → 刷新恢复 → 行程回看 |
| 无 WebGL 退路 | 通过（自动化） | `home-globe.spec.ts` 的降级用例 |
| 窄屏 390×844 | 通过（自动化） | 现有导航、书架、编辑器窄屏用例 |
| 真实触屏 / 中文输入法 | **未执行** | 无真机；现有测试用 `fill`，不代表真实输入法 |
| 主持机两次完整彩排 | **未执行** | 需要人工按第 6 节走两遍 |
| Qoder Sites 线上预览 | **未执行** | 未发布，等待授权 |

`npm run test:e2e` 覆盖的 79 个用例包括：应用启动、地球与图钉、无 WebGL、邮票册、模式选择、Journal 自动保存/冲突/失败重试/离开保护、Collage 素材/几何/图层/刷新、愿望地图、行程增删改与关联、跨模块联动、窄屏和静态部署。新增用例只有两个文件：

- `tests/e2e/demo-path.spec.ts`：一条完整演示主路径，并监控资源 404 与运行时错误。
- `tests/e2e/static-deploy.spec.ts`：同一份 `dist/` 的根路径和 `/atlas` 子路径，直接打开与刷新 hash 深链。

## 6. 现场演示流程

建议 5–7 分钟，只走一条主路径，备两个退路。

### 6.1 演示前准备

1. 固定机器、固定浏览器配置、固定端口 `4173`；不要清理站点数据。
2. 准备“空档案”和“演示档案”两个浏览器配置：
   - 空档案：全新配置，用于展示空状态和新建流程；
   - 演示档案：提前创建两本南京手账（一本 Journal、一本 Collage）、一趟南京两日行程、一张示例照片。
3. 两个配置各完整走两遍，第二遍重点看刷新恢复和返回路径。
4. 保留 `demo/previous/`，并把 Qoder 上一版产物留在可回退位置。
5. 关闭无关标签页、通知和输入法弹窗；确认音量/亮度；准备离线断网开关。

### 6.2 主路径

1. **首页**：打开固定地址，转动地球，指出六座城市的图钉；打开南京明信片，进入手账书架。
2. **邮票册**：顶部「旅行手账」→ 六枚邮票；点南京邮票，展示城市书架和两本已存在的手账。
3. **新建/打开**：点「新建一本」进入模式选择页，说明同一 `bookId` 的三种页面；或直接打开准备好的手账。
4. **Journal**：写一行中文、插入一张照片/贴纸，等待“已保存”；返回模式选择页再进入，内容还在。
5. **Collage**：切换到自由拼贴，插入城市贴纸，拖动/缩放/旋转一次，等待保存；刷新页面，画布恢复。
6. **关联行程**：在书壳里选择南京行程，打开行程详情，展示“关联手账”并点回同一本书。
7. **旅行计划**：顶部「旅行计划」→ 中国愿望地图 → 南京计划页；展示日期、每日安排、关联手账入口。
8. **返场**：回到邮票册，说明六城都可重复；最后停在首页或模式选择页，方便提问。

### 6.3 退路

- **WebGL 不可用**：打开禁用 WebGL 的浏览器配置，首页出现城市按钮列表，仍能进明信片和书架。
- **窄屏**：把窗口缩到 390×844，展示竖版首页、邮票册横向布局和编辑器可用；说明真实手机仍需赛前实测。
- **无数据/坏链接**：打开 `/#/book/missing` 展示“没有这本手账”与返回邮票册；打开 `/#/book/<id>?mode=unknown` 回到模式选择页。
- **保存失败**：不现场制造存储故障；用现有测试结果说明有草稿、重试和离开保护，避免演示时故意破坏数据。

## 7. 素材来源与授权

| 素材 | 来源 | 处理 | 备注 |
| --- | --- | --- | --- |
| 首页背景 `assets-source/home-hero.png` | 需求方提供 | `npm run data:hero` 等比压缩为 `src/assets/hero-bg.jpg` | 著作财产权归提供方；**公开发布前需再次确认使用范围** |
| 邮票册/模式选择/横线本 `stamp-album.png`、`create-mode.png`、`journal-lines.png` | 需求方提供，存于 `assets-source/` | `npm run data:paper` 等比缩放到 1440 宽、JPEG 78，**不裁切** | 热区按源图像素量取 |
| 内页背景 `inner-bg-map.png` | 需求方提供 | `npm run data:inner` | 本地打包 |
| Collage 底图/纸片/胶带等 | `assets-source/collage-*.jpg` 与需求方贴纸原图 | `npm run data:collage` / `npm run data:stickers` | 原图 70 MB 不入库，处理结果在 `src/assets/` |
| 34 张贴纸 | 需求方提供（GPT 生成/设计稿混合，见 `scripts/build-sticker-assets.mjs` 注释） | 去背景、紧裁、384px 内，输出到 `src/assets/stickers/` | 城市文化贴纸、六城邮票、通用物件 |
| 城市插画/邮戳/装饰 SVG | 仓库内手写 | 直接打包 | 无第三方版权不明素材 |
| 陆地轮廓 | Natural Earth 1:110m（public domain），经 `world-atlas@2.0.2`（ISC） | `npm run data:world` 生成 `src/data/world.ts` | 需联网重新生成，缓存留在 `.tmp/` |
| 字体 | 系统字体栈 | 不引入 web font | 无字体文件分发 |

未发现版权不明的第三方图片或字体。**唯一需要发布前确认的是首页背景画的使用范围**；如果团队不能确认，线上演示应改用不含该图的窄屏/替代首页，或只做本地演示。

## 8. 已知限制

- 本机未单独执行 Node 22 清洁安装：本机 Node 24.14.1；PR CI 已在 Node 22 上通过 `npm ci`、类型检查、单测、构建和完整 E2E。
- 真实触屏、双指缩放、手机浏览器地址栏/安全区、中文输入法均未在真机验证；现有窄屏用例是 Chromium 视口模拟。
- 只在 Chromium 1255 验证；Safari、Firefox、微信内置浏览器未测。
- Qoder Sites 尚未发布，没有线上地址、线上预览或公开访问策略记录。
- 数据只存在当前浏览器 IndexedDB；换浏览器、换端口、清理站点数据都会回到空档案；没有账号、云同步或跨设备。
- 首页依赖 WebGL；不支持时退化为城市按钮列表。低端设备帧率和发热未测。
- 首页舞台需要至少 760×430 的视口；更小走竖版布局。Journal 窄屏按设计横向滚动，不是重排。
- 比赛用主包仍较大（首屏 JS gzip 约 194 kB，另有 Three.js 118 kB）；未做进一步性能优化。
- 伦敦只保留在地球、明信片和城市页，不在六城邮票册/计划范围。
- 没有导出 PDF、分享链接、后端或多人协作；这些不属于 V1。
- 演示数据需要人工准备；仓库不提交任何用户照片或手账内容。

## 9. 发布检查清单

- [x] Node 22 环境 `npm ci`、`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e` 全通过（PR CI）
- [ ] 发布 commit 与 `dist/` 一一对应，记录 `index.html` SHA-256
- [ ] Qoder Sites 预览地址在根路径或 `/atlas` 子路径可打开，深链刷新正常，无 404
- [ ] 首页背景画授权已确认；未确认则不公开发布
- [ ] 真实触屏设备完成第 8 节矩阵，中文输入法实际输入
- [ ] 主持机用空档案和演示档案各完整走两遍
- [ ] 断网状态用 `demo/current` + 固定 4173 端口走完整流程
- [ ] `demo/previous/` 与 Qoder 上一版可回退
- [ ] PR 附测试结果、设备、访问地址、备份路径、构建 commit 和走台记录
- [ ] 团队明确授权后才切换公开访问
