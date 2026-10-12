/**
 * Paragraph edits on real-world-like pages through the UI (craft spec §4.2, §4.7; the corpus
 * of `tools/fixtures/edit-corpus-fixtures.ts`, the matrices `packages/engine/src/text-edit/
 * edit-matrix.test.ts` and `src/text-edit/edit-matrix.test.ts`). Each case opens a corpus page,
 * arms Edit text (E), clicks into a paragraph, edits it from the keyboard, commits (Esc), opens
 * the paragraph again to see the committed text, and the export cases download the file, open
 * it again and search the new text.
 *
 * Known failures are `test.fail()` with the bug they reproduce.
 */
import { readFile } from 'node:fs/promises';

import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  fixturePath,
  historyStep,
  inHistory,
  openFindPanel,
  openSaveCopy,
  useFileInputPicker,
} from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Covered in Chromium');
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  // Force the <a download> path: Playwright cannot drive the native save picker.
  await page.addInitScript({
    content:
      "Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });",
  });
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
});

/** Opens `text-edit-corpus/<file>` and arms Edit text. */
async function openCorpus(page: Page, file: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await chooser).setFiles(fixturePath(`text-edit-corpus/${file}`));
  await expect(page.getByRole('tab', { name: file.replace(/\.pdf$/, '') })).toBeVisible();
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await page.locator('[data-read-viewport]').focus();
  await page.keyboard.press('e');
  await expect(page.getByRole('button', { name: 'Edit text' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}

/** Clicks just inside the first run whose text starts with `prefix`: the paragraph editor. */
async function openParagraph(page: Page, prefix: string): Promise<Locator> {
  const run = page
    .locator(`[data-text-edit-layer="0"] [data-text-run^=${JSON.stringify(prefix)}]`)
    .first();
  await expect(run).toBeVisible({ timeout: 20_000 });
  const box = await run.boundingBox();
  if (!box) throw new Error(`run "${prefix}" not laid out`);
  await page.mouse.click(box.x + 1, box.y + box.height / 2);
  const editor = page.getByRole('textbox', { name: 'Paragraph on page 1' });
  await expect(editor).toBeFocused({ timeout: 20_000 });
  return editor;
}

/**
 * Opens the committed paragraph again through its Edit text target (the layer offers a
 * detected paragraph as one button named after its text).
 */
async function reopenParagraph(page: Page, prefix: string): Promise<Locator> {
  const target = page
    .getByRole('button', { name: new RegExp(`^Edit paragraph “${prefix}`) })
    .first();
  await expect(target).toBeVisible({ timeout: 20_000 });
  // The paragraph's runs lie over its target: click its first glyph, as a user would.
  const box = await target.boundingBox();
  if (!box) throw new Error(`paragraph "${prefix}" not laid out`);
  await page.mouse.click(box.x + 2, box.y + Math.min(box.height / 2, 8));
  const editor = page.getByRole('textbox', { name: 'Paragraph on page 1' });
  await expect(editor).toBeFocused({ timeout: 20_000 });
  return editor;
}

/** Esc after the settled preview: no error, the editor closes, one history entry. */
async function commit(page: Page, editor: Locator): Promise<void> {
  await expect(page.locator('[data-paragraph-editor]')).toHaveAttribute('data-preview', '', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('paragraph-error')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0, { timeout: 20_000 });
  await inHistory(page, (list) =>
    expect(historyStep(list, /^Paragraph edited/)).toHaveCount(1, { timeout: 20_000 }),
  );
}

/** The editor's text with white space collapsed. */
async function textOf(editor: Locator): Promise<string> {
  return ((await editor.textContent()) ?? '').replace(/\s+/gu, ' ').trim();
}

/** Downloads a copy, opens it as `name`.pdf and returns the hits of `query`. */
async function exportAndSearch(page: Page, name: string, query: string): Promise<Locator> {
  await page.keyboard.press('Escape');
  const exportDialog = await openSaveCopy(page);
  const downloadPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download copy' }).click();
  const bytes = await readFile(await (await downloadPromise).path());
  await page.keyboard.press('Escape');
  const reopen = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await reopen).setFiles({
    name: `${name}.pdf`,
    mimeType: 'application/pdf',
    buffer: bytes,
  });
  await expect(page.getByRole('tab', { name, exact: true })).toBeVisible();
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  let field = page.locator('#left-panel').getByRole('searchbox', { name: 'Find in document' });
  if (!(await field.isVisible())) field = await openFindPanel(page);
  await field.fill(query);
  return page.getByTestId('search-hit');
}

test('word export: a word typed into a kerned TJ line survives reopen and export', async ({
  page,
}) => {
  await openCorpus(page, 'word-export.pdf');
  const editor = await openParagraph(page, 'Thanks');
  await expect(editor).toHaveText(/^Thanks are due/);
  await page.keyboard.type('Bright ');
  await expect(editor).toHaveText(/^Bright Thanks are due/);
  await commit(page, editor);

  const again = await reopenParagraph(page, 'Bright');
  expect(await textOf(again)).toBe(
    'Bright Thanks are due to the parish council and to all who gave their time.',
  );
  await page.keyboard.press('Escape');
  await expect(again).toHaveCount(0, { timeout: 20_000 });
  const hits = await exportAndSearch(page, 'word-bright', 'Bright Thanks are due');
  await expect(hits).toHaveCount(1, { timeout: 20_000 });
});

test('word export: Backspace at a line start joins two words of a Tw-justified paragraph', async ({
  page,
}) => {
  await openCorpus(page, 'word-export.pdf');
  const editor = await openParagraph(page, 'Borrowing');
  const before = await textOf(editor);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  const after = await textOf(editor);
  expect(after.length).toBe(before.length - 1);
  await commit(page, editor);
  const again = await reopenParagraph(page, 'Borrowing');
  expect(await textOf(again)).toBe(after);
});

test('word export: select all, delete and type into a one-line paragraph', async ({ page }) => {
  test.fail(
    true,
    "typing into an emptied paragraph gives the characters style '' (paragraph-model replaceRange): the caret stays put and the commit is refused (invalid-range)",
  );
  await openCorpus(page, 'word-export.pdf');
  const editor = await openParagraph(page, 'Thanks');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('Fresh words');
  await expect(editor).toHaveText('Fresh words');
  await commit(page, editor);
  const again = await reopenParagraph(page, 'Fresh');
  expect(await textOf(again)).toBe('Fresh words');
});

test('cid Turkish: letters the subset lacks fall back and read back after export', async ({
  page,
}) => {
  await openCorpus(page, 'cid-turkish.pdf');
  const editor = await openParagraph(page, 'Kütüphane');
  await page.keyboard.type('ĞÖ ');
  await expect(editor).toHaveText(/^ĞÖ Kütüphane/);
  await expect(page.getByTestId('paragraph-honesty')).toContainText('because the original font');
  await commit(page, editor);
  const hits = await exportAndSearch(page, 'turkish-fallback', 'ĞÖ Kütüphane');
  await expect(hits).toHaveCount(1, { timeout: 20_000 });
});

test('per glyph: a word typed into a paragraph drawn one glyph per show', async ({ page }) => {
  await openCorpus(page, 'per-glyph.pdf');
  const editor = await openParagraph(page, 'E');
  await expect(editor).toHaveText(/^Every glyph of this paragraph/);
  await page.keyboard.press('ControlOrMeta+ArrowLeft');
  await page.keyboard.type('Now ');
  await expect(editor).toHaveText(/^Now Every glyph/);
  await commit(page, editor);
  const again = await reopenParagraph(page, 'Now');
  expect(await textOf(again)).toMatch(/^Now Every glyph of this paragraph is placed/);
});

test('quote-operator paragraph: text pasted with line breaks', async ({ page }) => {
  await openCorpus(page, 'spacing-ops.pdf');
  const editor = await openParagraph(page, 'This last paragraph');
  await page.keyboard.insertText('Pasted one\nPasted two\n');
  await expect(editor).toContainText('Pasted one');
  await commit(page, editor);
  const again = await reopenParagraph(page, 'Pasted');
  // The pasted lines end in line breaks: detection now reads them as a paragraph of their own.
  expect(await textOf(again)).toBe('Pasted one Pasted two');
});

test('quote-operator paragraph: Turkish letters in the substitute font commit', async ({
  page,
}) => {
  test.fail(
    true,
    'verification-failed: substitute glyphs land 0.02 pt off their planned origins (engine edit-matrix: spacing-ops.pdf#3 turkish)',
  );
  await openCorpus(page, 'spacing-ops.pdf');
  const editor = await openParagraph(page, 'This last paragraph');
  await page.keyboard.type('ğüşıöç İĞÜŞÖÇ ');
  await expect(editor).toHaveText(/^ğüşıöç İĞÜŞÖÇ This last/);
  await commit(page, editor);
});
