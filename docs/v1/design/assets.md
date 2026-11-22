# V1-04 素材与来源登记

2026-11-22 · `v1/04-city-art`（创作方式选择页一张随 V1-06 `v1/06-city-stamps` 补入本表）

这一页只登记「素材从哪来、放在哪、谁在用、坐标按哪张图量」。运行方式见根目录 README，
数据形状与 ID 规则以 [公共契约](../contracts.md) 为准。

## 纸张整画

三张都是「整张画 + 叠在画上的真控件」：邮票、两张卡片、印好的 Title/Date 填空和横线全部画在图里，
页面上只放真的可点、可输入的元素，按源图像素坐标量出的热区对位。
热区坐标的出处与量法见 `src/config/journal.ts`（收藏册与创作模式选择页随 V1-06 入表，横线页归 V1-07）。

| 源图 | 尺寸 | 运行时产物 | 生成命令 | 用在 |
| --- | --- | --- | --- | --- |
| `assets-source/stamp-album.png` | 1536×1024 | `src/assets/stamp-album.jpg`（1440 宽，JPEG 78） | `npm run data:paper` | 城市邮票收藏册 |
| `assets-source/create-mode.png` | 1448×1086 | `src/assets/create-mode.jpg`（1440 宽，JPEG 78） | `npm run data:paper` | 创作方式选择页 |
| `assets-source/journal-lines.png` | 1448×1086 | `src/assets/journal-page.jpg`（1440 宽，JPEG 78） | `npm run data:paper` | Journal 横线日记本 |

源图与压缩件一起入库：热区是按源图像素量的，只留压缩件的话换图后重量坐标会失去依据。
生成脚本 `scripts/build-paper-assets.mjs` 只做等比缩放和压缩，**不裁切**，裁一刀画上的
邮票和热区就错位了。

首页 `assets-source/home-hero.png` 与内页背景 `assets-source/inner-bg-map.png` 由 V1-01 / V1-03
各自维护，登记在对应任务分支里，本表不重复。

## 六城邮票

`src/data/catalog/stamps.ts` 按 V1-02 冻结的形状登记六枚静态邮票：
ID 为 `<cityId>-postmark`，`motif` 直接取自城市目录，保证邮票地标与地球图钉、明信片封面同源。

| 城市 ID | 邮票 ID | 地标 motif |
| --- | --- | --- |
| `nanjing` | `nanjing-postmark` | `city-gate` |
| `shanghai` | `shanghai-postmark` | `pearl-tower` |
| `xian` | `xian-postmark` | `wild-goose-pagoda` |
| `beijing` | `beijing-postmark` | `hall-of-prayer` |
| `hangzhou` | `hangzhou-postmark` | `lake-bridge` |
| `chengdu` | `chengdu-postmark` | `alley-lanterns` |

伦敦只在地球上，册子里没有它的邮票，因此不在目录中。

## 下一阶段（未提交）

- **贴纸目录未填。** `src/data/catalog/stickers.ts` 仍是 V1-02 留下的空表，
  `src/assets/stickers/` 尚无文件，`StickerDefinition` 的 `sticker:<local-id>` 规则已冻结可直接用。
  本城贴纸与通用贴纸随 V1-04 的下一阶段提交，仍走同一个任务分支和 PR。
- 用户收藏状态不属于素材：由 V1-06 写 Dexie `stamps` 表，静态目录里永远不放「谁藏了」。
