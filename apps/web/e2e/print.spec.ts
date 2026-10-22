/**
 * Print… end to end (PRD-25; epics-r25 Epic 5; `export/print.ts`):
 *
 * - **Frame** (a browser with a PDF viewer): on `redact-text-runs.pdf` (SECRET-7731 on lines
 *   1–3), every match is redacted and applied and a pen stroke drawn, then Mod+P builds Save a
 *   copy's bytes and hands them to the browser's print in a hidden frame. The frame's `print` is
 *   stubbed; the test reads the frame's blob back: a PDF with the document's pages, the ink
 *   annotation, no script action, and, re-opened in the app, the rest of the text but not the
 *   token. It also proves the policy lets the frame load (`frame-src blob:`): a refused frame
 *   is cross-origin and its `print` can be neither stubbed nor read.
 * - **Pages** (no PDF viewer, as on iPadOS): the title menu's Print… renders each page into the
 *   print-only sheet and calls `window.print()` (stubbed) once every page is in.
 *
 * Runs on Chromium: the methods are chosen by feature detection, which the test forces.
 */
import { readFile } from 'node:fs/promises';

import { type PDFDict, PDFDocument, PDFName } from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import {
  enterEdit,
  fixturePath,
  markAllMatches,
  openFindPanel,
  openFixtures,
  showSidebar,
  useFileInputPicker,
} from './helpers';

declare global {
  interface Window {
    __printed?: { readonly frame?: string; readonly images?: number };
    /** Every object URL's blob, by URL: the page's `connect-src` keeps `fetch` off blob URLs. */
    __blobs?: Map<string, Blob>;
  }
}

test.skip(({ browserName }) => browserName !== 'chromium', 'the methods are forced on Chromium');

const TOKEN = 'SECRET-7731';

async function openDocument(page: Page, pdfViewer: boolean, fixture: string): Promise<void> {
  await page.addInitScript((viewer) => {
    Object.defineProperty(Navigator.prototype, 'pdfViewerEnabled', { get: () => viewer });
    const blobs = new Map<string, Blob>();
    window.__blobs = blobs;
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => {
      const url = create(object);
      if (object instanceof Blob) blobs.set(url, object);
      return url;
    };
    window.print = () => {
      window.__printed = { images: document.querySelectorAll('[data-print="pages"] img').length };
    };
    const own = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get(this: HTMLIFrameElement) {
        const win = own?.get?.call(this) as Window | null;
        if (win && this.dataset.print === 'frame') {
          const src = this.src;
          win.print = () => {
            window.__printed = { frame: src };
          };
        }
        return win;
      },
    });
  }, pdfViewer);
  await page.setViewportSize({ width: 1440, height: 900 });
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, [fixture]);
  await expect(page.locator('[data-page-index="0"]')).toBeVisible();
}

const printed = (page: Page) =>
  page.waitForFunction(() => window.__printed, null, { timeout: 30_000 });

const layer = (page: Page) => page.locator('[data-annotation-layer="0"]');

/** Marks every match of the token and applies the marks (redaction spec §1.2). */
async function redactToken(page: Page): Promise<void> {
  await (await openFindPanel(page)).fill(TOKEN);
  await expect(page.getByTestId('search-hit')).toHaveCount(3);
  await markAllMatches(page);
  await expect(layer(page).locator('[data-annotation-kind="redact"]')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await showSidebar(page, 'Review');
  await page.getByRole('radio', { name: /^Marks/ }).click();
  await page.locator('[data-review-panel]').getByTestId('redaction-apply').click();
  const dialog = page.getByTestId('redaction-apply-dialog');
  await dialog.getByTestId('redaction-apply-confirm').click();
  await expect(dialog.getByTestId('redaction-result')).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('text-layer').first()).not.toContainText(TOKEN);
}

/** One pen stroke on the first page, below the text. */
async function drawStroke(page: Page): Promise<void> {
  const bar = page.getByRole('toolbar', { name: 'Markup', exact: true });
  await bar.locator('[data-pen-well]').getByRole('button', { name: 'Black pen, 1.5 pt' }).click();
  await expect(layer(page)).toHaveAttribute('data-tool', 'ink');
  const box = await layer(page).boundingBox();
  if (!box) throw new Error('page not rendered');
  // In the part of the page on screen, clear of the bar at the bottom of the stage.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  const shown = Math.min(box.y + box.height, viewport.height - 160) - box.y;
  await page.mouse.move(box.x + box.width * 0.2, box.y + shown * 0.85);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + shown * 0.88, { steps: 10 });
  await page.mouse.up();
  await expect(layer(page).locator('[data-annotation-kind="ink"]')).toHaveCount(1, {
    timeout: 10_000,
  });
  await page.keyboard.press('Escape');
}

test('Mod+P prints the document as saved, through a frame where the browser has a PDF viewer', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openDocument(page, true, 'redact-text-runs.pdf');
  await enterEdit(page);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await redactToken(page);
  await enterEdit(page);
  await drawStroke(page);

  await page.locator('[data-read-viewport]').focus();
  await page.keyboard.press('ControlOrMeta+P');
  await printed(page);
  const printedPdf = await page.evaluate(async () => {
    const src = window.__printed?.frame;
    const blob = src ? window.__blobs?.get(src) : undefined;
    if (!blob) throw new Error('the frame did not print a blob');
    return { type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())] };
  });
  expect(printedPdf.type).toBe('application/pdf');
  const data = new Uint8Array(printedPdf.bytes);
  expect(new TextDecoder().decode(data.slice(0, 5))).toBe('%PDF-');
  await expect(page.getByTestId('print-failed')).toHaveCount(0);

  const pdf = await PDFDocument.load(data, { updateMetadata: false });
  const source = await PDFDocument.load(await readFile(fixturePath('redact-text-runs.pdf')));
  expect(pdf.getPageCount()).toBe(source.getPageCount());
  const subtypes = (pdf.getPage(0).node.Annots()?.asArray() ?? []).map((ref) =>
    String((pdf.context.lookup(ref) as PDFDict).get(PDFName.of('Subtype'))),
  );
  expect(subtypes).toContain('/Ink');
  expect(subtypes).not.toContain('/Redact');
  expect(pdf.catalog.has(PDFName.of('OpenAction'))).toBe(false);

  // The printed text, read back by the app's own engine: the rest is there, the token is not.
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await chooser).setFiles({
    name: 'printed.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(data),
  });
  await expect(page.getByRole('tab', { name: 'printed', selected: true })).toBeVisible();
  const field = await openFindPanel(page);
  await field.fill('quick brown fox');
  await expect(page.getByTestId('search-hit')).toHaveCount(1, { timeout: 20_000 });
  await field.fill(TOKEN);
  await expect(page.getByTestId('search-status')).toHaveText('No matches', { timeout: 20_000 });
});

test('Print… in the title menu renders the pages where there is no PDF viewer', async ({
  page,
}) => {
  await openDocument(page, false, 'simple-text.pdf');
  await page.getByTestId('document-menu').click();
  await page.getByRole('menuitem', { name: 'Print…' }).click();
  await printed(page);
  expect(await page.evaluate(() => window.__printed)).toEqual({ images: 3 });
  // The sheet is the only thing that prints: everything else is hidden from print.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('app-shell')).toBeHidden();
  await expect(page.locator('[data-print="pages"] img').first()).toBeVisible();
});
