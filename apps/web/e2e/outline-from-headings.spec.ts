/**
 * "Add bookmarks from headings" (PRD-33) end to end: a PDF with headings and no outline shows
 * the action in the empty Contents panel; running it builds a nested outline (one undo step),
 * undo and redo restore it, and a saved copy carries the real /Outlines when reopened.
 */
import { writeFile } from 'node:fs/promises';

import { PDFDocument, PDFName, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test } from '@playwright/test';

import { downloadCopy, openSaveCopy, showSidebar, useFileInputPicker } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Download flow is verified on Chromium');

const BODY = 'Body text that runs on to a plain sentence so the body size is clear.';

/** Three pages; headings are big (24 pt) or medium (16 pt) bold, the body is 11 pt. */
async function headingsPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const plain = await doc.embedFont(StandardFonts.Helvetica);
  const pages: [string, string][][] = [
    [
      ['Chapter One', 'h1'],
      ['One A', 'h2'],
    ],
    [['One B', 'h2']],
    [['Chapter Two', 'h1']],
  ];
  for (const headings of pages) {
    const page = doc.addPage([612, 792]);
    let y = 720;
    for (const [text, kind] of headings) {
      page.drawText(text, { x: 72, y, size: kind === 'h1' ? 24 : 16, font: bold });
      y -= 40;
      for (let i = 0; i < 3; i++) {
        page.drawText(BODY, { x: 72, y, size: 11, font: plain });
        y -= 16;
      }
      y -= 24;
    }
  }
  return doc.save();
}

test('add bookmarks from headings: nest, undo, redo, save a copy', async ({ page }, testInfo) => {
  await page.addInitScript({
    content:
      "Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });",
  });
  await useFileInputPicker(page);
  const source = testInfo.outputPath('headings.pdf');
  await writeFile(source, await headingsPdf());
  await page.goto('./?lang=en');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await chooser).setFiles(source);
  await expect(page.getByTestId('page-pill')).toHaveText(/^1 \/ 3 · /);

  await showSidebar(page, 'Pages', 'Contents');
  await page.getByRole('button', { name: 'Add bookmarks from headings' }).click();
  const tree = page.getByRole('tree', { name: /Contents of/ });
  await expect(tree.getByRole('treeitem', { name: 'Chapter One' })).toHaveAttribute(
    'aria-level',
    '1',
  );
  await tree.getByRole('treeitem', { name: 'Chapter One' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tree.getByRole('treeitem', { name: 'One A' })).toHaveAttribute('aria-level', '2');
  await expect(tree.getByRole('treeitem', { name: 'One B' })).toHaveAttribute('aria-level', '2');
  await expect(tree.getByRole('treeitem', { name: 'Chapter Two' })).toHaveAttribute(
    'aria-level',
    '1',
  );
  await expect(tree.getByRole('treeitem')).toHaveCount(4);

  // One undo step takes all four away; redo brings them back.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByText('This document has no bookmarks.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add bookmarks from headings' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(tree.getByRole('treeitem', { name: 'Chapter Two' })).toBeVisible();

  // Save a copy and reopen it: the outline is real.
  const dialog = await openSaveCopy(page);
  await dialog.getByRole('textbox', { name: 'Name' }).fill('headings-bookmarked.pdf');
  const { download, bytes } = await downloadCopy(page, dialog);
  const written = await PDFDocument.load(bytes, { updateMetadata: false });
  expect(written.catalog.has(PDFName.of('Outlines'))).toBe(true);
  const saved = testInfo.outputPath('headings-bookmarked.pdf');
  await download.saveAs(saved);

  const reopen = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await reopen).setFiles(saved);
  const reopened = page.getByRole('tree', { name: 'Contents of headings-bookmarked' });
  await expect(reopened.getByRole('treeitem', { name: 'Chapter One' })).toBeVisible();
  await expect(reopened.getByRole('treeitem', { name: 'Chapter Two' })).toBeVisible();
  // The action is gone once the document has an outline.
  await expect(page.getByRole('button', { name: 'Add bookmarks from headings' })).toHaveCount(0);
});
