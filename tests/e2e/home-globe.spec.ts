import { expect, test, type Page } from '@playwright/test';

/**
 * V1-01 首页主链路回归：选城转场、重叠图钉命中、连续选择、ESC 与焦点、
 * 页面往返、窄屏与触屏、无 WebGL 退路。
 *
 * 图钉按钮和画上的明信片热区名字都以城市名开头，所以用 aria-label 的前缀和
 * 坐标符号区分：图钉带经纬度（°），快捷入口带栏目说明。
 */
const marker = (page: Page, name: string) =>
  page.locator(`button[aria-label^="${name}，"][aria-label*="°"]`);

const paintedCard = (page: Page, name: string, region: string) =>
  page.getByRole('button', { name: `${name}，${region}，翻开这张明信片` });

const dialog = (page: Page, name: string) => page.getByRole('dialog', { name: `${name} 明信片` });

async function markerPoint(page: Page, name: string) {
  const box = await marker(page, name).boundingBox();
  if (!box) throw new Error(`找不到 ${name} 图钉`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function cardPoint(page: Page, name: string, region: string) {
  const box = await paintedCard(page, name, region).boundingBox();
  if (!box) throw new Error(`找不到 ${name} 明信片热区`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * 指针停在图钉命中半径内时自转暂停。自转中的图钉一直在动，
 * 所以量一次、移一次，重试到指针真正落进命中半径为止。
 */
async function aimAtMarker(page: Page, name: string) {
  await expect
    .poll(async () => {
      const point = await markerPoint(page, name);
      await page.mouse.move(point.x, point.y);
      return marker(page, name).getAttribute('data-pick');
    }, { timeout: 8000 })
    .toBe('true');
  await page.waitForTimeout(250);
}

/** 南京、上海、杭州三个图钉投影后只隔几像素，按落点最近命中的规则点选。 */
async function openMarker(page: Page, name: string) {
  await aimAtMarker(page, name);
  const point = await markerPoint(page, name);
  await page.mouse.move(point.x, point.y);
  await expect(marker(page, name)).toHaveAttribute('data-pick', 'true');
  await page.mouse.click(point.x, point.y);
  await expect(dialog(page, name)).toBeVisible();
}

function blockWebgl(page: Page) {
  return page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext as (...args: unknown[]) => unknown;
    const patched = function getContext(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.includes('webgl')) return null;
      return original.call(this, type, ...rest);
    };
    HTMLCanvasElement.prototype.getContext = patched as typeof HTMLCanvasElement.prototype.getContext;
  });
}

test.describe('桌面：选城、转场与焦点', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('重叠的南京/上海图钉按落点选中，ESC 后焦点回到被选中的图钉', async ({ page }) => {
    await page.goto('/');

    await openMarker(page, '南京');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(marker(page, '南京')).toBeFocused();

    await openMarker(page, '上海');
    await expect(dialog(page, '上海')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  test('图钉旁边的画布点击也按最近城市命中', async ({ page }) => {
    await page.goto('/');
    await aimAtMarker(page, '南京');

    const nanjing = await markerPoint(page, '南京');
    // 移出 20px 的图钉盒子、仍在 18px 命中半径内；最近的城市还是南京
    await page.mouse.click(nanjing.x - 13, nanjing.y - 6);
    await expect(dialog(page, '南京')).toBeVisible();
  });

  test('拖动地球结束在图钉附近不会误开明信片', async ({ page }) => {
    await page.goto('/');
    await aimAtMarker(page, '南京');

    const nanjing = await markerPoint(page, '南京');
    await page.mouse.move(nanjing.x - 100, nanjing.y);
    await page.mouse.down();
    await page.mouse.move(nanjing.x - 13, nanjing.y - 6, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(900);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('连续快速选择时只完成最后一座城市的转场和明信片', async ({ page }) => {
    await page.goto('/');

    // 直接按坐标连点，避免自动化在两次点击之间等可操作性检查，
    // 模拟的是用户 80ms 内连点两张明信片。
    const nanjing = await cardPoint(page, '南京', '江苏 · 中国');
    const shanghai = await cardPoint(page, '上海', '直辖市 · 中国');
    await page.mouse.click(nanjing.x, nanjing.y);
    await page.waitForTimeout(80);
    await page.mouse.click(shanghai.x, shanghai.y);

    await expect(dialog(page, '上海')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(dialog(page, '南京')).toHaveCount(0);
  });

  test('飞行途中按 ESC 取消预览并留在地球', async ({ page }) => {
    await page.goto('/');

    const nanjing = await cardPoint(page, '南京', '江苏 · 中国');
    await page.mouse.click(nanjing.x, nanjing.y);
    await page.waitForTimeout(80);
    await page.keyboard.press('Escape');

    await page.waitForTimeout(2200);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('Travel Atlas Book 首页')).toBeVisible();
  });

  test('旅行手账往返，内页与首页各自只保留一套顶栏', async ({ page }) => {
    await page.goto('/');

    const nanjing = await cardPoint(page, '南京', '江苏 · 中国');
    await page.mouse.click(nanjing.x, nanjing.y);
    await page.getByRole('button', { name: '进入旅行手账' }).click();

    await expect(page).toHaveURL(/\/#\/city\/nanjing$/);
    await expect(page.getByRole('heading', { name: /^南京/ })).toBeVisible();
    await expect(page.getByRole('link', { name: '返回地球探索' })).toBeVisible();
    // 内页用 InnerPageLayout 的顶栏，Shell 不再叠加旧导航
    await expect(page.getByRole('navigation', { name: '已收录城市' })).toHaveCount(0);

    await page.getByRole('link', { name: '返回地球探索' }).click();
    await expect(page).toHaveURL(/\/#\/$/);
    await expect(page.getByLabel('Travel Atlas Book 首页')).toBeVisible();
    // 首页参考图舞台用画上的缎带导航，同样不挂旧导航
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '已收录城市' })).toHaveCount(0);
  });

  test('飞行途中跨越参考图/竖版断点仍会打开所选城市', async ({ page }) => {
    await page.goto('/');

    const beijing = await cardPoint(page, '北京', '直辖市 · 中国');
    await page.mouse.click(beijing.x, beijing.y);
    await page.waitForTimeout(80);
    await page.setViewportSize({ width: 700, height: 800 });
    await expect(page.getByRole('heading', { name: '城市明信片' })).toBeVisible();
    await expect(dialog(page, '北京')).toBeVisible({ timeout: 8000 });

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(dialog(page, '北京')).toBeVisible();
  });

  test('指针悬停图钉时图钉停住，移开后恢复自转', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(700);

    await aimAtMarker(page, '南京');
    const before = await markerPoint(page, '南京');
    await page.waitForTimeout(700);
    const after = await markerPoint(page, '南京');
    expect(Math.abs(after.x - before.x)).toBeLessThan(3);

    await page.mouse.move(4, 4);
    await page.waitForTimeout(1500);
    const beforeLeaving = await markerPoint(page, '南京');
    // 负载重时帧率会掉，按"最终确实动起来"轮询，而不是死等固定墙钟时间
    await expect
      .poll(async () => Math.abs((await markerPoint(page, '南京')).x - beforeLeaving.x), { timeout: 6000 })
      .toBeGreaterThan(4);
  });

  test('转到背面的图钉不进入 Tab 顺序，键盘回车可选中并 ESC 归还焦点', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(700);

    await expect(marker(page, '伦敦')).toHaveAttribute('tabindex', '-1');

    await page.keyboard.press('Tab');
    await expect(marker(page, '南京')).toBeFocused();

    const tabbed: (string | null | undefined)[] = [];
    for (let index = 0; index < 5; index += 1) {
      await page.keyboard.press('Tab');
      tabbed.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')));
    }
    expect(tabbed.join('|')).not.toContain('伦敦，');

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '首页' })).toBeFocused();

    await page.goto('/');
    await page.waitForTimeout(700);
    await page.keyboard.press('Tab');
    await expect(marker(page, '南京')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog(page, '南京')).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(marker(page, '南京')).toBeFocused();
  });

  test('主流程没有运行时错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await openMarker(page, '南京');
    await page.getByRole('button', { name: '进入旅行手账' }).click();
    await expect(page).toHaveURL(/\/#\/city\/nanjing$/);
    await page.getByRole('link', { name: '返回地球探索' }).click();
    await expect(page.getByLabel('Travel Atlas Book 首页')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe('窄屏与触屏', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });

  test('竖版布局的快捷入口来自共享城市目录，图钉和入口都能打开明信片', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByLabel('Travel Atlas Book 首页')).toHaveCount(0);
    // 六城 + 伦敦都来自同一份城市目录，快捷入口不另写业务数据
    await expect(page.locator('ul li button')).toHaveCount(7);
    await expect(page.getByRole('button', { name: '南京', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '成都', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '伦敦', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    const point = await markerPoint(page, '上海');
    await page.touchscreen.tap(point.x, point.y);
    await expect(dialog(page, '上海')).toBeVisible();
    await page.getByRole('button', { name: '先留在地球' }).click();

    await page.getByRole('button', { name: '南京', exact: true }).click();
    await expect(dialog(page, '南京')).toBeVisible();
    await page.getByRole('button', { name: '先留在地球' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('触屏的粗指针在图钉旁边 22px 也能命中', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);

    const shanghai = await markerPoint(page, '上海');
    await page.touchscreen.tap(shanghai.x + 18, shanghai.y - 14);
    await expect(dialog(page, '上海')).toBeVisible();
  });

  test('竖版布局的 WebGL 退路仍能选出六城之一', async ({ page }) => {
    await blockWebgl(page);
    await page.goto('/');

    await expect(page.getByText('这个浏览器没能启用 WebGL')).toBeVisible();
    await page.getByRole('button', { name: /^成都\s*四川/ }).click();
    await expect(dialog(page, '成都')).toBeVisible();
    await page.getByRole('button', { name: '先留在地球' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('无 WebGL 退路（参考图舞台）', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('城市列表压在背景画之上，可点开明信片并归还焦点', async ({ page }) => {
    await blockWebgl(page);
    await page.goto('/');

    await expect(page.locator('canvas')).toHaveCount(0);
    const note = page.getByText('这个浏览器没能启用 WebGL');
    await expect(note).toBeVisible();

    const fallback = note.locator('..');
    expect(await fallback.evaluate((node) => getComputedStyle(node).zIndex)).toBe('3');
    await expect(fallback.locator('button')).toHaveCount(7);

    const chengdu = page.getByRole('button', { name: /^成都\s*四川/ });
    await chengdu.click();
    await expect(dialog(page, '成都')).toBeVisible();
    await page.getByRole('button', { name: '先留在地球' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(chengdu).toBeFocused();
  });
});
