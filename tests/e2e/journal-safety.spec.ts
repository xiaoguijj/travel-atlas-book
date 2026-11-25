import { expect, test, type Locator } from '@playwright/test';
import { resolve } from 'node:path';
import type { JournalContent, JournalNode } from '../../src/data/contracts';
import { readBook, seedBook, seedBooks } from './book-helpers';

const BOOK_ID = 'journal-safety-book';
const BOOK_URL = `/#/book/${BOOK_ID}?mode=journal`;

function paragraph(text: string): JournalNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function textOf(node: JournalNode | undefined): string {
  if (!node) return '';
  return node.text ?? (node.content ?? []).map(textOf).join('');
}

async function selectText(editor: Locator, start: number, length: number): Promise<void> {
  await editor.focus();
  await editor.press('ControlOrMeta+Home');
  for (let index = 0; index < start; index += 1) await editor.press('ArrowRight');
  for (let index = 0; index < length; index += 1) await editor.press('Shift+ArrowRight');
}

for (const entry of ['journal toolbar', 'shared toolbar'] as const) {
  test(`photo insertion preserves the selected text through the ${entry} and after refresh`, async ({ page }) => {
    const prefix = '出发。';
    const selected = '路上遇见梧桐。';
    const suffix = '晚上回家。';
    const paragraphs = entry === 'journal toolbar'
      ? [paragraph(prefix + selected + suffix)]
      : [paragraph('第一段仍然保留。'), paragraph('第二段也仍然保留。')];
    const original: JournalContent = { doc: { type: 'doc', content: paragraphs } };
    await seedBooks(page, [seedBook(BOOK_ID, '插照片不能删字', 'nanjing', { journal: original })]);
    await page.goto(BOOK_URL);
    const editor = page.getByRole('textbox', { name: '手账正文', exact: true });
    await expect(editor).toBeVisible();

    if (entry === 'journal toolbar') {
      await selectText(editor, prefix.length, selected.length);
      await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(selected);
      await page.getByRole('button', { name: '插入照片', exact: true }).click();
    } else {
      await editor.focus();
      await editor.press('ControlOrMeta+a');
      await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain('第二段');
      await page.getByRole('button', { name: '素材', exact: true }).click();
    }

    const dialog = page.getByRole('dialog', { name: '挑一张贴进手账' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type=file]').setInputFiles(resolve('tests/fixtures/atlas-sample.png'));
    await expect(dialog.getByText('照片已加入素材', { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: '使用这张素材' }).click();
    await expect(dialog).toBeHidden();
    await expect(editor.locator('[data-type="atlasMedia"] img')).toBeVisible();

    await expect.poll(async () => {
      const stored = (await readBook(page, BOOK_ID))?.journal;
      return {
        text: textOf(stored?.doc),
        photos: stored?.doc.content?.filter((node) => node.type === 'atlasMedia').length,
      };
    }).toEqual({ text: textOf(original.doc), photos: 1 });

    if (entry === 'journal toolbar') {
      const stored = (await readBook(page, BOOK_ID))!.journal!;
      const mediaIndex = stored.doc.content!.findIndex((node) => node.type === 'atlasMedia');
      expect(textOf(stored.doc.content![mediaIndex - 1])).toBe(prefix + selected);
      expect(textOf(stored.doc.content![mediaIndex + 1])).toBe(suffix);
    }

    await page.reload();
    await expect(editor).toBeVisible();
    await expect(editor.locator('[data-type="atlasMedia"] img')).toBeVisible();
    const visibleText = await editor.locator(':scope > p').allTextContents();
    expect(visibleText.join('')).toBe(textOf(original.doc));
    expect(textOf((await readBook(page, BOOK_ID))?.journal?.doc)).toBe(textOf(original.doc));
  });
}

test('a damaged book remains reachable from a shelf shared with a healthy book', async ({ page }) => {
  const broken = { doc: { type: 'doc', content: [null] } } as unknown as JournalContent;
  await seedBooks(page, [seedBook('healthy', '正常手账'), seedBook(BOOK_ID, '待恢复手账', 'nanjing', { journal: broken })]);
  await page.goto('/#/section/journals?cityId=nanjing');
  await page.getByRole('button', { name: /正常手账/ }).click();
  await expect(page.getByRole('link', { name: /Journal 横线日记本/ })).toBeVisible();
  await page.goto('/#/section/journals?cityId=nanjing');
  await page.getByRole('button', { name: /待恢复手账/ }).click();
  await page.getByRole('link', { name: /Journal 横线日记本/ }).click();
  await expect(page.getByRole('alert')).toContainText('正文暂时无法完整读取');
  expect((await readBook(page, BOOK_ID))?.journal).toEqual(broken);
});

test('legacy paragraph formatting survives a title edit and reload in recovery', async ({ page }) => {
  const original: JournalContent = { doc: { type: 'doc', content: [{ ...paragraph('居中的文字'), attrs: { textAlign: 'center' } }] } };
  await seedBooks(page, [seedBook(BOOK_ID, '旧版排版', 'nanjing', { journal: original })]);
  await page.goto(BOOK_URL);
  await expect(page.getByRole('alert')).toContainText('正文暂时无法完整读取');
  await expect(page.getByRole('textbox', { name: '手账正文' })).toHaveCount(0);
  await page.getByLabel('手账标题').fill('新标题');
  await expect.poll(async () => (await readBook(page, BOOK_ID))?.title).toBe('新标题');
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('正文暂时无法完整读取');
  expect((await readBook(page, BOOK_ID))?.journal).toEqual(original);
});

test('an unsupported document keeps its original content and flushes a just-edited title before reloading', async ({ page }) => {
  const original: JournalContent = {
    doc: {
      type: 'doc',
      content: [
        paragraph('前面的中文正文不能丢。'),
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '旧版标题' }] },
        paragraph('后面的中文正文也不能丢。'),
      ],
    },
  };
  await seedBooks(page, [seedBook(BOOK_ID, '旧文档保护', 'nanjing', { journal: original })]);
  await page.goto(BOOK_URL);
  const recovery = page.getByRole('alert').filter({ hasText: '正文暂时无法完整读取' });
  await expect(recovery).toContainText('原始正文仍保留在本机');
  await expect(page.locator('header [role="status"]')).toContainText('正文读取失败，原文已保留');
  await expect(page.getByRole('textbox', { name: '手账正文', exact: true })).toHaveCount(0);
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);

  // The in-app recovery action must flush other fields, even within their debounce window.
  const reloadButton = page.getByRole('button', { name: '重新读取正文', exact: true });
  await expect(reloadButton).toBeEnabled();
  await reloadButton.hover();
  const unexpectedDialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    unexpectedDialogs.push(dialog.type());
    await dialog.accept();
  });
  await page.getByLabel('手账标题').fill('原文保留的手账');
  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    reloadButton.click(),
  ]);
  await expect(recovery).toContainText('正文编辑和自动保存已暂停');
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(page.getByLabel('手账标题')).toHaveValue('原文保留的手账');
  const reloaded = await readBook(page, BOOK_ID);
  expect(reloaded?.title).toBe('原文保留的手账');
  expect(reloaded?.journal).toEqual(original);
  expect(unexpectedDialogs).toEqual([]);
});

test('recovery reports a blocked reload, permits retry and reloads after the title is corrected', async ({ page }) => {
  const original: JournalContent = {
    doc: {
      type: 'doc',
      content: [
        paragraph('重新读取失败也不能覆盖这段原文。'),
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '尚不支持的标题' }] },
      ],
    },
  };
  await seedBooks(page, [seedBook(BOOK_ID, '等待恢复的手账', 'nanjing', { journal: original })]);
  await page.goto(BOOK_URL);
  const recovery = page.getByRole('alert').filter({ hasText: '正文暂时无法完整读取' });
  const reloadButton = recovery.getByRole('button', { name: '重新读取正文', exact: true });
  const title = page.getByLabel('手账标题');
  const failure = recovery.getByText('其他修改暂时没能保存，已留在本页。请重试保存后再重新读取。', { exact: true });
  await expect(reloadButton).toBeEnabled();

  // An invalid title makes the real save queue return false without throwing.
  // The recovery action must report that result and retain the unsaved input.
  await title.fill('');
  await reloadButton.click();
  await expect(failure).toBeVisible();
  await expect(reloadButton).toBeEnabled();
  await expect(title).toHaveValue('');
  await expect(page.locator('header [role="status"]')).toContainText('标题保存失败，正文保护中');
  expect((await readBook(page, BOOK_ID))?.title).toBe('等待恢复的手账');
  expect((await readBook(page, BOOK_ID))?.journal).toEqual(original);

  // Retrying the same failure remains possible and cannot dismiss the warning.
  await reloadButton.click();
  await expect(failure).toBeVisible();
  await expect(reloadButton).toBeEnabled();
  await expect(title).toHaveValue('');

  await title.fill('修正标题后继续恢复');
  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    reloadButton.click(),
  ]);
  await expect(recovery).toContainText('正文编辑和自动保存已暂停');
  await expect(failure).toHaveCount(0);
  await expect(title).toHaveValue('修正标题后继续恢复');
  await expect(page.getByRole('textbox', { name: '手账正文', exact: true })).toHaveCount(0);
  const reloaded = await readBook(page, BOOK_ID);
  expect(reloaded?.title).toBe('修正标题后继续恢复');
  expect(reloaded?.journal).toEqual(original);
});

test('reopening in the same session retains text and intentionally clearing it stays empty after reload', async ({ page }) => {
  await seedBooks(page, [seedBook(BOOK_ID, '来回打开和删空')]);
  await page.goto(BOOK_URL);
  const editor = page.getByRole('textbox', { name: '手账正文', exact: true });
  await editor.fill('这一段先保存，稍后主动删掉。');
  await page.getByRole('link', { name: /返回创作模式/ }).click();
  await page.waitForURL(new RegExp(`/book/${BOOK_ID}$`));
  await page.locator('a[href*="mode=journal"]').click();
  await expect(editor).toHaveText('这一段先保存，稍后主动删掉。');

  await editor.focus();
  await editor.press('ControlOrMeta+a');
  await editor.press('Backspace');
  await expect.poll(async () => {
    const journal = (await readBook(page, BOOK_ID))?.journal;
    return journal ? textOf(journal.doc) : null;
  }).toBe('');
  await page.reload();
  await expect(editor).toBeVisible();
  await expect(editor).toHaveText('');
  expect(textOf((await readBook(page, BOOK_ID))?.journal?.doc)).toBe('');
});

test('clicking an automatically detected link edits the text without opening another tab', async ({ page, context }) => {
  await seedBooks(page, [seedBook(BOOK_ID, '链接编辑')]);
  await page.goto(BOOK_URL);
  const editor = page.getByRole('textbox', { name: '手账正文', exact: true });
  await editor.fill('https://example.com ');
  const link = editor.getByRole('link', { name: 'https://example.com' });
  await expect(link).toHaveAttribute('href', 'https://example.com');
  await link.click();
  await expect(editor).toBeFocused();
  await editor.press('End');
  await page.keyboard.insertText('继续补记');
  await expect.poll(async () => textOf((await readBook(page, BOOK_ID))?.journal?.doc)).toContain('继续补记');
  expect(context.pages()).toHaveLength(1);
  await expect(page).toHaveURL(new RegExp(`/book/${BOOK_ID}\\?mode=journal$`));
});
