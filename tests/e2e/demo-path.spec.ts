import { expect, test, type Page } from '@playwright/test';
import { readBook } from './book-helpers';

// 这条路径覆盖比赛现场最可能走的一条完整演示路线：新建行程 → 从邮票册新建手账
// → 选择模式 → 写 Journal → 关联行程 → 做 Collage → 刷新恢复 → 从行程回看手账。
test.describe.configure({ timeout: 90_000 });

function watchRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

function watchAssetFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.status() < 400) return;
    if (!new URL(response.url()).pathname.includes('/assets/')) return;
    failures.push(`${response.status()} ${response.url()}`);
  });
  return failures;
}

async function waitSaved(page: Page) {
  await expect(page.locator('[data-state="saved"]')).toContainText('已保存');
}

async function hashSuffix(page: Page, pattern: RegExp): Promise<string> {
  const match = new URL(page.url()).hash.match(pattern);
  if (!match) throw new Error(`地址不符合预期: ${page.url()}`);
  return match[1];
}

test('the demo path creates, edits, links and restores a book from the album', async ({ page }) => {
  const runtimeErrors = watchRuntimeErrors(page);
  const assetFailures = watchAssetFailures(page);

  // 1. 先建一趟行程，稍后从手账里关联。
  await page.goto('/#/plan/new?cityId=nanjing');
  await page.getByLabel('行程标题').fill('南京比赛演示行程');
  await page.getByRole('button', { name: '保存行程' }).click();
  await page.waitForURL(/#\/plan\/[0-9a-f-]{36}$/);
  const planId = await hashSuffix(page, /#\/plan\/([0-9a-f-]{36})$/);
  await expect(page.getByRole('heading', { name: '南京比赛演示行程' })).toBeVisible();

  // 2. 邮票收藏册 → 南京书架 → 新建一本。
  await page.goto('/#/section/journals');
  await expect(page.getByRole('heading', { name: '中国城市手账 · China Travel Stamps' })).toBeVisible();
  const nanjingStamp = page.getByRole('button', { name: /^南京 Nanjing 邮票，/ });
  await nanjingStamp.click();
  await expect(page.getByRole('button', { name: '新建一本' })).toBeVisible();
  await page.getByRole('button', { name: '新建一本' }).click();
  await page.waitForURL(/#\/book\/[0-9a-f-]{36}$/);
  const bookId = await hashSuffix(page, /#\/book\/([0-9a-f-]{36})$/);
  await expect(page.getByRole('heading', { name: /南京 · Nanjing — 选择你的创作方式/ })).toBeVisible();

  // 3. Journal：写标题和正文，等待自动保存。
  await page.getByRole('link', { name: /^Journal 横线日记本，.*南京这一页$/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/book/${bookId}\\?mode=journal$`));
  await expect(page.getByLabel('手账正文', { exact: true })).toBeVisible();
  await page.getByLabel('手账标题').fill('南京比赛演示手账');
  await page.getByLabel('手账正文', { exact: true }).fill('梧桐树下留一页，晚上再去秦淮河。');
  await waitSaved(page);

  // 4. 关联刚创建的行程。
  const planSelect = page.getByRole('combobox', { name: '关联行程' });
  await expect(planSelect).toBeEnabled();
  await expect(planSelect.getByRole('option', { name: /南京比赛演示行程/ })).toHaveCount(1);
  await planSelect.selectOption(planId);
  await expect(page.getByRole('link', { name: '打开关联行程' })).toHaveAttribute(
    'href',
    `#/plan/${planId}`,
  );

  // 5. 刷新后，标题、正文和行程关联都从 IndexedDB 恢复。
  await page.reload();
  await expect(page.getByLabel('手账标题')).toHaveValue('南京比赛演示手账');
  await expect(page.getByLabel('手账正文', { exact: true })).toContainText('梧桐树下留一页');
  await expect(page.getByRole('combobox', { name: '关联行程' })).toHaveValue(planId);

  // 6. 切到 Collage，插入一张城市贴纸并等待保存。
  await page
    .getByRole('navigation', { name: '编辑模式' })
    .getByRole('link', { name: /Collage/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`#/book/${bookId}\\?mode=collage$`));
  await expect(page.getByRole('region', { name: '拼贴画布', exact: true })).toBeVisible();
  const rail = page.getByRole('toolbar', { name: '素材工具', exact: true });
  await rail.getByRole('button', { name: '城市贴纸', exact: true }).click();
  await page.getByRole('button', { name: '插入贴纸 南京邮票', exact: true }).click();
  await waitSaved(page);
  await expect.poll(async () => (await readBook(page, bookId))?.collage?.items.length).toBe(1);

  // 7. 刷新拼贴页，画布与素材仍然可用。
  await page.reload();
  await expect(page.getByRole('region', { name: '拼贴画布', exact: true })).toBeVisible();
  const inspector = page.locator('aside[aria-label="图层与属性"]');
  if ((await inspector.count()) === 0) {
    await page.locator('button[aria-label="图层与属性"]').last().click();
  }
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('listbox', { name: '图层列表' }).getByRole('option')).toHaveCount(1);

  // 8. 从行程详情回看关联手账，验证跨模块联动。
  await page.goto(`/#/plan/${planId}`);
  const linkedBooks = page.getByRole('region', { name: '关联手账' });
  await expect(linkedBooks).toContainText('南京比赛演示手账');
  await expect(linkedBooks.getByRole('link', { name: /南京比赛演示手账/ })).toHaveAttribute(
    'href',
    `#/book/${bookId}`,
  );

  expect(assetFailures).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
