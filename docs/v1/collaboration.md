# V1 双人协作

以[正式 V1 开发规划](../Travel-Atlas-Book-V1-Development-Plan.md)为准。[开发看板](https://xiaoguijj.github.io/travel-atlas-book/v1/)展示当前进度、依赖、分支和 PR。

1. **认领任务。** 从看板的「可认领」任务里选一个，点开确认边界、验收和推荐分支名。认领前刷新远程分支列表。若远端已有同名分支，先和队友沟通。
2. **建分支。** 从最新 `origin/main` 创建推荐分支并立即推送。推送后的空分支记为「已认领」，例如认领 V1-01 时执行以下命令。

   ```bash
   git fetch origin
   git switch -c v1/01-globe-baseline origin/main
   git push -u origin v1/01-globe-baseline
   ```

3. **开发与提交。** 每次提交写清楚改动，可在提交信息中带任务编号。集中处理所领任务，提交可复现的验证证据。看板以任务分支相对 `main` 的独立提交识别「开发中」。
4. **提 PR。** 从目标仓库中的任务分支向 `main` 提交 PR。未做完或希望提前讨论时用 Draft。达到任务验收要求后转 Ready for Review，请队友审核。说明范围、前置 PR、验证步骤和结果，以及演示路径上的已知问题。
5. **互审与修复。** 队友按任务卡走一遍比赛演示路径，关注功能完整、交互稳定、演示可用和代码可维护。P0/P1 必须修复并复查。P2 可建 Issue 后续处理，PR 里附链接。需要修改时用 GitHub 的 Request changes，把修复推送到同一分支并请求复审。正式 PR 在修改期间仍显示「审核中」和审核反馈，退回 Draft 则显示「开发中」。
6. **合并。** 队友审核通过，前置任务全已合入 `main`，任务验收和必要检查通过后，再合并到 `main`。看板依据已合并 PR 记录完成。分支删除后仍可查看历史 PR。
7. **并行与冲突。** 依照规划第 4、6 节，提前做独立组件、fixtures 或测试时，避免改动队友负责的路由、Schema、公共类型和锁文件。前置合并后将最新 `origin/main` 合入自己的分支，接真实接口并重跑验收。需要调整公共契约时先在 PR 里明确影响，与队友统一改动顺序。

## 看板如何认任务

看板按「任务分支 → 目标仓库的 `main` PR」关联。分支必须与正式推荐名完全相同，或在 [历史分支关联](legacy-links.json)明确登记。普通 PR 标题、提交消息、同名 fork 分支均不作为任务凭证。一个任务如果需要多个阶段提交，请在同一任务 PR 中保持 Draft，待完整验收后合入。需要先合并部分成果时，用独立的非任务分支和 PR，等任务完成再用正式任务分支提验收 PR。

现有 `11.22/v1-03` 按编号登记为 V1-03。邮票原型跨越 V1-05、06、07，待团队确认如何拆分复用。首页转场 PR #1 是 V1-01 的复用基线。后两项作为已有开发记录展示。

## 发布与本地预览

- 有仓库 Pages 设置权限的成员在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。本 PR 合入后，首轮 `Publish V1 dashboard` 可由 main 推送触发，也可在 Actions 手动运行。部署成功后访问 [GitHub Pages 看板](https://xiaoguijj.github.io/travel-atlas-book/v1/)。
- 分支创建、删除、推送，PR 状态变动和审核事件触发刷新。每小时补同步一次。API 查询失败会使构建失败，线上保留上一次成功快照和原更新时间。README 图标由同一次快照生成，GitHub 图片缓存可能让它稍晚更新。
- 修改正式规划后，执行 `python docs/v1/progress.py --sync-plan`，将更新的 [task-plan.json](task-plan.json)一并提交。构建会检查 JSON 与正式规划是否一致。
- 已登录 `gh` 时，运行 `python -B docs/v1/progress.py --output <临时目录>` 并打开产物的 `v1/index.html`。改动看板的 PR 可以在 Actions 对应的 `V1 progress events` 运行中下载 `v1-dashboard-preview`。
