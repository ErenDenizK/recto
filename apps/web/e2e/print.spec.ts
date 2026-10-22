/**
 * Print… end to end (PRD-25; epics-r25 Epic 5; `export/print.ts`):
 *
 * - **Frame** (a browser with a PDF viewer): Mod+P builds Save a copy's bytes and hands them to
 *   the browser's print in a hidden frame. The frame's `print` is stubbed; the test reads the
 *   frame's blob back and checks it is a PDF with the document's pages. It also proves the page's
 *   policy lets the frame load (`frame-src blob:`): a refused frame is cross-origin and its
 *   `print` cannot be stubbed or read.
 * - **Pages** (no PDF viewer, as on iPadOS): the title menu's Print… renders each page into the
 *   print-only sheet and calls `window.print()` (stubbed) once every page is in.
 *
 * Runs on Chromium: the methods are chosen by feature detection, which the test forces.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';

declare global {
  interface Window {
    __printed?: { readonly frame?: string; readonly images?: number };
    /** Every object URL's blob, by URL: the page's `connect-src` keeps `fetch` off blob URLs. */
    __blobs?: Map<string, Blob>;
  }
}

test.skip(({ browserName }) => browserName !== 'chromium', 'the methods are forced on Chromium');

async function openDocument(page: Page, pdfViewer: boolean): Promise<void> {
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
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.locator('[data-page-index="0"]')).toBeVisible();
}

const printed = (page: Page) =>
  page.waitForFunction(() => window.__printed, null, { timeout: 30_000 });

test('Mod+P prints the exported PDF in a frame where the browser has a PDF viewer', async ({
  page,
}) => {
  await openDocument(page, true);
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
  expect((await PDFDocument.load(data)).getPageCount()).toBe(3);
  await expect(page.getByTestId('print-failed')).toHaveCount(0);
});

test('Print… in the title menu renders the pages where there is no PDF viewer', async ({
  page,
}) => {
  await openDocument(page, false);
  await page.getByTestId('document-menu').click();
  await page.getByRole('menuitem', { name: 'Print…' }).click();
  await printed(page);
  expect(await page.evaluate(() => window.__printed)).toEqual({ images: 3 });
  // The sheet is the only thing that prints: everything else is hidden from print.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('app-shell')).toBeHidden();
  await expect(page.locator('[data-print="pages"] img').first()).toBeVisible();
});
