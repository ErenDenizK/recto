/**
 * Phone editing's foundation (M10 WP1; design/phone-2026-10/README.md §2–§6, EDN-8), on the
 * `phone` and `phone-land` projects with CDP touch: the edit button morphs the capsule into the
 * edit island on Pen; one finger draws; a dot neither toggles the chrome nor zooms; Undo and
 * Redo walk the stroke; two fingers pinch and never draw; the tool drawer rises out of the chip
 * and a tile arms its tool with the drawer staying open, Undo working under it (EDN-18); Done
 * leaves editing and the stroke is kept on the device and comes
 * back after a reload.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (reading, island, drawer, the
 * drawer mid-rise with its animation paused through CDP, a drawn stroke).
 */
import { join } from 'node:path';

import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker, waitForSnapshot } from './helpers';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

async function shot(page: Page, name: string, settle = 400): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  if (settle > 0) await page.waitForTimeout(settle);
  const scheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  const lang = await page.evaluate(() => document.documentElement.lang || 'en');
  await page.screenshot({
    path: join(SHOTS, `${name}-${lang}-${scheme}-${size?.width}x${size?.height}.png`),
  });
}

async function openReader(page: Page, lang = 'en'): Promise<void> {
  await useFileInputPicker(page);
  await page.goto(`./?lang=${lang}`);
  await expect(page.getByTestId('compact-library')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

const capsule = (page: Page) => page.getByTestId('compact-capsule');
const undo = (page: Page) => page.getByTestId('compact-undo');
const redo = (page: Page) => page.getByTestId('compact-redo');
const chip = (page: Page) => page.getByTestId('compact-tool-chip');
const drawer = (page: Page) => page.getByTestId('compact-tool-drawer');
const zoomOf = async (page: Page) =>
  Number(await page.getByTestId('compact-pages').getAttribute('data-zoom'));

/** A box on the first page, in page coordinates: its lower blank half, clear of the text. */
async function blankArea(page: Page): Promise<{ x: number; y: number; w: number; h: number }> {
  const box = await page.locator('[data-page-index="0"]').boundingBox();
  if (!box) throw new Error('no page');
  const view = page.viewportSize() ?? { width: 390, height: 844 };
  const bottom = Math.min(box.y + box.height, view.height - 120);
  return { x: box.x + box.width * 0.2, y: bottom - 90, w: box.width * 0.6, h: 60 };
}

/** One finger: a stroke across `area` by CDP touch events. */
async function drawStroke(cdp: CDPSession, area: { x: number; y: number; w: number; h: number }) {
  const at = (t: number) => ({
    x: area.x + area.w * t,
    y: area.y + area.h / 2 + Math.sin(t * Math.PI * 2) * (area.h / 2.5),
    id: 1,
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / steps)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Two fingers moving apart: a pinch. */
async function pinch(cdp: CDPSession, centre: { x: number; y: number }, from: number, to: number) {
  const points = (gap: number) => [
    { x: centre.x - gap / 2, y: centre.y, id: 1 },
    { x: centre.x + gap / 2, y: centre.y, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(from + ((to - from) * i) / steps),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Dark pixels of the first page's bitmap inside `area` (page coordinates), as a share. */
async function inkIn(page: Page, area: { x: number; y: number; w: number; h: number }) {
  return page.locator('[data-page-index="0"]').evaluate((el, a) => {
    const canvas = el.querySelector('canvas');
    if (!canvas) return 0;
    const box = canvas.getBoundingClientRect();
    const sx = canvas.width / box.width;
    const sy = canvas.height / box.height;
    const probe = document.createElement('canvas');
    const w = Math.max(1, Math.round(a.w * sx));
    const h = Math.max(1, Math.round(a.h * sy));
    probe.width = w;
    probe.height = h;
    const ctx = probe.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(canvas, (a.x - box.x) * sx, (a.y - box.y) * sy, w, h, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] ?? 255) + (data[i + 1] ?? 255) + (data[i + 2] ?? 255) < 300) dark++;
    }
    return dark / (w * h);
  }, area);
}

async function expectUndoable(locator: Locator, on: boolean): Promise<void> {
  if (on) await expect(locator).not.toHaveAttribute('aria-disabled', 'true');
  else await expect(locator).toHaveAttribute('aria-disabled', 'true');
}

test.describe('phone editing (M10 WP1)', () => {
  test('edit, draw with a finger, undo, redo, pinch without ink, Done keeps the stroke', async ({
    page,
  }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await openReader(page);
    await shot(page, 'reading');

    // The edit button beside the capsule morphs it into the island, on Pen.
    const edit = page.getByRole('button', { name: 'Edit' });
    await expect(edit).toBeVisible();
    await edit.click();
    await expect(capsule(page)).toHaveAttribute('data-editing');
    await expect(chip(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page)).toHaveAccessibleName('Pen');
    await expect(page.getByTestId('compact-edit-done')).toBeVisible();
    await expectUndoable(undo(page), false);
    await expect(edit).toHaveAttribute('data-away');
    await shot(page, 'island');

    const cdp = await page.context().newCDPSession(page);
    const area = await blankArea(page);
    const zoom = await zoomOf(page);
    const before = await inkIn(page, area);

    // One finger draws; the chrome stays.
    await drawStroke(cdp, area);
    await expectUndoable(undo(page), true);
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');
    await expect.poll(() => inkIn(page, area), { timeout: 10_000 }).toBeGreaterThan(before);
    await shot(page, 'stroke');

    // A dot is the pen's: it neither toggles the chrome nor zooms.
    const dot = { x: area.x + area.w / 2, y: area.y - 40, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [dot] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [dot] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(450);
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');
    expect(await zoomOf(page)).toBe(zoom);

    // Undo until nothing is left; Redo appears after an undo.
    while ((await undo(page).getAttribute('aria-disabled')) !== 'true') {
      await undo(page).click();
    }
    await expect(redo(page)).toBeVisible();
    await expect.poll(() => inkIn(page, area), { timeout: 10_000 }).toBeLessThanOrEqual(before);

    // Two fingers pinch and never draw: a stroke would clear Redo's step.
    const centre = { x: area.x + area.w / 2, y: area.y - 120 };
    await pinch(cdp, centre, 80, 200);
    await expect.poll(() => zoomOf(page)).toBeGreaterThan(zoom);
    await expect(redo(page)).toBeVisible();
    await pinch(cdp, centre, 200, 80);

    // Redo brings the first stroke back.
    await redo(page).click();
    await expectUndoable(undo(page), true);

    // Done: back to reading, the stroke kept on the device.
    await page.getByTestId('compact-edit-done').click();
    await expect(capsule(page)).not.toHaveAttribute('data-editing');
    await expect(edit).not.toHaveAttribute('data-away');
    await expect(page.getByTestId('compact-page-number')).toBeVisible();
    await waitForSnapshot(page);
    await page.reload();
    await expect(page.getByTestId('compact-reader')).toBeVisible();
    await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
      'data-state',
      'rendered',
    );
    const after = await blankArea(page);
    await expect.poll(() => inkIn(page, after), { timeout: 10_000 }).toBeGreaterThan(before);
  });

  test('the drawer rises from the chip, arms a tile and stays, and closes by Done, swipe, outside or the chip', async ({
    page,
  }) => {
    await openReader(page);
    await page.getByRole('button', { name: 'Edit' }).click();
    const more = page.getByTestId('compact-tool-more');
    await more.click();
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page)).toHaveAttribute('role', 'dialog');
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    // Floating: inset from the sides, above the island, never over 55 % of the screen.
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    await page.waitForTimeout(600);
    const box = await drawer(page).boundingBox();
    const island = await capsule(page).boundingBox();
    if (!box || !island) throw new Error('not laid out');
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width - 16);
    expect(box.y + box.height).toBeLessThanOrEqual(island.y - 8);
    expect(box.height).toBeLessThanOrEqual(view.height * 0.55 + 1);
    // Tiles are 44 px targets at least; Pen is armed and its options show.
    const pen = drawer(page).getByRole('button', { name: 'Pen' });
    await expect(pen).toHaveAttribute('aria-pressed', 'true');
    expect((await pen.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('compact-ink-options')).toBeVisible();
    // Edit text is live (WP5, EDN-17), no longer "Soon".
    await expect(drawer(page).getByRole('button', { name: 'Edit text' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await shot(page, 'drawer');

    // A tile arms its tool and the drawer stays open (EDN-18): its options and the chip under it
    // turn to the new tool, so another choice is one tap away.
    await drawer(page).getByRole('button', { name: 'Highlight' }).click();
    await expect(chip(page)).toHaveAccessibleName('Highlight');
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page).getByRole('button', { name: 'Highlight' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('compact-ink-options')).toBeVisible();
    await drawer(page).getByRole('button', { name: 'Pen' }).click();
    await expect(chip(page)).toHaveAccessibleName('Pen');
    await expect(page.getByTestId('compact-ink-options')).toBeVisible();
    await expect(drawer(page)).toBeVisible();

    // Closed by Done…
    await drawer(page).getByTestId('compact-drawer-done').click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(more).toBeFocused();
    // …by a press outside…
    await more.click();
    await expect(drawer(page)).toBeVisible();
    await page.getByTestId('compact-drawer-scrim').dispatchEvent('pointerdown');
    await expect(drawer(page)).toHaveCount(0);
    // …by the chip…
    await more.click();
    await expect(drawer(page)).toBeVisible();
    await chip(page).click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(chip(page)).toHaveAttribute('aria-pressed', 'true');
    // …and by a swipe down.
    await more.click();
    await expect(drawer(page)).toBeVisible();
    await page.waitForTimeout(500);
    const grab = await drawer(page).boundingBox();
    if (!grab) throw new Error('no drawer');
    const cdp = await page.context().newCDPSession(page);
    const x = grab.x + grab.width / 2;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: grab.y + 8, id: 1 }],
    });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: grab.y + 8 + i * 14, id: 1 }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(drawer(page)).toHaveCount(0);

    // The chip's tap turns the tool off: one finger scrolls again.
    await chip(page).click();
    await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('Undo and Redo work with the drawer open, which stays (EDN-18)', async ({ page }) => {
    await openReader(page);
    await page.getByTestId('compact-edit').click();
    await expect(capsule(page)).toHaveAttribute('data-editing');
    const cdp = await page.context().newCDPSession(page);
    await drawStroke(cdp, await blankArea(page));
    await expectUndoable(undo(page), true);

    await page.getByTestId('compact-tool-more').click();
    await expect(drawer(page)).toBeVisible();
    // The island's Undo, under the open drawer: the stroke goes and the drawer stays.
    await undo(page).click();
    await expectUndoable(undo(page), false);
    await expect(drawer(page)).toBeVisible();
    // The drawer's own Redo brings it back, still open.
    const redoAction = drawer(page).getByRole('button', { name: 'Redo' });
    await expect(redoAction).not.toHaveAttribute('aria-disabled', 'true');
    await redoAction.click();
    await expectUndoable(undo(page), true);
    await expect(drawer(page)).toBeVisible();
  });
});

/**
 * The review set (CAPTURE_SCREENSHOTS only): reading with the edit button, the island, the
 * drawer open on Pen, the drawer mid-rise (its animation paused through CDP) and a drawn
 * stroke, in English and Turkish, dark and light.
 */
for (const lang of ['en', 'tr'] as const) {
  for (const colorScheme of ['dark', 'light'] as const) {
    test.describe(`review captures, ${lang} ${colorScheme}`, () => {
      test.use({ colorScheme });

      test('captures', async ({ page }) => {
        test.skip(!SHOTS, 'screenshots only');
        await openReader(page, lang);
        await shot(page, 'reading');
        await page.getByTestId('compact-edit').click();
        await shot(page, 'island', 700);
        const cdp = await page.context().newCDPSession(page);
        await drawStroke(cdp, await blankArea(page));
        await expectUndoable(undo(page), true);
        await shot(page, 'stroke', 900);
        await page.getByTestId('compact-tool-more').click();
        await shot(page, 'drawer', 800);
        await page.getByTestId('compact-drawer-scrim').dispatchEvent('pointerdown');
        await expect(drawer(page)).toHaveCount(0);
        await cdp.send('Animation.enable');
        await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
        await page.getByTestId('compact-tool-more').click();
        await page.waitForTimeout(400);
        await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
        await shot(page, 'drawer-rising', 0);
        await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
      });
    });
  }
}
