/**
 * Phone editing, lane B (M10 WP2, WP3; design/phone-2026-10/README.md §3 row 2, §4, §5), on the
 * `phone` and `phone-land` projects with CDP touch: the pen's preset row (three colours, three
 * sizes) keeps its choice across a reload; the Eraser takes a finger's stroke away and Undo
 * brings it back; Select lets a finger pick an annotation; the Highlight tile's freehand
 * highlighter snaps to a text line in its own tint and Undo removes it; and a text selection
 * shows the compact selection bar, whose Highlight works while reading (with its own Undo) and
 * while editing (the island's Undo), and whose Copy puts the text on the clipboard.
 *
 * A long press cannot be emulated to select text, so the selection is made programmatically,
 * as the system's would be. Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (the
 * preset row, the highlight row, a freehand highlight, the selection bar) in dark and light.
 */
import { join } from 'node:path';

import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker, motionDone } from './helpers';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

interface Area {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

async function shot(page: Page, name: string, settle = 500): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  if (settle > 0) await motionDone(page);
  const scheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  await page.screenshot({
    path: join(SHOTS, `${name}-${scheme}-${size?.width}x${size?.height}.png`),
  });
}

async function openReader(page: Page): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('compact-library')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open PDF' }).click();
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await rendered(page);
}

async function rendered(page: Page): Promise<void> {
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

const undo = (page: Page) => page.getByTestId('compact-undo');
const chip = (page: Page) => page.getByTestId('compact-tool-chip');
const drawer = (page: Page) => page.getByTestId('compact-tool-drawer');
const bar = (page: Page) => page.getByTestId('compact-selection-bar');

/** Editing with Pen on: the island opens with the tool off (MOB-18), the chip turns it on. */
async function edit(page: Page): Promise<void> {
  await page.getByTestId('compact-edit').click();
  await expect(page.getByTestId('compact-capsule')).toHaveAttribute('data-editing');
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
  await chip(page).click();
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'true');
}

async function openDrawer(page: Page): Promise<void> {
  await page.getByTestId('compact-tool-more').click();
  await expect(drawer(page)).toBeVisible();
}

async function closeDrawer(page: Page): Promise<void> {
  await page.getByTestId('compact-drawer-scrim').dispatchEvent('pointerdown');
  await expect(drawer(page)).toHaveCount(0);
}

/** The first page's lower blank half, clear of the text. */
async function blankArea(page: Page): Promise<Area> {
  const box = await page.locator('[data-page-index="0"]').boundingBox();
  if (!box) throw new Error('no page');
  const view = page.viewportSize() ?? { width: 390, height: 844 };
  const bottom = Math.min(box.y + box.height, view.height - 120);
  return { x: box.x + box.width * 0.2, y: bottom - 90, w: box.width * 0.6, h: 60 };
}

/** The box of the first page's first body line (under the heading). */
async function firstLine(page: Page): Promise<Area> {
  const line = page.locator('[data-page-index="0"] [data-text-layer] span[data-row]').nth(1);
  await expect(line).toBeAttached();
  const box = await line.boundingBox();
  if (!box) throw new Error('no text');
  return { x: box.x, y: box.y, w: box.width, h: box.height };
}

/** The point at `t` of the stroke `drawStroke` draws across `area`. */
const strokeAt = (area: Area, t: number) => ({
  x: area.x + area.w * t,
  y: area.y + area.h / 2 + Math.sin(t * Math.PI * 2) * (area.h / 2.5),
  id: 1,
});

async function touchPath(cdp: CDPSession, at: (t: number) => { x: number; y: number; id: number }) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / steps)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const drawStroke = (cdp: CDPSession, area: Area) => touchPath(cdp, (t) => strokeAt(area, t));

/** A straight stroke along the middle of `line`, end to end. */
const strokeAlong = (cdp: CDPSession, line: Area) =>
  touchPath(cdp, (t) => ({ x: line.x + 2 + (line.w - 4) * t, y: line.y + line.h / 2, id: 1 }));

/**
 * The share of the first page's bitmap inside `area` that is dark ink (`dark`) or a tint, a
 * strongly coloured pixel (`tint`). `dark` is any inked pixel (the pen starts blue, INK-13).
 */
async function pixelsIn(page: Page, area: Area, kind: 'dark' | 'tint'): Promise<number> {
  return page.locator('[data-page-index="0"]').evaluate(
    (el, { a, k }) => {
      // Every canvas of the page in order: the bitmap, then the ink layers over it.
      const canvases = [...el.querySelectorAll('canvas')];
      const base = canvases[0];
      if (!base) return 0;
      const baseBox = base.getBoundingClientRect();
      const scale = base.width / baseBox.width;
      const probe = document.createElement('canvas');
      const w = Math.max(1, Math.round(a.w * scale));
      const h = Math.max(1, Math.round(a.h * scale));
      probe.width = w;
      probe.height = h;
      const ctx = probe.getContext('2d');
      if (!ctx) return 0;
      for (const canvas of canvases) {
        const box = canvas.getBoundingClientRect();
        if (box.width === 0 || canvas.width === 0) continue;
        const sx = canvas.width / box.width;
        const sy = canvas.height / box.height;
        ctx.globalCompositeOperation = canvas === base ? 'source-over' : 'multiply';
        ctx.drawImage(
          canvas,
          (a.x - box.x) * sx,
          (a.y - box.y) * sy,
          a.w * sx,
          a.h * sy,
          0,
          0,
          w,
          h,
        );
      }
      const data = ctx.getImageData(0, 0, w, h).data;
      let hits = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 255;
        const g = data[i + 1] ?? 255;
        const b = data[i + 2] ?? 255;
        if (k === 'dark' ? r + g + b < 600 : Math.max(r, g, b) - Math.min(r, g, b) > 70) hits++;
      }
      return hits / (w * h);
    },
    { a: area, k: kind },
  );
}

/** Selects a page's first body line (the first page's by default), as a long press would. */
async function selectFirstLine(page: Page, pageIndex = 0): Promise<void> {
  await page.evaluate((index) => {
    const span = document.querySelectorAll(
      `[data-page-index="${index}"] [data-text-layer] span[data-row]`,
    )[1];
    if (!span) throw new Error('no text layer');
    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, pageIndex);
}

test.describe('phone ink (M10 lane B)', () => {
  test('the preset row: three colours, three sizes as growing dots, kept after a reload', async ({
    page,
  }) => {
    await openReader(page);
    await edit(page);
    await openDrawer(page);
    const sizes = page.getByTestId('compact-ink-sizes');
    const radios = sizes.getByRole('radio');
    await expect(radios).toHaveCount(3);
    // Three filled dots of growing diameter.
    const widths = await radios.evaluateAll((els) =>
      els.map((el) => (el.lastElementChild as HTMLElement).getBoundingClientRect().width),
    );
    expect(widths[0]).toBeLessThan(widths[1] ?? 0);
    expect(widths[1]).toBeLessThan(widths[2] ?? 0);
    const colours = page
      .getByTestId('compact-ink-options')
      .getByRole('radiogroup', { name: 'Ink colour' })
      .getByRole('radio');
    await expect(colours).toHaveCount(3);

    // A colour arms its pen, and a size is that pen's own (each pen keeps its width, EDN-11).
    await colours.nth(1).click();
    await expect(colours.nth(1)).toHaveAttribute('aria-checked', 'true');
    await sizes.getByRole('radio', { name: 'Bold' }).click();
    await expect(sizes.getByRole('radio', { name: 'Bold' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Choosing keeps the drawer open.
    await expect(drawer(page)).toBeVisible();

    await page.reload();
    await rendered(page);
    await edit(page);
    await openDrawer(page);
    await expect(colours.nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(sizes.getByRole('radio', { name: 'Bold' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('the Eraser takes a finger stroke, Undo brings it back, and Select picks it', async ({
    page,
  }) => {
    await openReader(page);
    await edit(page);
    const cdp = await page.context().newCDPSession(page);
    const area = await blankArea(page);
    const before = await pixelsIn(page, area, 'dark');
    await drawStroke(cdp, area);
    await expect
      .poll(() => pixelsIn(page, area, 'dark'), { timeout: 10_000 })
      .toBeGreaterThan(before);

    // The quiet row's Eraser, then the same path again with a finger.
    await openDrawer(page);
    await drawer(page).getByRole('button', { name: 'Eraser' }).click();
    await closeDrawer(page);
    await expect(chip(page)).toHaveAccessibleName('Eraser');
    await drawStroke(cdp, area);
    await expect
      .poll(() => pixelsIn(page, area, 'dark'), { timeout: 10_000 })
      .toBeLessThanOrEqual(before);

    // Undo puts the stroke back.
    await undo(page).click();
    await expect
      .poll(() => pixelsIn(page, area, 'dark'), { timeout: 10_000 })
      .toBeGreaterThan(before);

    // Select (the drawer's quiet action): a finger's tap on the stroke picks it.
    await openDrawer(page);
    await drawer(page).getByRole('button', { name: 'Select' }).click();
    await closeDrawer(page);
    await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
    const on = strokeAt(area, 0.25);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [on] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('[data-selected-annotation]')).toHaveCount(1);
  });

  test('the Highlight tile: a freehand stroke snaps to a line in its tint; Undo removes it', async ({
    page,
  }) => {
    await openReader(page);
    await edit(page);
    await openDrawer(page);
    await drawer(page).getByRole('button', { name: 'Highlight' }).click();
    // The tile keeps the drawer open (EDN-18), its options now the Highlighter's.
    await expect(chip(page)).toHaveAccessibleName('Highlight');
    await expect(drawer(page)).toBeVisible();
    // Its own three tints.
    const tints = page
      .getByTestId('compact-ink-options')
      .getByRole('radiogroup', { name: 'Ink colour' })
      .getByRole('radio');
    await expect(tints).toHaveCount(3);
    await tints.nth(1).click();
    await closeDrawer(page);

    const line = await firstLine(page);
    const before = await pixelsIn(page, line, 'tint');
    const cdp = await page.context().newCDPSession(page);
    await strokeAlong(cdp, line);
    await expect
      .poll(() => pixelsIn(page, line, 'tint'), { timeout: 10_000 })
      .toBeGreaterThan(before + 0.2);
    await shot(page, 'highlight-freehand');
    // Snapped: one Highlight whose band covers the line (not a thin stroke along its middle).
    const top = { ...line, h: line.h * 0.3 };
    expect(await pixelsIn(page, top, 'tint')).toBeGreaterThan(0.2);

    await undo(page).click();
    await expect
      .poll(() => pixelsIn(page, line, 'tint'), { timeout: 10_000 })
      .toBeLessThanOrEqual(before + 0.02);
  });

  test('a selection shows the bar: Highlight and Undo while reading, Copy, and Highlight while editing', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openReader(page);
    const line = await firstLine(page);
    const before = await pixelsIn(page, line, 'tint');

    // The bar's watch comes with the edit chunk, fetched when the browser is idle.
    await expect(async () => {
      await selectFirstLine(page);
      await expect(bar(page)).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    // A callout's band clear of the selection: above it, or below it when the top bar is in
    // the way (this line sits just under it).
    const placed = await bar(page).boundingBox();
    if (!placed) throw new Error('no bar');
    if ((await bar(page).getAttribute('data-side')) === 'above') {
      expect(placed.y + placed.height).toBeLessThanOrEqual(line.y - 56);
    } else {
      expect(placed.y).toBeGreaterThanOrEqual(line.y + line.h + 56);
    }
    // Edit text is live (WP5, EDN-17): the bar offers it beside Highlight and Copy.
    await expect(bar(page).getByRole('button', { name: 'Edit text' })).toHaveCount(1);

    // A line with room above it (the second page's, upright) takes the bar above it.
    const second = page.locator('[data-page-index="1"] [data-text-layer] span[data-row]').nth(1);
    const room = (await second.count()) > 0 ? await second.boundingBox() : null;
    if (room && room.y > 300 && room.y < (page.viewportSize()?.height ?? 0) - 200) {
      await selectFirstLine(page, 1);
      await expect(bar(page)).toHaveAttribute('data-side', 'above');
      const above = await bar(page).boundingBox();
      expect((above?.y ?? 0) + (above?.height ?? 0)).toBeLessThanOrEqual(room.y - 56);
      await selectFirstLine(page);
      await expect(bar(page)).toHaveAttribute('data-side', 'below');
    }

    // Copy: the line's text on the clipboard; the selection stays.
    await bar(page).getByRole('button', { name: 'Copy' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.trim().length).toBeGreaterThan(0);
    await expect(bar(page)).toBeVisible();

    // Highlight while reading: the line takes the tint; the bar offers Undo.
    await bar(page).getByRole('button', { name: 'Highlight' }).click();
    await expect(bar(page).getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect
      .poll(() => pixelsIn(page, line, 'tint'), { timeout: 10_000 })
      .toBeGreaterThan(before + 0.2);
    await bar(page).getByRole('button', { name: 'Undo' }).click();
    await expect(bar(page)).toHaveCount(0);
    await expect
      .poll(() => pixelsIn(page, line, 'tint'), { timeout: 10_000 })
      .toBeLessThanOrEqual(before + 0.02);

    // Editing, with Select: the same bar; the island's Undo takes the highlight back.
    await edit(page);
    await chip(page).click();
    await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
    await selectFirstLine(page);
    await expect(bar(page)).toBeVisible();
    await bar(page).getByRole('button', { name: 'Highlight' }).click();
    await expect(bar(page)).toHaveCount(0);
    await expect
      .poll(() => pixelsIn(page, line, 'tint'), { timeout: 10_000 })
      .toBeGreaterThan(before + 0.2);
    await undo(page).click();
    await expect
      .poll(() => pixelsIn(page, line, 'tint'), { timeout: 10_000 })
      .toBeLessThanOrEqual(before + 0.02);
  });
});

/** The review set (CAPTURE_SCREENSHOTS only), dark and light. */
for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`lane B review captures, ${colorScheme}`, () => {
    test.use({ colorScheme });

    test('captures', async ({ page }) => {
      test.skip(!SHOTS, 'screenshots only');
      await openReader(page);
      await expect(async () => {
        await selectFirstLine(page);
        await expect(bar(page)).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 15_000 });
      await shot(page, 'selection-bar');
      if ((page.viewportSize()?.height ?? 0) > 600) {
        await selectFirstLine(page, 1);
        await expect(bar(page)).toHaveAttribute('data-side', 'above');
        await shot(page, 'selection-bar-above');
      }
      await page.evaluate(() => getSelection()?.removeAllRanges());
      await edit(page);
      await openDrawer(page);
      await shot(page, 'preset-row-pen', 800);
      await drawer(page).getByRole('button', { name: 'Highlight' }).click();
      await expect(chip(page)).toHaveAccessibleName('Highlight');
      await shot(page, 'preset-row-highlight', 800);
      await closeDrawer(page);
      const cdp = await page.context().newCDPSession(page);
      await strokeAlong(cdp, await firstLine(page));
      await expect(undo(page)).not.toHaveAttribute('aria-disabled', 'true');
      await shot(page, 'highlight', 900);
    });
  });
}
