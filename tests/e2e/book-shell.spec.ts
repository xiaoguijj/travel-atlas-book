import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { readBook, readPhotoCount, seedBook, seedBooks } from './book-helpers';

const BOOK_A = 'book-nanjing-a';
const BOOK_B = 'book-nanjing-b';
const TITLE_A = '南京 · 梧桐手账';
const TITLE_B = '玄武湖散步';

function watchRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function waitSaved(page: Page): Promise<void> {
  await expect(page.locator('[data-state="saved"]')).toContainText('已保存', { timeout: 10_000 });
}

/** Exercise the real contenteditable, including Enter-created paragraphs. */
async function fillJournal(page: Page, text: string): Promise<void> {
  const editor = page.getByLabel('手账正文', { exact: true });
  const [first, ...rest] = text.split('\n');
  await editor.fill(first);
  for (const line of rest) {
    await editor.press('Enter');
    await page.keyboard.insertText(line);
  }
}

async function expectJournal(page: Page, text: string): Promise<void> {
  await expect(page.getByLabel('手账正文', { exact: true }).locator(':scope > p')).toHaveText(text.split('\n'));
}

function journalHasText(book: { journal?: { doc: { content?: unknown[] } } } | undefined, text: string): boolean {
  return JSON.stringify(book?.journal ?? null).includes(text);
}

test('mode selection page, mode URLs, refresh, back and invalid IDs', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await seedBooks(page, [seedBook(BOOK_A, TITLE_A)]);

  await page.goto(`/#/book/${BOOK_A}`);
  await expect(page.getByRole('heading', { level: 1, name: '南京 · Nanjing — 选择你的创作方式' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Journal 横线日记本，开始写南京这一页' })).toHaveAttribute(
    'href',
    `#/book/${BOOK_A}?mode=journal`,
  );
  await expect(page.getByRole('link', { name: 'Collage 自由拼贴，开始拼贴南京这一页' })).toHaveAttribute(
    'href',
    `#/book/${BOOK_A}?mode=collage`,
  );
  await expect(page.getByRole('link', { name: '返回邮票收藏册', exact: true })).toHaveAttribute(
    'href',
    '#/section/journals?cityId=nanjing',
  );

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: '南京 · Nanjing — 选择你的创作方式' })).toBeVisible();
  await page.getByRole('link', { name: '返回邮票收藏册', exact: true }).click();
  await page.waitForURL(/section\/journals\?cityId=nanjing/);
  await expect(page.getByRole('heading', { level: 1, name: '中国城市手账 · China Travel Stamps' })).toBeVisible();
  await expect(page.getByRole('button', { name: /南京 Nanjing 邮票/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: new RegExp(TITLE_A) })).toBeVisible();

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expect(page.getByLabel('手账正文', { exact: true })).toBeVisible();
  await page.waitForURL(/mode=journal/);

  await page.goto(`/#/book/${BOOK_A}?mode=collage`);
  await expect(page.getByRole('heading', { name: '自由拼贴画布' })).toBeVisible();

  await page.goto(`/#/book/${BOOK_A}?mode=unknown`);
  await expect(page.getByRole('heading', { level: 1, name: '南京 · Nanjing — 选择你的创作方式' })).toBeVisible();
  await expect(page.locator('a[href*="mode=journal"]')).toBeVisible();

  await page.goto('/#/book/missing-book');
  await expect(page.getByRole('heading', { name: '没有这本手账' })).toBeVisible();
  await expect(page.getByRole('link', { name: '返回邮票收藏册' }).first()).toHaveAttribute(
    'href',
    /#\/section\/journals/,
  );

  await page.goto('/#/stamps?cityId=nanjing');
  await page.waitForURL(/section\/journals\?cityId=nanjing/);
  await expect(page.getByRole('heading', { level: 1, name: '中国城市手账 · China Travel Stamps' })).toBeVisible();
  await expect(page.getByRole('button', { name: /南京 Nanjing 邮票/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: new RegExp(TITLE_A) })).toBeVisible();

  await page.goto('/#/stamps?cityId=atlantis');
  await page.waitForURL(/section\/journals$/);
  await expect(page.getByRole('heading', { level: 1, name: '中国城市手账 · China Travel Stamps' })).toBeVisible();
  await expect(page.getByRole('button', { name: /邮票，.*翻开这一城的手账书架/ })).toHaveCount(6);
  await expect(page.getByRole('button', { name: /南京 Nanjing 邮票/ })).toHaveAttribute('aria-expanded', 'false');

  expect(errors).toEqual([]);
});

test('journal title and body save, refresh and stay isolated between two books', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await seedBooks(page, [seedBook(BOOK_A, TITLE_A), seedBook(BOOK_B, TITLE_B, 'nanjing')]);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expect(page.getByLabel('手账标题')).toHaveValue(TITLE_A);
  await page.getByLabel('手账标题').fill('梧桐手账 · 补记');
  await fillJournal(page, '梧桐落在窗台。\n傍晚去玄武湖。');
  await waitSaved(page);

  const storedA = await readBook(page, BOOK_A);
  expect(storedA?.title).toBe('梧桐手账 · 补记');
  expect(journalHasText(storedA, '梧桐落在窗台')).toBe(true);

  await page.reload();
  await expect(page.getByLabel('手账标题')).toHaveValue('梧桐手账 · 补记');
  await expectJournal(page, '梧桐落在窗台。\n傍晚去玄武湖。');

  await page.goto(`/#/book/${BOOK_B}?mode=journal`);
  await expect(page.getByLabel('手账标题')).toHaveValue(TITLE_B);
  await expectJournal(page, '');
  await fillJournal(page, '玄武湖的风从桥洞里穿过去。');
  await waitSaved(page);

  const storedB = await readBook(page, BOOK_B);
  expect(storedB?.title).toBe(TITLE_B);
  expect(journalHasText(storedB, '玄武湖的风')).toBe(true);
  expect(journalHasText(storedB, '梧桐落在窗台')).toBe(false);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expectJournal(page, '梧桐落在窗台。\n傍晚去玄武湖。');
  const reloadedA = await readBook(page, BOOK_A);
  expect(reloadedA?.title).toBe('梧桐手账 · 补记');
  expect(journalHasText(reloadedA, '玄武湖的风')).toBe(false);

  expect(errors).toEqual([]);
});

test('shared asset panel uploads a photo, inserts it and restores the same asset after reload', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await seedBooks(page, [seedBook(BOOK_A, TITLE_A)]);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await page.getByRole('button', { name: '素材', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /挑一张贴进手账/ });
  await expect(dialog).toBeVisible();

  await page.locator('input[type=file]').setInputFiles(resolve('tests/fixtures/atlas-sample.gif'));
  await expect(page.getByRole('alert')).toContainText('仅支持 JPEG、PNG、WebP');

  await page.locator('input[type=file]').setInputFiles(resolve('tests/fixtures/atlas-sample.png'));
  await expect(page.getByText('照片已加入素材')).toBeVisible();
  const tile = page.getByRole('button', { name: /选择照片 atlas-sample\.png/ });
  await expect(tile).toBeVisible();
  await expect(tile).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '使用这张素材' }).click();
  await expect(dialog).toBeHidden();
  const media = page.getByLabel('手账正文', { exact: true }).locator('[data-type="atlasMedia"]');
  await expect(media).toHaveCount(1);
  const assetLabel = media.getByText(/^photo:[^\s]+$/);
  await expect(assetLabel).toBeVisible();
  const assetId = (await assetLabel.innerText()).trim();
  expect(assetId).toMatch(/^photo:/);
  const photo = media.getByRole('img', { name: 'atlas-sample.png', exact: true });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await waitSaved(page);

  expect(await readPhotoCount(page)).toBe(1);
  const stored = await readBook(page, BOOK_A);
  expect(JSON.stringify(stored?.journal)).toContain(assetId);

  await page.reload();
  await expect(page.getByLabel('手账正文', { exact: true })).toBeVisible();
  await expect(media).toHaveCount(1);
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(assetLabel).toHaveText(assetId);

  expect(errors).toEqual([]);
});

test('missing referenced assets show a placeholder instead of breaking the page', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await seedBooks(page, [
    seedBook(BOOK_A, TITLE_A, 'nanjing', {
      journal: {
        doc: {
          type: 'doc',
          content: [
            { type: 'atlasMedia', attrs: { assetId: 'photo:missing-asset' } },
            { type: 'paragraph', content: [{ type: 'text', text: '这页引用了不存在的照片。' }] },
          ],
        },
      },
    }),
  ]);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expect(page.getByText('这页引用了不存在的照片。')).toBeVisible();
  const missingMedia = page.getByLabel('手账正文', { exact: true }).locator('[data-type="atlasMedia"]');
  await expect(missingMedia.getByText('本机素材库里没有「photo:missing-asset」，先占位，素材回来就自动补上。')).toBeVisible();
  await expect(missingMedia.getByRole('button', { name: '取走这一格' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('a pending draft is flushed before switching modes', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await seedBooks(page, [seedBook(BOOK_A, TITLE_A)]);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await page.getByLabel('手账标题').fill('离开前保存的标题');
  await fillJournal(page, '写到一半就切去拼贴。');
  await page.locator('a[href*="mode=collage"]').click();
  await page.waitForURL(/mode=collage/);
  await expect(page.getByRole('heading', { name: '自由拼贴画布' })).toBeVisible();

  const stored = await readBook(page, BOOK_A);
  expect(stored?.title).toBe('离开前保存的标题');
  expect(journalHasText(stored, '写到一半就切去拼贴')).toBe(true);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expectJournal(page, '写到一半就切去拼贴。');

  expect(errors).toEqual([]);
});

test('plan routes keep real exits', async ({ page }) => {
  const errors = watchRuntimeErrors(page);

  await page.goto('/#/section/plans');
  await expect(page.getByRole('heading', { name: '中国愿望地图' })).toBeVisible();
  await page.locator('a[href*="plan/city/nanjing"]').first().click();
  await page.waitForURL(/plan\/city\/nanjing/);
  await expect(page.getByRole('heading', { name: '南京的计划页' })).toBeVisible();

  await page.locator('a[href*="plan/new?cityId=nanjing"]').first().click();
  await page.waitForURL(/plan\/new\?cityId=nanjing/);
  await expect(page.getByRole('heading', { name: '从南京出发' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /南京/ })).toBeChecked();

  await page.goto('/#/plan/city/atlantis');
  await expect(page.getByRole('heading', { name: '地图里没有这座城' })).toBeVisible();
  await expect(page.getByRole('link', { name: '返回愿望地图' })).toBeVisible();

  await page.goto('/#/plan/new');
  await expect(page.getByRole('heading', { name: '新建一趟行程' })).toBeVisible();

  await page.goto('/#/plan/unknown-plan');
  await expect(page.getByRole('heading', { name: '没有这趟行程' })).toBeVisible();
  await expect(page.getByText('unknown-plan')).toBeVisible();

  expect(errors).toEqual([]);
});

test('save failure is reported, retry works and leaving can be cancelled', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await seedBooks(page, [seedBook(BOOK_A, TITLE_A)]);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await page.getByLabel('手账标题').fill('');
  await expect(page.locator('[data-state="error"]')).toContainText('保存失败', { timeout: 10_000 });
  const retry = page.getByRole('button', { name: '重试', exact: true });
  await expect(retry).toHaveCount(1);
  await retry.click();
  await expect(page.locator('[data-state="error"]')).toContainText('保存失败');

  await page.locator('a[href*="mode=collage"]').click();
  const dialog = page.getByRole('dialog', { name: /保存失败，暂时不能离开/ });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByRole('button', { name: '重试保存并离开' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '放弃修改并离开' })).toBeVisible();
  await dialog.getByRole('button', { name: '留在本页' }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel('手账标题').fill('重新写好的标题');
  await waitSaved(page);

  await page.locator('a[href*="mode=collage"]').click();
  await page.waitForURL(/mode=collage/);
  await expect(page.getByRole('heading', { name: '自由拼贴画布' })).toBeVisible();

  const stored = await readBook(page, BOOK_A);
  expect(stored?.title).toBe('重新写好的标题');

  expect(errors).toEqual([]);
});

const STICKER_KEY = `travel-atlas-book.stickers.nanjing.journal.${BOOK_A}`;

async function prepareFailedStickerCheckpoint(page: Page): Promise<string> {
  await seedBooks(page, [seedBook(BOOK_A, TITLE_A)]);
  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await page.evaluate((archiveKey) => {
    const setItem = Storage.prototype.setItem;
    window.addEventListener('test:allow-sticker-writes', () => {
      Storage.prototype.setItem = setItem;
    }, { once: true });
    Storage.prototype.setItem = function (key, value) {
      // Keep checkpoint storage writable so the real pagehide path creates a
      // durable slot owned by this editor, while its main archive cannot save.
      if (key === archiveKey) throw new DOMException('Simulated full archive', 'QuotaExceededError');
      setItem.call(this, key, value);
    };
  }, STICKER_KEY);
  await page.getByRole('button', { name: '插入贴纸', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '贴纸盒', exact: true });
  await picker.getByRole('button', { name: '绿皮火车', exact: true }).click();
  await expect(page.locator('[data-state="error"]')).toBeVisible();
  await picker.getByRole('button', { name: '贴好了', exact: true }).click();
  const keys = await page.evaluate((archiveKey) => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    return Object.keys(localStorage).filter((key) => key.startsWith(archiveKey + '.pending.'));
  }, STICKER_KEY);
  expect(keys).toHaveLength(1);
  return keys[0];
}

async function holdBookStickerLock(holder: Page): Promise<void> {
  await holder.goto('/#/section/inspiration');
  await holder.evaluate((key) => new Promise<void>((held) => {
    void navigator.locks.request(key, () => new Promise<void>((release) => {
      window.addEventListener('test:release-sticker-lock', () => release(), { once: true });
      held();
    }));
  }), STICKER_KEY);
}

test('discard waits for checkpoint deletion and cannot be cancelled or repeated while pending', async ({ page, context }) => {
  const checkpointKey = await prepareFailedStickerCheckpoint(page);
  await page.getByLabel('手账标题').fill('');
  await page.locator('a[href*="mode=collage"]').click();
  const failed = page.getByRole('dialog', { name: '保存失败，暂时不能离开', exact: true });
  await expect(failed).toBeVisible();
  const holder = await context.newPage();
  await holdBookStickerLock(holder);

  // The holder is a separate tab; focus assertions must exercise this tab.
  await page.bringToFront();
  await failed.getByRole('button', { name: '放弃修改并离开', exact: true }).click();
  const pending = page.getByRole('dialog', { name: '正在放弃修改…', exact: true });
  await expect(pending).toBeVisible();
  await expect(pending.getByRole('button', { name: '放弃修改并离开', exact: true })).toBeDisabled();
  await expect(pending.getByRole('button', { name: '重试保存并离开', exact: true })).toBeDisabled();
  await expect(pending.getByRole('button', { name: '留在本页', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(pending).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(pending).toBeFocused();
  await expect(page).toHaveURL(/mode=journal/);
  expect(await page.evaluate((key) => localStorage.getItem(key), checkpointKey)).not.toBeNull();
  expect((await readBook(page, BOOK_A))?.title).toBe(TITLE_A);

  // Once writes work again, cleanup must still respect the completed discard.
  await page.evaluate(() => window.dispatchEvent(new Event('test:allow-sticker-writes')));
  await holder.evaluate(() => window.dispatchEvent(new Event('test:release-sticker-lock')));
  await page.waitForURL(/mode=collage/);
  expect(await page.evaluate((key) => localStorage.getItem(key), checkpointKey)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), STICKER_KEY)).toBeNull();
  expect((await readBook(page, BOOK_A))?.title).toBe(TITLE_A);
  await holder.close();
});

test('failed checkpoint deletion keeps the page and title draft, then permits a discard retry', async ({ page }) => {
  const checkpointKey = await prepareFailedStickerCheckpoint(page);
  await page.evaluate((blockedKey) => {
    const removeItem = Storage.prototype.removeItem;
    window.addEventListener('test:allow-checkpoint-deletion', () => {
      Storage.prototype.removeItem = removeItem;
    }, { once: true });
    Storage.prototype.removeItem = function (key) {
      if (key === blockedKey) throw new DOMException('Simulated denied cleanup', 'SecurityError');
      removeItem.call(this, key);
    };
  }, checkpointKey);
  await page.getByLabel('手账标题').fill('');
  await page.locator('a[href*="mode=collage"]').click();
  const saveFailure = page.getByRole('dialog', { name: '保存失败，暂时不能离开', exact: true });
  await saveFailure.getByRole('button', { name: '放弃修改并离开', exact: true }).click();
  const discardFailure = page.getByRole('dialog', { name: '放弃修改失败，暂时不能离开', exact: true });
  await expect(discardFailure).toContainText('放弃修改未能完成，已留在本页');
  await expect(discardFailure.getByRole('button', { name: '放弃修改并离开', exact: true })).toBeEnabled();
  await expect(discardFailure.getByRole('button', { name: '留在本页', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/mode=journal/);
  await expect(page.getByLabel('手账标题')).toHaveValue('');
  await expect(page.locator('[data-sticker]')).toHaveCount(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), checkpointKey)).not.toBeNull();
  expect((await readBook(page, BOOK_A))?.title).toBe(TITLE_A);

  await page.keyboard.press('Escape');
  await expect(discardFailure).toBeHidden();
  await expect(page.getByLabel('手账标题')).toHaveValue('');
  await page.evaluate(() => window.dispatchEvent(new Event('test:allow-checkpoint-deletion')));
  await page.locator('a[href*="mode=collage"]').click();
  await saveFailure.getByRole('button', { name: '放弃修改并离开', exact: true }).click();
  await page.waitForURL(/mode=collage/);
  expect(await page.evaluate((key) => localStorage.getItem(key), checkpointKey)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), STICKER_KEY)).toBeNull();
  expect((await readBook(page, BOOK_A))?.title).toBe(TITLE_A);
});

test('cancelling an in-flight save prevents its later completion from leaving the page', async ({ page, context }) => {
  const checkpointKey = await prepareFailedStickerCheckpoint(page);
  const holder = await context.newPage();
  await holdBookStickerLock(holder);
  await page.evaluate(() => window.dispatchEvent(new Event('test:allow-sticker-writes')));
  await page.locator('a[href*="mode=collage"]').click();
  const saving = page.getByRole('dialog', { name: '正在保存这一页…', exact: true });
  await expect(saving).toBeVisible();
  await expect(saving.getByRole('button', { name: '留在本页', exact: true })).toBeEnabled();
  await saving.getByRole('button', { name: '留在本页', exact: true }).click();
  await expect(saving).toBeHidden();

  await holder.evaluate(() => window.dispatchEvent(new Event('test:release-sticker-lock')));
  // Wait behind every already queued save, including the cancelled guard's
  // flush, before asserting that its eventual completion cannot navigate.
  await page.evaluate((key) => navigator.locks.request(key, () => undefined), STICKER_KEY);
  await waitSaved(page);
  await expect(page).toHaveURL(/mode=journal/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '手账正文', exact: true })).toBeVisible();
  await expect(page.locator('[data-sticker]')).toHaveCount(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), checkpointKey)).toBeNull();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).pages[0][0].assetId, STICKER_KEY)).toBe('common-train');
  await holder.close();
});
