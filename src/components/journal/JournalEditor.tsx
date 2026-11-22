import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { localClock } from '../../config/dates';
import { artBoxStyle, artCqw, journalArt, journalRules, journalToolbarBox, journalWritingBox } from '../../config/journal';
import {
  JOURNAL_MEDIA_NODE_NAME,
  type EditorSaveState,
  type JournalDocument,
  type JournalEditorProps,
} from '../../data/contracts';
import { AtlasMedia } from './AtlasMedia';
import { journalDocFor } from './journalDoc';
import styles from './JournalEditor.module.css';

/**
 * 横线日记本的正文编辑器（V1-07）。
 *
 * 只实现 V1-02 冻结的 `JournalEditorProps`：正文一律是 `{ doc: JournalDocument }`，
 * 媒体只写 `assetId` 与可选说明；改动通过 `onChange` 交给手账壳的保存队列，
 * 本页不读写数据库，也不在正文里留任何 URL 或 Blob。
 *
 * 外壳（那张牛皮纸、Title / Date 两行、城市铭牌）由手账壳画，这一层只往上贴两块：
 * 横线区里的正文、和画在下沿空带上的工具条。两块都按 `src/config/journal.ts` 里
 * 量自源图的坐标绝对定位，所以挂载它的父级必须是 `position: relative` 的画框，
 * 并把 `--rule-step` / `--body-size` 两个源图换算出来的变量传下来（见 JournalMountPage）。
 *
 * 行高恒等于印好的线距（47.6px 换算成 cqw），字体用画上手写体的那一款，字才坐在线上而不是飘着。
 * 格式只放不改变行高的那几样：加粗、斜体、下划线 —— 标题会把行撑高，一撑高整页横线就错位。
 */
export function JournalEditor({
  bookId,
  content,
  assets,
  saveState,
  onChange,
  onRetrySave,
  onOpenAssetPanel,
  insertionRequest,
  onInsertionHandled,
}: JournalEditorProps) {
  // 内容只在挂载时读一次（契约：加载一次，之后保存回执不能回头覆盖正在写的字）。
  // Tiptap 3 的 useEditor 在依赖非空时只在依赖变化那一次重建实例，所以依赖给书编号：
  // 换一本书整只重建，同一本书里父级因保存状态重渲染都不会碰已经打进的正文。
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
          dropcursor: false,
        }),
        AtlasMedia.configure({ assets }),
      ],
      content: journalDocFor(content) as unknown as JSONContent,
      editorProps: {
        attributes: { class: styles.prose, spellcheck: 'false', 'aria-label': '手账正文' },
      },
      onUpdate: ({ editor: instance }) => {
        onChangeRef.current({ doc: instance.getJSON() as JournalDocument });
      },
    },
    [bookId],
  );

  // 工具条上的按钮态：Tiptap 3 默认不再为每次事务重渲染，所以按小快照订阅，
  // 只有加粗/斜体/下划线或可撤销可重做真的变了才重画这一层。
  const toolbar = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive('bold'),
      italic: instance.isActive('italic'),
      underline: instance.isActive('underline'),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  });

  const insertAsset = useCallback(
    (assetId: string) => {
      editor?.chain().focus().insertContent({ type: JOURNAL_MEDIA_NODE_NAME, attrs: { assetId } }).run();
    },
    [editor]
  );

  // 素材面板选好了一张照片或一枚贴纸：插到光标处，插完立刻回执，免得同一条请求重复插入。
  useEffect(() => {
    if (!editor || !insertionRequest) return;
    insertAsset(insertionRequest.assetId);
    onInsertionHandled?.(insertionRequest.requestId);
  }, [editor, insertionRequest, insertAsset, onInsertionHandled]);

  const writingStyle = { ...artBoxStyle(journalArt, journalWritingBox) } as CSSProperties;
  const toolbarStyle = {
    ...artBoxStyle(journalArt, journalToolbarBox),
    '--rule-step': artCqw(journalArt, journalRules.step),
  } as CSSProperties;

  return (
    <>
      <div className={styles.paper} style={writingStyle}>
        <EditorContent editor={editor} className={styles.surface} />
      </div>

      <div className={styles.toolbarWrap} style={toolbarStyle}>
        <div className={styles.toolbar} role="toolbar" aria-label="正文格式">
          <FormatButton
            label="加粗"
            active={toolbar.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <span className={styles.boldMark}>B</span>
          </FormatButton>
          <FormatButton
            label="斜体"
            active={toolbar.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <span className={styles.italicMark}>I</span>
          </FormatButton>
          <FormatButton
            label="下划线"
            active={toolbar.underline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span className={styles.underMark}>U</span>
          </FormatButton>

          <span className={styles.divider} aria-hidden="true" />

          <FormatButton label="撤销" disabled={!toolbar.canUndo} onClick={() => editor.chain().focus().undo().run()}>
            ↺
          </FormatButton>
          <FormatButton label="重做" disabled={!toolbar.canRedo} onClick={() => editor.chain().focus().redo().run()}>
            ↻
          </FormatButton>

          <span className={styles.divider} aria-hidden="true" />

          {/* 素材抽屉本身归 V1-05，这里只把「要插哪一类」递过去 */}
          <FormatButton label="插入照片" onClick={() => onOpenAssetPanel('photo')}>
            照片
          </FormatButton>
          <FormatButton label="插入贴纸" onClick={() => onOpenAssetPanel('sticker')}>
            贴纸
          </FormatButton>
        </div>

        <SaveBadge state={saveState} onRetry={onRetrySave} />
      </div>
    </>
  );
}

function FormatButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? `${styles.tool} ${styles.toolActive}` : styles.tool}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SaveBadge({ state, onRetry }: { state: EditorSaveState; onRetry: () => void }) {
  const stamp = state.lastSavedAt ? localClock(state.lastSavedAt) : null;
  const copy: Record<EditorSaveState['status'], string> = {
    ready: '写完就自动存进本机',
    saving: '正在写入这本手账…',
    saved: stamp ? `已保存 ${stamp}` : '已保存',
    error: state.error ? state.error.message : '这一版没能存进本机',
  };
  const tone =
    state.status === 'error' ? styles.saveError : state.status === 'saving' ? styles.saveBusy : styles.saveQuiet;

  return (
    <p className={`${styles.save} ${tone}`} role="status" aria-live="polite">
      {copy[state.status]}
      {state.status === 'error' ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          重试
        </button>
      ) : null}
    </p>
  );
}
