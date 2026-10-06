/**
 * OCR end to end (spec recognize-and-compare §1.5, ADR-0012 §7) on scan-text.pdf, two scanned
 * pages without text (test/fixtures/manifest.json): the dialog proposes both pages and
 * English, the run recognises them with tesseract.js served from our origin, one history
 * entry records it, Show results opens Review's Words to check (spec X33, D2-9) with each
 * page's quality, languages and resolution, and J / K ring a low-confidence word, Find finds words of the manifest, and the export's summary names the
 * run. The exported file carries the words in its invisible layer (read back with pdf-lib);
 * undo removes the text and redo brings it back from the stored words.
 * Throughout, the request log shows no request to any other origin, and every worker the page
 * starts (PDFium, tesseract.js) runs a script of this origin: no blob: or data: worker, whose
 * requests the log could not attribute.
 */
import { readFile } from 'node:fs/promises';

import { decodePDFRawStream, PDFDict, PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import {
  copySummary,
  historyStep,
  inHistory,
  openFixtures,
  openSaveCopy,
  useFileInputPicker,
} from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'OCR is verified on Chromium');
test.use({ viewport: { width: 1440, height: 900 } });

const mod = (page: Page) =>
  page.evaluate(() => (/mac/i.test(navigator.platform) ? 'Meta' : 'Control'));

/** The words of every `/PdfEditorOCR` layer of a PDF (UTF-16BE hex strings shown with Tj). */
async function layerWords(bytes: Uint8Array): Promise<string[][]> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  return pdf.getPages().map((page) => {
    const words: string[] = [];
    const xobjects = page.node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict);
    for (const [, ref] of xobjects?.entries() ?? []) {
      const stream = pdf.context.lookup(ref);
      if (!(stream instanceof PDFRawStream)) continue;
      if (!stream.dict.has(PDFName.of('PdfEditorOCR'))) continue;
      const content = new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode());
      for (const match of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
        const hex = match[1] ?? '';
        let text = '';
        for (let i = 0; i + 4 <= hex.length; i += 4) {
          text += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
        }
        words.push(text.trim());
      }
    }
    return words;
  });
}

test('recognise scan-text.pdf offline-first: panel, search, export, no foreign request', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const origin = new URL(baseURL ?? 'http://localhost').origin;
  const foreign: string[] = [];
  const ocrFiles: string[] = [];
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.origin !== origin) foreign.push(url.href);
    if (url.pathname.includes('/ocr/')) ocrFiles.push(url.pathname);
  });
  await page.addInitScript({
    content:
      "Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });",
  });
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await openFixtures(page, ['scan-text.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  // Nothing OCR-related is fetched before the dialog is used (spec §1.1).
  expect(ocrFiles).toEqual([]);

  // 1. Title menu → Recognize text (OCR)…: S10, a tool sheet.
  await page.getByTestId('document-menu').click();
  await page.getByRole('menuitem', { name: 'Recognize text (OCR)…' }).click();
  const dialog = page.getByTestId('ocr-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Pages without text (2 pages)' })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /English/ })).toBeChecked();
  await expect(dialog.getByTestId('ocr-languages-key')).toContainText('eng');
  await expect(dialog.getByTestId('ocr-honesty')).toContainText('may contain errors');
  await dialog.getByRole('button', { name: 'Recognize 2 pages' }).click();

  // 2. The run: progress in the sheet; then the result.
  await expect(
    dialog.getByTestId('ocr-progress').or(dialog.getByTestId('ocr-result')),
  ).toBeVisible();
  const result = dialog.getByTestId('ocr-result');
  await expect(result).toBeVisible({ timeout: 180_000 });
  await expect(result).toContainText('Recognize text: 2 pages, eng');
  await expect(page.getByTestId('status-ocr')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Show results' }).click();
  await expect(dialog).toHaveCount(0);

  // 3. Show results opened Review on Words to check (X33): each recognised page with its
  // quality, languages and resolution, then its low-confidence words.
  const reviewWords = page.getByTestId('review-words');
  await expect(reviewWords).toBeVisible();
  const pages = reviewWords.getByTestId('review-words-page');
  await expect(pages).toHaveCount(2);
  await expect(pages.first()).toContainText(/^Page 1 · (Good|Review|Poor)/);
  await expect(pages.first()).toContainText('English');
  await expect(pages.first()).toContainText('dpi');
  await expect(pages.nth(1)).toContainText(/^Page 2 · (Good|Review|Poor)/);
  // J rings a low-confidence word on its page (a 1px ring; the page is never tinted) and marks
  // its row current.
  await expect(reviewWords.getByTestId('review-word')).not.toHaveCount(0);
  await page.keyboard.press('j');
  await expect(page.getByTestId('ocr-focus-ring')).toHaveCount(1);
  await expect(reviewWords.locator('button[aria-current="true"]')).toHaveCount(1);
  if (process.env.SHOTS_DIR) {
    await page.screenshot({ path: `${process.env.SHOTS_DIR}/ocr-words-to-check-1440-en.png` });
  }

  // One history entry for the run.
  await inHistory(page, (list) =>
    expect(historyStep(list, /Recognize text: 2 pages, eng/)).toBeVisible(),
  );

  // 4. Find: words of the manifest are found in the recognised text.
  await page.keyboard.press(`${await mod(page)}+f`);
  const field = page.getByRole('searchbox', { name: 'Find in document' });
  await field.fill('quick');
  await expect(page.getByTestId('find-count')).toContainText(/1 of [12]/, { timeout: 20_000 });
  await field.fill('recognition');
  await expect(page.getByTestId('find-count')).toContainText('1 of', { timeout: 20_000 });
  await field.press('Escape');

  // 5. Export: the summary names the run; the file's layer holds the words.
  const exportDialog = await openSaveCopy(page);
  const downloadPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download copy' }).click();
  const bytes = await readFile(await (await downloadPromise).path());
  await expect(await copySummary(page)).toContainText('Recognized text (OCR) on 2 pages: English');
  const words = await layerWords(bytes);
  expect(words).toHaveLength(2);
  const first = words[0] ?? [];
  for (const word of ['Scanned', 'Document', 'quick', 'brown', 'fox', '2024', '7731']) {
    expect(first).toContain(word);
  }

  await page.keyboard.press('Escape');
  await expect(exportDialog).toHaveCount(0);

  // 6. Undo reopens the original and replays the rest: no recognised text, no page in Words to
  // check (the filter stays for the session); redo writes the stored words again without
  // recognising anew.
  await page.keyboard.press(`${await mod(page)}+z`);
  await expect(pages).toHaveCount(0);
  await page.keyboard.press(`${await mod(page)}+f`);
  await field.fill('quick');
  await expect(page.getByTestId('find-count')).toHaveText('No matches', { timeout: 20_000 });
  // Esc clears the query, the next one leaves the field for the page (01-frame F6 §6).
  await field.press('Escape');
  await field.press('Escape');
  await page.keyboard.press(`${await mod(page)}+Shift+z`);
  await expect(pages).toHaveCount(2);
  await page.keyboard.press(`${await mod(page)}+f`);
  await field.fill('quick');
  await expect(page.getByTestId('find-count')).toContainText('1 of', { timeout: 20_000 });
  await field.press('Escape');

  // The engine and the pack came from our origin; nothing left it.
  expect(ocrFiles.some((p) => p.endsWith('/ocr/lang/eng.traineddata.gz'))).toBe(true);
  expect(ocrFiles.some((p) => /\/ocr\/tesseract-[\d.]+\/worker\.min\.js$/.test(p))).toBe(true);
  expect(foreign).toEqual([]);
  // Every worker is a script of this origin (not blob:, data: or another site).
  expect(workers.some((url) => /\/ocr\/tesseract-[\d.]+\/worker\.min\.js$/.test(url))).toBe(true);
  const sameOrigin = (url: string) => {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === origin
    );
  };
  expect(workers.filter((url) => !sameOrigin(url))).toEqual([]);
});

test('after "Keep available offline", OCR works with the network off', async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 30_000,
    })
    .toBe(true);
  // The PDFium wasm is warmed into its runtime cache once the shell is offline-ready.
  await expect
    .poll(
      () => page.evaluate(async () => (await (await caches.open('pdf-editor-wasm')).keys()).length),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  // Palette → OCR languages…; keep English available offline.
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox', { name: 'Search commands' }).fill('OCR languages');
  await expect(page.getByRole('option', { name: /OCR languages…/, selected: true })).toBeVisible();
  await page.keyboard.press('Enter');
  const manager = page.getByTestId('ocr-languages');
  await expect(manager).toBeVisible();
  await expect(manager.getByTestId('ocr-pack')).toHaveCount(9);
  const keep = manager.getByRole('switch', { name: 'Keep English available offline' });
  await expect(keep).not.toBeChecked();
  // The switch follows the device state: it turns on once the pack is cached.
  await keep.click();
  await expect(keep).toBeChecked({ timeout: 60_000 });
  await expect(manager.getByTestId('ocr-pack').first()).toContainText('On this device');
  await page.keyboard.press('Escape');

  // Offline: reload, open the scan, recognise the current page.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, ['scan-text.pdf']);
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await page.getByTestId('document-menu').click();
  await page.getByRole('menuitem', { name: 'Recognize text (OCR)…' }).click();
  const dialog = page.getByTestId('ocr-dialog');
  await expect(dialog.getByRole('checkbox', { name: /English/ })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /English/ }).locator('..')).toContainText(
    'On this device',
  );
  await dialog.getByRole('radio', { name: 'Current page (1)' }).check();
  await dialog.getByRole('button', { name: 'Recognize 1 page' }).click();
  await expect(dialog.getByTestId('ocr-result')).toContainText('Recognize text: 1 page, eng', {
    timeout: 180_000,
  });
  await dialog.getByRole('button', { name: 'Show results' }).click();
  await page.keyboard.press('ControlOrMeta+f');
  await page.getByRole('searchbox', { name: 'Find in document' }).fill('lazy');
  await expect(page.getByTestId('find-count')).toContainText('1 of', { timeout: 20_000 });
});
