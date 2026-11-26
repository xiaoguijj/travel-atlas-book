import { expect, test, type Page } from '@playwright/test';
import { readBook, seedBook, seedBooks } from './book-helpers';

const cities = [
  ['nanjing', '南京'], ['shanghai', '上海'], ['xian', '西安'],
  ['beijing', '北京'], ['hangzhou', '杭州'], ['chengdu', '成都'],
] as const;

test('narrow navigation and every city connect the album, portal and plans', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('link', { name: '旅行计划' }).click();
  await expect(page.getByRole('heading', { name: '中国愿望地图' })).toBeVisible();
  await page.goto('/');
  await nav.getByRole('link', { name: '旅行手账' }).click();
  await expect(page).toHaveURL(/#\/section\/journals$/);

  for (const [id, name] of cities) {
    const stamp = page.getByRole('button', { name: new RegExp(`^${name} .*邮票，`) });
    await stamp.click();
    await expect(stamp).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('link', { name: `${name}城市详情` }).click();
    await expect(page).toHaveURL(new RegExp(`#/city/${id}$`));
    await expect(page.getByRole('link', { name: `${name}手账书架` })).toHaveAttribute(
      'href', `#/section/journals?cityId=${id}`,
    );
    await page.getByRole('link', { name: `${name}旅行计划` }).click();
    await expect(page.getByRole('heading', { name: `${name}的计划页` })).toBeVisible();
    await page.getByRole('link', { name: `打开${name}手账书架` }).click();
    await expect(stamp).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('link', { name: `${name}旅行计划` })).toHaveAttribute(
      'href', `#/plan/city/${id}`,
    );
    await page.getByRole('button', { name: '收起', exact: true }).click();
  }

  await page.goto('/#/city/london');
  await expect(page.getByRole('link', { name: '伦敦手账书架' })).toBeVisible();
  await expect(page.getByRole('link', { name: '伦敦旅行计划' })).toHaveCount(0);
  await page.goto('/#/section/journals?cityId=missing');
  await expect(page.getByRole('button', { name: '新建一本' })).toHaveCount(0);
});

async function createPlan(page: Page, cityId: string, title: string): Promise<string> {
  await page.goto(`/#/plan/new?cityId=${cityId}`);
  await page.getByLabel('行程标题').fill(title);
  await page.getByRole('button', { name: '保存行程' }).click();
  await page.waitForURL(/#\/plan\/[0-9a-f-]{36}$/);
  return new URL(page.url()).hash.slice('#/plan/'.length);
}

test('editors link, switch and unlink a plan while preserving pending book edits', async ({ page, context }) => {
  const bookId = 'nanjing-module-links';
  const updatedTitle = '去南京的途中';
  const journal = '同时存下这一页。';
  await seedBooks(page, [seedBook(bookId, '南京手账', 'nanjing')]);
  const first = await createPlan(page, 'nanjing', '梧桐散步');
  const second = await createPlan(page, 'nanjing', '秦淮夜游');
  await createPlan(page, 'shanghai', '上海外滩');

  await page.goto(`/#/book/${bookId}?mode=journal`);
  const select = page.getByRole('combobox', { name: '关联行程' });
  await expect(select).toBeEnabled();
  await expect(select.getByRole('option', { name: /上海外滩/, includeHidden: true })).toHaveCount(0);
  await page.getByLabel('手账标题').fill(updatedTitle);
  await page.getByLabel('手账正文', { exact: true }).fill(journal);
  await select.selectOption(first);
  const openPlan = page.getByRole('link', { name: '打开关联行程' });
  await expect(openPlan).toHaveAttribute('href', `#/plan/${first}`);
  await openPlan.click();
  await expect(page.getByRole('heading', { name: '梧桐散步' })).toBeVisible();
  await expect(page.getByRole('link', { name: '返回南京计划' }).first()).toHaveAttribute('href', '#/plan/city/nanjing');
  const linkedBooks = page.getByRole('region', { name: '关联手账' });
  await expect(linkedBooks.getByRole('link', { name: '南京手账书架' })).toHaveAttribute(
    'href', '#/section/journals?cityId=nanjing',
  );
  await linkedBooks.getByRole('link', { name: new RegExp(updatedTitle) }).click();
  await expect(page).toHaveURL(new RegExp(`#/book/${bookId}$`));
  await page.getByRole('link', { name: /Collage 自由拼贴/ }).click();
  await expect(select).toHaveValue(first);
  const secondPlanTab = await context.newPage();
  await secondPlanTab.goto(`/#/plan/${second}`);
  const secondPlanBooks = secondPlanTab.getByRole('region', { name: '关联手账' });
  await expect(secondPlanBooks).toContainText('还没有关联手账');

  await select.selectOption(second);
  await expect(openPlan).toHaveAttribute('href', `#/plan/${second}`);
  await expect(secondPlanBooks.getByRole('link', { name: new RegExp(updatedTitle) })).toBeVisible();

  await page.reload();
  await expect(openPlan).toHaveAttribute('href', `#/plan/${second}`);
  await select.selectOption('');
  await expect(select).toBeEnabled();
  await expect(openPlan).toHaveCount(0);
  const stored = await readBook(page, bookId);
  expect(stored).toMatchObject({ title: updatedTitle });
  expect(stored?.planId).toBeUndefined();
  expect(JSON.stringify(stored?.journal)).toContain(journal);

  await expect(secondPlanBooks).toContainText('还没有关联手账');
  await page.goto(`/#/plan/${first}`);
  await expect(linkedBooks).toContainText('还没有关联手账');
});
