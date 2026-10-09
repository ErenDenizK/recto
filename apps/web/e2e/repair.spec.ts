/**
 * Save repaired copy (docs/plan/v1/PLAN.md M3-d; document-tools spec §7): a file PDFium had to
 * rebuild on open offers "Save repaired copy" in the title menu (only then), which opens Save
 * a copy on PDF with the notice that the copy is written from the rebuilt version. The copy
 * that downloads is a whole, valid file: every page is there, its `startxref` points at its
 * cross-reference section (the damage in broken-xref.pdf), and the summary says it was
 * repaired.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, test } from '@playwright/test';

import {
  copySummary,
  downloadCopy,
  openFixtures,
  useDownloadPath,
  useFileInputPicker,
} from './helpers';

/** The offset the last `startxref` names, and what the file holds there. */
function startxrefTarget(bytes: Buffer): { offset: number; at: string } {
  const text = bytes.toString('latin1');
  const match = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);
  if (!match) throw new Error('no trailing startxref');
  const offset = Number(match[1]);
  return { offset, at: text.slice(offset, offset + 16) };
}

test('a damaged file: Save repaired copy writes a rebuilt, valid copy', async ({ page }) => {
  await useDownloadPath(page);
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();

  // A healthy file does not offer it.
  await openFixtures(page, ['simple-text.pdf']);
  await page.getByTestId('document-menu').click();
  await expect(page.getByRole('menuitem', { name: 'Save a copy…' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Save repaired copy' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // The damaged one does: its startxref points 100 bytes before the real table.
  await openFixtures(page, ['broken-xref.pdf']);
  await expect(page.getByRole('tab', { name: 'broken-xref', selected: true })).toBeVisible();
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId('document-menu').click();
  await page.getByRole('menuitem', { name: 'Save repaired copy' }).click();
  const sheet = page.getByTestId('save-copy-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(
    'This file was damaged and rebuilt on open. The copy is written from the rebuilt version.',
  );

  const { download, bytes } = await downloadCopy(page, sheet);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  // A whole file: three pages, and a startxref that lands on its cross-reference section
  // (a table, or the object of a cross-reference stream).
  const copy = await PDFDocument.load(bytes, { updateMetadata: false });
  expect(copy.getPageCount()).toBe(3);
  const { at } = startxrefTarget(bytes);
  expect(at).toMatch(/^(xref|\d+ \d+ obj)/);

  const summary = await copySummary(page);
  await expect(summary).toContainText(
    '1 damaged file was repaired when opened; the output is built from the repaired copy.',
  );
});
