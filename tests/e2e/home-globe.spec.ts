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
    }, { timeout: 15000 })
    .toBe('true');
  await page.waitForTimeout(250);
}

/**
 * 场景刚挂载时容器宽高还是 1×1，渲染画布没按真实尺寸创建前，
 * 图钉全部堆在布局原点却已经可聚焦。tabindex 从第一帧起就反映真实朝向，
 * 只有屏幕位置要等画布尺寸就位后才散开；不需要点按坐标的用例等它就够了。
 */
async function waitForGlobeReady(page: Page) {
  await expect
    .poll(() => page
      .locator('div[class*="canvasHost"] canvas')
      .evaluate((element) => (element as HTMLCanvasElement).width)
      .catch(() => 0))
    .toBeGreaterThanOrEqual(100);
}

/**
 * tabindex 打开只说明第一帧投影已经跑过：那一帧所有图钉还堆在布局原点，
 * 下一帧才散开到真实球面位置。等位置稳定两次采样不变后再点按，避免落在原点。
 */
async function waitForProjection(page: Page, name: string) {
  await expect(marker(page, name)).toHaveAttribute('tabindex', '0');
  await expect
    .poll(async () => {
      // 场景刚挂载时容器宽高还是 1×1，退化帧把图钉全部投影到原点，
      // transform 的 x 只有零点几像素；真实投影至少几十像素。
      // 画布尺寸就位并不等于散开的那一帧已经渲染，直接看图钉自己最可靠。
      const projectedX = await marker(page, name).evaluate((element) => {
        const match = element.style.transform.match(/translate3d\((-?[\d.]+)px/);
        return match ? Number(match[1]) : 0;
      });
      if (projectedX < 20) return Number.POSITIVE_INFINITY;
      const before = await marker(page, name).boundingBox();
      await page.waitForTimeout(60);
      const after = await marker(page, name).boundingBox();
      if (!before || !after) return Number.POSITIVE_INFINITY;
      return Math.hypot(after.x - before.x, after.y - before.y);
    }, { timeout: 15000 })
    .toBeLessThan(0.5);
}

/** 南京、上海、杭州三个图钉投影后只隔几像素，按落点最近命中的规则点选。 */
async function openMarker(page: Page, name: string) {
  await aimAtMarker(page, name);
  const point = await markerPoint(page, name);
  await page.mouse.move(point.x, point.y);
  await expect(marker(page, name)).toHaveAttribute('data-pick', 'true');
  await page.mouse.click(point.x, point.y);
  await expect(dialog(page, name)).toBeVisible({ timeout: 15000 });
}

/**
 * 自转位移按帧推进（每帧只有零点几像素），帧率被并行负载压到几帧每秒时，
 * 墙钟等待会超时。在页面里逐帧采样，数帧数而不是等秒数。
 */
async function waitForMarkerDrift(page: Page, name: string, start: { x: number; y: number }, minDrift = 4) {
  await expect
    .poll(() => page.evaluate(
      ({ prefix, startX, startY, minDrift }) => new Promise<number>((resolve) => {
        const marker = [...document.querySelectorAll('button[aria-label*="°"]')]
          .find((button) => button.getAttribute('aria-label')?.startsWith(prefix));
        if (!marker) {
          resolve(0);
          return;
        }
        const driftOf = () => {
          const rect = marker.getBoundingClientRect();
          return Math.hypot(rect.x + rect.width / 2 - startX, rect.y + rect.height / 2 - startY);
        };
        let frames = 0;
        const tick = () => {
          const drift = driftOf();
          if (drift > minDrift || frames >= 120) {
            resolve(drift);
            return;
          }
          frames += 1;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
      { prefix: `${name}，`, startX: start.x, startY: start.y, minDrift },
    ), { timeout: 20000 })
    .toBeGreaterThan(minDrift);
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
    await expect(dialog(page, '上海')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  test('图钉旁边的画布点击也按最近城市命中', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await aimAtMarker(page, '南京');

    const nanjing = await markerPoint(page, '南京');
    // 移出 20px 的图钉盒子、仍在 18px 命中半径内；最近的城市还是南京
    const point = { x: nanjing.x - 8, y: nanjing.y - 13 };
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe('CANVAS');
    await page.mouse.click(point.x, point.y);
    await expect(dialog(page, '南京')).toBeVisible({ timeout: 15000 });
  });

  test('拖回按下的位置松手也不会误开明信片', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await aimAtMarker(page, '南京');

    const nanjing = await markerPoint(page, '南京');
    const point = { x: nanjing.x - 8, y: nanjing.y - 13 };
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe('CANVAS');
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x - 70, point.y, { steps: 8 });
    const distanceMoved = async () => Math.abs((await markerPoint(page, '南京')).x - nanjing.x);
    await expect.poll(distanceMoved).toBeGreaterThan(25);

    await page.mouse.move(point.x, point.y, { steps: 8 });
    await expect.poll(distanceMoved).toBeLessThan(2);
    await page.mouse.up();

    await expect(marker(page, '南京')).not.toBeFocused();
    await page.waitForTimeout(700);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.mouse.click(point.x, point.y);
    await expect(dialog(page, '南京')).toBeVisible({ timeout: 15000 });
  });

  test('空白处的透明城市标签不会拦截画布或触发选城', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(marker(page, '西安')).toHaveAttribute('tabindex', '0');
    const hiddenLabel = marker(page, '西安').locator('span').nth(1);
    await expect(hiddenLabel).toHaveCSS('opacity', '0');
    const labelPoint = () => hiddenLabel.evaluate((label) => {
      const box = label.getBoundingClientRect();
      const x = Math.round(box.x + box.width / 2);
      const y = Math.round(box.y + box.height / 2);
      return document.elementsFromPoint(x, y).some((element) => element.tagName === 'CANVAS')
        ? { x, y }
        : null;
    });
    await expect.poll(labelPoint).not.toBeNull();
    const point = await labelPoint();
    if (!point) throw new Error('找不到西安标签覆盖的画布位置');

    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(700);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe('CANVAS');
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

    // 画上的明信片热区是静态 DOM 按钮，不会跟着球面移动；提前把两处坐标量好，
    // 中间不重新测量，模拟用户 80ms 内连点两张明信片，也避免第二下点进
    // 第一座城市刚弹出来的明信片里。
    const nanjing = await cardPoint(page, '南京', '江苏 · 中国');
    const shanghai = await cardPoint(page, '上海', '直辖市 · 中国');
    await page.mouse.click(nanjing.x, nanjing.y);
    await page.mouse.click(shanghai.x, shanghai.y);

    await expect(dialog(page, '上海')).toBeVisible({ timeout: 15000 });
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

    await expect(page).toHaveURL(/\/#\/section\/journals\?cityId=nanjing$/);
    await expect(page.getByRole('button', { name: /南京 Nanjing 邮票/ })).toHaveAttribute('aria-expanded', 'true');
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

  test('飞行或预览时跨越布局断点仍能打开正确城市并恢复焦点', async ({ page }) => {
    await page.goto('/');

    const beijing = await cardPoint(page, '北京', '直辖市 · 中国');
    await page.mouse.click(beijing.x, beijing.y);
    await page.waitForTimeout(80);
    await page.setViewportSize({ width: 700, height: 800 });
    await expect(page.getByRole('heading', { name: '城市明信片' })).toBeVisible();
    await expect(dialog(page, '北京')).toBeVisible({ timeout: 15000 });
    const classicEntry = page.getByRole('region', { name: '城市快捷入口' })
      .getByRole('button', { name: /^北京\s/ });
    await page.keyboard.press('Escape');
    await expect(dialog(page, '北京')).toHaveCount(0);
    await expect(classicEntry).toBeFocused();

    await classicEntry.press('Enter');
    await expect(dialog(page, '北京')).toBeVisible({ timeout: 15000 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(paintedCard(page, '北京', '直辖市 · 中国')).toBeVisible();
    await expect(dialog(page, '北京')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(paintedCard(page, '北京', '直辖市 · 中国')).toBeFocused();
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
    await waitForMarkerDrift(page, '南京', beforeLeaving);
  });

  test('图钉转到静止指针下也会暂停自转', async ({ page }) => {
    await page.goto('/');
    const shanghai = marker(page, '上海');
    await expect(shanghai).toHaveAttribute('tabindex', '0');
    const start = await markerPoint(page, '上海');
    await waitForMarkerDrift(page, '上海', start);
    const moving = await markerPoint(page, '上海');

    await page.mouse.move(moving.x + 32, moving.y - 4);
    await expect(shanghai).not.toHaveAttribute('data-pick', 'true');
    // 图钉逐帧转进指针的命中半径；帧率低时墙钟等待同样会超时，逐帧等它转进去。
    await expect
      .poll(() => page.evaluate(() => new Promise<boolean>((resolve) => {
        const marker = [...document.querySelectorAll('button[aria-label*="°"]')]
          .find((button) => button.getAttribute('aria-label')?.startsWith('上海，'));
        if (!marker) {
          resolve(false);
          return;
        }
        let frames = 0;
        const tick = () => {
          if (marker.getAttribute('data-pick') === 'true') {
            resolve(true);
            return;
          }
          if (frames >= 300) {
            resolve(false);
            return;
          }
          frames += 1;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })), { timeout: 30000 })
      .toBe(true);

    const before = await markerPoint(page, '上海');
    await page.waitForTimeout(700);
    const after = await markerPoint(page, '上海');
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(3);
  });

  test('转到背面的图钉不进入 Tab 顺序，键盘回车可选中并 ESC 归还焦点', async ({ page }) => {
    await page.goto('/');
    await waitForGlobeReady(page);
    await expect(marker(page, '南京')).toHaveAttribute('tabindex', '0');

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
    await waitForGlobeReady(page);
    await expect(marker(page, '南京')).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('Tab');
    await expect(marker(page, '南京')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog(page, '南京')).toBeVisible({ timeout: 15000 });
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
    await expect(page).toHaveURL(/\/#\/section\/journals\?cityId=nanjing$/);
    await page.getByRole('link', { name: '返回地球探索' }).click();
    await expect(page.getByLabel('Travel Atlas Book 首页')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe('固定尺寸交互', () => {
  test.use({ viewport: { width: 919, height: 773 }, reducedMotion: 'reduce', hasTouch: true });

  const projections = (page: Page) => page.locator('button[aria-label*="°"]').evaluateAll(
    (buttons) => buttons.map((button) => (button as HTMLElement).style.transform),
  );
  const renderFrames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
  // 球心位于原点，渲染矩阵中的平移向量长度就是相机距离；允许旋转时仍可准确检查缩放。
  const cameraDistance = (page: Page) => page.locator('canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2')!;
    const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
    const location = gl.getUniformLocation(program, 'modelViewMatrix');
    if (!location) throw new Error('地球渲染矩阵尚未就绪');
    const matrix = gl.getUniform(program, location) as Float32Array;
    return Math.hypot(matrix[12], matrix[13], matrix[14]);
  });

  test('滚轮不能缩放地球，鼠标拖动仍然旋转', async ({ page }) => {
    await page.goto('/');
    await expect(marker(page, '南京')).toHaveAttribute('tabindex', '0');
    const canvas = page.getByLabel('Travel Atlas Book 首页').locator('canvas');
    const bounds = (await canvas.boundingBox())!;
    // 从球体下方的空白海面拖动，避开城市按钮及其浮动标签。
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 + 80 };
    await page.mouse.move(center.x, center.y);
    await renderFrames(page);
    const initial = await projections(page);
    const distance = await cameraDistance(page);
    for (const delta of [800, -800]) {
      await page.mouse.wheel(0, delta);
      await renderFrames(page);
      expect(await projections(page)).toEqual(initial);
      expect(await cameraDistance(page)).toBeCloseTo(distance, 5);
    }
    await page.mouse.down();
    await page.mouse.move(center.x + 80, center.y + 25, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => projections(page)).not.toEqual(initial);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('双指捏合不能缩小或放大地球', async ({ page, context }) => {
    await page.goto('/');
    await expect(marker(page, '南京')).toHaveAttribute('tabindex', '0');
    const bounds = (await page.getByLabel('Travel Atlas Book 首页').locator('canvas').boundingBox())!;
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2 + 45;
    await renderFrames(page);
    const distance = await cameraDistance(page);
    const session = await context.newCDPSession(page);
    for (const [from, to] of [[55, 25], [25, 65]]) {
      const points = (offset: number) => [{ id: 1, x: x - offset, y }, { id: 2, x: x + offset, y }];
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
      for (const part of [0.25, 0.5, 0.75, 1]) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(from + (to - from) * part) });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await renderFrames(page);
      expect(await cameraDistance(page)).toBeCloseTo(distance, 5);
    }
    await session.detach();
    await expect(page.getByRole('dialog')).toHaveCount(0);
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

    await expect(marker(page, '上海')).toHaveAttribute('tabindex', '0');
    await expect(marker(page, '杭州')).toHaveAttribute('tabindex', '0');
    await waitForProjection(page, '上海');
    const point = await markerPoint(page, '上海');
    const hangzhou = await markerPoint(page, '杭州');
    // 模拟浏览器把合成 click 的坐标挪到邻近图钉，真实触屏按下仍发生在上海。
    await page.evaluate(({ x, y }) => {
      document.addEventListener('click', (event) => {
        Object.defineProperties(event, { clientX: { value: x }, clientY: { value: y } });
      }, { capture: true, once: true });
    }, hangzhou);
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.getByRole('dialog')).toHaveAccessibleName('上海 明信片', { timeout: 15000 });
    await expect(dialog(page, '上海')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: '先留在地球' }).click();

    await page.getByRole('button', { name: '南京', exact: true }).click();
    await expect(dialog(page, '南京')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: '先留在地球' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('触屏的粗指针在图钉旁边 22px 也能命中', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);

    await waitForProjection(page, '上海');
    const shanghai = await markerPoint(page, '上海');
    await page.touchscreen.tap(shanghai.x + 18, shanghai.y - 14);
    await expect(page.getByRole('dialog')).toHaveAccessibleName('上海 明信片', { timeout: 15000 });
    await expect(dialog(page, '上海')).toBeVisible({ timeout: 15000 });
  });

  test('竖版布局的 WebGL 退路仍能选出六城之一', async ({ page }) => {
    await blockWebgl(page);
    await page.goto('/');

    await expect(page.getByText('这个浏览器没能启用 WebGL')).toBeVisible();
    await page.getByRole('button', { name: /^成都\s*四川/ }).click();
    await expect(dialog(page, '成都')).toBeVisible({ timeout: 15000 });
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
    await expect(dialog(page, '成都')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: '先留在地球' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(chengdu).toBeFocused();
  });
});
