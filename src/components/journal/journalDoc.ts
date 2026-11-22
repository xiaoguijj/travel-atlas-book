import { JOURNAL_MEDIA_NODE_NAME, type JournalContent, type JournalDocument, type JournalNode } from '../../data/contracts';
import { assertJournalContent } from '../../data/validation';

/**
 * Journal 文档的纯函数帮手（V1-07）。
 *
 * 这里不放任何 React、也不放 Tiptap：编辑器要用的「空白一页长什么样」「这页算不算没写」
 * 「读回来的形状对不对」三条判断，抽出来才能在 node 环境里直接测。
 * 文档本身的结构仍然以 V1-02 冻结的 `JournalContent`（`{ doc: JournalDocument }`）为准。
 */

/** 一本书的横线上还没有任何东西时，文档就是这样一页空纸。 */
export function emptyJournal(): JournalContent {
  return { doc: { type: 'doc', content: [{ type: 'paragraph' }] } };
}

/**
 * 交给 Tiptap 之前的形状检查：这本书没写过就给空页，写过但形状不对也给空页 ——
 * 记录里躺着一份打不开的文档，不该让整页白屏。返回值和传进来的 `content.doc` 不是同一个对象，
 * 就说明走了退路，调用方（手账壳）据此提醒用户「这一页从空白开始，写下去会盖掉原来那份」。
 */
export function journalDocFor(content: JournalContent | undefined): JournalDocument {
  if (!content) return emptyJournal().doc;
  try {
    assertJournalContent(content);
  } catch {
    return emptyJournal().doc;
  }
  return content.doc;
}

/** 只有空段落、没有文字也没有媒体块，就算「还没动笔」。 */
export function isJournalBlank(content: JournalContent | undefined): boolean {
  if (!content) return true;
  return countText(content.doc) === 0 && !hasMedia(content.doc);
}

function countText(node: JournalNode): number {
  if (typeof node.text === 'string') return node.text.trim().length;
  return (node.content ?? []).reduce((sum, child) => sum + countText(child), 0);
}

function hasMedia(node: JournalNode): boolean {
  if (node.type === JOURNAL_MEDIA_NODE_NAME) return true;
  return (node.content ?? []).some(hasMedia);
}
