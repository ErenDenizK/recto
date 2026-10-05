/**
 * Long press opens the page menu on touch (spec D1-7; 04-context §2.3, §13 item 1; research 19
 * §6, M-20): the gesture core's 450 ms recogniser on the page paper.
 *
 * On the `tablet` project the touches are real (the DevTools protocol's touch input, so the
 * browser's own gesture handling, its `contextmenu` and its click run too). The desktop
 * projects have no touch screen, and only Chromium has the DevTools protocol, so there the
 * spec feeds touch-typed Pointer Events to the paper: it proves the wiring and the menu in
 * every engine, WebKit included, without the platform's touch pipeline.
 */
import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';

type Phase = 'start' | 'end';

/**
 * A touch at (x, y) begins or ends: through `cdp` when the project has real touch (one session
 * for the whole test, which keeps the touch between its start and end), else as Pointer Events.
 */
async function touchAt(page: Page, phase: Phase, x: number, y: number, cdp: CDPSession | null) {
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: phase === 'start' ? 'touchStart' : 'touchEnd',
      touchPoints: phase === 'start' ? [{ x, y, id: 0 }] : [],
    });
    return;
  }
  await page.evaluate(
    ([type, px, py]) => {
      const target = document.elementFromPoint(px, py);
      if (!target) throw new Error('nothing under the touch');
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 41,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          clientX: px,
          clientY: py,
        }),
      );
    },
    [phase === 'start' ? 'pointerdown' : 'pointerup', x, y] as const,
  );
}

test('a long press on a page opens the page menu at the press, once', async ({
  page,
  browserName,
}, testInfo) => {
  const real = browserName === 'chromium' && testInfo.project.use.hasTouch === true;
  const cdp = real ? await page.context().newCDPSession(page) : null;
  await useFileInputPicker(page);
  await page.goto('./');
  await openFixtures(page, ['simple-text.pdf']);
  const first = page.locator('[data-page-index="0"]');
  await expect(first.locator('canvas[data-state="rendered"]')).toBeAttached({ timeout: 20_000 });
  const box = await first.boundingBox();
  if (!box) throw new Error('page 1 not laid out');
  // The top margin: paper, not a text run (a press on text selects natively).
  const x = Math.round(box.x + 24);
  const y = Math.round(box.y + 16);
  const menu = page.getByTestId('page-context-menu');

  // A short press is no long press.
  await touchAt(page, 'start', x, y, cdp);
  await page.waitForTimeout(200);
  await touchAt(page, 'end', x, y, cdp);
  await page.waitForTimeout(400);
  await expect(menu).toHaveCount(0);

  // Held: the menu opens while the finger is still down, at the press point.
  await touchAt(page, 'start', x, y, cdp);
  await expect(menu).toBeVisible({ timeout: 2_000 });
  await expect(menu).toHaveAccessibleName('Page 1');
  const at = await menu.boundingBox();
  expect(Math.abs((at?.x ?? 0) - x)).toBeLessThan(16);
  // Past Android's own long-press time, then lift: still one menu, still open (its
  // `contextmenu` and the release's click were swallowed).
  await page.waitForTimeout(400);
  await touchAt(page, 'end', x, y, cdp);
  await page.waitForTimeout(500);
  await expect(menu).toHaveCount(1);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /^Arrange/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('long-press-menu.png') });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});
