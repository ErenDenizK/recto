/**
 * A finger the size of a real one draws on the phone (MOB-18: with Pen or Highlight on, one
 * finger draws), on the `phone` project with CDP touch on the sample (`?sample`).
 *
 * CDP touches default to a 1 px contact, which no finger has. iOS Safari reports a touch's
 * `width` and `height` as twice its contact radius, about 40 to 60 CSS px for a fingertip
 * resting on an iPhone's glass, so these strokes are sent with a 24 px radius (a 48 px contact).
 * Such a press used to be taken for a palm and dropped (`pointerRole`, pen/ink-input.ts) with
 * no pen ever seen: the pen and the highlighter drew nothing but the odd light, narrow touch.
 */
import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test';

import { atRest } from './helpers';

/** A fingertip on an iPhone: half of the 48 CSS px contact iOS reports for it. */
const FINGER_RADIUS = 24;

interface Area {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const undo = (page: Page) => page.getByTestId('compact-undo');
const chip = (page: Page) => page.getByTestId('compact-tool-chip');
const drawer = (page: Page) => page.getByTestId('compact-tool-drawer');

async function expectUndoable(locator: Locator, on: boolean): Promise<void> {
  if (on) await expect(locator).not.toHaveAttribute('aria-disabled', 'true');
  else await expect(locator).toHaveAttribute('aria-disabled', 'true');
}

/** The sample's first page, rendered, then editing with the tool off (MOB-18). */
async function editSample(page: Page): Promise<void> {
  await page.goto('./?sample&lang=en');
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
  await page.getByTestId('compact-edit').click();
  await expect(page.getByTestId('compact-capsule')).toHaveAttribute('data-editing');
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
  await expectUndoable(undo(page), false);
}

/** A band across the first page's visible part, clear of the top and the island. */
async function strokeArea(page: Page): Promise<Area> {
  const box = await page.locator('[data-page-index="0"]').boundingBox();
  if (!box) throw new Error('no page');
  const view = page.viewportSize() ?? { width: 390, height: 844 };
  const top = Math.max(box.y, 160);
  const bottom = Math.min(box.y + box.height, view.height - 160);
  return { x: box.x + box.width * 0.2, y: (top + bottom) / 2 - 30, w: box.width * 0.6, h: 60 };
}

/** One finger with a real fingertip's contact: a wave across `area` by CDP touch events. */
async function fingerStroke(cdp: CDPSession, area: Area): Promise<void> {
  const at = (t: number) => ({
    x: area.x + area.w * t,
    y: area.y + area.h / 2 + Math.sin(t * Math.PI * 2) * (area.h / 2.5),
    radiusX: FINGER_RADIUS,
    radiusY: FINGER_RADIUS,
    id: 1,
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / steps)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('phone pen with a real finger (MOB-18)', () => {
  test('Pen, then Highlight: one fingertip draws a stroke that Undo can take back', async ({
    page,
  }) => {
    await editSample(page);
    const cdp = await page.context().newCDPSession(page);
    // The chip arms Pen; one finger draws.
    await chip(page).click();
    await expect(chip(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page)).toHaveAccessibleName('Pen');
    // The contact reaches the page as a fingertip's, not as CDP's 1 px default.
    const contact = page.evaluate(
      () =>
        new Promise<number>((resolve) =>
          window.addEventListener('pointerdown', (e) => resolve(Math.max(e.width, e.height)), {
            once: true,
            capture: true,
          }),
        ),
    );

    const area = await strokeArea(page);
    await fingerStroke(cdp, area);
    expect(await contact).toBeGreaterThan(40);
    await expectUndoable(undo(page), true);

    // Undo takes it back, so the Highlighter's stroke is its own step.
    await undo(page).click();
    await expectUndoable(undo(page), false);

    // The drawer's Highlight tile arms the Highlighter; one finger draws with it too.
    await page.getByTestId('compact-tool-more').click();
    await expect(drawer(page)).toBeVisible();
    await drawer(page).getByRole('button', { name: 'Highlight' }).click();
    await expect(chip(page)).toHaveAccessibleName('Highlight');
    await page.getByTestId('compact-drawer-scrim').dispatchEvent('pointerdown');
    await expect(drawer(page)).toHaveCount(0);
    await atRest(page.getByTestId('compact-capsule'));
    await fingerStroke(cdp, await strokeArea(page));
    await expectUndoable(undo(page), true);
  });

  test('the first stroke after picking a tool in the open drawer draws (EDN-28)', async ({
    page,
  }) => {
    await editSample(page);
    const cdp = await page.context().newCDPSession(page);
    for (const name of ['Pen', 'Highlight']) {
      await page.getByTestId('compact-tool-more').click();
      await expect(drawer(page)).toBeVisible();
      await drawer(page).getByRole('button', { name }).click();
      await expect(chip(page)).toHaveAccessibleName(name);
      // The drawer is still open (EDN-18); the first touch closes it and draws.
      await fingerStroke(cdp, await strokeArea(page));
      await expect(drawer(page)).toHaveCount(0);
      await expectUndoable(undo(page), true);
      await undo(page).click();
      await expectUndoable(undo(page), false);
    }
  });
});
