/**
 * Error states at the point of failure (V1-B5, PLAN §2.6): a damaged, truncated, empty,
 * non-PDF, password-protected and XFA file each shows an honest message where the person
 * opened it, never a blank page and never a message that blames the wrong thing. The fixtures
 * are built by `support/error-fixtures.ts` or taken from the corpus.
 *
 * The over-ceiling case (V1-P13) is a fixme: the web size ceiling is not in the app yet.
 */
import { expect, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker } from './helpers';
import {
  corruptPdf,
  emptyPdf,
  type ErrorFixture,
  notAPdf,
  truncatedPdf,
} from './support/error-fixtures';

test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'the messages are engine-independent; Chromium desktop checks them',
);
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
});

/** Opens a file from memory or the corpus through the Open button. */
async function openRaw(page: Page, file: ErrorFixture | string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Open PDFs…)$/ })
    .first()
    .click();
  await (await chooser).setFiles(typeof file === 'string' ? fixturePath(file) : file);
}

/** Document info (S4) from the title menu, where the file's badges are listed. */
async function openFacts(page: Page): Promise<void> {
  await page.getByTestId('document-menu').click();
  await page.getByRole('menuitem', { name: 'Document info…' }).click();
  await expect(page.getByRole('dialog', { name: 'Document info' })).toBeVisible();
}

/** The words the app shows for a failed open: a toast or an alert, wherever it is. */
const message = (page: Page, text: string | RegExp) =>
  page.getByRole('status').or(page.getByRole('alert')).filter({ hasText: text }).first();

test('a damaged file says it is damaged, by name, and opens no tab', async ({ page }) => {
  const file = corruptPdf();
  await openRaw(page, file);
  await expect(message(page, 'Could not open corrupt.pdf: the file is damaged.')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('tab', { name: 'corrupt' })).toHaveCount(0);
  // The Library is still there to try another file.
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a file cut off inside its objects says it is damaged', async ({ page }) => {
  await openRaw(page, truncatedPdf());
  await expect(message(page, /^Could not open truncated-hard\.pdf: /)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('tab', { name: 'truncated-hard' })).toHaveCount(0);
});

test('a file with a bad startxref is repaired on open, and Document info says so', async ({
  page,
}) => {
  await openRaw(page, 'broken-xref.pdf');
  await expect(page.getByRole('tab', { name: 'broken-xref' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await openFacts(page);
  await expect(page.getByTestId('document-facts')).toContainText('Repaired');
});

test('a file that lost its tail opens as repaired, and Document info says so', async ({ page }) => {
  // The corpus's `truncated.pdf` (last 300 bytes gone: the xref's end, the trailer, startxref)
  // keeps every object; the engine rebuilds its tail as MuPDF does (structure/tail-repair.ts).
  await openRaw(page, 'truncated.pdf');
  await expect(page.getByRole('tab', { name: 'truncated' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await openFacts(page);
  await expect(page.getByTestId('document-facts')).toContainText('Repaired');
});

test('a text file under a .pdf name is not opened as a PDF', async ({ page }) => {
  await openRaw(page, notAPdf());
  await expect(message(page, /notes\.pdf/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('tab', { name: 'notes' })).toHaveCount(0);
});

test('an empty file is refused with a message, not a blank tab', async ({ page }) => {
  await openRaw(page, emptyPdf());
  await expect(message(page, /empty\.pdf/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('tab', { name: 'empty' })).toHaveCount(0);
});

test('a password-protected file asks for its password, and a wrong one is said to be wrong', async ({
  page,
}) => {
  await openRaw(page, 'encrypted-aes-256.pdf');
  const dialog = page
    .locator('[role="dialog"], [role="alertdialog"]')
    .filter({ hasText: 'Password required' });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toContainText('encrypted-aes-256.pdf is protected.');
  await dialog.locator('input').fill('not-the-password');
  await dialog.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(dialog).toContainText('That password did not open the file. Try again.', {
    timeout: 20_000,
  });
  await expect(page.getByRole('tab', { name: 'encrypted-aes-256' })).toHaveCount(0);
  // Skipping leaves the Library with an honest line.
  await dialog.getByRole('button', { name: 'Skip file' }).click();
  await expect(
    message(page, 'encrypted-aes-256.pdf was not opened: it needs a password.'),
  ).toBeVisible();
});

test('an XFA form opens, and Document info says XFA is not supported', async ({ page }) => {
  await openRaw(page, 'xfa-stub.pdf');
  await expect(page.getByRole('tab', { name: 'xfa-stub' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await openFacts(page);
  await expect(page.getByTestId('document-facts')).toContainText('XFA');
});

test.fixme('a file over the web size ceiling says so and points to the desktop edition', () => {
  // V1-P13: the ceiling (proposed 2,000 pages or 500 MB) and its message are not built. When
  // they are, generate the fixture here (a page tree of 2,001 pages) and expect the message.
});
