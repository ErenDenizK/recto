/**
 * Canvas zoom and scroll (05-canvas §4, §5; spec D2-10): the zoom controller, the gesture into
 * the grid, the pinch detent chip (05.11) and the trailing page scrubber (05.1).
 *
 * On the `tablet` project (820 × 1180, Chromium with touch) the touches are real, through the
 * DevTools protocol:
 * - a two-finger pinch lays nothing out: Chromium's `LayoutCount` does not move and no
 *   `layout-shift` entry arrives during the pinch's frames; it commits once at rest with no
 *   transform left (Q-2);
 * - a pinch more than 15 % below fit page shows the chip, and its release opens the grid at the
 *   page under the fingers;
 * - J2 by touch: page 7 of a 400-page file is one drag of the scrubber (flows.md §8.2).
 *
 * On the desktop projects: no scrubber with a fine pointer; Mod+wheel notches stop at fit page,
 * and a notch after a 300 ms pause opens the grid. The wheels are dispatched in the page, so the
 * test is the same in every engine. Set CAPTURE_SCREENSHOTS=<dir> to write the review
 * screenshots (the chip at 1440 × 900 and on the tablet, the scrubber on the tablet).
 */
import { join } from 'node:path';

import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { expectGlassClean, walkGlass } from './support/glass-walker';
import { openFixtures, useFileInputPicker } from './helpers';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  await page.screenshot({ path: join(SHOTS, `${name}-${size?.width}x${size?.height}.png`) });
}

const zoomFrame = (page: Page) => page.locator('[data-zoom-frame]');
const layer = (page: Page) => page.locator('[data-zoom-frame] > div');
const chip = (page: Page) => page.getByTestId('pinch-detent-chip');

async function open(page: Page, name: string): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await openFixtures(page, [name]);
  await expect(page.locator('[data-page-index="0"] canvas')).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

/** Every page canvas in the DOM has its bitmap (a late bitmap resizes its canvas: a layout). */
async function bitmapsSettled(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll('[data-read-viewport] canvas')].every((c) =>
            /^(rendered|error)$/.test(c.getAttribute('data-state') ?? ''),
          ),
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
}

const frames = (page: Page, n = 1) =>
  page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);

async function layoutCount(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((metric) => metric.name === 'LayoutCount')?.value ?? Number.NaN;
}

/** Waits until Chromium has laid nothing out for ten frames in a row. */
async function layoutsSettled(page: Page, cdp: CDPSession): Promise<void> {
  let count = await layoutCount(cdp);
  for (let still = 0; still < 10; ) {
    await frames(page);
    const now = await layoutCount(cdp);
    still = now === count ? still + 1 : 0;
    count = now;
  }
}

type Finger = [number, number];

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', at: Finger[]) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: at.map(([x, y], id) => ({ x, y, id })),
  });
}

/** Two fingers `gap` px apart about `centre`, side by side. */
const pair = ([x, y]: Finger, gap: number): Finger[] => [
  [x - gap / 2, y],
  [x + gap / 2, y],
];

/** The page index under a client point. */
const pageUnder = (page: Page, [x, y]: Finger) =>
  page.evaluate(
    ([px, py]) =>
      Number(
        document
          .elementFromPoint(px, py)
          ?.closest('[data-page-index]')
          ?.getAttribute('data-page-index') ?? -1,
      ),
    [x, y] as const,
  );

/** A zoom wheel dispatched in the page at client (x, y) (Mod: Control). */
const zoomWheel = (page: Page, [x, y]: Finger, deltaY: number) =>
  page.evaluate(
    ([px, py, dy]) => {
      document.querySelector('[data-read-viewport]')?.dispatchEvent(
        new WheelEvent('wheel', {
          clientX: px,
          clientY: py,
          deltaY: dy,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [x, y, deltaY] as const,
  );

/** The centre of the free rectangle (the viewport's frame: the viewport runs under the panels). */
async function viewportCentre(page: Page): Promise<Finger> {
  const box = await page.locator('[data-read-viewport]').locator('..').boundingBox();
  if (!box) throw new Error('no viewport');
  return [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)];
}

test.describe('touch (tablet)', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.use.hasTouch !== true, 'real touches need a touch project');
    // Opening 400 pages, waiting for their bitmaps and the glass walk take their time.
    test.setTimeout(90_000);
  });

  test('a pinch lays nothing out, then commits once at rest', async ({ page }) => {
    await open(page, 'mixed-sizes.pdf');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await bitmapsSettled(page);
    const first = page.locator('[data-page-index="0"]');
    const before = await first.boundingBox();
    if (!before) throw new Error('no page');
    const centre: Finger = [Math.round(before.x + before.width / 2), Math.round(before.y + 300)];
    // Layout shifts, buffered from here on (transforms never make one).
    await page.evaluate(() => {
      const w = window as unknown as { shifts: number };
      w.shifts = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          w.shifts += (entry as unknown as { value: number }).value;
      }).observe({ type: 'layout-shift' });
    });

    await touch(cdp, 'touchStart', pair(centre, 120));
    // The second finger prepared the layer: its one layout, before the pinch's first frame.
    await expect(zoomFrame(page)).toHaveAttribute('data-zooming', '');
    await bitmapsSettled(page);
    await layoutsSettled(page, cdp);
    const layouts = await layoutCount(cdp);
    for (let i = 1; i <= 15; i++) {
      await touch(cdp, 'touchMove', pair(centre, 120 + i * 10));
      await frames(page);
    }
    expect(await layoutCount(cdp)).toBe(layouts);
    expect(await page.evaluate(() => (window as unknown as { shifts: number }).shifts)).toBe(0);
    await expect(layer(page)).toHaveAttribute('style', /scale\(/);

    await touch(cdp, 'touchEnd', []);
    await expect(zoomFrame(page)).not.toHaveAttribute('data-zooming');
    await expect(layer(page)).toHaveCSS('transform', 'none');
    const after = await first.boundingBox();
    expect(after?.width ?? 0).toBeGreaterThan(before.width * 1.8);
  });

  test('pinching below fit page shows the chip; release opens the grid at that page', async ({
    page,
  }) => {
    await open(page, 'many-pages.pdf');
    const cdp = await page.context().newCDPSession(page);
    // Down the document a little, as a reader would be.
    await page.locator('[data-read-viewport]').evaluate((el) => {
      el.scrollTop = 6000;
    });
    await bitmapsSettled(page);
    const centre = await viewportCentre(page);
    const under = await pageUnder(page, centre);
    expect(under).toBeGreaterThan(5);

    await touch(cdp, 'touchStart', pair(centre, 300));
    for (let i = 1; i <= 10; i++) {
      await touch(cdp, 'touchMove', pair(centre, 300 - i * 20));
      await frames(page);
    }
    await expect(chip(page)).toHaveAttribute('data-shown', '');
    await expect(chip(page)).toHaveText('Release to see all pages');
    await expect(chip(page)).toHaveCSS('opacity', '1');
    // The chip is clean glass mid-gesture: one backdrop root, nothing nested, sized for it.
    const walk = await walkGlass(page, { atRest: false });
    expect(
      walk.violations.filter((v) => ['Q-3', 'Q-4', 'Q-5', 'Q-8'].includes(v.rule)),
      'glass while the chip shows',
    ).toEqual([]);
    await shot(page, 'pinch-detent-chip');

    await touch(cdp, 'touchEnd', []);
    const table = page.getByTestId('light-table');
    await expect(table).toBeVisible();
    // The page that was under the fingers is in view in the grid.
    const cell = table.getByRole('gridcell', { name: new RegExp(`^Page ${under + 1} of 400\\b`) });
    await expect(cell).toBeInViewport({ ratio: 1 });
    await expect(chip(page)).toHaveCount(0);
  });

  test('J2: page 7 of a long file is one drag of the scrubber', async ({ page }) => {
    await open(page, 'many-pages.pdf');
    const cdp = await page.context().newCDPSession(page);
    const scrubber = page.getByRole('slider', { name: 'Scrub pages' });
    // Hidden at rest.
    await expect(page.getByTestId('page-scrubber')).toHaveCSS('visibility', 'hidden');
    // Reading: a short one-finger scroll shows it (scrolling is uncounted in J2).
    const [x, y] = await viewportCentre(page);
    await touch(cdp, 'touchStart', [[x, y + 200]]);
    for (let i = 1; i <= 6; i++) await touch(cdp, 'touchMove', [[x, y + 200 - i * 20]]);
    await touch(cdp, 'touchEnd', []);
    await expect(scrubber).toBeVisible();

    // The one step: drag the thumb to page 7.
    const thumb = await scrubber.boundingBox();
    const track = await page.getByTestId('page-scrubber').boundingBox();
    if (!thumb || !track) throw new Error('no scrubber');
    const travel = track.height - thumb.height;
    const from: Finger = [thumb.x + thumb.width / 2, thumb.y + thumb.height / 2];
    const to: Finger = [from[0], track.y + (6 / 399) * travel + thumb.height / 2];
    await touch(cdp, 'touchStart', [from]);
    for (let i = 1; i <= 6; i++) {
      await touch(cdp, 'touchMove', [[from[0], from[1] + ((to[1] - from[1]) * i) / 6]]);
      await frames(page);
    }
    await expect(scrubber).toHaveAttribute('aria-valuenow', '7');
    await expect(scrubber).toHaveAttribute('aria-valuetext', 'Page 7 of 400');
    await shot(page, 'page-scrubber');
    await touch(cdp, 'touchEnd', []);

    // Page 7 is on screen at the top of the free rectangle; the thumb names it.
    await expect(page.locator('[data-page-index="6"]')).toBeInViewport();
    await expect(scrubber).toHaveText('7');
    // …and the scrubber goes 1.5 s after the last scroll.
    await expect(page.getByTestId('page-scrubber')).toHaveCSS('visibility', 'hidden', {
      timeout: 4000,
    });
  });
});

test.describe('wheel (desktop)', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.use.hasTouch === true, 'the desktop projects');
  });

  test('no scrubber with a fine pointer; notches stop at fit page, then a paused one opens the grid', async ({
    page,
  }) => {
    await open(page, 'simple-text.pdf');
    await expect(page.getByTestId('page-scrubber')).toHaveCount(0);
    const centre = await viewportCentre(page);
    const width = async () => (await page.locator('[data-page-index="0"]').boundingBox())?.width;
    const fitWidth = (await width()) ?? 0;

    // A burst of notches out, 40 ms apart (sent in the page, so no round trip makes a pause):
    // the zoom stops at fit page, however many come.
    await page.evaluate(async ([x, y]) => {
      for (let i = 0; i < 10; i++) {
        document
          .querySelector('[data-read-viewport]')
          ?.dispatchEvent(
            new WheelEvent('wheel', { clientX: x, clientY: y, deltaY: 100, ctrlKey: true }),
          );
        await new Promise((r) => setTimeout(r, 40));
      }
    }, centre);
    await expect(zoomFrame(page)).not.toHaveAttribute('data-zooming');
    await expect(layer(page)).toHaveCSS('transform', 'none');
    const fitPage = (await width()) ?? 0;
    expect(fitPage).toBeLessThan(fitWidth);
    await expect(page.getByTestId('light-table')).toHaveCount(0);
    // The page is whole in the viewport at fit page.
    await expect(page.locator('[data-page-index="0"]')).toBeInViewport({ ratio: 0.99 });

    // After a pause, one more notch opens the grid.
    await page.waitForTimeout(400);
    await zoomWheel(page, centre, 100);
    await expect(page.getByTestId('light-table')).toBeVisible();
  });

  test('a trackpad pinch out shows the chip at 1440 × 900 (screenshot)', async ({ page }) => {
    test.skip(!SHOTS, 'review screenshot only');
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, 'simple-text.pdf');
    const centre = await viewportCentre(page);
    // Small Mod+wheel deltas are a trackpad pinch, sent in the page so no gap ends it; it is
    // kept going while the screenshot is taken.
    await page.evaluate(async ([x, y]) => {
      const wheel = (deltaY: number) =>
        document
          .querySelector('[data-read-viewport]')
          ?.dispatchEvent(
            new WheelEvent('wheel', { clientX: x, clientY: y, deltaY, ctrlKey: true }),
          );
      for (let i = 0; i < 30; i++) {
        wheel(4);
        await new Promise((r) => setTimeout(r, 16));
      }
      const w = window as unknown as { keep: number };
      w.keep = window.setInterval(() => wheel(0.01), 40);
    }, centre);
    await expect(chip(page)).toHaveAttribute('data-shown', '');
    await page.waitForTimeout(200);
    await shot(page, 'pinch-detent-chip');
    await page.evaluate(() => window.clearInterval((window as unknown as { keep: number }).keep));
    await expect(page.getByTestId('light-table')).toBeVisible();
    await expectGlassClean(page, 'the grid after a trackpad pinch');
  });
});
