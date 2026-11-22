import { describe, expect, it } from 'vitest';
import {
  bookModePath,
  bookPath,
  collageBookPath,
  journalBookPath,
  readBookMode,
} from '../../../src/config/routes';
import { DataError } from '../../../src/data/contracts';

describe('book route contract', () => {
  it('builds the mode selection, journal and collage URLs from one book id', () => {
    expect(bookPath('abc')).toBe('/book/abc');
    expect(journalBookPath('abc')).toBe('/book/abc?mode=journal');
    expect(collageBookPath('abc')).toBe('/book/abc?mode=collage');
    expect(bookModePath('abc', 'journal')).toBe('/book/abc?mode=journal');
  });

  it('encodes path segments and rejects empty ids', () => {
    expect(bookPath('a/b c')).toBe('/book/a%2Fb%20c');
    expect(() => bookPath('   ')).toThrow(DataError);
  });

  it('falls back to the mode selection page for missing or unknown modes', () => {
    expect(readBookMode(new URLSearchParams(''))).toBeUndefined();
    expect(readBookMode(new URLSearchParams('mode='))).toBeUndefined();
    expect(readBookMode(new URLSearchParams('mode=unknown'))).toBeUndefined();
    expect(readBookMode(new URLSearchParams('mode=journal'))).toBe('journal');
    expect(readBookMode(new URLSearchParams('mode=collage'))).toBe('collage');
    expect(readBookMode(new URLSearchParams('mode=JOURNAL'))).toBeUndefined();
  });
});