import { expect, test, type Locator } from '@playwright/test';
import { readBook, seedBook, seedBooks } from './book-helpers';
import { COLLAGE_CANVAS_HEIGHT, COLLAGE_CANVAS_WIDTH } from '../../src/data/contracts';

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

async function expectPaperUnchanged(canvas: Locator, initial: Awaited<ReturnType<typeof box>>) {
  // CSS 小数宽度与 Konva 的 clientWidth 整数测量允许不足半像素的舍入差。
  await expect.poll(async () => {
    const current = await box(canvas);
    return Math.max(...(['x', 'y', 'width', 'height'] as const).map((key) => Math.abs(current[key] - initial[key])));
  }).toBeLessThan(0.5);
}

test('desktop paper, tools and scrolling inspector occupy separate columns', async ({ page }) => {
  await seedBooks(page, [seedBook('desktop-ui', '桌面布局')]);
  await page.goto('/#/book/desktop-ui?mode=collage');
  const canvas = page.getByRole('region', { name: '拼贴画布', exact: true });
  const rail = page.getByRole('toolbar', { name: '素材工具', exact: true });
  const inspector = page.locator('aside[aria-label="图层与属性"]');
  await expect(canvas).toBeVisible();
  // 入场动画结束后量取基准，避免把 translateY 入场位移算作面板引起的移动。
  await canvas.evaluate(async (element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      await Promise.all(node.getAnimations().map((animation) => animation.finished));
    }
  });
  let previousPaperWidth = (await box(canvas)).width;
  for (const size of [{ width: 919, height: 773 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    await expect(inspector).toBeVisible();
    // 等待 ResizeObserver 将新栏宽同步给 Konva；等比通过只说明画布是 4:3，
    // 旧视口的纸面同样满足，还要等宽度离开上一视口的值才算同步完成。
    await expect.poll(async () => {
      const paper = await box(canvas);
      return paper.width / paper.height;
    }).toBeCloseTo(COLLAGE_CANVAS_WIDTH / COLLAGE_CANVAS_HEIGHT, 2);
    await expect.poll(async () => (await box(canvas)).width).not.toBe(previousPaperWidth);
    const [paper, tools, panel] = await Promise.all([box(canvas), box(rail), box(inspector)]);
    previousPaperWidth = paper.width;
    expect(paper.width / paper.height).toBeCloseTo(COLLAGE_CANVAS_WIDTH / COLLAGE_CANVAS_HEIGHT, 2);
    expect(paper.width).toBeGreaterThan(size.width >= 1280 ? 620 : 400);
    expect(tools.x + tools.width).toBeLessThan(paper.x);
    expect(paper.x + paper.width).toBeLessThan(panel.x);
    expect(panel.x + panel.width).toBeLessThanOrEqual(size.width);
    expect(panel.y + panel.height).toBeLessThanOrEqual(size.height);
    expect(paper.y + paper.height).toBeLessThanOrEqual(size.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // 每一种素材选项展开、切换和收起，纸张都保持同样的宽高和位置。
    for (const name of ['照片', '城市贴纸', '通用贴纸', '文字']) {
      await rail.getByRole('button', { name, exact: true }).click();
      const materialPanel = page.getByRole('region', { name: `${name}面板`, exact: true });
      await expect(materialPanel).toBeVisible();
      await expectPaperUnchanged(canvas, paper);
      const material = await box(materialPanel);
      expect(paper.x + paper.width).toBeLessThan(material.x);
      expect(material.x + material.width).toBeLessThanOrEqual(size.width);
      expect(material.y + material.height).toBeLessThanOrEqual(size.height);
    }
    await page.getByRole('button', { name: '收起素材面板', exact: true }).click();
    await expectPaperUnchanged(canvas, paper);
    await page.getByRole('button', { name: '图层与属性', exact: true }).click();
  }
  await rail.getByRole('button', { name: '文字', exact: true }).click();
  const material = await box(page.getByRole('region', { name: '文字面板', exact: true }));
  const paper = await box(canvas);
  expect(paper.x + paper.width).toBeLessThan(material.x);
  await page.getByRole('button', { name: '添加文字', exact: true }).click();
  await expect(page.getByLabel('文字内容')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  const panel = await box(inspector);
  expect(panel.y + panel.height).toBeLessThanOrEqual(720);
  const body = inspector.locator('[class*="panelBody"]');
  expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await inspector.getByRole('button', { name: /删除/ }).scrollIntoViewIfNeeded();
  await expect(inspector.getByRole('button', { name: /删除/ })).toBeInViewport();
  await expect(page.locator('[data-state="saved"]')).toContainText('已保存');
  expect((await readBook(page, 'desktop-ui'))?.collage?.items).toHaveLength(1);
});

test('both editors share the map shell while other pages keep their background', async ({ page }) => {
  await seedBooks(page, [seedBook('background-ui', '背景检查')]);
  const background = () => page.locator('[class*="bgCollage"]').evaluate(el => getComputedStyle(el).backgroundImage);
  await page.goto('/#/book/background-ui?mode=journal');
  await expect(page.getByLabel('手账正文', { exact: true })).toBeVisible();
  const journalBg = await background();
  expect(journalBg).toContain('collage-desk');
  await page.getByRole('link', { name: /Collage · 自由拼贴/ }).click();
  await expect(page.getByRole('region', { name: '拼贴画布', exact: true })).toBeVisible();
  expect(await background()).toBe(journalBg);
  await page.goto('/#/section/inspiration');
  await expect(page.locator('[class*="bgCollage"]')).toHaveCount(0);
  await expect(page.locator('[class*="bg_"]')).toHaveCSS('background-image', /inner-bg-map/);
  await page.goto('/');
  await expect(page.locator('[class*="home_"]')).toHaveCSS('background-image', /inner-bg-map/);
  await expect(page.locator('img[src*="hero-bg"]')).toBeVisible();
});
