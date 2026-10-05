/**
 * Visible Undo and Redo and the History scrubber (spec redesign D0-6; 01-frame F3; 08-feedback
 * FB7; ADR-0032 §2.8), on `chromium` (fine) and `tablet` (coarse, real touch through the
 * DevTools protocol):
 *
 * - ↶ names the step in its tooltip and undoes in one press, a tap on the tablet;
 * - the scrubber opens from ↶ and a kept jump in Read mode changes the bytes only as history
 *   says (the four lock reasons arrive with D1 and are tested in D1-QA);
 * - undo reveal brings the changed page back into view.
 *
 * Screenshots of ↶ ↷ and the scrubber at 1440 × 900 and on the tablet go to the test output
 * (`test-results/`), for the design review.
 */

import { PDFArray, PDFDict, PDFDocument, PDFName } from '@cantoo/pdf-lib';
import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { enterEdit, openFixtures, saveCopyBytes, useFileInputPicker } from './helpers';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Chromium and the tablet project; the other engines run the same code through the unit suite',
);

const isTablet = (project: string) => project === 'tablet';

function layer(page: Page, index = 0) {
  return page.locator(`[data-annotation-layer="${index}"]`);
}

async function open(page: Page, name: string): Promise<void> {
  // Export downloads through <a download>: Playwright cannot drive the native save picker.
  await page.addInitScript({
    content:
      "Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });",
  });
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await openFixtures(page, [name]);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
}

/** Draws a rectangle with the mouse on page `index`, between two fractions of its box. */
async function rectangle(page: Page, index: number, from: [number, number], to: [number, number]) {
  await page.locator('body').press('r');
  const box = await layer(page, index).boundingBox();
  if (!box) throw new Error('page not rendered');
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
}

/** Annotation subtypes per page of a PDF, e.g. `[{ Square: 2 }]`. */
async function annotationCounts(bytes: Uint8Array): Promise<Record<string, number>[]> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  return pdf.getPages().map((p) => {
    const counts: Record<string, number> = {};
    const annots = p.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    for (let i = 0; i < (annots?.size() ?? 0); i++) {
      const subtype =
        annots
          ?.lookupMaybe(i, PDFDict)
          ?.lookupMaybe(PDFName.of('Subtype'), PDFName)
          ?.decodeText() ?? '?';
      counts[subtype] = (counts[subtype] ?? 0) + 1;
    }
    return counts;
  });
}

async function exportBytes(page: Page): Promise<Buffer> {
  return saveCopyBytes(page);
}

/** A real touch on the tablet (DevTools touch input), held for `holdMs`. */
async function touch(cdp: CDPSession, x: number, y: number, holdMs: number, page: Page) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 0 }],
  });
  await page.waitForTimeout(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function centre(page: Page, testId: string): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} not laid out`);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

test.describe('↶ ↷ and the History scrubber', () => {
  // 1440 × 900 on the desktop; the tablet keeps its own 820 × 1180.
  test.beforeEach(async ({ page }, info) => {
    if (!isTablet(info.project.name)) await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('↶ names the step and undoes in one press (a tap on the tablet); ↷ redoes', async ({
    page,
  }, info) => {
    await open(page, 'simple-text.pdf');
    const undo = page.getByTestId('undo-button');
    const redo = page.getByTestId('redo-button');
    await expect(undo).toBeVisible();
    await expect(redo).toHaveAttribute('aria-disabled', 'true');

    await enterEdit(page);
    await rectangle(page, 0, [0.2, 0.3], [0.5, 0.45]);
    const squares = layer(page).locator('[data-annotation-kind="square"]');
    await expect(squares).toHaveCount(1, { timeout: 10_000 });
    await expect(undo).toHaveAccessibleDescription(/^Undo rectangle on page 1\. /);

    if (isTablet(info.project.name)) {
      const cdp = await page.context().newCDPSession(page);
      const at = await centre(page, 'undo-button');
      await touch(cdp, at.x, at.y, 60, page);
      await expect(squares).toHaveCount(0);
      await page.screenshot({ path: info.outputPath('undo-redo-tablet.png') });
      const back = await centre(page, 'redo-button');
      await touch(cdp, back.x, back.y, 60, page);
      await expect(squares).toHaveCount(1);
      return;
    }

    // The tooltip names the step, with the keys.
    await undo.hover();
    await expect(page.getByText('Undo rectangle on page 1', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('undo-tooltip-1440.png') });
    await undo.click();
    await expect(squares).toHaveCount(0);
    await expect(redo).not.toHaveAttribute('aria-disabled');
    await redo.click();
    await expect(squares).toHaveCount(1);
  });

  test('a kept scrubber jump in Read mode changes the bytes only as history says', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'one engine is enough for the bytes');
    test.setTimeout(120_000);
    await open(page, 'simple-text.pdf');
    await enterEdit(page);
    await rectangle(page, 0, [0.15, 0.3], [0.35, 0.4]);
    await rectangle(page, 0, [0.5, 0.5], [0.7, 0.6]);
    const squares = layer(page).locator('[data-annotation-kind="square"]');
    await expect(squares).toHaveCount(2, { timeout: 10_000 });
    expect(await annotationCounts(await exportBytes(page))).toEqual([{ Square: 2 }, {}, {}]);

    // Back to Read (the M8 lock), then the scrubber: one step back, kept with Enter.
    await page.keyboard.press('1');
    await expect(page.getByRole('radio', { name: 'Read, locked' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByTestId('undo-button').click({ button: 'right' });
    const scrubber = page.getByTestId('history-scrubber');
    await expect(scrubber).toBeVisible();
    await expect(scrubber).toHaveAttribute('data-presentation', 'list');
    await expect(scrubber.getByRole('option')).toHaveCount(3);
    await page.mouse.move(2, 450);
    await scrubber.screenshot({ path: info.outputPath('scrubber-list-1440.png') });
    await page.screenshot({ path: info.outputPath('scrubber-page-1440.png') });
    await page.keyboard.press('ArrowDown');
    await expect(squares).toHaveCount(1);
    await expect(scrubber.getByRole('heading', { name: 'Previewing step 2' })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(scrubber).toHaveCount(0);
    await expect(page.getByTestId('undo-button')).toBeFocused();
    // Still in Read; the bytes hold the one rectangle history says.
    await expect(page.getByRole('radio', { name: 'Read, locked' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(await annotationCounts(await exportBytes(page))).toEqual([{ Square: 1 }, {}, {}]);

    // Esc after a preview restores; the bytes stay at the kept step.
    await page.getByTestId('undo-button').click({ button: 'right' });
    await expect(scrubber).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(squares).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(scrubber).toHaveCount(0);
    await expect(squares).toHaveCount(1);
    expect(await annotationCounts(await exportBytes(page))).toEqual([{ Square: 1 }, {}, {}]);
  });

  test('on the tablet a long press on ↶ opens the slider; a drag keeps, Cancel restores', async ({
    page,
  }, info) => {
    test.skip(!isTablet(info.project.name), 'the coarse presentation');
    const cdp = await page.context().newCDPSession(page);
    await open(page, 'simple-text.pdf');
    await enterEdit(page);
    await rectangle(page, 0, [0.15, 0.3], [0.35, 0.4]);
    await rectangle(page, 0, [0.5, 0.5], [0.7, 0.6]);
    const squares = layer(page).locator('[data-annotation-kind="square"]');
    await expect(squares).toHaveCount(2, { timeout: 10_000 });
    const scrubber = page.getByTestId('history-scrubber');
    const longPressUndo = async () => {
      const at = await centre(page, 'undo-button');
      await touch(cdp, at.x, at.y, 700, page);
      await expect(scrubber).toBeVisible();
      await expect(scrubber).toHaveAttribute('data-presentation', 'slider');
    };

    await longPressUndo();
    // The long press undid nothing.
    await expect(squares).toHaveCount(2);
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath('scrubber-slider-tablet.png') });
    await scrubber.screenshot({ path: info.outputPath('scrubber-slider-tablet-close.png') });

    // A finger drags the knob one step back: the page previews it, the release keeps it.
    const thumb = await scrubber.locator('[data-slider-thumb]').boundingBox();
    const track = await scrubber.locator('[data-track]').boundingBox();
    if (!thumb || !track) throw new Error('slider not laid out');
    const y = Math.round(thumb.y + thumb.height / 2);
    const x0 = Math.round(thumb.x + thumb.width / 2);
    const x1 = Math.round(track.x + track.width / 2);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: x0, y, id: 0 }],
    });
    for (let i = 1; i <= 8; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / 8);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y, id: 0 }],
      });
    }
    await expect(squares).toHaveCount(1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(scrubber).toHaveCount(0);
    await expect(squares).toHaveCount(1);

    // A preview from the keys, then Cancel: the step it opened at comes back.
    await longPressUndo();
    await scrubber.getByRole('slider').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(squares).toHaveCount(0);
    await expect(scrubber.getByText('1 of 3')).toBeVisible();
    // A tap through Playwright: it waits until Cancel is still and hit-testable, and names
    // whatever covers it if something does.
    await scrubber.getByRole('button', { name: 'Cancel' }).tap();
    await expect(scrubber).toHaveCount(0);
    await expect(squares).toHaveCount(1);
  });

  test('undo reveal brings the changed page back into view', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'one engine is enough');
    await open(page, 'many-pages.pdf');
    await enterEdit(page);
    await rectangle(page, 0, [0.2, 0.3], [0.5, 0.45]);
    await expect(layer(page).locator('[data-annotation-kind="square"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    // Far away from page 1: the page view's scroller to its end.
    const first = page.locator('[data-page-index="0"]');
    await first.evaluate((el) => {
      let scroller = el.parentElement;
      while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) {
        scroller = scroller.parentElement;
      }
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    await expect(first).not.toBeInViewport();
    await page.getByTestId('undo-button').click();
    await expect(first).toBeInViewport();
    // The ring flashes once and nothing runs after it (quality-bar Q-10).
    await expect
      .poll(() => first.evaluate((el) => el.getAnimations().length), { timeout: 3_000 })
      .toBe(0);
  });
});
