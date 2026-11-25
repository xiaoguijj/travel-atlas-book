import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react';
import type { Extensions, JSONContent } from '@tiptap/core';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { artBoxStyle, artCqw, journalArt, journalRules, journalToolbarBox, journalWritingBox } from '../../config/journal';
import {
  JOURNAL_MEDIA_NODE_NAME,
  type AssetKind,
  type JournalDocument,
  type JournalEditorProps,
} from '../../data/contracts';
import { createJournalExtensions, prepareJournalDocument } from './journalSchema';
import styles from './JournalEditor.module.css';

/** View-only loading feedback; the shared data/editor contract remains unchanged. */
export interface JournalEditorComponentProps extends JournalEditorProps {
  onLoadBlocked?: (blocked: boolean) => void;
  /** The host saves pending fields before reloading; the editor never reloads directly. */
  onReloadRequested?: () => void | Promise<void>;
}

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
 * 并把 `--rule-step` / `--body-size` 两个源图换算出来的变量传下来（见 JournalView）。
 *
 * 行高恒等于印好的线距（47.6px 换算成 cqw），字体用画上手写体的那一款，字才坐在线上而不是飘着。
 * 格式只放不改变行高的那几样：加粗、斜体、下划线 —— 标题会把行撑高，一撑高整页横线就错位。
 */
export function JournalEditor(props: JournalEditorComponentProps) {
  // A book switch starts a new load decision; saving receipts cannot reset a draft.
  return <JournalEditorSession key={props.bookId} {...props} />;
}

function JournalEditorSession(props: JournalEditorComponentProps) {
  const [initial] = useState(() => {
    const extensions = createJournalExtensions(props.assets);
    return { extensions, result: prepareJournalDocument(props.content, extensions) };
  });

  useEffect(() => {
    props.onLoadBlocked?.(initial.result.status === 'blocked');
  }, [initial.result.status, props.onLoadBlocked]);

  if (initial.result.status === 'blocked') {
    return <RecoveryNotice onReloadRequested={props.onReloadRequested} />;
  }

  return (
    <EditableJournalEditor
      {...props}
      extensions={initial.extensions}
      initialDoc={initial.result.doc}
    />
  );
}

function EditableJournalEditor({
  bookId,
  extensions,
  initialDoc,
  onChange,
  onOpenAssetPanel,
  insertionRequest,
  onInsertionHandled,
  onLoadBlocked,
  onReloadRequested,
}: JournalEditorComponentProps & { extensions: Extensions; initialDoc: JournalDocument }) {
  // 内容只在挂载时读一次（契约：加载一次，之后保存回执不能回头覆盖正在写的字）。
  // Tiptap 3 的 useEditor 在依赖非空时只在依赖变化那一次重建实例，所以依赖给书编号：
  // 换一本书整只重建，同一本书里父级因保存状态重渲染都不会碰已经打进的正文。
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const blockedRef = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [insertionError, setInsertionError] = useState<string | null>(null);
  const insertionPoint = useRef<number | null>(null);
  const handledRequest = useRef<string | null>(null);

  const editor = useEditor(
    {
      extensions,
      content: initialDoc as unknown as JSONContent,
      enableContentCheck: true,
      editorProps: {
        attributes: {
          class: styles.prose,
          spellcheck: 'false',
          role: 'textbox',
          'aria-label': '手账正文',
          'aria-multiline': 'true',
        },
      },
      onContentError: () => {
        // This guard is immediate: a fallback transaction must never reach autosave.
        blockedRef.current = true;
        setBlocked(true);
      },
      onFocus: () => {
        insertionPoint.current = null;
      },
      onBlur: ({ editor: instance }) => {
        // Also covers the shared asset button in BookShell, outside this toolbar.
        insertionPoint.current = instance.state.selection.to;
      },
      onTransaction: ({ transaction }) => {
        if (transaction.docChanged && insertionPoint.current !== null) {
          insertionPoint.current = transaction.mapping.map(insertionPoint.current, 1);
        }
      },
      onUpdate: ({ editor: instance }) => {
        if (blockedRef.current) return;
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
      if (blockedRef.current || editor.isDestroyed) return false;
      // A numeric position inserts at the selection boundary; a range replaces text.
      // Capture it before focus() so the asynchronous picker cannot erase the range.
      const position = Math.max(
        0,
        Math.min(insertionPoint.current ?? editor.state.selection.to, editor.state.doc.content.size),
      );
      const inserted = editor
        .chain()
        .focus()
        .insertContentAt(position, { type: JOURNAL_MEDIA_NODE_NAME, attrs: { assetId } })
        .run();
      if (inserted) insertionPoint.current = null;
      return inserted;
    },
    [editor]
  );

  // Only acknowledge a successful insertion, and do not repeat it on an effect replay.
  useEffect(() => {
    if (!insertionRequest || handledRequest.current === insertionRequest.requestId || blockedRef.current) return;
    if (!insertAsset(insertionRequest.assetId)) {
      setInsertionError('这张素材暂时没能插入，请重新打开素材面板再试。');
      return;
    }
    handledRequest.current = insertionRequest.requestId;
    setInsertionError(null);
    onInsertionHandled?.(insertionRequest.requestId);
  }, [insertionRequest, insertAsset, onInsertionHandled]);

  useEffect(() => {
    if (blocked) onLoadBlocked?.(true);
  }, [blocked, onLoadBlocked]);

  const openAssetPanel = (kind: AssetKind) => {
    insertionPoint.current = editor.state.selection.to;
    setInsertionError(null);
    onOpenAssetPanel(kind);
  };

  const writingStyle = { ...artBoxStyle(journalArt, journalWritingBox) } as CSSProperties;
  const toolbarStyle = {
    ...artBoxStyle(journalArt, journalToolbarBox),
    '--rule-step': artCqw(journalArt, journalRules.step),
  } as CSSProperties;

  if (blocked) return <RecoveryNotice onReloadRequested={onReloadRequested} />;

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
          <FormatButton label="插入照片" onClick={() => openAssetPanel('photo')}>
            照片
          </FormatButton>
          <FormatButton label="插入贴纸" onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true });
            openAssetPanel('sticker');
          }}>
            贴纸
          </FormatButton>
        </div>

        {insertionError ? <p className={styles.insertionError} role="alert">{insertionError}</p> : null}
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
  onClick: MouseEventHandler<HTMLButtonElement>;
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

function RecoveryNotice({ onReloadRequested }: Pick<JournalEditorComponentProps, 'onReloadRequested'>) {
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);

  const requestReload = async () => {
    if (!onReloadRequested || reloading) return;
    setReloading(true);
    setReloadFailed(false);
    try {
      await onReloadRequested();
    } catch {
      setReloadFailed(true);
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className={styles.recovery} style={artBoxStyle(journalArt, journalWritingBox)} role="alert">
      <p className={styles.recoveryTitle}>正文暂时无法完整读取</p>
      <p>原始正文仍保留在本机。为防止覆盖，正文编辑和自动保存已暂停。</p>
      <p>可以重新读取；如果仍无法打开，请先保留这本手账。</p>
      <button
        type="button"
        className={styles.reload}
        disabled={reloading || !onReloadRequested}
        onClick={() => void requestReload()}
      >
        {reloading ? '正在保存并重新读取…' : '重新读取正文'}
      </button>
      {!onReloadRequested ? <p>请先保存其他修改，再从书架重新打开这本手账。</p> : null}
      {reloadFailed ? <p>其他修改暂时没能保存，已留在本页。请重试保存后再重新读取。</p> : null}
    </div>
  );
}
