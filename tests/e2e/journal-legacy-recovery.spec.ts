import { expect, test } from '@playwright/test';
import type { JournalContent } from '../../src/data/contracts';
import { readBook, seedBook, seedBooks } from './book-helpers';

const originals: { name: string; content: JournalContent }[] = [
  {
    name: 'text stored on a non-text paragraph',
    content: { doc: { type: 'doc', content: [{ type: 'paragraph', text: '旧原文不能被解析器丢弃' }] } },
  },
  {
    name: 'nested content on a text node',
    content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{
      type: 'text', text: '外层文字', content: [{ type: 'text', text: '内层旧文字也必须保留' }],
    }] }] } },
  },
];

for (const original of originals) {
  test(`legacy recovery protects ${original.name} through a title save and reload`, async ({ page }) => {
    const id = 'legacy-raw-journal';
    await seedBooks(page, [seedBook(id, '需要保护的旧档', 'nanjing', { journal: original.content })]);
    await page.goto(`/#/book/${id}?mode=journal`);
    const notice = page.getByRole('alert').filter({ hasText: '正文暂时无法完整读取' });
    await expect(notice).toBeVisible();
    await expect(page.getByRole('textbox', { name: '手账正文', exact: true })).toHaveCount(0);
    await page.getByLabel('手账标题').fill('标题仍然可以正常保存');
    await Promise.all([
      page.waitForEvent('domcontentloaded'),
      notice.getByRole('button', { name: '重新读取正文', exact: true }).click(),
    ]);
    await expect(notice).toBeVisible();
    await expect(page.getByLabel('手账标题')).toHaveValue('标题仍然可以正常保存');
    const stored = (await readBook(page, id))!;
    expect(stored.journal).toEqual(original.content);
    expect(stored.title).toBe('标题仍然可以正常保存');
  });
}
