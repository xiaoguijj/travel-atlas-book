import { expect, test, type Page } from '@playwright/test';
import type { JournalContent, JournalNode } from '../../src/data/contracts';
import { readBook, seedBook, seedBooks } from './book-helpers';

const BOOK_ID = 'journal-concurrent-book';
const URL = `/#/book/${BOOK_ID}?mode=journal`;

function textOf(node: JournalNode | undefined): string {
  return node?.text ?? (node?.content ?? []).map(textOf).join('');
}

const initial: JournalContent = {
  doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '共同原文' }] }] },
};

const editor = (page: Page) => page.getByRole('textbox', { name: '手账正文', exact: true });

test('a stale tab preserves both versions and can save its current body as a separate book', async ({ page, context }) => {
  await seedBooks(page, [seedBook(BOOK_ID, '多页正文保护', 'nanjing', { journal: initial })]);
  const other = await context.newPage();
  await Promise.all([page.goto(URL), other.goto(URL)]);
  await expect(editor(page)).toHaveText('共同原文');
  await expect(editor(other)).toHaveText('共同原文');

  await editor(page).fill('共同原文；A新增的重要段落');
  await expect.poll(async () => textOf((await readBook(page, BOOK_ID))?.journal?.doc)).toBe('共同原文；A新增的重要段落');

  // A title receipt returns the latest stored book, but must not rebase B's editor.
  await other.getByLabel('手账标题').fill('B改了标题');
  await expect.poll(async () => (await readBook(page, BOOK_ID))?.title).toBe('B改了标题');
  await editor(other).fill('共同原文；B不同的段落');
  const conflict = other.getByRole('alert').filter({ hasText: '正文有其他版本' });
  await expect(conflict).toBeVisible();
  await expect(other.locator('header [data-state="error"]')).toContainText('正文保存冲突');
  await other.getByRole('button', { name: '重试', exact: true }).click();
  await expect(other.locator('header [data-state="error"]')).toBeVisible();
  expect(textOf((await readBook(other, BOOK_ID))?.journal?.doc)).toBe('共同原文；A新增的重要段落');
  await expect(editor(other)).toHaveText('共同原文；B不同的段落');

  await conflict.getByRole('button', { name: '另存本页正文', exact: true }).click();
  const copyLink = conflict.getByRole('link', { name: '打开正文副本（新标签页）' });
  await expect(copyLink).toBeVisible();
  const href = await copyLink.getAttribute('href');
  const copyId = decodeURIComponent(href!.match(/\/book\/([^?]+)/)![1]);
  expect(copyId).not.toBe(BOOK_ID);
  expect(textOf((await readBook(other, copyId))?.journal?.doc)).toBe('共同原文；B不同的段落');
  await expect(conflict).toContainText('之后在本页继续编辑的内容需要再次另存');

  await editor(other).fill('B另存后继续写的内容');
  await expect(other.locator('header [data-state="error"]')).toBeVisible();
  expect(textOf((await readBook(other, copyId))?.journal?.doc)).toBe('共同原文；B不同的段落');
  expect(textOf((await readBook(other, BOOK_ID))?.journal?.doc)).toBe('共同原文；A新增的重要段落');

  await other.getByRole('link', { name: /返回创作模式/ }).click();
  const guard = other.getByRole('dialog', { name: '保存失败，暂时不能离开' });
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: '留在本页' }).click();
  await expect(editor(other)).toHaveText('B另存后继续写的内容');

  const popup = other.waitForEvent('popup');
  await copyLink.click();
  const copyPage = await popup;
  await expect(editor(copyPage)).toHaveText('共同原文；B不同的段落');
  await editor(copyPage).fill('在独立副本继续编辑');
  await expect.poll(async () => textOf((await readBook(copyPage, copyId))?.journal?.doc)).toBe('在独立副本继续编辑');
  expect(textOf((await readBook(page, BOOK_ID))?.journal?.doc)).toBe('共同原文；A新增的重要段落');
});

test('two tabs saving from the same snapshot cannot both overwrite the book successfully', async ({ page, context }) => {
  await seedBooks(page, [seedBook(BOOK_ID, '同时保存', 'nanjing', { journal: initial })]);
  const other = await context.newPage();
  await Promise.all([page.goto(URL), other.goto(URL)]);
  await expect(editor(page)).toHaveText('共同原文');
  await expect(editor(other)).toHaveText('共同原文');
  await Promise.all([editor(page).fill('同时提交A'), editor(other).fill('同时提交B')]);

  await expect.poll(async () => {
    const flags = await Promise.all([page, other].map((tab) => tab.locator('header [data-state="error"]').count()));
    return flags.reduce((sum, value) => sum + value, 0);
  }).toBe(1);
  const stored = textOf((await readBook(page, BOOK_ID))?.journal?.doc);
  expect(['同时提交A', '同时提交B']).toContain(stored);
  const losingPage = stored === '同时提交A' ? other : page;
  await expect(editor(losingPage)).toHaveText(stored === '同时提交A' ? '同时提交B' : '同时提交A');
  await expect(losingPage.getByRole('alert').filter({ hasText: '正文有其他版本' })).toBeVisible();
  await losingPage.getByRole('button', { name: '重试', exact: true }).click();
  await expect(losingPage.locator('header [data-state="error"]')).toBeVisible();
  expect(textOf((await readBook(page, BOOK_ID))?.journal?.doc)).toBe(stored);
});
