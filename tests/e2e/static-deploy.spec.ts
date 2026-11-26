import { expect, test, type Page } from '@playwright/test';

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
