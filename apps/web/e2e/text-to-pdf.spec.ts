/**
 * Text (.txt) to PDF end to end (conversion memo step 2, PRD-19): a `.txt` opened through
 * Open files becomes the document `<name>.pdf` with real text, so its page appears and Find
 * finds a word in it, Turkish letters included. The "Text to PDF…" command opens a picker on
 * .txt files. Markdown (.md, PRD-28) takes the same paths through its own converter.
 */
import { expect, test } from '@playwright/test';

import { fixturePath, openFindPanel, quiet, trackEngine, useFileInputPicker } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Covered in Chromium');
test.use({ viewport: { width: 1440, height: 900 } });

const TEXT = [
  'Merhaba dünya',
  '',
  'İstanbul çarşısında şeker ve ağaç gölgesinde ılık bir Işık.',
  'Zürafa, öğrenci, şişe.',
  '',
  ...Array.from({ length: 12 }, (_, i) => `Satır ${i + 1}: the quick brown fox jumps over.`),
].join('\r\n');

test('a .txt opened with Open files becomes a PDF page and Find finds its words', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await useFileInputPicker(page);
  await page.goto('./?lang=en');

  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^Open files$/ })
    .first()
    .click();
  await (await chooser).setFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(TEXT, 'utf8'),
  });

  await expect(page.getByRole('tab', { name: 'notes' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-page-index="0"]').first()).toBeVisible({ timeout: 20_000 });

  // A new, unsaved document like an image's: Save is offered, not "in file".
  await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'save');

  const field = await openFindPanel(page);
  await field.fill('ağaç');
  await expect(page.getByTestId('search-hit')).toHaveCount(1, { timeout: 20_000 });
  await field.fill('quick brown fox');
  await expect(page.getByTestId('search-hit')).toHaveCount(12, { timeout: 20_000 });

  const shot = process.env.R24_TEXT_SHOT;
  if (shot !== undefined) await page.screenshot({ path: shot });
});

test('only .txt converts: a .log is ignored', async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^Open files$/ })
    .first()
    .click();
  await (await chooser).setFiles([
    { name: 'server.log', mimeType: 'text/plain', buffer: Buffer.from('log line') },
    { name: 'kept.txt', mimeType: 'text/plain', buffer: Buffer.from('kept line') },
  ]);
  await expect(page.getByRole('tab', { name: 'kept' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('tab', { name: /server/ })).toHaveCount(0);
});

test('"Text to PDF" in the palette asks for a .txt file', async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();

  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox', { name: 'Search commands' }).fill('text to pdf');
  await expect(page.getByRole('option', { name: /Text to PDF/, selected: true })).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  const picker = await chooser;
  expect(picker.isMultiple()).toBe(true);
  await picker.setFiles({
    name: 'tek.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Tek satır', 'utf8'),
  });
  await expect(page.getByRole('tab', { name: 'tek' })).toBeVisible({ timeout: 30_000 });
});

const MARKDOWN = [
  '# Rapor',
  '',
  'İstanbul çarşısında **kalın** bir ağaç gölgesi ve [bir bağlantı](https://example.com/x).',
  '',
  '- birinci',
  '- ikinci',
  '',
  '```',
  'const x = 1;',
  '```',
].join('\n');

test('a .md opened with Open files becomes a PDF page without Markdown syntax', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await useFileInputPicker(page);
  await page.goto('./?lang=en');

  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^Open files$/ })
    .first()
    .click();
  await (await chooser).setFiles({
    name: 'readme.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(MARKDOWN, 'utf8'),
  });

  await expect(page.getByRole('tab', { name: 'readme' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-page-index="0"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'save');

  const field = await openFindPanel(page);
  await field.fill('ağaç');
  await expect(page.getByTestId('search-hit')).toHaveCount(1, { timeout: 20_000 });
  await field.fill('**');
  await expect(page.getByTestId('search-hit')).toHaveCount(0, { timeout: 20_000 });

  const shot = process.env.R27_MD_SHOT;
  if (shot !== undefined) await page.screenshot({ path: shot });
});

test('"Markdown to PDF" in the palette asks for a .md file', async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();

  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox', { name: 'Search commands' }).fill('markdown to pdf');
  await expect(page.getByRole('option', { name: /Markdown to PDF/, selected: true })).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  const picker = await chooser;
  expect(picker.isMultiple()).toBe(true);
  await picker.setFiles({
    name: 'notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Notlar\n\nTek satır', 'utf8'),
  });
  await expect(page.getByRole('tab', { name: 'notes' })).toBeVisible({ timeout: 30_000 });
});

test('a .md with a table opens as a document at the default fit, and the table renders (PRD-30)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await trackEngine(page);
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();

  // From Home: the launcher's Open files… takes the Markdown and lands on the document.
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files…' }).click();
  await (await chooser).setFiles(fixturePath('table-notes.md'));
  await expect(page.getByRole('tab', { name: 'table-notes' })).toBeVisible({ timeout: 30_000 });
  const first = page.locator('[data-page-index="0"]').first();
  await expect(first).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('home')).toHaveCount(0);
  await quiet(page);

  // The converted document gets the default every PDF gets (fit width, DSN-60), not a zoom
  // of its own: a normal PDF opened beside it fits the same width.
  const fitted = async () => (await first.boundingBox())?.width ?? 0;
  const markdownWidth = await fitted();
  expect(markdownWidth).toBeGreaterThan(300);
  const second = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^Open files$/ })
    .first()
    .click();
  await (await second).setFiles(fixturePath('simple-text.pdf'));
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible({ timeout: 30_000 });
  await quiet(page);
  const pdfWidth = (await page.locator('[data-page-index="0"]').first().boundingBox())?.width ?? 0;
  expect(Math.abs(pdfWidth - markdownWidth)).toBeLessThan(2);
  await page.getByRole('tab', { name: 'table-notes' }).click();
  await quiet(page);

  // The table is real text in cells: no pipes or delimiter dashes, every cell findable.
  const field = await openFindPanel(page);
  await field.fill('İç Anadolu');
  await expect(page.getByTestId('search-hit')).toHaveCount(1, { timeout: 20_000 });
  await field.fill('Karadeniz');
  await expect(page.getByTestId('search-hit')).toHaveCount(1, { timeout: 20_000 });
  await field.fill('|');
  await expect(page.getByTestId('search-hit')).toHaveCount(0, { timeout: 20_000 });
  await field.fill('-----');
  await expect(page.getByTestId('search-hit')).toHaveCount(0, { timeout: 20_000 });

  const shot = process.env.R29_MD_SHOT;
  if (shot !== undefined) await page.screenshot({ path: shot });
});
