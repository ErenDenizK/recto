/**
 * Clip 10, "The phone edits too" (EDN-7, ADR-0034; EDN-29 for the Colophon Home): the
 * compact edition at 390 × 844 with touch. Home opens the sample in the reader; a swipe
 * reaches the editor's letter; ✎ turns the single capsule into the editing tools (EDN-24,
 * EDN-29), Highlight arms with its tray, and one fingertip marks a line. The scene asserts that the stroke is a step Undo can take back.
 * Touches are sent through CDP with a fingertip's contact (e2e/compact-pen.spec.ts), and the
 * harness draws each one (lib/touch.ts).
 */
import { expect } from '@playwright/test';

import { scene } from '../lib/scene.ts';

/** A fingertip: half of the 48 CSS px contact iOS reports for one (compact-pen.spec.ts). */
const FINGER_RADIUS = 24;

scene({
  id: '10-phone',
  kind: 'clip',
  device: 'phone',
  async run(stage) {
    const { page } = stage;
    const sample = page.getByRole('button', { name: 'Try the sample' });
    await expect(sample).toBeVisible();
    await stage.hold(500);

    // 1. Home's sample opens in the reader, its first page rendered.
    await sample.tap();
    await expect(page.getByTestId('compact-reader')).toBeVisible({ timeout: 30_000 });
    const first = page.locator('[data-page-index="0"] canvas').first();
    await expect(first).toHaveAttribute('data-state', 'rendered', { timeout: 30_000 });
    await stage.hold(700);

    // 2. A swipe up to the editor's letter, page 2: one finger scrolls while no tool is on.
    const line = page.getByText('the spring to say that her lighthouse was going automatic,');
    // Scrolling down puts the chrome away and scrolling up brings it back (CompactReader), so
    // the swipe goes a little past the letter and comes back.
    const scroll = (by: 'line' | number) =>
      line.evaluate((el, amount) => {
        let box: HTMLElement | null = el.parentElement;
        while (
          box &&
          !(
            box.scrollHeight > box.clientHeight + 4 && getComputedStyle(box).overflowY !== 'visible'
          )
        ) {
          box = box.parentElement;
        }
        const top =
          amount === 'line' ? el.getBoundingClientRect().top - innerHeight * 0.3 + 80 : amount;
        (box ?? document.scrollingElement)?.scrollBy({ top, behavior: 'smooth' });
      }, by);
    await scroll('line');
    await expect
      .poll(async () => Math.round((await line.boundingBox())?.y ?? 0), { timeout: 10_000 })
      .toBeLessThan(844 * 0.3);
    await scroll(-80);
    const edit = page.getByTestId('compact-capsule-edit');
    await expect(edit).toBeInViewport();
    await stage.rendered(page.locator('[data-page-index="1"]'), 1);
    await stage.hold(600);

    // 3. ✎: the capsule becomes the editing tools; Highlight arms and opens its tray.
    await edit.tap();
    await expect(page.getByTestId('compact-capsule')).toHaveAttribute('data-editing');
    await stage.hold(450);
    const highlight = page.getByTestId('compact-capsule-tool-highlight');
    await highlight.tap();
    await expect(highlight).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('compact-tool-tray')).toBeVisible();
    await stage.hold(450);

    // 4. One fingertip along the line.
    const box = await line.boundingBox();
    if (!box) throw new Error('the line is not on screen');
    const y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const at = (t: number) => ({
      x: box.x + 2 + (box.width - 4) * t,
      y,
      radiusX: FINGER_RADIUS,
      radiusY: FINGER_RADIUS,
      id: 1,
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [at(i / steps)],
      });
      await new Promise((resolve) => setTimeout(resolve, 18));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByTestId('compact-undo')).not.toHaveAttribute('aria-disabled', 'true');
    await stage.hold(500);
  },
});
