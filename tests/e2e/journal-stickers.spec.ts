import { expect, test, type Locator, type Page } from '@playwright/test';
import type { JournalContent, JournalNode } from '../../src/data/contracts';
import { readBook, seedBook, seedBooks } from './book-helpers';

const COMMON_STICKERS = [
  { rawId: 'common-gramophone', label: '留声机' },
  { rawId: 'common-postage-sunflower', label: '向日葵邮票' },
  { rawId: 'common-camera', label: '胶片相机' },
  { rawId: 'common-train', label: '绿皮火车' },
] as const;

function paragraph(text: string): JournalNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function textOf(node: JournalNode): string {
  return node.text ?? (node.content ?? []).map(textOf).join('');
}

function documentOrder(journal: JournalContent | undefined) {
  return (journal?.doc.content ?? []).map((node) => node.type === 'atlasMedia'
    ? { type: node.type, assetId: node.attrs?.assetId, caption: node.attrs?.caption }
    : { type: node.type, text: textOf(node) });
}

async function selectText(editor: Locator, start: number, length: number): Promise<void> {
  await editor.focus();
  await editor.press('ControlOrMeta+Home');
  for (let index = 0; index < start; index += 1) await editor.press('ArrowRight');
  for (let index = 0; index < length; index += 1) await editor.press('Shift+ArrowRight');
}

async function openSharedStickers(page: Page): Promise<Locator> {
  // This must use the shared panel: PR #13's journal sticker button opens the
  // independent floating layer, which does not insert an atlasMedia node.
  await page.getByRole('button', { name: '素材', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '挑一张贴进手账', exact: true });
  await expect(panel).toBeVisible();
  const tab = panel.getByRole('tab', { name: /^贴纸\s+\d+$/ });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByRole('button', { name: /^选择贴纸 / })).toHaveCount(9);
  return panel;
}

async function expectLoadedArtwork(image: Locator, rawId: string): Promise<void> {
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  // The preview server serves Vite's real build assets, not injected data URLs.
  await expect(image).toHaveAttribute('src', new RegExp(`(?:^|/)${rawId}-[A-Za-z0-9_-]+\\.(?:png|jpg)$`));
  await expect.poll(() => image.evaluate((element) => {
    const img = element as HTMLImageElement;
    return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  })).toBe(true);
}

for (const sticker of [
  { rawId: 'common-camera', label: '胶片相机' },
  { rawId: 'nanjing-plum-blossom', label: '梅花' },
] as const) {
  test(`shared ${sticker.rawId} preserves selected text, media order and the real image after reload`, async ({ page }) => {
    const bookId = `shared-sticker-${sticker.rawId}`;
    const assetId = `sticker:${sticker.rawId}`;
    const prefix = '从南京出发。';
    const selected = '选中的这句话必须完整保留。';
    const suffix = '傍晚回到城里。';
    const nextParagraph = '下一段的顺序也不能改变。';
    const original: JournalContent = {
      doc: { type: 'doc', content: [paragraph(prefix + selected + suffix), paragraph(nextParagraph)] },
    };
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await seedBooks(page, [seedBook(bookId, '真实共享贴纸', 'nanjing', { journal: original })]);
    await page.goto(`/#/book/${bookId}?mode=journal`);
    const editor = page.getByRole('textbox', { name: '手账正文', exact: true });
    await expect(editor).toBeVisible();
    await selectText(editor, prefix.length, selected.length);
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(selected);

    const panel = await openSharedStickers(page);
    const tile = panel.getByRole('button', { name: `选择贴纸 ${sticker.label}`, exact: true });
    await expectLoadedArtwork(tile.getByRole('img', { name: `${sticker.label} 预览`, exact: true }), sticker.rawId);
    await tile.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'true');
    await panel.getByRole('button', { name: '使用这张素材', exact: true }).click();
    await expect(panel).toBeHidden();

    const media = editor.locator('[data-type="atlasMedia"]');
    await expect(media).toHaveCount(1);
    await expectLoadedArtwork(media.getByRole('img', { name: sticker.label, exact: true }), sticker.rawId);
    await expect(media.getByRole('textbox', { name: '素材说明' })).toHaveCount(0);

    const expectedOrder = [
      { type: 'paragraph', text: prefix + selected },
      { type: 'atlasMedia', assetId, caption: '' },
      { type: 'paragraph', text: suffix },
      { type: 'paragraph', text: nextParagraph },
    ];
    await expect.poll(async () => documentOrder((await readBook(page, bookId))?.journal)).toEqual(expectedOrder);
    const stored = (await readBook(page, bookId))!.journal!;
    expect(stored.doc.content?.[1].attrs).toEqual({ assetId, caption: '', rotation: 0, lines: 3 });
    await expect(editor.locator(':scope > p')).toHaveText([prefix + selected, suffix, nextParagraph]);

    await page.reload();
    await expect(editor).toBeVisible();
    await expect(editor.locator(':scope > p')).toHaveText([prefix + selected, suffix, nextParagraph]);
    await expect(media).toHaveCount(1);
    await expect(media.getByRole('textbox', { name: '素材说明' })).toHaveCount(0);
    await expectLoadedArtwork(media.getByRole('img', { name: sticker.label, exact: true }), sticker.rawId);
    const restored = (await readBook(page, bookId))?.journal;
    expect(documentOrder(restored)).toEqual(expectedOrder);
    expect(restored).toEqual(stored);

    await media.getByRole('img', { name: sticker.label, exact: true }).click();
    await media.getByRole('button', { name: '取走这一格', exact: true }).click();
    await expect(media).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('the real shared catalog isolates city artwork and loads common stickers in both cities', async ({ page }) => {
  const cities = [
    { id: 'nanjing', labels: ['南京邮票', '鸡鸣寺', '鸭血粉丝汤', '梅花', '南京云锦'] },
    { id: 'shanghai', labels: ['上海邮票', '海派旗袍少女', '白玉兰', '生煎包', '武康大楼'] },
  ];
  await seedBooks(page, cities.map((city) => seedBook(`catalog-${city.id}`, '城市贴纸目录', city.id)));

  for (const city of cities) {
    await page.goto(`/#/book/catalog-${city.id}?mode=journal`);
    await expect(page.getByRole('textbox', { name: '手账正文', exact: true })).toBeVisible();
    const panel = await openSharedStickers(page);
    const expectedLabels = [...COMMON_STICKERS.map((sticker) => sticker.label), ...city.labels]
      .map((label) => `选择贴纸 ${label}`).sort();
    const tiles = panel.getByRole('button', { name: /^选择贴纸 / });
    await expect.poll(() => tiles.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')).sort()))
      .toEqual(expectedLabels);

    for (const sticker of COMMON_STICKERS) {
      const tile = panel.getByRole('button', { name: `选择贴纸 ${sticker.label}`, exact: true });
      await expect(tile).toBeEnabled();
      await expectLoadedArtwork(tile.getByRole('img', { name: `${sticker.label} 预览`, exact: true }), sticker.rawId);
    }
    await panel.getByRole('button', { name: '关闭素材面板', exact: true }).click();
    await expect(panel).toBeHidden();
  }
});
