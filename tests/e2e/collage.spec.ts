import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import type { CollageItem } from '../../src/data/contracts';
import { readBook, readPhotoCount, seedBook, seedBooks } from './book-helpers';

const BOOK = 'nanjing-collage';
const OTHER = 'nanjing-other';
const COLLAGE_URL = `/#/book/${BOOK}?mode=collage`;
const layerMenu = (page: Page) => page.getByRole('combobox', { name: '图层', exact: true });
const canvas = (page: Page) => page.getByRole('region', { name: '拼贴画布', exact: true }).locator('canvas');

function pixelAt(page: Page, x: number, y: number) {
  return canvas(page).evaluate((element, point) => {
    const surface = element as HTMLCanvasElement;
    const px = Math.round(surface.width * point.x / 1200);
    const py = Math.round(surface.height * point.y / 1600);
    return Array.from(surface.getContext('2d')!.getImageData(px, py, 1, 1).data);
  }, { x, y });
}

async function savedItems(page: Page, bookId = BOOK) {
  await expect(page.locator('[data-state="saved"]')).toContainText('已保存');
  return (await readBook(page, bookId))!.collage!.items;
}

async function itemScreenBox(page: Page, item: CollageItem) {
  await canvas(page).scrollIntoViewIfNeeded();
  const rect = (await canvas(page).boundingBox())!;
  const scale = rect.width / 1200;
  return { x: rect.x + item.x * scale, y: rect.y + item.y * scale, w: item.width * scale, h: item.height * scale, scale };
}

async function mouseDrag(page: Page, x: number, y: number, toX: number, toY: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 6 });
  await page.mouse.up();
}

async function insertSticker(page: Page, label: string) {
  await page.getByRole('button', { name: '插入贴纸', exact: true }).click();
  await page.getByRole('button', { name: `选择贴纸 ${label}`, exact: true }).click();
  await page.getByRole('button', { name: '使用这张素材' }).click();
}

test('collage assets, text, geometry and layer order survive reload and stay scoped to the book and mode', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seedBooks(page, [seedBook(BOOK, '南京拼贴'), seedBook(OTHER, '南京另一本')]);
  await page.goto(COLLAGE_URL);

  await page.getByRole('button', { name: '插入照片', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles(resolve('tests/fixtures/atlas-sample.png'));
  await expect(page.getByRole('button', { name: /选择照片 atlas-sample\.png/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '使用这张素材' }).click();
  const [photo] = await savedItems(page);
  expect(photo).toMatchObject({ kind: 'photo', assetId: expect.stringMatching(/^photo:/) });
  await expect.poll(() => pixelAt(page, photo.x + photo.width / 2, photo.y + photo.height / 2)).toEqual([255, 255, 255, 255]);
  expect(await readPhotoCount(page)).toBe(1);

  await insertSticker(page, '南京邮票');
  await insertSticker(page, '绿皮火车');
  await page.getByRole('button', { name: '添加文字', exact: true }).click();
  await page.getByLabel('文字内容').fill('南京散步');
  await page.getByLabel('字号').fill('56');
  await page.getByLabel('字号').press('Enter');
  await page.getByLabel('文字颜色').fill('#a02040');
  await page.getByRole('combobox', { name: '对齐', exact: true }).selectOption('center');
  await page.getByLabel('粗体').check();
  await page.getByLabel('斜体').check();
  const original = await savedItems(page);
  expect(original).toEqual([
    photo,
    expect.objectContaining({ kind: 'sticker', assetId: 'sticker:stamp-nanjing' }),
    expect.objectContaining({ kind: 'sticker', assetId: 'sticker:common-train' }),
    expect.objectContaining({ kind: 'text', text: '南京散步', style: {
      fontSize: 56, color: '#a02040', align: 'center', fontWeight: 'bold', fontStyle: 'italic',
    } }),
  ]);
  const [,, train, text] = original;

  await page.getByRole('button', { name: '置底', exact: true }).click();
  await expect(layerMenu(page).locator('option').nth(1)).toHaveAttribute('value', text.id);
  await page.getByRole('button', { name: '上移', exact: true }).click();
  await expect(layerMenu(page).locator('option').nth(2)).toHaveAttribute('value', text.id);
  await page.getByRole('button', { name: '置顶', exact: true }).click();
  await expect(layerMenu(page).locator('option').nth(4)).toHaveAttribute('value', text.id);
  await layerMenu(page).selectOption(train.id);
  await page.getByRole('button', { name: '下移', exact: true }).click();
  await expect(layerMenu(page).locator('option').nth(2)).toHaveAttribute('value', train.id);

  let { x, y, w, h, scale } = await itemScreenBox(page, text);
  await mouseDrag(page, x + w / 2, y + h / 2, x + w / 2 + 100 * scale, y + h / 2 + 130 * scale);
  await expect(layerMenu(page)).toHaveValue(text.id);
  const dragged = (await savedItems(page)).at(-1)!;
  expect(Math.abs(dragged.x - text.x - 100)).toBeLessThan(1 / scale);
  expect(Math.abs(dragged.y - text.y - 130)).toBeLessThan(1 / scale);

  ({ x, y, w, h } = await itemScreenBox(page, dragged));
  await mouseDrag(page, x + w, y + h, x + w * 1.3, y + h * 1.3);
  const resized = (await savedItems(page)).at(-1)!;
  expect(resized.width / dragged.width).toBeCloseTo(1.3, 1);
  expect(resized.height / dragged.height).toBeCloseTo(1.3, 1);
  expect(resized).toMatchObject({ kind: 'text', style: { fontSize: expect.any(Number) } });

  ({ x, y, w, h } = await itemScreenBox(page, resized));
  await mouseDrag(page, x + w / 2, y - 24, x + w / 2 + h / 2 + 24, y + h / 2);
  const items = await savedItems(page);
  const saved = (await readBook(page, BOOK))!;
  const rotated = items.at(-1)!;
  expect(Math.abs(rotated.rotation - 90)).toBeLessThan(1.5);
  expect(items.map((item) => item.id)).toEqual([photo.id, train.id, original[1].id, text.id]);
  expect(saved.journal).toBeUndefined();
  expect(saved.collage).toEqual({ width: 1200, height: 1600, items });
  expect(JSON.stringify(items)).not.toMatch(/blob:|scaleX|scaleY/);

  await page.reload();
  await expect(layerMenu(page)).toHaveValue('');
  ({ x, y, w, h } = await itemScreenBox(page, rotated));
  await page.mouse.click(x - h / 2, y + w / 2);
  await expect(layerMenu(page)).toHaveValue(text.id);
  await expect(page.getByLabel('文字内容')).toHaveValue('南京散步');
  await expect(page.getByLabel('粗体')).toBeChecked();

  await page.getByRole('link', { name: /Journal · 横线日记本/ }).click();
  const journal = page.getByLabel('手账正文', { exact: true });
  await expect(journal).toBeVisible();
  await page.getByRole('button', { name: '素材', exact: true }).click();
  await page.getByRole('button', { name: /选择照片 atlas-sample\.png/ }).click();
  await page.getByRole('button', { name: '使用这张素材' }).click();
  await expect(journal.getByRole('img', { name: 'atlas-sample.png' })).toBeVisible();
  await expect(page.locator('[data-state="saved"]')).toContainText('已保存');
  const shared = (await readBook(page, BOOK))!;
  if (photo.kind !== 'photo') throw new Error('Expected the uploaded photo');
  expect(JSON.stringify(shared.journal)).toContain(photo.assetId);
  expect(shared.collage?.items).toEqual(items);
  expect(await readPhotoCount(page)).toBe(1);

  await page.getByRole('link', { name: /Collage · 自由拼贴/ }).click();
  await layerMenu(page).selectOption(photo.id);
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('link', { name: /Journal · 横线日记本/ }).click();
  await expect(journal.getByRole('img', { name: 'atlas-sample.png' })).toBeVisible();
  const savedAfterDeletion = (await readBook(page, BOOK))!;
  expect(savedAfterDeletion.collage?.items).toEqual(items.slice(1));
  expect(savedAfterDeletion.journal).toEqual(shared.journal);
  expect(await readPhotoCount(page)).toBe(1);

  await page.goto(`/#/book/${OTHER}?mode=collage`);
  await expect(layerMenu(page).locator('option')).toHaveCount(1);
  await page.getByRole('button', { name: '添加文字', exact: true }).click();
  expect(await savedItems(page, OTHER)).toMatchObject([{ kind: 'text', text: '新文字' }]);
  expect(await readBook(page, BOOK)).toEqual(savedAfterDeletion);
  expect(errors).toEqual([]);
});

test('a failed collage write stays pending, blocks leaving and can be retried', async ({ page }) => {
  await seedBooks(page, [seedBook(BOOK, '保存重试')]);
  await page.goto(COLLAGE_URL);
  await expect(layerMenu(page)).toBeVisible();
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === 'books') throw new DOMException('Simulated full storage', 'QuotaExceededError');
      return put.apply(this, args);
    };
    window.addEventListener('test:allow-book-writes', () => { IDBObjectStore.prototype.put = put; }, { once: true });
  });
  await page.getByRole('button', { name: '添加文字', exact: true }).click();
  await expect(page.locator('[data-state="error"]')).toContainText('保存失败');
  expect((await readBook(page, BOOK))?.collage).toBeUndefined();
  await page.getByRole('link', { name: /Journal · 横线日记本/ }).click();
  const guard = page.getByRole('dialog', { name: '保存失败，暂时不能离开', exact: true });
  await guard.getByRole('button', { name: '留在本页' }).click();
  await expect(page.getByLabel('文字内容')).toHaveValue('新文字');

  await page.evaluate(() => window.dispatchEvent(new Event('test:allow-book-writes')));
  await page.getByRole('button', { name: '重试', exact: true }).click();
  expect(await savedItems(page)).toMatchObject([{ kind: 'text', text: '新文字' }]);
  await page.reload();
  await expect(layerMenu(page).locator('option')).toHaveCount(2);
});

test.describe('narrow touch viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('a missing photo remains visible and touch gestures commit logical coordinates', async ({ page, context }) => {
    const item: CollageItem = { id: 'missing', kind: 'photo', assetId: 'photo:missing', x: 140, y: 150, width: 340, height: 260, rotation: 0 };
    await seedBooks(page, [seedBook(BOOK, '窄屏拼贴', 'nanjing', { collage: { width: 1200, height: 1600, items: [item] } })]);
    await page.goto(COLLAGE_URL);
    await expect.poll(() => pixelAt(page, 170, 180)).toEqual([228, 228, 228, 255]);
    const session = await context.newCDPSession(page);
    async function touchDrag(x: number, y: number, dx: number, dy: number) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const part of [0.25, 0.5, 0.75, 1]) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + part * dx, y: y + part * dy }] });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }

    let { x, y, w, h, scale } = await itemScreenBox(page, item);
    await page.touchscreen.tap(x + w / 2, y + h / 2);
    await expect(layerMenu(page)).toHaveValue(item.id);
    await touchDrag(x + w / 2, y + h / 2, 90 * scale, 110 * scale);
    const [moved] = await savedItems(page);
    expect(Math.abs(moved.x - item.x - 90)).toBeLessThan(1 / scale);
    expect(Math.abs(moved.y - item.y - 110)).toBeLessThan(1 / scale);

    ({ x, y, w, h } = await itemScreenBox(page, moved));
    await touchDrag(x + w, y + h, w * 0.4, h * 0.4);
    const [resized] = await savedItems(page);
    expect(resized.width / item.width).toBeCloseTo(1.4, 1);
    expect(resized.height / item.height).toBeCloseTo(1.4, 1);

    ({ x, y, w, h } = await itemScreenBox(page, resized));
    await touchDrag(x + w / 2, y - 24, h / 2 + 24, h / 2 + 24);
    const [rotated] = await savedItems(page);
    expect(Math.abs(rotated.rotation - 90)).toBeLessThan(1.5);

    await page.setViewportSize({ width: 520, height: 900 });
    await page.reload();
    ({ x, y, w, h } = await itemScreenBox(page, rotated));
    await page.touchscreen.tap(x - h / 2, y + w / 2);
    await expect(layerMenu(page)).toHaveValue(item.id);
    expect((await readBook(page, BOOK))?.collage?.items).toEqual([rotated]);
  });
});
