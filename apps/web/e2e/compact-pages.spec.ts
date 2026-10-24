/**
 * The phone's pages (MOB-3; research phone-2026-10 `pages.md` §4) in the page overview, on the
 * `phone` project (390 × 844, touch), each job checked on bytes read with pdf-lib, as
 * `pages-export.spec.ts` reads the full edition's.
 *
 * Covers: a long press selects (and taps then toggle); Rotate; Delete and its Undo toast; a
 * long press and move drags a page to another place; Add › Pages from a file (the file input
 * stands in for the system picker) after the page read; Extract as file and Split here hand
 * files to the share sheet (stubbed: it keeps what it is given) and leave the open document as
 * it was. The document's own bytes come from the bar's Share, through the same stub.
 *
 * CDP touches, so Chromium only. Set CAPTURE_SCREENSHOTS=<dir> for the review screenshots.
 */
import { join } from 'node:path';

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
import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker, motionDone, pastDeadline } from './helpers';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

/** The share sheet, stubbed: every share keeps its files' names and bytes on `window`. */
async function stubShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shared: { name: string; bytes: number[] }[][] = [];
    Object.assign(window, { __shared: shared });
    Object.defineProperty(Navigator.prototype, 'canShare', {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async ({ files }: { files: File[] }) => {
        shared.push(
          await Promise.all(
            files.map(async (file) => ({
              name: file.name,
              bytes: [...new Uint8Array(await file.arrayBuffer())],
            })),
          ),
        );
      },
    });
  });
}

async function sharedCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length);
}

/** The files of the latest share, as pdf-lib documents with their names. */
async function lastShared(page: Page): Promise<{ name: string; pdf: PDFDocument }[]> {
  const files = await page.evaluate(() => {
    const all = (window as unknown as { __shared: { name: string; bytes: number[] }[][] }).__shared;
    return all[all.length - 1] ?? [];
  });
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      pdf: await PDFDocument.load(new Uint8Array(file.bytes), { updateMetadata: false }),
    })),
  );
}

// --- Reading the bytes (as pages-export.spec.ts) ---------------------------------------------

function decoded(stream: PDFStream): string {
  const bytes =
    stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
  return Buffer.from(bytes).toString('latin1');
}

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

/** Each page as its fixture marker: "M3" for mixed-sizes' page 3, "S2" for simple-text's. */
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

// --- The overview ------------------------------------------------------------------------------

const overview = (page: Page) => page.getByTestId('compact-overview');
const tile = (page: Page, index: number) =>
  page.getByTestId('compact-overview-plane').locator(`button[data-tile-index="${index}"]`);
const tiles = (page: Page) =>
  page.getByTestId('compact-overview-plane').locator('button[data-tile-index]');
const bar = (page: Page) => page.getByTestId('compact-overview-bar');

async function openMixed(page: Page): Promise<CDPSession> {
  await useFileInputPicker(page);
  await stubShare(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('compact-library')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
  await (await chooser).setFiles(fixturePath('mixed-sizes.pdf'));
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
  await page.getByTestId('compact-capsule').getByRole('button', { name: 'Pages' }).click();
  await expect(overview(page)).toHaveAttribute('data-phase', 'open', { timeout: 15_000 });
  await expect(tiles(page)).toHaveCount(5);
  return page.context().newCDPSession(page);
}

async function centre(page: Page, index: number): Promise<{ x: number; y: number }> {
  const box = await tile(page, index).boundingBox();
  if (!box) throw new Error(`tile ${index} is not laid out`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A finger held on a tile past the long press, then lifted where it is. */
async function longPress(page: Page, cdp: CDPSession, index: number): Promise<void> {
  const at = await centre(page, index);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  await pastDeadline(page, 650); // the long-press hold, the rule under test
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** A long press on tile `from`, then a move to `to` (a point) and a lift. */
async function drag(
  page: Page,
  cdp: CDPSession,
  from: number,
  to: { x: number; y: number },
): Promise<void> {
  const at = await centre(page, from);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  await pastDeadline(page, 650); // the long-press hold, the rule under test
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: at.x + ((to.x - at.x) * i) / steps, y: at.y + ((to.y - at.y) * i) / steps },
      ],
    });
  }
  await motionDone(page);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'pages-dragging-390x844.png') });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Ends the selection, shares the document from the bar, and reads what was shared. */
async function sharedDocument(page: Page): Promise<PDFDocument> {
  const selecting = bar(page).getByRole('button', { name: 'Done selecting' });
  if (await selecting.isVisible()) await selecting.click();
  const before = await sharedCount(page);
  await bar(page).getByRole('button', { name: 'Share' }).click();
  await expect.poll(() => sharedCount(page), { timeout: 30_000 }).toBe(before + 1);
  const [file] = await lastShared(page);
  if (!file) throw new Error('nothing shared');
  return file.pdf;
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await motionDone(page);
  await page.screenshot({ path: join(SHOTS, `${name}-390x844.png`) });
}

test.describe('the phone’s pages (MOB-3)', () => {
  test('a long press selects, taps toggle, Rotate turns the selection', async ({ page }) => {
    const cdp = await openMixed(page);
    await longPress(page, cdp, 1);
    const selectionBar = page.getByTestId('compact-overview-selection-bar');
    await expect(selectionBar).toContainText('1 selected');
    await expect(tile(page, 1)).toHaveAttribute('aria-pressed', 'true');
    // The long press's own click did not toggle it back, nor open the page.
    await expect(overview(page)).toHaveAttribute('data-phase', 'open');
    await tile(page, 3).tap();
    await expect(selectionBar).toContainText('2 selected');
    await shot(page, 'pages-selecting');
    await selectionBar.getByRole('button', { name: 'Rotate' }).click();
    await expect(page.getByTestId('toast').getByText('Rotated 2 pages right')).toBeVisible();
    const pdf = await sharedDocument(page);
    expect(markers(pdf)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5']);
    expect(rotations(pdf)).toEqual([0, 90, 90, 90, 0]);
  });

  test('Select in the bar enters selection with nothing selected; Done leaves it', async ({
    page,
  }) => {
    await openMixed(page);
    const rest = page.getByTestId('compact-overview-actions');
    // At rest: Select · Add · Share · Done (MOB-9).
    await expect(rest.getByRole('button')).toHaveText(['Select', 'Add', 'Share', 'Done']);
    await rest.getByRole('button', { name: 'Select' }).click();
    const selectionBar = page.getByTestId('compact-overview-selection-bar');
    await expect(selectionBar).toContainText('0 selected');
    await expect(selectionBar.getByRole('button', { name: 'Rotate' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(tile(page, 0)).toHaveAttribute('aria-pressed', 'false');
    // A tap now toggles instead of opening the page.
    await tile(page, 2).tap();
    await expect(selectionBar).toContainText('1 selected');
    await expect(overview(page)).toHaveAttribute('data-phase', 'open');
    await selectionBar.getByRole('button', { name: 'Done selecting' }).click();
    await expect(rest).toBeVisible();
    await expect(tile(page, 2)).not.toHaveAttribute('aria-pressed');
  });

  test('Delete takes one step, and the toast’s Undo brings the page back', async ({ page }) => {
    const cdp = await openMixed(page);
    await longPress(page, cdp, 0);
    await page
      .getByTestId('compact-overview-selection-bar')
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(tiles(page)).toHaveCount(4);
    // Deleting ends the selection; the Undo toast stands above the bar.
    await expect(page.getByTestId('compact-overview-actions')).toBeVisible();
    const undo = page.getByRole('button', { name: 'Undo' });
    // Once its entrance has settled, the toast's foot is above the bar's top.
    const barBox = await bar(page).boundingBox();
    await expect
      .poll(async () => {
        const box = await page.getByTestId('toast').last().boundingBox();
        return (box?.y ?? 0) + (box?.height ?? 0) <= (barBox?.y ?? 0) + 0.5;
      })
      .toBe(true);
    await shot(page, 'pages-deleted-undo');
    expect(markers(await sharedDocument(page))).toEqual(['M2', 'M3', 'M4', 'M5']);
    await undo.click();
    await expect(tiles(page)).toHaveCount(5);
    expect(markers(await sharedDocument(page))).toEqual(['M1', 'M2', 'M3', 'M4', 'M5']);
  });

  test('a long press and move drags a page to another place', async ({ page }) => {
    const cdp = await openMixed(page);
    // Page 5 (second row) dropped before page 1 (the first tile's left half).
    const first = await tile(page, 0).boundingBox();
    if (!first) throw new Error('no first tile');
    await drag(page, cdp, 4, { x: first.x + 10, y: first.y + first.height / 2 });
    await expect(page.getByTestId('toast').getByText('Moved 1 page')).toBeVisible();
    expect(markers(await sharedDocument(page))).toEqual(['M5', 'M1', 'M2', 'M3', 'M4']);
  });

  test('Add › Pages from a file inserts after the page read, as one step', async ({ page }) => {
    await openMixed(page);
    await page.getByTestId('compact-overview-add').click();
    const menu = page.getByTestId('compact-overview-add-menu');
    await expect(menu).toBeVisible();
    await shot(page, 'pages-add-menu');
    const chooser = page.waitForEvent('filechooser');
    await menu.getByRole('menuitem', { name: 'Pages from a file' }).click();
    await (await chooser).setFiles(fixturePath('simple-text.pdf'));
    await expect(tiles(page)).toHaveCount(8);
    expect(markers(await sharedDocument(page))).toEqual([
      'M1',
      'S1',
      'S2',
      'S3',
      'M2',
      'M3',
      'M4',
      'M5',
    ]);
    // One step: Undo takes all three away.
    await page.getByRole('button', { name: 'Undo' }).first().click();
    await expect(tiles(page)).toHaveCount(5);
  });

  test('Extract and Split make files for the share sheet; the document stays', async ({ page }) => {
    const cdp = await openMixed(page);
    await longPress(page, cdp, 1);
    await tile(page, 2).tap();
    const selectionBar = page.getByTestId('compact-overview-selection-bar');
    await expect(selectionBar).toContainText('2 selected');
    await selectionBar.getByRole('button', { name: 'More page actions' }).click();
    const more = page.getByTestId('compact-overview-more-menu');
    await expect(more).toBeVisible();
    await shot(page, 'pages-more-menu');
    let before = await sharedCount(page);
    await more.getByRole('menuitem', { name: 'Extract as file' }).click();
    await expect.poll(() => sharedCount(page), { timeout: 30_000 }).toBe(before + 1);
    const [extracted] = await lastShared(page);
    expect(extracted?.name).toBe('mixed-sizes (pages 2–3).pdf');
    expect(markers(extracted?.pdf as PDFDocument)).toEqual(['M2', 'M3']);
    // M3 keeps its own /Rotate.
    expect(rotations(extracted?.pdf as PDFDocument)).toEqual([0, 90]);

    // Split here at pages 2 and 3: three files.
    await selectionBar.getByRole('button', { name: 'More page actions' }).click();
    before = await sharedCount(page);
    await page
      .getByTestId('compact-overview-more-menu')
      .getByRole('menuitem', { name: 'Split here' })
      .click();
    await expect.poll(() => sharedCount(page), { timeout: 30_000 }).toBe(before + 1);
    const parts = await lastShared(page);
    expect(parts.map((p) => markers(p.pdf))).toEqual([['M1'], ['M2'], ['M3', 'M4', 'M5']]);
    expect(parts.map((p) => p.name)).toEqual([
      'mixed-sizes (page 1).pdf',
      'mixed-sizes (page 2).pdf',
      'mixed-sizes (pages 3–5).pdf',
    ]);

    // The open document is as it was: no step was taken.
    await expect(tiles(page)).toHaveCount(5);
    expect(markers(await sharedDocument(page))).toEqual(['M1', 'M2', 'M3', 'M4', 'M5']);
  });
});

if (SHOTS) {
  test.describe('pages review captures', () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`selecting and the menus, ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        const cdp = await openMixed(page);
        await shot(page, `pages-rest-${colorScheme}`);
        await longPress(page, cdp, 1);
        await tile(page, 3).tap();
        await shot(page, `pages-selecting-${colorScheme}`);
        await page
          .getByTestId('compact-overview-selection-bar')
          .getByRole('button', { name: 'More page actions' })
          .click();
        await shot(page, `pages-more-${colorScheme}`);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('compact-overview-actions')).toBeVisible();
        await page.getByTestId('compact-overview-add').click();
        await shot(page, `pages-add-${colorScheme}`);
      });
    }
  });
}
