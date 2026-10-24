/**
 * Phone signing and saving (M10 WP6, WP7; design/phone-2026-10/README.md §3, §4, §6), on the
 * `phone` and `phone-land` projects with CDP touch:
 *
 * - Sign's tile keeps the drawer open on its options (New and the saved signatures), as a saved
 *   signature does until the first tap on the page places it (EDN-18); New opens
 *   New signature as a sheet that fits the window; a finger draws on the pad; Use arms it; the
 *   next tap places it, selected, with 44 px touch handles and the phone's bar; a drag moves
 *   it, a corner scales it, and Undo walks back to no signature. The kept signature shows as a
 *   tile next time.
 * - Saving: a copy prepared before an edit (the ⋯ menu prepares one as it opens) is never handed
 *   out after it: the menu shows the "Changed" cue and Save a copy downloads bytes with the
 *   edit.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (the drawer's Sign options, the
 * pad, the placed signature with its handles, the ⋯ menu's Changed cue), dark and light.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PDFDocument } from '@cantoo/pdf-lib';
import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker, motionDone } from './helpers';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

async function shot(page: Page, name: string, settle = 500): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  if (settle > 0) await motionDone(page);
  const scheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  await page.screenshot({
    path: join(SHOTS, `sign-${name}-${scheme}-${size?.width}x${size?.height}.png`),
  });
}

async function openReader(page: Page): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('compact-library')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open PDF' }).click();
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

const drawer = (page: Page) => page.getByTestId('compact-tool-drawer');
const sheet = (page: Page) => page.getByTestId('new-signature-sheet');
const undo = (page: Page) => page.getByTestId('compact-undo');
const stamps = (page: Page) => page.locator('[data-annotation-kind="stamp"]');

interface Point {
  readonly x: number;
  readonly y: number;
}

async function touchDrag(cdp: CDPSession, from: Point, to: Point, steps = 12): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...from, id: 1 }],
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, id: 1 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function tap(cdp: CDPSession, at: Point): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...at, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** A signature across the pad: one finger, a loop and a tail. */
async function sign(cdp: CDPSession, pad: { x: number; y: number; width: number; height: number }) {
  const at = (t: number) => ({
    x: pad.x + pad.width * (0.12 + 0.76 * t),
    y: pad.y + pad.height * (0.55 + Math.sin(t * Math.PI * 3) * 0.25),
    id: 1,
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
  for (let i = 1; i <= 30; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / 30)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** A blank spot on the first page, clear of its text and of the island. */
async function blankSpot(page: Page): Promise<Point> {
  const box = await page.locator('[data-page-index="0"]').boundingBox();
  if (!box) throw new Error('no page');
  const view = page.viewportSize() ?? { width: 390, height: 844 };
  const bottom = Math.min(box.y + box.height, view.height - 160);
  return { x: box.x + box.width / 2, y: Math.max(box.y + 140, bottom - 60) };
}

async function selectionBox(page: Page) {
  const box = await page.locator('[data-selected-annotation] rect').first().boundingBox();
  if (!box) throw new Error('nothing selected');
  return box;
}

async function annotsInCopy(path: string): Promise<number> {
  const pdf = await PDFDocument.load(await readFile(path));
  return pdf.getPages().reduce((sum, p) => sum + (p.node.Annots()?.size() ?? 0), 0);
}

test.describe('phone signing (M10 WP6)', () => {
  test('draw a signature with a finger, place it, move and scale it, undo it', async ({ page }) => {
    await openReader(page);
    await page.getByTestId('compact-edit').click();
    await page.getByTestId('compact-tool-more').click();
    await expect(drawer(page)).toBeVisible();

    // Sign's tile keeps the drawer open on its options.
    await drawer(page).getByRole('button', { name: 'Sign' }).click();
    await expect(page.getByTestId('compact-sign-options')).toBeVisible();
    await motionDone(page);
    await expect(drawer(page)).toBeVisible();
    await expect(page.getByTestId('compact-tool-chip')).toHaveAccessibleName('Sign');
    expect(
      (await page.getByTestId('compact-sign-new').boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);

    // New: the drawer goes, New signature comes, within the window.
    await page.getByTestId('compact-sign-new').click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(sheet(page)).toBeVisible();
    await motionDone(page);
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    const panel = await sheet(page).boundingBox();
    if (!panel) throw new Error('no sheet');
    expect(panel.x).toBeGreaterThanOrEqual(-1);
    expect(panel.x + panel.width).toBeLessThanOrEqual(view.width + 1);
    // The phone sheet (DSN-53), inset in its shape, opened at large for the pad: its top and its
    // primary show.
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.x).toBeGreaterThanOrEqual(8);
    const use = sheet(page).getByRole('button', { name: 'Use signature' });
    await use.scrollIntoViewIfNeeded();
    const useBox = await use.boundingBox();
    expect(useBox && useBox.y + useBox.height).toBeLessThanOrEqual(view.height + 1);

    // A finger draws on the pad.
    const pad = sheet(page).locator('canvas[data-strokes]');
    await pad.scrollIntoViewIfNeeded();
    const padBox = await pad.boundingBox();
    if (!padBox) throw new Error('no pad');
    const cdp = await page.context().newCDPSession(page);
    await sign(cdp, padBox);
    await expect(pad).toHaveAttribute('data-strokes', '1');
    await use.click();
    await expect(sheet(page)).toBeHidden();

    // The next tap places it, selected, with the touch handles and the phone's bar.
    await expect(stamps(page)).toHaveCount(0);
    await tap(cdp, await blankSpot(page));
    await expect(stamps(page)).toHaveCount(1);
    await expect(page.locator('[data-selected-annotation]')).toHaveCount(1);
    const hits = page.locator('[data-handle-hit]');
    await expect(hits).toHaveCount(4);
    for (const hit of await hits.all()) {
      const b = await hit.boundingBox();
      expect(b?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const bar = page.getByTestId('compact-touch-bar');
    await expect(bar).toBeVisible();
    expect(
      (await bar.getByRole('button').first().boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);

    // A drag on it moves it.
    const before = await selectionBox(page);
    const centre = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    await touchDrag(cdp, centre, { x: centre.x - 30, y: centre.y - 40 });
    await expect.poll(async () => (await selectionBox(page)).y).toBeLessThan(before.y - 20);
    const moved = await selectionBox(page);

    // Its corner scales it.
    const corner = await page.locator('[data-handle-hit="se"]').boundingBox();
    if (!corner) throw new Error('no corner');
    const grip = { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 };
    await touchDrag(cdp, grip, { x: grip.x + 50, y: grip.y + 20 });
    await expect
      .poll(async () => (await selectionBox(page)).width)
      .toBeGreaterThan(moved.width + 20);

    // Undo walks back to no signature.
    for (let i = 0; i < 6 && (await undo(page).getAttribute('aria-disabled')) !== 'true'; i++) {
      await undo(page).click();
      await motionDone(page);
    }
    await expect(stamps(page)).toHaveCount(0);

    // The kept signature is a tile next time.
    await page.getByTestId('compact-tool-more').click();
    const saved = page.locator('[data-saved-signature]');
    await expect(saved).toHaveCount(1);

    // Choosing it keeps the drawer open (EDN-18); the first tap on the page closes the drawer
    // and places it, where the drawer leaves page above it (a phone held upright).
    await saved.click();
    await expect(saved).toHaveAttribute('aria-pressed', 'true');
    await motionDone(page);
    await expect(drawer(page)).toBeVisible();
    const top = (await drawer(page).boundingBox())?.y ?? 0;
    const sheetBox = await page.locator('[data-page-index="0"]').boundingBox();
    if (!sheetBox) throw new Error('no page');
    const above = { x: sheetBox.x + sheetBox.width / 2, y: top - 60 };
    if (above.y < Math.max(sheetBox.y, 0) + 40) return;
    await tap(cdp, above);
    await expect(drawer(page)).toHaveCount(0);
    await expect(stamps(page)).toHaveCount(1);
  });
});

test.describe('phone saving (M10 WP7)', () => {
  test('a copy made before an edit is never handed out after it', async ({ page }) => {
    await openReader(page);
    // The title menu, the copy's home and the one menu (DSN-48, DSN-53), prepares the pristine
    // copy as it opens and shows no Changed cue yet.
    await page.getByTestId('compact-title-menu-trigger').click();
    await expect(page.getByTestId('compact-file-menu')).toBeVisible();
    await expect(page.getByTestId('compact-menu-changed')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('compact-file-menu')).toHaveCount(0);

    // A pen stroke: ✎ opens with the tool off (MOB-18), the chip turns Pen on.
    await page.getByTestId('compact-edit').click();
    await page.getByTestId('compact-tool-chip').click();
    await expect(page.getByTestId('compact-tool-chip')).toHaveAttribute('aria-pressed', 'true');
    const cdp = await page.context().newCDPSession(page);
    const spot = await blankSpot(page);
    await touchDrag(cdp, { x: spot.x - 80, y: spot.y }, { x: spot.x + 80, y: spot.y + 20 }, 20);
    await expect(undo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('compact-edit-done').click();

    // The file menu says Changed and Save a copy downloads the copy with the stroke.
    await page.getByTestId('compact-title-menu-trigger').click();
    await expect(page.getByTestId('compact-menu-changed')).toBeVisible();
    await expect(page.getByText('Changed on this device')).toBeVisible();
    await shot(page, 'menu-changed');
    const downloading = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Save a copy' }).click();
    const download = await downloading;
    expect(await annotsInCopy(await download.path())).toBeGreaterThanOrEqual(1);
  });
});

/** The review set (CAPTURE_SCREENSHOTS only), dark and light. */
for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`sign review captures, ${colorScheme}`, () => {
    test.use({ colorScheme });

    test('captures', async ({ page }) => {
      test.skip(!SHOTS, 'screenshots only');
      await openReader(page);
      await page.getByTestId('compact-edit').click();
      await page.getByTestId('compact-tool-more').click();
      await drawer(page).getByRole('button', { name: 'Sign' }).click();
      await expect(page.getByTestId('compact-sign-options')).toBeVisible();
      await shot(page, 'drawer', 700);
      await page.getByTestId('compact-sign-new').click();
      await expect(sheet(page)).toBeVisible();
      const cdp = await page.context().newCDPSession(page);
      const pad = sheet(page).locator('canvas[data-strokes]');
      await motionDone(page);
      await pad.scrollIntoViewIfNeeded();
      const padBox = await pad.boundingBox();
      if (padBox) await sign(cdp, padBox);
      await shot(page, 'pad', 300);
      await sheet(page).getByRole('button', { name: 'Use signature' }).click();
      await expect(sheet(page)).toBeHidden();
      await tap(cdp, await blankSpot(page));
      await expect(page.getByTestId('compact-touch-bar')).toBeVisible();
      await shot(page, 'placed', 700);
      await page.getByTestId('compact-tool-more').click();
      await shot(page, 'drawer-saved', 700);
      await page.getByTestId('compact-drawer-scrim').dispatchEvent('pointerdown');
      await page.getByTestId('compact-edit-done').click();
      await page.getByTestId('compact-title-menu-trigger').click();
      await shot(page, 'menu-changed', 500);
    });
  });
}
