import type { Schema } from '@tiptap/pm/model';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasOnlyFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return Reflect.ownKeys(value).every((key) => typeof key === 'string' && fields.includes(key));
}

function isArrayOf(value: unknown, accepts: (item: unknown) => boolean): boolean {
  if (!Array.isArray(value) || Reflect.ownKeys(value).length !== value.length + 1) return false;
  // Array.every skips holes; JSON arrays cannot have holes or extra metadata.
  for (let index = 0; index < value.length; index += 1) {
    if (!hasOwn(value, index) || !accepts(value[index])) return false;
  }
  return true;
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? isArrayOf(value, (item) => isJsonValue(item, ancestors))
    : isRecord(value) && Reflect.ownKeys(value).every(
      (key) => typeof key === 'string' && isJsonValue(value[key], ancestors),
    );
  ancestors.delete(value);
  return valid;
}

function supportsAttrs(attrs: unknown, allowed: Record<string, unknown> = {}): boolean {
  // Omitted/null maps use schema defaults. Explicit values must survive parsing;
  // in particular, an undefined attribute would silently become its default.
  if (attrs === undefined || attrs === null) return true;
  return isRecord(attrs) && Reflect.ownKeys(attrs).every(
    (key) => typeof key === 'string' && hasOwn(allowed, key) && isJsonValue(attrs[key]),
  );
}

function supportsRawMark(mark: unknown, schema: Schema): boolean {
  if (!isRecord(mark) || !hasOnlyFields(mark, ['type', 'attrs'])) return false;
  if (!hasOwn(mark, 'type') || typeof mark.type !== 'string' || !hasOwn(schema.marks, mark.type)) return false;
  return supportsAttrs(mark.attrs, schema.marks[mark.type].spec.attrs);
}

// Parsing is deliberately permissive: paragraph.text, text.content and unknown
// metadata disappear before Node.check runs. Validate the original shape first.
// Do not compare whole serialized documents: defaults and mark ordering are valid
// normalizations and must not lock otherwise supported journals out of editing.
function supportsRawNode(node: unknown, schema: Schema): boolean {
  if (!isRecord(node) || !hasOwn(node, 'type') || typeof node.type !== 'string') return false;
  if (!hasOwn(schema.nodes, node.type)) return false;
  const type = schema.nodes[node.type];
  const fields = type.isText ? ['type', 'attrs', 'text', 'marks'] : ['type', 'attrs', 'content', 'marks'];
  if (!hasOnlyFields(node, fields) || !supportsAttrs(node.attrs, type.spec.attrs)) return false;
  if (node.marks !== undefined && !isArrayOf(node.marks, (mark) => supportsRawMark(mark, schema))) return false;
  if (type.isText) return typeof node.text === 'string' && node.text.length > 0;
  return node.content === undefined || isArrayOf(node.content, (child) => supportsRawNode(child, schema));
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
    if (!isRecord(initial) || !hasOnlyFields(initial, ['doc']) || !hasOwn(initial, 'doc')) return { status: 'blocked' };
    assertJournalContent(initial);
    const schema = getSchema(extensions);
    if (!supportsRawNode(initial.doc, schema)) return { status: 'blocked' };
    const parsed = schema.nodeFromJSON(initial.doc);
    if (parsed.type !== schema.topNodeType) return { status: 'blocked' };
    parsed.check();
    return { status: 'ready', doc: initial.doc };
  } catch {
    return { status: 'blocked' };
  }
}
