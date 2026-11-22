import { describe, expect, it } from 'vitest';
import {
  artBoxStyle,
  artCqw,
  journalArt,
  journalRules,
  journalToolbarBox,
  journalWritingBox,
} from '../../../src/config/journal';
import { emptyJournal, isJournalBlank, journalDocFor } from '../../../src/components/journal/journalDoc';
import {
  JOURNAL_MEDIA_NODE_NAME,
  type JournalContent,
  type JournalDocument,
  type JournalNode,
} from '../../../src/data/contracts';
import { assertJournalContent } from '../../../src/data/validation';

/**
 * V1-07 横线日记本的纯函数部分：空页形状、损坏记录的退路、「算不算动过笔」，
 * 以及正文里那一格媒体必须遵守的 V1-02 冻结契约（只存素材 ID）。
 * 渲染本身（Tiptap 需要真 DOM）留给 tests/e2e 与本地预览。
 */

function doc(...content: JournalNode[]): JournalContent {
  return { doc: { type: 'doc', content } as JournalDocument };
}

function paragraph(...text: string[]): JournalNode {
  return {
    type: 'paragraph',
    content: text.map((t) => ({ type: 'text', text: t })),
  };
}

function media(assetId: string, caption?: string): JournalNode {
  return { type: JOURNAL_MEDIA_NODE_NAME, attrs: { assetId, ...(caption ? { caption } : {}) } };
}

describe('journal document helpers', () => {
  it('starts a book with one empty paragraph and nothing else', () => {
    const blank = emptyJournal();
    expect(blank).toEqual({ doc: { type: 'doc', content: [{ type: 'paragraph' }] } });
    expect(() => assertJournalContent(blank)).not.toThrow();
    expect(isJournalBlank(blank)).toBe(true);
  });

  it('treats a missing content field as a blank page', () => {
    expect(isJournalBlank(undefined)).toBe(true);
    expect(journalDocFor(undefined)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('counts whitespace-only text as still unwritten', () => {
    expect(isJournalBlank(doc(paragraph('   '), paragraph('\n')))).toBe(true);
    expect(isJournalBlank(doc(paragraph('南京的梧桐')))).toBe(false);
  });

  it('counts a page holding only a media block as written', () => {
    // 只贴了一张照片、一个字没写，也不能算空白页：这一版得存下来。
    expect(isJournalBlank(doc(media('photo:1')))).toBe(false);
  });

  it('hands the exact stored doc to the editor when the shape is valid', () => {
    const stored = doc(paragraph('外滩的风'), media('sticker:lotus', '荷花'), media('photo:7'));
    expect(journalDocFor(stored)).toBe(stored.doc);
  });

  it('falls back to a blank page instead of throwing on a corrupt record', () => {
    const cases: JournalContent[] = [
      { doc: { type: 'paragraph' } as unknown as JournalDocument },
      doc(media('not-an-asset-id')),
      doc(media(undefined as unknown as string)),
      { doc: { type: 'doc', content: 'nope' } as unknown as JournalDocument },
    ];
    for (const broken of cases) {
      expect(() => assertJournalContent(broken)).toThrow();
      expect(journalDocFor(broken)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    }
  });
});

describe('journal media node contract', () => {
  it('accepts photo: and sticker: asset ids at any depth', () => {
    const content = doc(paragraph('a'), {
      type: 'blockquote',
      content: [media('photo:9', '西津渡')],
    } as JournalNode);
    expect(() => assertJournalContent(content)).not.toThrow();
    expect(isJournalBlank(content)).toBe(false);
  });

  it('rejects a media node whose attrs carry a non-prefixed asset id', () => {
    // 素材命名空间只有 photo: 与 sticker: 两个前缀，正文里不该出现裸 ID。
    expect(() => assertJournalContent(doc(media('nanjing-001')))).toThrowError(/素材/);
  });
});

describe('journal page geometry', () => {
  it('sizes the writing box to whole ruled lines', () => {
    expect(journalWritingBox.x).toBe(journalRules.left);
    expect(journalWritingBox.w).toBe(journalRules.right - journalRules.left);
    expect(journalWritingBox.h).toBe(journalRules.step * journalRules.writable);
    // 容器顶 = 第一条线往上一个行高再补基线差，第一行基线才会坐在第一条线上。
    expect(journalWritingBox.y).toBe(journalRules.first - journalRules.step + journalRules.nudge);
  });

  it('keeps the toolbar clear of the last writable rule', () => {
    const lastRule = journalRules.first + journalRules.step * (journalRules.writable - 1);
    expect(journalToolbarBox.y).toBeGreaterThan(lastRule);
    expect(journalToolbarBox.y + journalToolbarBox.h).toBeLessThan(journalArt.height);
    expect(journalToolbarBox.x).toBeGreaterThan(journalRules.left);
  });

  it('converts source-image coordinates into viewport-independent units', () => {
    const box = artBoxStyle(journalArt, { x: 144.8, y: 108.6, w: 724, h: 543 });
    expect(box).toEqual({ left: '10.000%', top: '10.000%', width: '50.000%', height: '50.000%' });
    expect(artCqw(journalArt, journalArt.width / 4)).toBe('25.000cqw');
  });
});
