import { expect, test, type Page } from '@playwright/test';
import type { StickerDocument } from '../../src/stickers/types';
import { readBook, seedBook, seedBooks } from './book-helpers';

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

async function addSticker(page: Page, bookId = BOOK_A, expectedCount = 1): Promise<StickerDocument | null> {
  await page.getByRole('button', { name: '插入贴纸', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '贴纸盒' });
  await picker.getByRole('button', { name: '绿皮火车', exact: true }).click();
  await expect(page.locator('[data-state="saved"], [data-state="error"]')).toBeVisible();
  await picker.getByRole('button', { name: '贴好了', exact: true }).click();
  await expect(page.locator('[data-sticker]')).toHaveCount(expectedCount);
  return readStickers(page, bookId);
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
    const schedule = window.setTimeout;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => schedule(handler, delay === 350 ? 60_000 : delay, ...args)) as typeof window.setTimeout;
    node.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: startX, clientY: startY }));
    window.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: startX + 40, clientY: startY + 25 }));
    window.setTimeout = schedule;
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
  await expect.poll(async () => (await readStickers(page))?.pages[0][0].x).toBeCloseTo(moved.expectedX, 6);
  expect((await readStickers(page))?.pages[0][0].y).toBeCloseTo(moved.expectedY, 6);
});

for (const lifecycle of ['pagehide', 'hidden'] as const) {
  test(`${lifecycle} starts saving the pending gesture before the debounce timer`, async ({ page }) => {
    await openBook(page);
    await addSticker(page);
    const moved = await moveStickerAndAct(page, lifecycle);
    await expect.poll(async () => (await readStickers(page))?.pages[0][0].x).toBeCloseTo(moved.expectedX, 6);
    expect((await readStickers(page))!.pages[0][0].y).toBeCloseTo(moved.expectedY, 6);
  });
}

test('releasing move, scale and rotation handles persists the final values immediately', async ({ page }) => {
  await openBook(page);
  await addSticker(page);
  const moved = await moveStickerAndAct(page, 'pointerup');
  await expect.poll(async () => (await readStickers(page))?.pages[0][0].x).toBeCloseTo(moved.expectedX, 6);
  for (const [label, field] of [['缩放这张贴纸', 'scale'], ['旋转这张贴纸', 'rotation']] as const) {
    const previous = (await readStickers(page))!.pages[0][0][field];
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).evaluate((handle) => {
      const box = handle.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const pointer = { bubbles: true, pointerId: 8, pointerType: 'mouse', button: 0, buttons: 1 };
      handle.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: x, clientY: y }));
      window.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: x + 40, clientY: y + 30 }));
      window.dispatchEvent(new PointerEvent('pointerup', { ...pointer, buttons: 0 }));
    });
    await expect.poll(async () => (await readStickers(page))!.pages[0][0][field]).not.toBeCloseTo(previous, 4);
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

test('the shared asset dialog cannot delete a selected canvas sticker', async ({ page }) => {
  await openBook(page);
  const stored = await addSticker(page);
  await page.getByRole('button', { name: '素材', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '挑一张贴进手账' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  const sticker = page.locator('[data-sticker]');
  await expect(sticker).toHaveCount(1);
  expect(await readStickers(page)).toEqual(stored);
  await dialog.getByRole('button', { name: '关闭素材面板' }).click();
  await sticker.focus();
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await readStickers(page))?.pages[0]).toEqual([]);
});

async function holdStickerLock(tab: Page) {
  await tab.evaluate((key) => new Promise<void>((held) => {
    void navigator.locks.request(key, () => new Promise<void>((release) => {
      window.addEventListener('release-test-lock', () => release(), { once: true });
      held();
    }));
  }), keyFor(BOOK_A));
}

test('overlapping saves retain the losing tab’s draft and show a conflict', async ({ page, context }) => {
  await openBook(page);
  const second = await context.newPage();
  await second.goto(`/#/book/${BOOK_A}?mode=journal`);
  await holdStickerLock(page);
  for (const [tab, label] of [[page, '绿皮火车'], [second, '胶片相机']] as const) {
    await tab.getByRole('button', { name: '插入贴纸', exact: true }).click();
    await tab.getByRole('button', { name: label, exact: true }).click();
    await tab.getByRole('button', { name: '贴好了', exact: true }).click();
    await expect(tab.locator('[data-state="saving"]')).toBeVisible();
  }
  expect(await readStickers(page)).toBeNull();
  await page.evaluate(() => window.dispatchEvent(new Event('release-test-lock')));
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expect(second.locator('[data-state="error"]')).toContainText('贴纸保存冲突');
  expect((await readStickers(second))?.pages[0].map((item) => item.assetId)).toEqual(['common-train']);
  await expect(second.locator('[data-sticker] img')).toHaveAttribute('alt', '胶片相机');
});

test('closing a tab while its save waits for a lock leaves a recoverable draft', async ({ page, context }) => {
  await openBook(page);
  const holder = await context.newPage();
  await holder.goto('/#/section/inspiration');
  await holdStickerLock(holder);
  await page.getByRole('button', { name: '插入贴纸', exact: true }).click();
  await page.getByRole('button', { name: '绿皮火车', exact: true }).click();
  await expect(page.locator('[data-state="saving"]')).toBeVisible();
  // A real navigation runs pagehide while the other tab still owns the lock.
  page.on('dialog', (dialog) => { void dialog.accept(); });
  await page.goto('about:blank');
  await page.close();
  expect(await readStickers(holder)).toBeNull();
  await holder.evaluate(() => window.dispatchEvent(new Event('release-test-lock')));
  await holder.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expect(holder.locator('[data-state="saved"]')).toBeVisible();
  expect((await readStickers(holder))?.pages[0].map((item) => item.assetId)).toEqual(['common-train']);
});

test('an idle second tab picks up saved stickers before editing the same journal', async ({ page, context }) => {
  await openBook(page);
  const second = await context.newPage();
  await second.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expect(second.getByRole('button', { name: '插入贴纸', exact: true })).toBeVisible();

  const first = await addSticker(page);
  await expect(second.locator('[data-sticker]')).toHaveCount(1);
  const afterSecond = await addSticker(second, BOOK_A, 2);
  expect(afterSecond?.pages[0][0]).toEqual(first?.pages[0][0]);
  expect(afterSecond?.pages[0][1].instanceId).not.toBe(first?.pages[0][0].instanceId);
  await expect(page.locator('[data-sticker]')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('[data-sticker]')).toHaveCount(2);
});

test('without Web Locks a stale save keeps the draft and protects the newer archive', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await openBook(page);
  const original = (await addSticker(page))!;
  const latest = { ...original, pages: [[{ ...original.pages[0][0], x: 0.8 }]] };
  await page.getByRole('button', { name: '插入贴纸', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '贴纸盒' });
  await picker.getByRole('button', { name: '胶片相机', exact: true }).evaluate((button, { key, latest }) => {
    // Simulate a write whose storage notification has yet to reach this controller.
    localStorage.setItem(key, JSON.stringify(latest));
    (button as HTMLButtonElement).click();
  }, { key: keyFor(BOOK_A), latest });
  await picker.getByRole('button', { name: '贴好了', exact: true }).click();
  await expect(page.locator('[data-sticker]')).toHaveCount(2);
  await expect(page.locator('[data-state="error"]')).toContainText('贴纸保存冲突，草稿已保留');
  expect(await readStickers(page)).toEqual(latest);

  await page.locator('a[href*="mode=collage"]').click();
  const guard = page.getByRole('dialog', { name: '保存失败，暂时不能离开' });
  await expect(guard).toContainText('另一个标签页已更新贴纸');
  await guard.getByRole('button', { name: '放弃修改并离开' }).click();
  await page.waitForURL(/mode=collage/);
  expect(await readStickers(page)).toEqual(latest);
});

test('unused sticker archive does not affect collage title save feedback', async ({ page }) => {
  await seedBooks(page, [seedBook(BOOK_A, '拼贴手账')]);
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), keyFor(BOOK_A, 'collage'));
  await page.goto(`/#/book/${BOOK_A}?mode=collage`);
  await page.getByRole('textbox', { name: '手账标题', exact: true }).fill('拼贴标题已保存');
  await expect(page.locator('[data-state="saved"]')).toContainText('已保存');
  expect((await readBook(page, BOOK_A))?.title).toBe('拼贴标题已保存');
});

test('selected sticker handles follow the paper size without reselecting', async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 850 });
  await openBook(page);
  const instance = (await addSticker(page))!.pages[0][0];
  const sticker = page.locator('[data-sticker]');
  const remove = page.getByRole('button', { name: '删除这张贴纸', exact: true });
  const before = (await remove.boundingBox())!;

  await page.setViewportSize({ width: 1000, height: 620 });
  await expect.poll(() => sticker.evaluate((node, { x, rotation }) => {
    const layer = node.parentElement!;
    const handle = layer.querySelector<HTMLButtonElement>('[aria-label="删除这张贴纸"]')!;
    const angle = rotation * Math.PI / 180;
    const cornerX = layer.clientWidth * x
      + (node as HTMLElement).offsetWidth / 2 * Math.cos(angle)
      + (node as HTMLElement).offsetHeight / 2 * Math.sin(angle);
    return Math.abs(Number.parseFloat(handle.style.left) - cornerX);
  }, instance)).toBeLessThan(1);
  expect(Math.abs((await remove.boundingBox())!.x - before.x)).toBeGreaterThan(80);
  await remove.click();
  await expect(sticker).toHaveCount(0);
});

test('sticker picker wraps focus, contains keyboard shortcuts and restores its opener', async ({ page }) => {
  await openBook(page);
  const opener = page.getByRole('button', { name: '插入贴纸', exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('dialog', { name: '贴纸盒' });
  await expect(picker.getByRole('searchbox')).toBeFocused();

  const sticker = picker.getByRole('button', { name: '绿皮火车', exact: true });
  await sticker.click();
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-sticker]')).toHaveCount(1);

  const close = picker.getByRole('button', { name: '关闭贴纸盒', exact: true });
  const done = picker.getByRole('button', { name: '贴好了', exact: true });
  await done.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(done).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(opener).toBeFocused();
});
