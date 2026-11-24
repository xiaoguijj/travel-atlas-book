import { getSchema, type Extensions } from '@tiptap/core';
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
    return { status: 'ready', doc: initial.doc };
  } catch {
    return { status: 'blocked' };
  }
}
