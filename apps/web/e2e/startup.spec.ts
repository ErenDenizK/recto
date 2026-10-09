/**
 * Start-up and save budgets (docs/plan/v1/PLAN.md §2.3 V1-P5, V1-P6, V1-P10; PF-14), measured
 * in the browser and reported as annotations ("[budget] …" lines in the report):
 *
 * - **V1-P5 / V1-P6:** open → first page painted, for a 10-page and a 500-page document: from
 *   the file input's `change` event to the first `main canvas[data-state="rendered"]`, both
 *   on the page's clock.
 * - **V1-P10:** Save a copy of a 100-page document: from Download copy to the copy's toast.
 * - **Phases** of an open (W1-g, PF-2 and PF-4): the engine service's `pdf-editor.startup.*` start-up marks
 *   (`STARTUP_MARKS`: engine requested, PDFium worker configured, wasm compiled, document
 *   opened, first page's bitmap), each in ms after the input's `change`, reported beside the
 *   open time so a regression shows where it is.
 *
 * The documents are generated here from the corpus with pdf-lib: the 10 and 500 pages from
 * many-pages.pdf, the 100 pages from the corpus files with fonts, images, annotations and
 * fields, copied in turn. The expectations are soft, at about twice the W0 baseline
 * (docs/plan/v1/perf-results.md: open ≈ 1.3–2.1 s cold whatever the length, the engine's
 * load and wasm compile being most of it; save ≈ 1.2–1.6 s), as ink-latency.spec.ts does. The
 * plan's targets (V1-P5 ≤ 600 ms, V1-P6 ≤ 1.2 s) are for PF-2 and PF-4 to reach; the ceilings
 * move down as they land. Speed budgets are measured on desktop Chromium (PLAN.md §2.3).
 */
import { readFile } from 'node:fs/promises';

import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import {
  downloadCopy,
  fixturePath,
  openSaveCopy,
  useDownloadPath,
  useFileInputPicker,
} from './helpers';

/** Soft ceilings, ms: about twice the W0 baseline on desktop Chromium. */
const CEILING = { tenPages: 3_000, fiveHundredPages: 3_000, saveHundredPages: 3_000 } as const;

const RICH = [
  'annotations.pdf',
  'forms-a.pdf',
  'images.pdf',
  'text-edit-fonts.pdf',
  'redact-images.pdf',
  'outline-named-dests.pdf',
];

async function load(name: string): Promise<PDFDocument> {
  return PDFDocument.load(await readFile(fixturePath(name)), {
    updateMetadata: false,
    ignoreEncryption: true,
  });
}

/** `count` pages copied in turn from `sources`. */
async function generate(sources: readonly PDFDocument[], count: number): Promise<Buffer> {
  const out = await PDFDocument.create({ updateMetadata: false });
  for (let round = 0; out.getPageCount() < count; round++) {
    const doc = sources[round % sources.length] as PDFDocument;
    for (const page of await out.copyPages(doc, doc.getPageIndices())) {
      if (out.getPageCount() < count) out.addPage(page);
    }
  }
  return Buffer.from(await out.save({ useObjectStreams: false }));
}

interface OpenTiming {
  /** ms from the input's change to the first rendered page. */
  readonly total: number;
  /** The `pdf-editor.startup.*` start-up marks, ms after the change (absent when not reached). */
  readonly phases: Readonly<Record<string, number>>;
}

/** Opens `buffer` as `name` and resolves to ms from the input's change to the first page. */
async function openAndTime(page: Page, name: string, buffer: Buffer): Promise<OpenTiming> {
  await page.evaluate(() => {
    const w = window as unknown as { __openToFirstPage?: Promise<OpenTiming> };
    w.__openToFirstPage = new Promise((resolve) => {
      document.addEventListener(
        'change',
        (event) => {
          if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'file') return;
          const start = performance.now();
          const done = () => {
            if (!document.querySelector('main canvas[data-state="rendered"]')) return false;
            observer.disconnect();
            const phases: Record<string, number> = {};
            for (const mark of performance.getEntriesByType('mark')) {
              if (mark.name.startsWith('pdf-editor.startup.')) {
                phases[mark.name.slice('pdf-editor.startup.'.length)] = Math.round(mark.startTime - start);
              }
            }
            resolve({ total: performance.now() - start, phases });
            return true;
          };
          const observer = new MutationObserver(done);
          observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['data-state'],
          });
          done();
        },
        { capture: true, once: true },
      );
    });
  });
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
    .first()
    .click();
  await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer });
  return page.evaluate(
    () => (window as unknown as { __openToFirstPage: Promise<OpenTiming> }).__openToFirstPage,
  );
}

/** The phases of an open, as one annotation line ("worker-configured +212 ms, …"). */
function reportPhases(label: string, timing: OpenTiming): void {
  const description = `${label} phases: ${Object.entries(timing.phases)
    .sort(([, a], [, b]) => a - b)
    .map(([name, ms]) => `${name} +${ms} ms`)
    .join(', ')}`;
  test.info().annotations.push({ type: 'budget', description });
  console.info(`[budget] ${description}`);
}

function report(label: string, ms: number, ceiling: number): void {
  const description = `${label}: ${Math.round(ms)} ms (soft ceiling ${ceiling} ms)`;
  test.info().annotations.push({ type: 'budget', description });
  console.info(`[budget] ${description}`);
  expect.soft(ms, `${label} (ms)`).toBeLessThanOrEqual(ceiling);
}

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Speed budgets are measured on Chromium',
);

test.beforeEach(async ({ page }) => {
  await useDownloadPath(page);
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test('V1-P5: open → first page painted, 10 pages', async ({ page }) => {
  const ten = await generate([await load('many-pages.pdf')], 10);
  const timing = await openAndTime(page, 'ten.pdf', ten);
  report('V1-P5 open to first page, 10 pages', timing.total, CEILING.tenPages);
  reportPhases('V1-P5', timing);
  // Every phase was reached, in order (the marks are the engine service's, PF-2).
  expect(Object.keys(timing.phases)).toEqual(
    expect.arrayContaining(['engine-requested', 'worker-configured', 'first-page-bitmap']),
  );
});

test('V1-P6: open → first page painted, 500 pages', async ({ page }) => {
  const many = await load('many-pages.pdf');
  const five = await generate([many], 500);
  const timing = await openAndTime(page, 'five-hundred.pdf', five);
  report('V1-P6 open to first page, 500 pages', timing.total, CEILING.fiveHundredPages);
  reportPhases('V1-P6', timing);
});

test('V1-P10: Save a copy of 100 pages', async ({ page }) => {
  test.setTimeout(120_000);
  const sources = await Promise.all(RICH.map(load));
  const hundred = await generate(sources, 100);
  await openAndTime(page, 'hundred.pdf', hundred);
  const sheet = await openSaveCopy(page);
  const started = Date.now();
  const { bytes } = await downloadCopy(page, sheet, 90_000);
  report('V1-P10 save a copy, 100 pages', Date.now() - started, CEILING.saveHundredPages);
  expect((await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount()).toBe(100);
});
