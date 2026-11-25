import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStickerSaveController } from '../../../src/stickers/saveController';
import { readStickerDocument, stickerKey, writeStickerDocument } from '../../../src/stickers/storage';
import type { StickerDocument, StickerInstance, StickerScope } from '../../../src/stickers/types';

const scope: StickerScope = { cityId: 'nanjing', mode: 'journal', journalId: 'stored-book' };
const key = stickerKey(scope);
const repository = { read: readStickerDocument, write: writeStickerDocument };

function instance(index = 0): StickerInstance {
  return { instanceId: `instance-${index}`, assetId: 'common-train', x: 0.5, y: 0.4, scale: 1, rotation: -4, z: index + 1 };
}

function document(): StickerDocument {
  return { version: 1, pages: [[instance()]] };
}

function fakeStorage() {
  const records = new Map<string, string>();
  return {
    records,
    getItem: vi.fn((name: string): string | null => records.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => { records.set(name, value); }),
  };
}

describe('sticker storage preserves existing documents', () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('treats only a missing key as a new empty document', () => {
    expect(readStickerDocument(scope)).toEqual({ version: 1, pages: [[]] });
    expect(storage.setItem).not.toHaveBeenCalled();
    storage.records.set(key, '');
    expect(() => readStickerDocument(scope)).toThrow();
    expect(storage.records.get(key)).toBe('');
  });

  it('round-trips all 121 stickers and all 201 pages without truncation', () => {
    const doc: StickerDocument = { version: 1, pages: Array.from({ length: 201 }, () => []) };
    doc.pages[0] = Array.from({ length: 121 }, (_, i) => instance(i));
    doc.pages[200] = [instance(201)];

    expect(writeStickerDocument(scope, doc)).toBe(true);
    const loaded = readStickerDocument(scope);
    expect(loaded).toEqual(doc);
    expect(loaded.pages[0]).toHaveLength(121);
    expect(loaded.pages[200]).toEqual([instance(201)]);
    expect(writeStickerDocument(scope, loaded)).toBe(true);
    expect(readStickerDocument(scope)).toEqual(doc);
  });

  const invalidDocuments: [string, string][] = [
    ['broken JSON', '{"version":1,"pages":'],
    ['wrong root type', '[]'],
    ['unsupported version', JSON.stringify({ ...document(), version: 2 })],
    ['missing version', JSON.stringify({ pages: [[]] })],
    ['wrong pages type', JSON.stringify({ version: 1, pages: {} })],
    ['wrong page type', JSON.stringify({ version: 1, pages: [null] })],
    ['invalid instance', JSON.stringify({ version: 1, pages: [[null]] })],
    ['unknown asset', JSON.stringify({ version: 1, pages: [[{ ...instance(), assetId: 'future-asset' }]] })],
    ['missing identity', JSON.stringify({ version: 1, pages: [[{ ...instance(), instanceId: '' }]] })],
    ['invalid position', JSON.stringify({ version: 1, pages: [[{ ...instance(), x: '0.5' }]] })],
    ['out-of-range size', JSON.stringify({ version: 1, pages: [[{ ...instance(), scale: 10 }]] })],
    ['invalid angle', JSON.stringify({ version: 1, pages: [[{ ...instance(), rotation: null }]] })],
    ['duplicate identity', JSON.stringify({ version: 1, pages: [[instance(), instance()]] })],
  ];

  it.each(invalidDocuments)('blocks %s without dropping fields, clearing data or saving an empty replacement', (_label, raw) => {
    storage.records.set(key, raw);
    const controller = createStickerSaveController(scope, repository);
    expect(controller.getSnapshot()).toMatchObject({ readBlocked: true, status: 'unavailable', dirty: false });
    expect(controller.getSnapshot().lastSavedAt).toBeUndefined();

    controller.update(document(), true);
    controller.discardPending();
    expect(controller.flush()).toBe(true); // no unsaved edit, so normal navigation is allowed
    expect(controller.retry()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ readBlocked: true, status: 'unavailable', dirty: false });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.records.get(key)).toBe(raw);
  });

  it('keeps the original raw value after read access is denied, then restores it by retrying only the read', () => {
    const raw = JSON.stringify(document(), null, 2);
    storage.records.set(key, raw);
    storage.getItem.mockImplementationOnce(() => { throw new Error('Storage read denied'); });
    const controller = createStickerSaveController(scope, repository);
    expect(controller.getSnapshot().readBlocked).toBe(true);
    controller.update({ version: 1, pages: [[]] }, true);
    controller.discardPending();
    controller.flush();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.records.get(key)).toBe(raw);

    expect(controller.retry()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ doc: document(), readBlocked: false, status: 'saved', dirty: false });
    expect(controller.getSnapshot().lastSavedAt).toBeUndefined();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.records.get(key)).toBe(raw);

    controller.update({ version: 1, pages: [[instance(), instance(1)]] }, true);
    expect(readStickerDocument(scope).pages[0]).toHaveLength(2);
  });

  it('preserves compatible extra metadata rather than stripping it during a read and write', () => {
    const doc = { ...document(), note: { importedFrom: 'backup' } };
    const raw = JSON.stringify(doc);
    storage.records.set(key, raw);
    const loaded = readStickerDocument(scope);
    expect(loaded).toEqual(doc);
    expect(writeStickerDocument(scope, loaded)).toBe(true);
    expect(storage.records.get(key)).toBe(raw);
  });

  it('does not report a successful save for a document that cannot be read back safely', () => {
    const raw = JSON.stringify(document());
    storage.records.set(key, raw);
    const invalid = document();
    invalid.pages[0][0].x = Number.NaN;
    expect(writeStickerDocument(scope, invalid)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.records.get(key)).toBe(raw);
  });
});
