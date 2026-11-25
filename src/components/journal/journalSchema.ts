import type { Schema } from '@tiptap/pm/model';
import { getSchema, type Extensions, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { AssetQuery, JournalContent, JournalDocument } from '../../data/contracts';
import { assertJournalContent } from '../../data/validation';
import { AtlasMedia } from './AtlasMedia';
import { emptyJournal } from './journalDoc';

/** Loading and editing must use the same extensions, including disabled node types. */
export function createJournalExtensions(assets: AssetQuery): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      dropcursor: false,
      link: { openOnClick: false },
    }),
    AtlasMedia.configure({ assets }),
  ];
}

export type JournalLoadResult =
  | { status: 'ready'; doc: JournalDocument }
  | { status: 'blocked' };

// ProseMirror supplies defaults and may reorder marks, but silently drops unknown
// node and mark attributes while parsing. Inspect each original attribute map.
function hasUnsupportedAttrs(node: JSONContent, schema: Schema): boolean {
  function unsupported(attrs: JSONContent['attrs'], allowed: Record<string, unknown> = {}) {
    return Object.keys(attrs ?? {}).some((key) => !Object.prototype.hasOwnProperty.call(allowed, key));
  }
  if (!node.type) return true;
  return unsupported(node.attrs, schema.nodes[node.type]?.spec.attrs)
    || Boolean(node.marks?.some((mark) => unsupported(mark.attrs, schema.marks[mark.type]?.spec.attrs)))
    || Boolean(node.content?.some((child) => hasUnsupportedAttrs(child, schema)));
}

/**
 * A missing document is a new page. An incompatible stored document is not.
 * Do not replace or mutate that record: the blocked result never mounts an editor
 * and therefore cannot emit an empty onChange into the shared saving queue.
 */
export function prepareJournalDocument(
  content: JournalContent | undefined,
  extensions: Extensions,
): JournalLoadResult {
  const initial = content === undefined ? emptyJournal() : content;
  try {
    assertJournalContent(initial);
    const schema = getSchema(extensions);
    const parsed = schema.nodeFromJSON(initial.doc);
    if (parsed.type !== schema.topNodeType) return { status: 'blocked' };
    parsed.check();
    if (hasUnsupportedAttrs(initial.doc as JSONContent, schema)) return { status: 'blocked' };
    return { status: 'ready', doc: initial.doc };
  } catch {
    return { status: 'blocked' };
  }
}
