import { expect, test, type Page } from '@playwright/test';
import { readBook } from './book-helpers';

test.describe.configure({ timeout: 90_000 });

const ROOT_ORIGIN = 'http://127.0.0.1:4174';
const SUBPATH_ORIGIN = 'http://127.0.0.1:4175';
const SUBPATH = `${SUBPATH_ORIGIN}/atlas`;

function watchAssets(page: Page) {
  const loaded = new Set<string>();
  const failures: string[] = [];
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (!pathname.includes('/assets/')) return;
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    else if (response.status() === 200 && /\.(png|jpe?g|webp|svg)$/i.test(pathname)) {
      loaded.add(response.url());
    }
  });
  return { loaded, failures };
}

test('the same dist works at the origin root with hash deep links and local images', async ({ page }) => {
  const assets = watchAssets(page);

  await page.goto(`${ROOT_ORIGIN}/#/section/journals`);
  await expect(page.getByRole('heading', { name: '中国城市手账 · China Travel Stamps' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^南京 Nanjing 邮票，/ })).toBeVisible();
  await expect.poll(() => assets.loaded.size).toBeGreaterThan(0);

  await page.goto(`${ROOT_ORIGIN}/#/city/nanjing`);
  await expect(page.getByRole('link', { name: '南京手账书架' })).toBeVisible();

  await page.goto(`${ROOT_ORIGIN}/#/section/plans`);
  await expect(page.getByRole('heading', { name: '中国愿望地图' })).toBeVisible();

  expect(assets.failures).toEqual([]);
});

test('the same dist also works under a fixed subpath without rewrites', async ({ page }) => {
  const assets = watchAssets(page);

  await page.goto(`${SUBPATH}/#/section/journals?cityId=nanjing`);
  await expect(page.getByRole('heading', { name: '中国城市手账 · China Travel Stamps' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^南京 Nanjing 邮票，/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(page.getByRole('button', { name: '新建一本' })).toBeVisible();
  await expect.poll(() => assets.loaded.size).toBeGreaterThan(0);

  await page.goto(`${SUBPATH}/#/book/missing?mode=journal`);
  await expect(page.getByRole('heading', { name: '没有这本手账' })).toBeVisible();

  await page.goto(`${SUBPATH}/#/plan/new?cityId=nanjing`);
  await expect(page.getByRole('heading', { name: '从南京出发' })).toBeVisible();

  await page.goto(`${SUBPATH}/#/plan/missing`);
  await expect(page.getByRole('heading', { name: '没有这趟行程' })).toBeVisible();

  expect(assets.failures).toEqual([]);
});

test('a real book keeps both editors working through /atlas hash deep links', async ({ page }) => {
  const assets = watchAssets(page);

  await page.goto(`${SUBPATH}/#/section/journals`);
  await expect(page.getByRole('heading', { name: '中国城市手账 · China Travel Stamps' })).toBeVisible();
  await page.getByRole('button', { name: /^南京 Nanjing 邮票，/ }).click();
  await page.getByRole('button', { name: '新建一本' }).click();
  await page.waitForURL(/#\/book\/[0-9a-f-]{36}$/);

  const match = new URL(page.url()).hash.match(/#\/book\/([0-9a-f-]{36})$/);
  expect(match).not.toBeNull();
  const bookId = match![1];
  const modeHeading = page.getByRole('heading', { name: /南京 · Nanjing — 选择你的创作方式/ });
  await expect(modeHeading).toBeVisible();

  // 三种书页都按直接输入 hash 地址 + 刷新来验证，而不是只从应用内跳转。
  await page.goto(`${SUBPATH}/#/book/${bookId}`);
  await page.reload();
  await expect(modeHeading).toBeVisible();

  await page.goto(`${SUBPATH}/#/book/${bookId}?mode=journal`);
  await page.reload();
  await expect(page.getByLabel('手账正文', { exact: true })).toBeVisible();
  await page.getByLabel('手账标题').fill('子路径深链手账');
  await page.getByLabel('手账正文', { exact: true }).fill('在 /atlas 下写入并刷新恢复。');
  await expect(page.locator('[data-state="saved"]')).toContainText('已保存');
  await page.reload();
  await expect(page.getByLabel('手账标题')).toHaveValue('子路径深链手账');
  await expect(page.getByLabel('手账正文', { exact: true })).toContainText('在 /atlas 下写入并刷新恢复。');

  await page.goto(`${SUBPATH}/#/book/${bookId}?mode=collage`);
  await page.reload();
  await expect(page.getByRole('region', { name: '拼贴画布', exact: true })).toBeVisible();
  const rail = page.getByRole('toolbar', { name: '素材工具', exact: true });
  await rail.getByRole('button', { name: '城市贴纸', exact: true }).click();
  await page.getByRole('button', { name: '插入贴纸 南京邮票', exact: true }).click();
  await expect(page.locator('[data-state="saved"]')).toContainText('已保存');
  await expect.poll(async () => (await readBook(page, bookId))?.collage?.items.length).toBe(1);
  await page.reload();
  await expect(page.getByRole('region', { name: '拼贴画布', exact: true })).toBeVisible();
  await expect.poll(async () => (await readBook(page, bookId))?.collage?.items.length).toBe(1);

  expect(assets.failures).toEqual([]);
});
