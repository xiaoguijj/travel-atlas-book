import { expect, test, type Page } from '@playwright/test';
import { readBook, seedBook, seedBooks } from './book-helpers';

const CITY_NAMES = ['南京', '上海', '西安', '北京', '杭州', '成都'];

function watchRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

function planIdFromUrl(page: Page): string {
  const hash = new URL(page.url()).hash;
  return hash.split('/').filter(Boolean).pop() ?? '';
}

test('wish map: six city markers, save note, refresh and remove', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto('/#/section/plans');
  await expect(page.getByRole('heading', { level: 1, name: '中国愿望地图' })).toBeVisible();
  await expect(page.locator('img[alt="中国地图底图"]')).toBeVisible();

  for (const name of CITY_NAMES) {
    await expect(
      page.getByRole('link', { name: new RegExp(`${name}，未标记愿望`) }),
    ).toBeVisible();
  }

  await page.getByRole('link', { name: /南京，未标记愿望/ }).click();
  await page.waitForURL(/plan\/city\/nanjing/);
  await expect(page.getByRole('heading', { level: 1, name: '南京的计划页' })).toBeVisible();
  await expect(page.getByText('还没有行程。可以先新建一趟，哪怕只有一天。')).toBeVisible();

  await page.getByLabel('愿望备注').fill('秋天去看梧桐，找一家能坐一下午的旧书店。');
  await page.getByRole('button', { name: '保存愿望' }).click();
  await expect(page.getByRole('status')).toContainText('愿望已保存');

  await page.getByRole('link', { name: '返回愿望地图' }).first().click();
  await page.waitForURL(/section\/plans$/);
  await expect(page.getByRole('link', { name: /南京，已标记愿望/ })).toBeVisible();
  await expect(page.getByText('六座城里有 1 座写下了愿望。')).toBeVisible();
  await expect(page.getByText('秋天去看梧桐')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: /南京，已标记愿望/ })).toBeVisible();

  await page.getByRole('link', { name: /南京，已标记愿望/ }).click();
  await expect(page.getByLabel('愿望备注')).toHaveValue('秋天去看梧桐，找一家能坐一下午的旧书店。');
  await page.getByLabel('愿望备注').fill('改成春天去，看樱花也行。');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByRole('status')).toContainText('愿望已保存');

  await page.getByRole('button', { name: '移除标记' }).click();
  await page.getByRole('button', { name: '确认移除' }).click();
  await expect(page.getByRole('status')).toContainText('愿望标记已移除');

  await page.getByRole('link', { name: '返回愿望地图' }).first().click();
  await expect(page.getByRole('link', { name: /南京，未标记愿望/ })).toBeVisible();

  expect(errors).toEqual([]);
});

test('plan: create a multi-city two-day trip, reorder, reopen, unlink and delete', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto('/#/plan/city/nanjing');
  await page.getByRole('link', { name: '新建一趟行程' }).click();
  await page.waitForURL(/plan\/new\?cityId=nanjing/);
  await expect(page.getByRole('heading', { level: 1, name: '从南京出发' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /南京/ })).toBeChecked();

  await page.getByLabel('行程标题').fill('南京与西安两日');
  await page.getByRole('checkbox', { name: /西安/ }).check();
  await page.getByLabel('开始日期').fill('2026-12-01');
  await page.getByLabel('结束日期').fill('2026-12-02');

  const dayOne = page.locator('article[data-date="2026-12-01"]');
  const dayTwo = page.locator('article[data-date="2026-12-02"]');
  await expect(dayOne).toBeVisible();
  await expect(dayTwo).toBeVisible();

  await dayOne.getByRole('button', { name: '＋ 添加景点' }).click();
  await dayOne.getByLabel(/第1项景点/).fill('中山陵');
  await dayOne.getByLabel(/第1项时间/).fill('09:30');
  await dayOne.getByRole('button', { name: '＋ 添加景点' }).click();
  await dayOne.getByLabel(/第2项景点/).fill('玄武湖');
  await dayOne.getByLabel(/第2项时间/).fill('16:30');
  await dayOne.getByRole('button', { name: /第2项上移/ }).click();

  await dayTwo.getByRole('button', { name: '＋ 添加景点' }).click();
  await dayTwo.getByLabel(/第1项景点/).fill('大雁塔');
  await dayTwo.getByLabel(/第1项备注/).fill('等一场落日');
  await dayTwo.getByRole('combobox').selectOption('xian');

  await page.getByRole('button', { name: '保存行程' }).click();
  await page.waitForURL(/#\/plan\/[0-9a-f-]{36}$/);
  const planId = planIdFromUrl(page);
  expect(planId).toMatch(/[0-9a-f-]{36}/);
  await expect(page.getByRole('link', { name: '返回南京计划' }).first()).toHaveAttribute(
    'href',
    /#\/plan\/city\/nanjing/,
  );

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: '南京与西安两日' })).toBeVisible();
  await expect(page.getByText('2026-12-01 → 2026-12-02')).toBeVisible();
  await expect(page.locator('article[data-date="2026-12-01"]').getByLabel(/第1项景点/)).toHaveValue('玄武湖');
  await expect(page.locator('article[data-date="2026-12-01"]').getByLabel(/第2项景点/)).toHaveValue('中山陵');
  await expect(page.locator('article[data-date="2026-12-02"]').getByLabel(/第1项备注/)).toHaveValue('等一场落日');

  // 同一份多城计划能从西安的城市计划页重新打开。
  await page.goto('/#/plan/city/xian');
  await expect(page.getByRole('heading', { level: 1, name: '西安的计划页' })).toBeVisible();
  await page.getByRole('link', { name: /南京与西安两日/ }).click();
  await page.waitForURL(new RegExp(`#/plan/${planId}$`));

  // 关联一本手账，随后删除计划应只解除关联。
  await seedBooks(page, [
    seedBook('book-xian-trip', '西安行程手账', 'xian', { planId }),
  ]);
  await page.goto(`/#/plan/${planId}`);
  await page.getByRole('button', { name: '删除行程' }).click();
  await expect(page.getByRole('dialog')).toContainText('以下手账会解除关联');
  await expect(page.getByRole('dialog')).toContainText('西安行程手账');
  await page.getByRole('button', { name: '确认删除' }).click();
  await page.waitForURL(/section\/plans$/);
  await expect(page.getByRole('heading', { level: 1, name: '中国愿望地图' })).toBeVisible();

  const keptBook = await readBook(page, 'book-xian-trip');
  expect(keptBook?.title).toBe('西安行程手账');
  expect(keptBook?.planId).toBeUndefined();

  await page.goto(`/#/plan/${planId}`);
  await expect(page.getByRole('heading', { level: 1, name: '没有这趟行程' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('plan: date validation and shortened-range confirmation', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto('/#/plan/new?cityId=nanjing');
  await page.getByLabel('开始日期').fill('2026-12-01');
  await page.getByLabel('结束日期').fill('2026-11-30');
  await page.getByRole('button', { name: '保存行程' }).click();
  await expect(page.getByRole('alert')).toContainText('结束日期不能早于开始日期');

  await page.getByLabel('结束日期').fill('2026-12-02');
  await page.getByLabel('行程标题').fill('缩短测试');
  const dayTwo = page.locator('article[data-date="2026-12-02"]');
  await dayTwo.getByRole('button', { name: '＋ 添加景点' }).click();
  await dayTwo.getByLabel(/第1项景点/).fill('玄武湖');
  await page.getByRole('button', { name: '保存行程' }).click();
  await page.waitForURL(/#\/plan\/[0-9a-f-]{36}$/);

  await page.getByLabel('结束日期').fill('2026-12-01');
  await page.getByRole('button', { name: '保存修改' }).click();
  const dialog = page.getByRole('dialog', { name: '保存前确认影响' });
  await expect(dialog).toContainText('缩短日期后会移除的日程');
  await expect(dialog).toContainText('2026-12-02');
  await page.getByRole('button', { name: '返回修改' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: '保存修改' }).click();
  await page.getByRole('button', { name: '确认并保存' }).click();
  await expect(page.getByRole('status')).toContainText('已保存');

  await page.reload();
  await expect(page.locator('article[data-date="2026-12-01"]')).toBeVisible();
  await expect(page.locator('article[data-date="2026-12-02"]')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('concurrent plan edits are rejected instead of deleting newer items', async ({ page, context }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto('/#/plan/new?cityId=nanjing');
  await page.getByLabel('行程标题').fill('并发保护');
  await page.getByLabel('开始日期').fill('2026-12-01');
  await page.getByLabel('结束日期').fill('2026-12-02');
  const dayTwo = page.locator('article[data-date="2026-12-02"]');
  await dayTwo.getByRole('button', { name: '＋ 添加景点' }).click();
  await dayTwo.getByLabel(/第1项景点/).fill('原始条目');
  await page.getByRole('button', { name: '保存行程' }).click();
  await page.waitForURL(/#\/plan\/[0-9a-f-]{36}$/);
  const planUrl = page.url();

  const other = await context.newPage();
  await other.goto(planUrl);
  await expect(other.getByRole('heading', { level: 1, name: '并发保护' })).toBeVisible();

  await page.getByLabel('结束日期').fill('2026-12-01');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByRole('dialog', { name: '保存前确认影响' })).toContainText('2026-12-02');

  await other.reload();
  const otherDayTwo = other.locator('article[data-date="2026-12-02"]');
  await otherDayTwo.getByRole('button', { name: '＋ 添加景点' }).click();
  await otherDayTwo.getByLabel(/第2项景点/).fill('并发新增条目');
  await other.getByRole('button', { name: '保存修改' }).click();
  await expect(other.getByRole('status')).toContainText('已保存');

  await page.getByRole('button', { name: '确认并保存' }).click();
  await expect(page.getByRole('alert')).toContainText('其他窗口');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.reload();
  await expect(page.getByLabel('结束日期')).toHaveValue('2026-12-02');
  await expect(
    page.locator('article[data-date="2026-12-02"]').getByLabel(/第2项景点/),
  ).toHaveValue('并发新增条目');

  await other.close();
  expect(errors).toEqual([]);
});

test('invalid plan routes and narrow viewport keep a way back to the map', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/#/plan/city/atlantis');
  await expect(page.getByRole('heading', { level: 1, name: '地图里没有这座城' })).toBeVisible();
  await page.getByRole('link', { name: '返回愿望地图' }).click();
  await page.waitForURL(/section\/plans$/);

  await page.goto('/#/plan/missing-plan');
  await expect(page.getByRole('heading', { level: 1, name: '没有这趟行程' })).toBeVisible();

  const external: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('http://127.0.0.1:4173') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      external.push(url);
    }
  });
  await page.goto('/#/section/plans');
  await expect(page.getByRole('link', { name: /成都，未标记愿望/ })).toBeVisible();

  const mismatchedMarkers = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/plan/city/"]')].filter((anchor) =>
      anchor.getAttribute('aria-label')?.includes('愿望'),
    );
    return links
      .map((anchor) => {
        const rect = anchor.getBoundingClientRect();
        const hit = document
          .elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          ?.closest('a');
        return {
          expected: anchor.getAttribute('aria-label'),
          actual: hit?.getAttribute('aria-label') ?? null,
        };
      })
      .filter((entry) => entry.expected !== entry.actual);
  });
  expect(mismatchedMarkers).toEqual([]);

  await page.getByRole('link', { name: /上海，未标记愿望/ }).click();
  await page.waitForURL(/plan\/city\/shanghai/);
  await expect(page.getByRole('heading', { level: 1, name: '上海的计划页' })).toBeVisible();

  await page.goto('/#/section/plans');
  await expect(page.getByRole('link', { name: /成都，未标记愿望/ })).toBeVisible();
  await page.getByRole('link', { name: /成都，未标记愿望/ }).click();
  await page.waitForURL(/plan\/city\/chengdu/);
  await expect(page.getByRole('heading', { level: 1, name: '成都的计划页' })).toBeVisible();
  expect(external).toEqual([]);

  expect(errors).toEqual([]);
});