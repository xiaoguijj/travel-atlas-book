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
  await expect(page.getByLabel('正文草稿')).toBeVisible();
  await page.waitForURL(/mode=journal/);

  await page.goto(`/#/book/${BOOK_A}?mode=collage`);
  await expect(page.getByRole('heading', { name: '拼贴画布正在裱糊' })).toBeVisible();

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
  await page.getByLabel('正文草稿').fill('梧桐落在窗台。\n傍晚去玄武湖。');
  await waitSaved(page);

  const storedA = await readBook(page, BOOK_A);
  expect(storedA?.title).toBe('梧桐手账 · 补记');
  expect(journalHasText(storedA, '梧桐落在窗台')).toBe(true);

  await page.reload();
  await expect(page.getByLabel('手账标题')).toHaveValue('梧桐手账 · 补记');
  await expect(page.getByLabel('正文草稿')).toHaveValue('梧桐落在窗台。\n傍晚去玄武湖。');

  await page.goto(`/#/book/${BOOK_B}?mode=journal`);
  await expect(page.getByLabel('手账标题')).toHaveValue(TITLE_B);
  await expect(page.getByLabel('正文草稿')).toHaveValue('');
  await page.getByLabel('正文草稿').fill('玄武湖的风从桥洞里穿过去。');
  await waitSaved(page);

  const storedB = await readBook(page, BOOK_B);
  expect(storedB?.title).toBe(TITLE_B);
  expect(journalHasText(storedB, '玄武湖的风')).toBe(true);
  expect(journalHasText(storedB, '梧桐落在窗台')).toBe(false);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expect(page.getByLabel('正文草稿')).toHaveValue('梧桐落在窗台。\n傍晚去玄武湖。');
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
  const assetCode = page.locator('code').filter({ hasText: /^photo:/ });
  await expect(assetCode).toBeVisible();
  const assetId = (await assetCode.textContent())?.trim();
  expect(assetId?.startsWith('photo:')).toBe(true);
  await waitSaved(page);

  expect(await readPhotoCount(page)).toBe(1);
  const stored = await readBook(page, BOOK_A);
  expect(JSON.stringify(stored?.journal)).toContain(assetId ?? '');

  await page.reload();
  await expect(page.getByLabel('正文草稿')).toBeVisible();
  await expect(page.locator('img[alt="已引用素材 1"]')).toBeVisible();
  await expect(page.locator('code').filter({ hasText: /^photo:/ })).toHaveText(assetId ?? '');

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
  await expect(page.getByRole('img', { name: '素材缺失' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('a pending draft is flushed before switching modes', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await seedBooks(page, [seedBook(BOOK_A, TITLE_A)]);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await page.getByLabel('手账标题').fill('离开前保存的标题');
  await page.getByLabel('正文草稿').fill('写到一半就切去拼贴。');
  await page.locator('a[href*="mode=collage"]').click();
  await page.waitForURL(/mode=collage/);
  await expect(page.getByRole('heading', { name: '拼贴画布正在裱糊' })).toBeVisible();

  const stored = await readBook(page, BOOK_A);
  expect(stored?.title).toBe('离开前保存的标题');
  expect(journalHasText(stored, '写到一半就切去拼贴')).toBe(true);

  await page.goto(`/#/book/${BOOK_A}?mode=journal`);
  await expect(page.getByLabel('正文草稿')).toHaveValue('写到一半就切去拼贴。');

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
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '拼贴画布正在裱糊' })).toBeVisible();

  const stored = await readBook(page, BOOK_A);
  expect(stored?.title).toBe('重新写好的标题');

  expect(errors).toEqual([]);
});