import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import type { AssetQuery, JournalContent, JournalNode } from '../../../src/data/contracts';
import { assertJournalContent } from '../../../src/data/validation';
import {
  createJournalExtensions,
  prepareJournalDocument,
} from '../../../src/components/journal/journalSchema';

const assets: AssetQuery = {
  async listAssets() { return []; },
  async getAsset() { return undefined; },
};

function document(...content: JournalNode[]): JournalContent {
  return { doc: { type: 'doc', content } };
}

const paragraph = (text: string): JournalNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

describe('loading a Journal with the actual editor schema', () => {
  const extensions = createJournalExtensions(assets);

  it('creates a writable empty paragraph only for a new book', () => {
    expect(prepareJournalDocument(undefined, extensions)).toEqual({
      status: 'ready',
      doc: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
  });

  it('preserves supported formatting and media references without mutating stored content', () => {
    const stored = document(
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '南京的梧桐', marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }] },
          { type: 'hardBreak' },
          { type: 'text', text: '网址', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
        ],
      },
      { type: 'atlasMedia', attrs: { assetId: 'photo:kept', caption: '旅途照片' } },
      { type: 'paragraph' },
    );
    const before = JSON.stringify(stored);
    const result = prepareJournalDocument(stored, extensions);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.doc).toBe(stored.doc);
    expect(JSON.stringify(stored)).toBe(before);
  });

  it('blocks a repository-valid heading instead of replacing surrounding paragraphs with an empty page', () => {
    const stored = document(
      paragraph('这一段不能丢'),
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '旧标题' }] },
      paragraph('这一段也不能丢'),
    );
    expect(() => assertJournalContent(stored)).not.toThrow();
    const before = JSON.stringify(stored);
    expect(prepareJournalDocument(stored, extensions)).toEqual({ status: 'blocked' });
    expect(JSON.stringify(stored)).toBe(before);
  });

  it.each([
    ['text on a paragraph', document({ type: 'paragraph', text: '这一段旧正文必须保留' })],
    ['text on the document root', { doc: { type: 'doc', text: '旧正文', content: [paragraph('可见正文')] } }],
    ['children inside a text node', document({
      type: 'paragraph',
      content: [{ type: 'text', text: '可见正文', content: [{ type: 'text', text: '不能丢的子内容' }] }],
    })],
    ['metadata on the content envelope', { ...document(paragraph('旧正文')), revision: 'legacy-7' } as JournalContent],
    ['metadata on the document root', { doc: { type: 'doc', version: 7, content: [paragraph('旧正文')] } }],
    ['metadata on a node', document({ ...paragraph('旧正文'), id: 'legacy-paragraph-7' })],
    ['metadata on a mark', document({
      type: 'paragraph',
      content: [{ type: 'text', text: '旧正文', marks: [{ type: 'bold', annotation: '旧注释' }] }],
    })],
  ] satisfies [string, JournalContent][])('blocks repository-valid data the parser would discard: %s', (_name, stored) => {
    const before = structuredClone(stored);
    expect(() => assertJournalContent(stored)).not.toThrow();
    const parsed = getSchema(extensions).nodeFromJSON(stored.doc);
    expect(() => parsed.check()).not.toThrow();
    expect({ doc: parsed.toJSON() }).not.toEqual(stored);

    expect(prepareJournalDocument(stored, extensions)).toEqual({ status: 'blocked' });
    expect(stored).toStrictEqual(before);
  });

  it.each([
    ['a null content envelope', null],
    ['a null document root', { doc: null }],
    ['a null child', { doc: { type: 'doc', content: [null] } }],
    ['a missing array entry', { doc: { type: 'doc', content: Array<JournalNode>(1) } }],
    ['metadata attached to a content array', {
      doc: { type: 'doc', content: Object.assign([paragraph('旧正文')], { recoveryNote: '必须保留的恢复信息' }) },
    }],
    ['a null content array', { doc: { type: 'doc', content: [{ type: 'paragraph', content: null }] } }],
    ['a null mark array', document({ ...paragraph('旧正文'), marks: null })],
    ['a null mark', document({
      type: 'paragraph', content: [{ type: 'text', text: '旧正文', marks: [null] }],
    })],
    ['an array used as node attributes', document({ ...paragraph('旧正文'), attrs: [] } as unknown as JournalNode)],
    ['a primitive used as node attributes', document({ ...paragraph('旧正文'), attrs: false } as unknown as JournalNode)],
    ['an array used as mark attributes', document({
      type: 'paragraph', content: [{ type: 'text', text: '旧正文', marks: [{ type: 'bold', attrs: [] }] }],
    })],
    ['an explicit undefined attribute', document({ type: 'atlasMedia', attrs: { assetId: 'photo:kept', caption: undefined } })],
    ['a non-finite attribute', document({ type: 'atlasMedia', attrs: { assetId: 'photo:kept', caption: Number.NaN } })],
    ['a non-JSON attribute', document({ type: 'atlasMedia', attrs: { assetId: 'photo:kept', caption: new Date(0) } })],
  ] satisfies [string, unknown][])('keeps malformed stored data untouched: %s', (_name, stored) => {
    const before = structuredClone(stored);
    expect(prepareJournalDocument(stored as JournalContent, extensions)).toEqual({ status: 'blocked' });
    expect(stored).toStrictEqual(before);
  });

  it('allows schema defaults, null attribute maps and mark reordering without mutating the original', () => {
    const stored: JournalContent = {
      doc: {
        type: 'doc',
        attrs: null,
        content: [
          {
            type: 'paragraph',
            attrs: {},
            content: [{
              type: 'text', text: '南京的梧桐', attrs: null,
              marks: [{ type: 'underline', attrs: null }, { type: 'italic' }, { type: 'bold' }],
            }],
          },
          { type: 'atlasMedia', attrs: { assetId: 'photo:kept' } },
          { type: 'paragraph', content: [], marks: [] },
        ],
      },
    };
    const before = structuredClone(stored);
    const result = prepareJournalDocument(stored, extensions);
    expect(result).toEqual({ status: 'ready', doc: stored.doc });
    if (result.status === 'ready') expect(result.doc).toBe(stored.doc);
    expect(stored).toStrictEqual(before);

    const normalized = getSchema(extensions).nodeFromJSON(stored.doc).toJSON();
    expect(normalized).not.toEqual(stored.doc);
    expect(normalized.content[0].content[0].marks).toEqual([{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }]);
    expect(normalized.content[1].attrs).toEqual({ assetId: 'photo:kept', caption: '' });
  });

  it('preserves explicit null values in supported link attributes', () => {
    const attrs = { href: 'https://example.com', target: null, rel: null, class: null };
    const stored = document({
      type: 'paragraph', content: [{ type: 'text', text: '网址', marks: [{ type: 'link', attrs }] }],
    });
    const before = structuredClone(stored);
    expect(prepareJournalDocument(stored, extensions)).toEqual({ status: 'ready', doc: stored.doc });
    expect(getSchema(extensions).nodeFromJSON(stored.doc).toJSON().content[0].content[0].marks[0].attrs).toMatchObject(attrs);
    expect(stored).toStrictEqual(before);
  });

  it.each([
    ['unknown mark metadata', document({
      type: 'paragraph', content: [{ type: 'text', text: '原文', marks: [{ type: 'bold', attrs: { weight: 800 } }] }],
    })],
    ['unknown media metadata', document({ type: 'atlasMedia', attrs: { assetId: 'photo:kept', crop: [0, 0, 50, 50] } })],
    ['an unknown node', document(paragraph('保留正文'), { type: 'futureWidget' })],
    ['an unknown mark', document({
      type: 'paragraph',
      content: [{ type: 'text', text: '保留正文', marks: [{ type: 'futureMark' }] }],
    })],
    ['invalid nesting', document({ type: 'paragraph', content: [paragraph('错误嵌套的正文')] })],
    ['a malformed media ID', document({ type: 'atlasMedia', attrs: { assetId: 'invalid' } })],
    ['an invalid document root', { doc: { type: 'paragraph' } } as unknown as JournalContent],
  ] satisfies [string, JournalContent][])('blocks %s without returning a writable fallback', (_name, stored) => {
    const before = JSON.stringify(stored);
    expect(prepareJournalDocument(stored, extensions)).toEqual({ status: 'blocked' });
    expect(JSON.stringify(stored)).toBe(before);
  });
});
