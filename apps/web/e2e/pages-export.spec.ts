/**
 * Page operations checked on the exported bytes (decision MOB-4; research phone-2026-10
 * `pages.md` §1b B9; `04-context` §10, §13; `07-sheets` S13, S15, S16): each job is done in
 * the Pages grid by mouse (`chromium`) or by touch (`tablet`), saved with Save a copy, and the
 * downloaded PDF is read with pdf-lib: its page count, its order (each fixture page draws its
 * own marker, "PAGE 3 A4 LANDSCAPE VIA ROTATE 90", "PAGE 2 OF simple-text"), its sizes and each
 * page's `/Rotate`.
 *
 * - reorder (‹ ›), rotate and delete from the Pages bar, with the rotation's Undo toast;
 * - Insert pages from file… from the bar's More and from the title menu: the file's pages after
 *   the focused page, or after the page being read, as one undo step;
 * - Move to in More on a folded bar (820 px wide, the tablet's portrait width);
 * - Extract: a new document of copies, the turns kept, the source untouched;
 * - Split every 4 pages from the title menu (DSN-47): the parts hold those pages, in order.
 *
 * The tablet's coarse pointer would share the copy (Share copy); this spec takes the download
 * path there too, so the bytes can be read the same way.
 */
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  type PDFPage,
  PDFRawStream,
  PDFStream,
} from '@cantoo/pdf-lib';
import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  downloadCopy,
  fixturePath,
  openFixtures,
  openSaveCopy,
  pastDeadline,
  useDownloadPath,
  useFileInputPicker,
} from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Downloads are read on Chromium');

const grid = (page: Page) => page.getByTestId('light-table');
const cells = (page: Page) => grid(page).locator('[role="gridcell"][data-page-id]');
const bar = (page: Page) => page.getByTestId('pages-bar');
const coarse = (page: Page) => page.evaluate(() => matchMedia('(pointer: coarse)').matches);

/**
 * A tap where the pointer is a finger, else a click. The tap is a real touch through CDP (as
 * `pages-grid.spec.ts`'s), with the compatibility mouse events and focus a device gives it.
 */
async function press(page: Page, target: Locator): Promise<void> {
  if (!(await coarse(page))) {
    await target.click();
    return;
  }
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  if (!box) throw new Error('not laid out');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test.beforeEach(async ({ page }) => {
  await useDownloadPath(page);
  await useFileInputPicker(page);
  // The download path on the tablet too (no Share copy), so the bytes can be read.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined });
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined });
  });
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

/** Enters the grid with its key, 3, and waits out the view change. */
async function enterGrid(page: Page): Promise<void> {
  await page.keyboard.press('3');
  await expect(grid(page)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-vt-grid')))
    .toBe(false);
}

/** Starts selection mode and selects the cells at `indices`. */
async function select(page: Page, indices: readonly number[]): Promise<void> {
  if ((await bar(page).getByRole('button', { name: 'Select', exact: true }).count()) > 0) {
    await press(page, bar(page).getByRole('button', { name: 'Select', exact: true }));
  }
  for (const index of indices) await press(page, cells(page).nth(index));
  await expect(bar(page)).toContainText(`${indices.length} selected`);
}

/** Runs one of the bar's acts: its button when the bar shows it, else its row in More. */
async function barAct(page: Page, name: string | RegExp): Promise<void> {
  const button = bar(page).getByRole('button', { name, exact: typeof name === 'string' });
  if ((await button.count()) > 0) {
    await press(page, button);
    return;
  }
  await press(page, bar(page).getByRole('button', { name: 'More actions' }));
  await press(page, page.getByRole('menuitem', { name }));
}

/** Saves a copy of the active document and returns its bytes, parsed. */
async function exported(page: Page): Promise<PDFDocument> {
  const sheet = await openSaveCopy(page);
  const { bytes } = await downloadCopy(page, sheet);
  return PDFDocument.load(bytes, { updateMetadata: false });
}

// --- Reading the copy ----------------------------------------------------------------------

function decoded(stream: PDFStream): string {
  const bytes =
    stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
  return Buffer.from(bytes).toString('latin1');
}

/** The strings a content stream shows: `<hex>` and `(literal)` operands, decoded. */
function shown(content: string): string {
  const parts: string[] = [];
  for (const match of content.matchAll(/<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^\\)])*)\)/g)) {
    const [, hex, literal] = match;
    parts.push(
      hex === undefined ? (literal ?? '') : Buffer.from(hex.replace(/\s/g, ''), 'hex').toString(),
    );
  }
  return parts.join(' ');
}

/** Every string the page draws, through its content streams and its Form XObjects. */
function pageText(pdf: PDFDocument, page: PDFPage): string {
  const out: string[] = [];
  const seen = new Set<unknown>();
  const visit = (stream: unknown, resources: PDFDict | undefined) => {
    if (!(stream instanceof PDFStream) || seen.has(stream)) return;
    seen.add(stream);
    out.push(shown(decoded(stream)));
    const own = stream.dict.lookupMaybe(PDFName.of('Resources'), PDFDict) ?? resources;
    forms(own);
  };
  const forms = (resources: PDFDict | undefined) => {
    const xobjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
    for (const [, ref] of xobjects?.entries() ?? []) visit(pdf.context.lookup(ref), resources);
  };
  const contents = page.node.Contents();
  const resources = page.node.Resources();
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => pdf.context.lookup(ref))
      : [contents];
  for (const stream of streams) visit(stream, resources);
  forms(resources);
  return out.join(' ');
}

/**
 * Each page as its fixture marker: "M3" for mixed-sizes' page 3, "S2" for simple-text's page 2,
 * "?" for a page that draws none.
 */
function markers(pdf: PDFDocument): string[] {
  return pdf.getPages().map((page) => {
    const text = pageText(pdf, page);
    const simple = /PAGE (\d+) OF simple-text/.exec(text);
    if (simple) return `S${simple[1]}`;
    const mixed = /PAGE (\d+) (A4|LETTER|SQUARE)/.exec(text);
    return mixed ? `M${mixed[1]}` : '?';
  });
}

const rotations = (pdf: PDFDocument) => pdf.getPages().map((p) => p.getRotation().angle);
/** Each page's MediaBox size, rounded to the point ("595×842"). */
const sizes = (pdf: PDFDocument) =>
  pdf.getPages().map((p) => {
    const { width, height } = p.getSize();
    return `${Math.round(width)}×${Math.round(height)}`;
  });

/** mixed-sizes.pdf as the fixture manifest has it. */
const MIXED = {
  M1: { size: '595×842', rotate: 0 },
  M2: { size: '612×792', rotate: 0 },
  M3: { size: '595×842', rotate: 90 },
  M4: { size: '842×595', rotate: 0 },
  M5: { size: '200×200', rotate: 0 },
} as const;
const LETTER = '612×792';

async function openMixed(page: Page): Promise<void> {
  await openFixtures(page, ['mixed-sizes.pdf']);
  await enterGrid(page);
  await expect(cells(page)).toHaveCount(5);
}

// --- The jobs ------------------------------------------------------------------------------

test('reorder, rotate and delete from the Pages bar: the copy has that order and those turns', async ({
  page,
}) => {
  // The tablet in landscape, where the audit saw a tooltip stick after two taps (B5).
  if (await coarse(page)) await page.setViewportSize({ width: 1180, height: 820 });
  await openMixed(page);
  // Page 1 two places later (‹ ›, the non-drag reorder): 2 3 1 4 5.
  await select(page, [0]);
  // Taps leave no tooltip standing over the bar (04-context §20 item 6; B5).
  if (await coarse(page)) {
    // Past a tooltip's 500 ms opening delay.
    await pastDeadline(page, 800);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  }
  await barAct(page, 'Move later');
  await barAct(page, 'Move later');
  await expect(cells(page).nth(2)).toHaveAttribute('aria-selected', 'true');
  // Rotate it right: one undo step with its toast (MOB-4), "Rotated page 3 right · Undo".
  await barAct(page, 'Rotate right');
  await expect(page.getByRole('group', { name: 'Rotated page 3 right' })).toBeVisible();
  // Delete page 4 (M4): 2 3 1 5.
  await press(page, cells(page).nth(2));
  await press(page, cells(page).nth(3));
  await expect(bar(page)).toContainText('1 selected');
  await barAct(page, 'Delete');
  await expect(cells(page)).toHaveCount(4);

  const pdf = await exported(page);
  expect(markers(pdf)).toEqual(['M2', 'M3', 'M1', 'M5']);
  expect(rotations(pdf)).toEqual([0, 90, 90, 0]);
  expect(sizes(pdf)).toEqual([MIXED.M2.size, MIXED.M3.size, MIXED.M1.size, MIXED.M5.size]);
});

test('Insert pages from file… in the bar’s More: the file after the focused page, one undo step', async ({
  page,
}) => {
  await openMixed(page);
  await select(page, [1]);
  await press(page, bar(page).getByRole('button', { name: 'More actions' }));
  const chooser = page.waitForEvent('filechooser');
  await press(page, page.getByRole('menuitem', { name: 'Insert pages from file…' }));
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await expect(cells(page)).toHaveCount(8);
  // The inserted file is not left open as a tab of its own.
  await expect(page.getByRole('tab', { name: /^simple-text/ })).toHaveCount(0);

  const pdf = await exported(page);
  expect(markers(pdf)).toEqual(['M1', 'M2', 'S1', 'S2', 'S3', 'M3', 'M4', 'M5']);
  expect(rotations(pdf)).toEqual([0, 0, 0, 0, 0, 90, 0, 0]);
  expect(sizes(pdf)).toEqual([
    MIXED.M1.size,
    MIXED.M2.size,
    LETTER,
    LETTER,
    LETTER,
    MIXED.M3.size,
    MIXED.M4.size,
    MIXED.M5.size,
  ]);

  // One undo step takes the whole file away.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cells(page)).toHaveCount(5);
});

test('Insert pages from file… in the title menu, while reading: after the page being read', async ({
  page,
}) => {
  await openFixtures(page, ['mixed-sizes.pdf']);
  await page.getByTestId('document-menu').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Insert pages from file…' }).click();
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await enterGrid(page);
  await expect(cells(page)).toHaveCount(8);

  const pdf = await exported(page);
  expect(markers(pdf)).toEqual(['M1', 'S1', 'S2', 'S3', 'M2', 'M3', 'M4', 'M5']);
  expect(rotations(pdf)).toEqual([0, 0, 0, 0, 0, 90, 0, 0]);
});

test('Move to in More on a folded bar moves the pages to the other document', async ({ page }) => {
  // The bar folds below 1040 px of room on a coarse pointer (the tablet, 820 wide) and below
  // 860 on a fine one.
  if (!(await coarse(page))) await page.setViewportSize({ width: 820, height: 900 });
  await openFixtures(page, ['mixed-sizes.pdf', 'simple-text.pdf']);
  await page.getByRole('tab', { name: /^mixed-sizes/ }).click();
  await enterGrid(page);
  await expect(cells(page)).toHaveCount(5);
  await select(page, [2, 4]);
  // Folded at this width: no Move to ▾ on the bar, so it heads More (§10 item 2).
  await expect(bar(page).locator('[data-capsule-item="move-to"]')).toHaveCount(0);
  await press(page, bar(page).getByRole('button', { name: 'More actions' }));
  await press(page, page.getByRole('menuitem', { name: /^Move to/ }));
  await press(
    page,
    page.getByRole('menu', { name: 'Move to' }).getByRole('menuitem', { name: /^simple-text/ }),
  );
  await expect(page.getByRole('tab', { name: /^simple-text/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const target = await exported(page);
  expect(markers(target)).toEqual(['S1', 'S2', 'S3', 'M3', 'M5']);
  expect(rotations(target)).toEqual([0, 0, 0, 90, 0]);

  await page.getByRole('tab', { name: /^mixed-sizes/ }).click();
  const source = await exported(page);
  expect(markers(source)).toEqual(['M1', 'M2', 'M4']);
});

test('Combine with one document open asks for files; Add files… appends; the open one comes first', async ({
  page,
}) => {
  await openFixtures(page, ['mixed-sizes.pdf']);
  await page.getByTestId('document-menu').click();
  // MOB-10: the title menu's Pages rows are exactly F5 §5's two; Merge files… left it.
  await expect(page.getByRole('menuitem', { name: 'Merge files…' })).toHaveCount(0);
  let chooser = page.waitForEvent('filechooser');
  await press(page, page.getByRole('menuitem', { name: 'Combine with open documents…' }));
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  const sheet = page.getByTestId('combine-sheet');
  await expect(sheet.getByTestId('combine-row')).toHaveCount(2);
  chooser = page.waitForEvent('filechooser');
  await press(page, sheet.getByRole('button', { name: 'Add files…' }));
  await (await chooser).setFiles(fixturePath('rotated-pages.pdf'));
  await expect(sheet.getByTestId('combine-row')).toHaveCount(3);
  await expect(sheet.getByRole('status')).toHaveText('Creates 1 document with 12 pages');
  await press(page, sheet.getByRole('button', { name: 'Combine', exact: true }));
  await expect(page.getByTestId('combined-toast')).toBeVisible({ timeout: 20_000 });

  const pdf = await exported(page);
  expect(markers(pdf).slice(0, 8)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'S1', 'S2', 'S3']);
  expect(pdf.getPageCount()).toBe(12);
  expect(rotations(pdf).slice(8)).toEqual([0, 90, 180, 270]);
});

test('Extract: a new document of copies with their turns; the source keeps its pages', async ({
  page,
}) => {
  await openMixed(page);
  await select(page, [2, 4]);
  await barAct(page, 'Extract');
  const sheet = page.getByRole('dialog', { name: 'Extract pages' });
  await press(page, sheet.getByRole('button', { name: 'Extract 2 pages' }));
  const extract = page.getByRole('tab', { name: /^mixed-sizes \(extract\)/ });
  await expect(extract).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 });

  const copy = await exported(page);
  expect(markers(copy)).toEqual(['M3', 'M5']);
  expect(rotations(copy)).toEqual([90, 0]);
  expect(sizes(copy)).toEqual([MIXED.M3.size, MIXED.M5.size]);

  await page.getByRole('tab', { name: /^mixed-sizes(,|$)/ }).click();
  const source = await exported(page);
  expect(markers(source)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5']);
});

test('Split every 4 pages: each part holds its pages, in order, with their turns', async ({
  page,
}) => {
  await openMixed(page);
  // Split… for the whole document is the title menu's, its one home (DSN-47).
  await press(page, page.getByTestId('document-menu'));
  await press(page, page.getByRole('menuitem', { name: 'Split…' }));
  const sheet = page.getByRole('dialog', { name: /^Split / });
  await expect(sheet).toBeVisible();
  const every = sheet.getByRole('textbox', { name: 'Pages per document' });
  await every.fill('4');
  await every.press('Tab');
  await press(page, sheet.getByRole('button', { name: /^Split/ }).last());
  const first = page.getByRole('tab', { name: /^mixed-sizes \(1 of 2\)/ });
  const second = page.getByRole('tab', { name: /^mixed-sizes \(2 of 2\)/ });
  await expect(first).toBeVisible({ timeout: 20_000 });
  await expect(second).toBeVisible();

  await first.click();
  const one = await exported(page);
  expect(markers(one)).toEqual(['M1', 'M2', 'M3', 'M4']);
  expect(rotations(one)).toEqual([0, 0, 90, 0]);
  expect(sizes(one)).toEqual([MIXED.M1.size, MIXED.M2.size, MIXED.M3.size, MIXED.M4.size]);

  await second.click();
  const two = await exported(page);
  expect(markers(two)).toEqual(['M5']);
  expect(sizes(two)).toEqual([MIXED.M5.size]);
});
