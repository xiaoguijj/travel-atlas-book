import { expect, test } from '@playwright/test';

test('production build boots the home page without runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/Travel Atlas Book/);
  await expect(page.locator('main')).toBeVisible();

  // V1-02 约定：首次进入应用不会自动创建数据库，也不会写入演示业务数据。
  const databaseNames = await page.evaluate(async () =>
    (await indexedDB.databases()).map((database) => database.name).filter(Boolean),
  );
  expect(databaseNames).not.toContain('travel-atlas-book');
  expect(runtimeErrors).toEqual([]);
});

test('hash deep link to a city page still works in the static build', async ({ page }) => {
  await page.goto('/#/city/nanjing');
  await expect(page.getByRole('heading', { name: /南京/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '页面导航' })).toBeVisible();
});