# 贴纸系统（Journal / Collage 共用）

Journal 和 Collage 用同一套贴纸：一份素材、一个选择器、一个可拖动图层。
这个目录**不认识**"页""横线""日记正文"这些概念——它只认实例数组和几个回调。
宿主页面统一从 `src/stickers` 出口 import，别直接引用里面的单个文件。

```
types.ts        数据类型：StickerAsset / StickerInstance / StickerScope / StickerDocument
catalog.ts      34 张贴纸的清单（中英文名、分类、所属城市）、URL、宽高比、搜索
sizes.ts        每张成品图的像素尺寸——由 npm run data:stickers 生成，不要手改
storage.ts      按作用域读写：travel-atlas-book.stickers.<cityId>.<mode>.<journalId>
saveController 保存草稿、350ms 防抖、补存/重试/明确放弃，固定绑定本子作用域
useStickers.ts  状态 + 生命周期补存 + 贴/移/缩放旋转/删/复制/层级
StickerPicker   贴纸盒：默认 4 张「全域小集」、城市邮票 6 张、中英文城市搜索
StickerLayer    画布层：拖动 + 四个圆把手（复制/删除/旋转/缩放）、点空白取消选中
index.ts        唯一出口
```

## 数据长什么样

```ts
interface StickerInstance {
  instanceId: string; // 一次粘贴的编号，crypto.randomUUID()
  assetId: string;    // 贴纸素材编号，如 'nanjing-plum-blossom'
  x: number;          // 0–1，相对画布宽度的**中心点**比例
  y: number;          // 0–1，相对画布高度的中心点比例
  scale: number;      // 1 = 原始大小，钳制在 0.25–4
  rotation: number;   // 角度，顺时针，不钳制
  z: number;          // 层级，越大越靠上
}

interface StickerDocument { version: 1; pages: StickerInstance[][] } // pages[页号] = 该页的贴纸

interface StickerScope {
  cityId: string;               // 'nanjing' | 'shanghai' | …
  mode: 'journal' | 'collage';  // 两种模式的存档互不干扰
  journalId: string;            // 一个城市写多本手账时用它区分；单本就填 'default'
}
```

存的位置和正文分开：正文由手账仓储写入 IndexedDB，贴纸的 localStorage 键仍是
`travel-atlas-book.stickers.<cityId>.<mode>.<journalId>`。所以老日记不会因为多了贴纸功能而被改写，
贴纸也不会把正文挤掉。读取保留全部合法页面和贴纸，不按数量截断；格式、版本、素材或字段
不兼容时暂停贴纸编辑，保留原始存档，不能把读取失败当作空白再覆盖。

## Journal 里的用法（BookShell 持有，JournalView 渲染）

```tsx
const stickers = useStickers({ cityId: city.id, mode: 'journal', journalId: book.id }, page);

// .stage 里面，JournalEditor 之后：
<StickerLayer instances={stickers.instances} selectedId={stickers.selectedId}
  onSelect={stickers.select} onUpdate={stickers.update} onRemove={stickers.remove}
  onDuplicate={stickers.duplicate} onReorder={stickers.reorder} onGestureEnd={stickers.flush} />

// 底栏一个入口 + 页面末尾一个弹层：
<button onClick={() => setPickerOpen(true)}>贴纸</button>
<StickerPicker open={pickerOpen} cityId={city.id} disabled={stickers.readBlocked}
  onPick={stickers.add} onClose={() => setPickerOpen(false)} />
```

`page` 直接当第二个参数传进去，翻页时层里换的就是另一页的实例——不同页的贴纸互不影响。

宿主同时负责正文和贴纸的保存反馈与离开保护：`dirty` 用于渲染，`isDirty()` 用于离开瞬间
读取最新状态；`await flush()` 等待跨标签页写锁并返回保存结果，手动重试调用 `retry()`；`discardPending()` 只在用户
明确放弃时调用。写入失败保留草稿和 dirty，只有真正写入成功才更新 `lastSavedAt`。
页面不能在贴纸仍 dirty 或 unavailable 时对整本手账显示“已保存”。
`readBlocked` 表示旧档没有完整读出，此时所有内容修改都被禁止，`retry()` 仅重新读取原档，
读取成功后才恢复编辑。读取失败没有产生新草稿，不拦截正常离开；放弃操作也不能解除读取保护。

## Collage 接入步骤

`StickerLayer` 自己不存状态，谁持有状态谁负责存。最省事的接法就是复用 `useStickers`：

```tsx
import { useState } from 'react';
import { StickerLayer, StickerPicker, useStickers } from '../stickers';

export function CollageEditor({ cityId }: { cityId: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const stickers = useStickers({ cityId, mode: 'collage', journalId: 'default' }, 0); // 拼贴只有一页，恒为 0

  return (
    <div className={styles.canvas}>
      {/* …队友自己的画布内容… */}

      <StickerLayer
        instances={stickers.instances}
        selectedId={stickers.selectedId}
        onSelect={stickers.select}
        onUpdate={stickers.update}
        onRemove={stickers.remove}
        onDuplicate={stickers.duplicate}
        onReorder={stickers.reorder}
        onGestureEnd={stickers.flush}
      />

      <button type="button" onClick={() => setPickerOpen(true)}>贴纸</button>
      <StickerPicker open={pickerOpen} cityId={cityId} disabled={stickers.readBlocked}
        onPick={stickers.add} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
```

三个必须满足的前提，缺一个贴纸就会错位或点不动：

1. **`StickerLayer` 的直接父元素就是画布本身**：它按父元素的矩形换算坐标，也在这个父元素上监听
   "点空白取消选中"。所以那层要有 `position: relative`，并且 `overflow` 别把贴纸裁掉。
2. **画布要有确定的宽高**（`aspect-ratio` 或固定尺寸都行）。给 0 高度时百分比会退化，贴纸挤成一条线。
3. **层要盖在画布内容之上**：`StickerLayer` 已经 `pointer-events: none`，只有贴纸像素可点，
   所以放在最后即可，不会挡住宿主自己的控件。

如果 Collage 已经有自己的存档格式，可以不用 `useStickers`：把 `StickerInstance[]` 从自己的状态里
取出来传给 `StickerLayer`，回调里写回自己的存档就行。`createInstanceId()`、`MIN_SCALE`、`MAX_SCALE`
都从出口导出，方便两条线共用同一套钳制规则。

只想读一份现成的贴纸档（导出、截图、云端上传）时用：

```ts
import { readStickerDocument, writeStickerDocument } from '../stickers';
const doc = readStickerDocument({ cityId, mode: 'collage', journalId: 'default' });
```

## 交互约定

- 点一下就贴：第一张落在画布正中偏上（x 0.5 / y 0.42），之后按张数错开 0.045 一档，同一张可以重复贴多次。
- 拖动=移动。选中后浮出**四个白底黄铜边的圆把手**：左上复制、右上删除、顶边外面改角度、右下角改大小
  （缩放看把手离中心多远，旋转看把手绕中心转过多少，按住 Shift 吸附到 15°）。四个都挂在层上而不是贴纸里，
  所以不跟着贴纸转、也压不住在别的贴纸下面；位置按贴纸的旋转矩阵算，转过的贴纸照样在真正的角上抓得到。
  手势期间监听挂在 window 上，不依赖 `setPointerCapture`，重渲染把手不会掉——上一版正是栽在这里，真鼠标一拖就断。
- 键盘与鼠标走同一套动作：焦点在贴纸上时 `+` / `-` 缩放 8%，`[` / `]` 转 5°（按住 Shift 转 1°），
  `Shift` + `↑` / `↓` 调前后层——换层只有这条键盘路径，画面上没有按钮。
- 点画布空白处取消选中；`Delete`/`Backspace` 删除选中，`Esc` 取消选中。
- **光标在标题、日期、正文里时，键盘事件一律放行**，绝不在打字时把贴纸删了；按住贴纸也不会抢走正文的焦点和选区。
- 连续移动、缩放和旋转以 350ms 防抖写入，手势结束立即补存；添加、删除、复制、换层立即保存。
  切换模式先由宿主保存并检查失败，页面隐藏时也发起补存。pagehide 会先同步保存本页独立的待写草稿，下次打开时在锁内核对基线后恢复。
  明确放弃后定时器和补存均不会再写入；存储持续不可用时仍需提示用户，不能保证强制关闭后保留未存草稿。

## 素材

`src/assets/stickers/` 34 张，由 `scripts/build-sticker-assets.mjs` 从原始贴纸包生成：

```bash
npm run data:stickers            # 默认读 .tmp/sticker-source
npm run data:stickers D:/AI/贴纸  # 或显式指定原图目录
```

34 张原图共 70MB，没有入库（`assets-source/` 里那四张背景画才 13MB，塞 70MB 进去会把仓库撑大六倍）：
原图由 `贴纸.zip` 保管，重跑脚本前解压一份，把目录当参数传进来即可。入库的是 `src/assets/stickers/`
里处理完的 6.2MB 成品。

脚本做四件事：按轮廓漫水填充抠掉白底 → 腐蚀 1px + 羽化 → 裁到包围盒（留 2px）→ 长边压到 384px。
满幅票面走另一条：不抠底，但按牛皮纸的色相（R−B > 100 且 R > 170）逐行逐列统计占比，把票面外面那圈
衬纸裁掉，只留齿孔；每边砍不到 3% 就不动，免得把本来就贴边的邮票削到齿。
有透明的写 PNG（deflate 9），没有透明的写 JPEG（q82），并顺手重新生成 `sizes.ts`。
新增素材要在 `sources` 里登记原名 → 贴纸 ID，再到 `catalog.ts` 补一条，然后重跑脚本。
命名一律 `<城市|common>-<内容>`，页面里绝不出现图片路径字符串（`import.meta.glob` 在打包时解析）。

## 已知边界

- 6 枚城市邮票和向日葵邮票是满幅票面设计，齿孔边就是外轮廓，抠成异形会破坏票面，所以这 7 张保留矩形（存 JPEG）。
- 没有多选、框选、吸附对齐；缩放旋转各靠一个把手，未做双指捏合（触屏上单指拖把手同样能用）。
- 调前后层没有按钮，只有 `Shift` + `↑` / `↓`；焦点不在贴纸上时这条键位不生效。
- 删文字导致页数变少时，后面页的贴纸仍按原页号留在档里；再写回那一页时它们会重新出现（不会静默丢）。
- 图片本身不进 Git 之外的存储：换浏览器、清站点数据就没有了，云同步和导出成图不在这个阶段。
