import { expect, test, type Page } from '@playwright/test';
import type { StickerDocument } from '../../src/stickers/types';
import { seedBook, seedBooks } from './book-helpers';

const BOOK_A = 'sticker-safety-a';
const BOOK_B = 'sticker-safety-b';
const keyFor = (bookId: string, mode = 'journal') => `travel-atlas-book.stickers.nanjing.${mode}.${bookId}`;

async function openBook(page: Page): Promise<void> {
  await seedBooks(page, [seedBook(BOOK_A, '贴纸保存验证'), seedBook(BOOK_B, '另一本手账')]);
  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expect(page.getByRole('button', { name: '插入贴纸', exact: true })).toBeVisible();
}

async function readStickers(page: Page, bookId = BOOK_A): Promise<StickerDocument | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as StickerDocument | null, keyFor(bookId));
}

async function addSticker(page: Page, bookId = BOOK_A): Promise<StickerDocument | null> {
  await page.getByRole('button', { name: '插入贴纸', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '贴纸盒' });
  // Click and inspect storage in one browser task: a 350ms debounce cannot pass by accident.
  const immediatelySaved = await picker.getByRole('button', { name: '绿皮火车', exact: true }).evaluate((button, key) => {
    (button as HTMLButtonElement).click();
    return JSON.parse(localStorage.getItem(key) ?? 'null') as StickerDocument | null;
  }, keyFor(bookId));
  await picker.getByRole('button', { name: '贴好了', exact: true }).click();
  await expect(page.locator('[data-sticker]')).toHaveCount(1);
  return immediatelySaved;
}

type LeaveAction = 'mode' | 'reload' | 'pagehide' | 'hidden' | 'pointerup';

async function moveStickerAndAct(page: Page, action: LeaveAction) {
  return page.evaluate(({ action, key }) => {
    const node = document.querySelector<HTMLElement>('[data-sticker]')!;
    const layer = document.querySelector<HTMLElement>('[data-sticker-layer]')!;
    const original = (JSON.parse(localStorage.getItem(key)!) as StickerDocument).pages[0][0];
    const box = node.getBoundingClientRect();
    const canvas = layer.getBoundingClientRect();
    const startX = box.left + box.width / 2;
    const startY = box.top + box.height / 2;
    const pointer = { bubbles: true, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
    // Keep the edit and save/leave signal in one JS task: a debounce timer cannot
    // run between them. A wall-clock limit would instead make busy CI machines fail.
    node.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: startX, clientY: startY }));
    window.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: startX + 40, clientY: startY + 25 }));
    if (action === 'mode') document.querySelector<HTMLAnchorElement>('a[href*="mode=collage"]')!.click();
    if (action === 'reload') window.setTimeout(() => window.location.reload(), 0);
    if (action === 'pagehide') window.dispatchEvent(new PageTransitionEvent('pagehide'));
    if (action === 'hidden') {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    }
    if (action === 'pointerup') window.dispatchEvent(new PointerEvent('pointerup', { ...pointer, buttons: 0 }));
    return {
      expectedX: Math.min(1, original.x + 40 / canvas.width),
      expectedY: Math.min(1, original.y + 25 / canvas.height),
      saved: JSON.parse(localStorage.getItem(key)!) as StickerDocument,
    };
  }, { action, key: keyFor(BOOK_A) });
}

async function failStickerWrites(page: Page): Promise<void> {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.addEventListener('test:restore-sticker-storage', () => {
      Storage.prototype.setItem = original;
    }, { once: true });
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('travel-atlas-book.stickers.')) throw new DOMException('Simulated full storage', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
}

async function restoreStickerWrites(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('test:restore-sticker-storage')));
}

test('new stickers save immediately, restore after reload, and stay isolated by book and mode', async ({ page }) => {
  await openBook(page);
  const original = await addSticker(page);
  expect(original?.pages[0]).toHaveLength(1);
  await page.reload();
  await expect(page.locator('[data-sticker]')).toHaveCount(1);
  await page.locator('a[href*="mode=collage"]').click();
  await page.waitForURL(/mode=collage/);
  expect(await page.evaluate((key) => localStorage.getItem(key), keyFor(BOOK_A, 'collage'))).toBeNull();
  expect(await readStickers(page)).toEqual(original);

  await page.goto(`/#/book/${BOOK_B}?mode=journal`);
  await expect(page.getByRole('button', { name: '插入贴纸', exact: true })).toBeVisible();
  await expect(page.locator('[data-sticker]')).toHaveCount(0);
  const other = await addSticker(page, BOOK_B);
  expect(other?.pages[0][0].instanceId).not.toBe(original?.pages[0][0].instanceId);
  expect(await readStickers(page, BOOK_A)).toEqual(original);
});

test('a mode switch during an unfinished drag saves before the 350ms timer', async ({ page }) => {
  await openBook(page);
  await addSticker(page);
  const moved = await moveStickerAndAct(page, 'mode');
  await page.waitForURL(/mode=collage/);
  const saved = await readStickers(page);
  expect(saved?.pages[0][0].x).toBeCloseTo(moved.expectedX, 6);
  expect(saved?.pages[0][0].y).toBeCloseTo(moved.expectedY, 6);
  await page.locator('a[href*="mode=journal"]').click();
  await expect(page.locator('[data-sticker]')).toHaveCount(1);
  const restoredLeft = await page.locator('[data-sticker]').evaluate((node) => parseFloat((node as HTMLElement).style.left));
  expect(restoredLeft).toBeCloseTo(Number((moved.expectedX * 100).toFixed(3)), 6);
});

test('refresh during an unfinished drag restores the final position', async ({ page }) => {
  await openBook(page);
  await addSticker(page);
  page.on('dialog', (dialog) => { void dialog.accept(); });
  const navigation = page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() });
  const moved = await moveStickerAndAct(page, 'reload');
  await navigation;
  await expect(page.locator('[data-sticker]')).toHaveCount(1);
  const restored = await readStickers(page);
  expect(restored?.pages[0][0].x).toBeCloseTo(moved.expectedX, 6);
  expect(restored?.pages[0][0].y).toBeCloseTo(moved.expectedY, 6);
});

for (const lifecycle of ['pagehide', 'hidden'] as const) {
  test(`${lifecycle} saves the pending gesture synchronously`, async ({ page }) => {
    await openBook(page);
    await addSticker(page);
    const moved = await moveStickerAndAct(page, lifecycle);
    expect(moved.saved.pages[0][0].x).toBeCloseTo(moved.expectedX, 6);
    expect(moved.saved.pages[0][0].y).toBeCloseTo(moved.expectedY, 6);
  });
}

test('releasing move, scale and rotation handles persists the final values immediately', async ({ page }) => {
  await openBook(page);
  await addSticker(page);
  const moved = await moveStickerAndAct(page, 'pointerup');
  expect(moved.saved.pages[0][0].x).toBeCloseTo(moved.expectedX, 6);
  for (const [label, field] of [['缩放这张贴纸', 'scale'], ['旋转这张贴纸', 'rotation']] as const) {
    const previous = (await readStickers(page))!.pages[0][0][field];
    const next = await page.getByRole('button', { name: new RegExp(`^${label}`) }).evaluate((handle, key) => {
      const box = handle.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const pointer = { bubbles: true, pointerId: 8, pointerType: 'mouse', button: 0, buttons: 1 };
      handle.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: x, clientY: y }));
      window.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: x + 40, clientY: y + 30 }));
      window.dispatchEvent(new PointerEvent('pointerup', { ...pointer, buttons: 0 }));
      return (JSON.parse(localStorage.getItem(key)!) as StickerDocument).pages[0][0];
    }, keyFor(BOOK_A));
    expect(next[field]).not.toBeCloseTo(previous, 4);
  }
});

test('failed sticker storage is visible, keeps the draft, and retries the actual sticker write', async ({ page }) => {
  await openBook(page);
  await failStickerWrites(page);
  expect(await addSticker(page)).toBeNull();
  await expect(page.locator('[data-state="error"]')).toContainText('保存失败');
  await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(1);
  expect(await readStickers(page)).toBeNull();

  await restoreStickerWrites(page);
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('[data-state="saved"]')).toContainText('已保存');
  expect((await readStickers(page))?.pages[0]).toHaveLength(1);
  await page.reload();
  await expect(page.locator('[data-sticker]')).toHaveCount(1);
});

test('sticker-only failure blocks leaving, and explicit discard cannot be saved again during cleanup', async ({ page }) => {
  await openBook(page);
  await failStickerWrites(page);
  await addSticker(page);
  await page.locator('a[href*="mode=collage"]').click();
  const guard = page.getByRole('dialog', { name: '保存失败，暂时不能离开' });
  await expect(guard).toBeVisible();
  await expect(page).toHaveURL(/mode=journal/);

  // Make storage writable before discarding: an unconditional cleanup flush would now resurrect it.
  await restoreStickerWrites(page);
  await guard.getByRole('button', { name: '放弃修改并离开', exact: true }).click();
  await page.waitForURL(/mode=collage/);
  expect(await readStickers(page)).toBeNull();
  await page.locator('a[href*="mode=journal"]').click();
  await expect(page.getByRole('button', { name: '插入贴纸', exact: true })).toBeVisible();
  await expect(page.locator('[data-sticker]')).toHaveCount(0);
});

test('an unreadable original archive disables insertion, stays untouched after retry, and permits leaving', async ({ page }) => {
  await seedBooks(page, [seedBook(BOOK_A, '保留旧贴纸存档')]);
  const original = '{"version":1,"pages":broken';
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: keyFor(BOOK_A), raw: original });
  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expect(page.locator('[data-state="error"]')).toBeVisible();
  await page.getByRole('button', { name: '插入贴纸', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '贴纸盒' });
  await expect(picker.getByRole('button', { name: '绿皮火车', exact: true })).toBeDisabled();
  await expect(picker.getByText(/原数据已保留/)).toBeVisible();
  await picker.getByRole('button', { name: '贴好了', exact: true }).click();
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('[data-state="error"]')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), keyFor(BOOK_A))).toBe(original);

  await page.locator('a[href*="mode=collage"]').click();
  await page.waitForURL(/mode=collage/);
  expect(await page.evaluate((key) => localStorage.getItem(key), keyFor(BOOK_A))).toBe(original);
});
