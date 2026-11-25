import { describe, expect, it } from 'vitest';
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
