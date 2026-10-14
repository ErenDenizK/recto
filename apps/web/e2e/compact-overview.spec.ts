/**
 * The phone's page overview (MOB-2; `docs/research/phone-2026-10/pinch-overview.md`), on the
 * `phone` project (390 × 844, touch).
 *
 * Covers: a pinch below fit width scrubs the morph on the Web Animations clock (paused, its
 * `currentTime` the fingers' progress; PRC-14) and its armed release settles into the grid,
 * which rests untransformed with the focus on the current page's tile; an unarmed release
 * springs back to the page; the grid's own pinch steps 2 · 3 · 4 columns keeping the tile under
 * the fingers, and a spread past the largest tiles dives into the page under them; a tap on a
 * tile dives into that page. Those use CDP touch events (Chromium only). The button path
 * (Pages, Done, Esc) uses no CDP, so it runs on every engine; under reduced motion it
 * cross-fades in at most 150 ms.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (mid-pinch and settled, light
 * and dark).
 */
import { join } from 'node:path';

import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker } from './helpers';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

/** The scrub domain of `overview/morph.ts` (progress × this = currentTime). */
const SCRUB_MS = 1000;
/** `overview-gesture.ts`: the finger ratio at which the page has reached its tile. */
const OVERVIEW_FULL = 0.45;

async function openPdf(page: Page, name: string): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('compact-library')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
  await (await chooser).setFiles(fixturePath(name));
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
  // The overview's chunk arrives when the browser is idle (or at the latest on Pages).
  await expect(page.getByTestId('compact-overview')).toBeAttached({ timeout: 15_000 });
}

const overview = (page: Page) => page.getByTestId('compact-overview');
const plane = (page: Page) => page.getByTestId('compact-overview-plane');
const pages = (page: Page) => page.getByTestId('compact-pages');
const pageNumber = (page: Page) => page.getByTestId('compact-page-number');
const capsule = (page: Page) => page.getByTestId('compact-capsule');

type Fingers = (gap: number) => { x: number; y: number; id: number }[];

function fingers(centre: { x: number; y: number }): Fingers {
  return (gap) => [
    { x: centre.x - gap / 2, y: centre.y, id: 1 },
    { x: centre.x + gap / 2, y: centre.y, id: 2 },
  ];
}

/** Two fingers land `from` apart and move to `to` apart; they stay down. */
async function pinchHold(
  cdp: CDPSession,
  centre: { x: number; y: number },
  from: number,
  to: number,
): Promise<void> {
  const points = fingers(centre);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(from + ((to - from) * i) / steps),
    });
  }
}

async function lift(cdp: CDPSession): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function pinch(cdp: CDPSession, centre: { x: number; y: number }, from: number, to: number) {
  await pinchHold(cdp, centre, from, to);
  await lift(cdp);
}

/** The plane's animations: play state, current time, and its easing (PRC-14's clock). */
async function planeClock(page: Page) {
  return plane(page).evaluate((el) =>
    el.getAnimations().map((a) => ({
      state: a.playState,
      time: Number(a.currentTime ?? 0),
      easing: a.effect?.getComputedTiming().easing ?? '',
      duration: Number(a.effect?.getComputedTiming().duration ?? 0),
    })),
  );
}

/** Follows the overview until it rests in `phase` with no animation left on its layers. */
async function expectRest(page: Page, phase: 'open' | 'closed'): Promise<void> {
  await expect(overview(page)).toHaveAttribute('data-phase', phase, { timeout: 10_000 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((a) => a.playState === 'running' || a.playState === 'paused')
            .filter((a) => {
              const target = (a.effect as KeyframeEffect | null)?.target;
              return (
                target instanceof Element &&
                target.closest(
                  '[data-testid="compact-overview"], [data-testid="compact-pages"]',
                ) !== null &&
                a.effect?.getComputedTiming().iterations !== Infinity
              );
            }).length,
      ),
    )
    .toBe(0);
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  await page.screenshot({ path: join(SHOTS, `${name}-${size?.width}x${size?.height}.png`) });
}

const SCREEN_CENTRE = { x: 195, y: 422 };

test.describe('the page overview (MOB-2)', () => {
  test('a pinch below fit scrubs the morph and an armed release settles into the grid', async ({
    page,
  }) => {
    await openPdf(page, 'many-pages.pdf');
    const cdp = await page.context().newCDPSession(page);

    // Fingers 300 → 210 px: ratio 0.7, armed (15 % below fit), progress (1 − 0.7) / 0.55.
    await pinchHold(cdp, SCREEN_CENTRE, 300, 210);
    await expect(overview(page)).toHaveAttribute('data-phase', 'morph');
    const progress = (1 - 0.7) / (1 - OVERVIEW_FULL);
    await expect
      .poll(async () => (await planeClock(page))[0]?.time ?? -1)
      .toBeCloseTo(progress * SCRUB_MS, -1);
    const held = await planeClock(page);
    expect(held).toHaveLength(1);
    expect(held[0]?.state).toBe('paused');
    // The page under the fingers stands in for its tile; the chip says what a release does.
    await expect(page.getByTestId('compact-overview-chip')).toHaveAttribute('data-shown', '');
    await expect(page.getByTestId('compact-overview-chip')).toHaveText('Release to see all pages');
    // Only transforms move: the reader's stage is scaled, its layout untouched.
    const stage = page.locator('[data-testid="compact-pages"] > div > div');
    expect(await stage.evaluate((el) => getComputedStyle(el).transform)).toMatch(/^matrix/);
    await shot(page, 'overview-mid-pinch');

    await lift(cdp);
    // The release runs on a spring from where the fingers left it.
    const settling = await planeClock(page);
    if (settling.length > 0) {
      expect(settling[0]?.state).toBe('running');
      expect(settling[0]?.easing).toContain('linear(');
    }
    await expectRest(page, 'open');
    // At rest: no transform on the grid (Q-2), the reader hidden, three columns, the focus on
    // the page that was read.
    await expect(plane(page)).toHaveCSS('transform', 'none');
    await expect(page.getByTestId('compact-overview-grid')).toHaveAttribute('data-columns', '3');
    await expect(pages(page)).toHaveAttribute('data-overview', 'true');
    // The tile of the page under the fingers is current and takes the focus.
    const current = plane(page).locator('button[aria-current="page"]');
    await expect(current).toBeFocused();
    const anchor = Number(await current.getAttribute('data-tile-index')) + 1;
    await expect(current).toHaveAccessibleName(`Page ${anchor} of 400`);
    await expect(page.getByRole('status')).toHaveText(`Pages grid. 400 pages. Page ${anchor}.`);
    // Virtualised: a few screens of tiles, not 400.
    expect(await plane(page).getByRole('listitem').count()).toBeLessThan(80);
    // The reader's chrome is away; the overview's bar has the count and Done.
    await expect(capsule(page)).toHaveAttribute('data-hidden', 'true');
    await expect(page.getByTestId('compact-overview-bar')).toContainText('400 pages');
    await expect(page.locator('[data-tile-index="0"] canvas')).toHaveAttribute(
      'data-state',
      /^(preview|rendered)$/,
    );
    await shot(page, 'overview-settled');
  });

  test('an unarmed release springs back to the page', async ({ page }) => {
    await openPdf(page, 'many-pages.pdf');
    const cdp = await page.context().newCDPSession(page);
    await pinchHold(cdp, SCREEN_CENTRE, 300, 270);
    await expect(overview(page)).toHaveAttribute('data-phase', 'morph');
    await expect(page.getByTestId('compact-overview-chip')).not.toHaveAttribute('data-shown');
    await lift(cdp);
    await expectRest(page, 'closed');
    await expect(pages(page)).toHaveAttribute('data-zoom', '1');
    await expect(page.locator('[data-testid="compact-pages"] > div > div')).toHaveCSS(
      'transform',
      'none',
    );
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');
  });

  test('a pinch from a zoom clamps at fit and never opens the overview', async ({ page }) => {
    await openPdf(page, 'many-pages.pdf');
    const cdp = await page.context().newCDPSession(page);
    await pinch(cdp, SCREEN_CENTRE, 80, 200);
    await expect
      .poll(async () => Number(await pages(page).getAttribute('data-zoom')))
      .toBeGreaterThan(2);
    await pinch(cdp, SCREEN_CENTRE, 260, 40);
    await expect(pages(page)).toHaveAttribute('data-zoom', '1');
    await expect(overview(page)).toHaveAttribute('data-phase', 'closed');
  });

  test('the grid’s pinch steps the columns, keeps the tile in place and dives on a spread', async ({
    page,
  }) => {
    await openPdf(page, 'many-pages.pdf');
    // Read from deep in the document, so the grid can keep any tile under the fingers.
    await pages(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });
    await expect(pageNumber(page)).not.toHaveText('1 / 400');
    const cdp = await page.context().newCDPSession(page);
    await pinch(cdp, SCREEN_CENTRE, 300, 150);
    await expectRest(page, 'open');
    const grid = page.getByTestId('compact-overview-grid');
    await expect(grid).toHaveAttribute('data-columns', '3');

    /** The tile whose slot (or label) is under `point`, and its button's middle. */
    const under = (point = SCREEN_CENTRE) =>
      page.evaluate(({ x, y }) => {
        const item = document.elementFromPoint(x, y)?.closest('[role="listitem"]');
        const button = item?.querySelector('button[data-tile-index]');
        if (!(button instanceof HTMLElement)) return null;
        const box = button.getBoundingClientRect();
        return { index: Number(button.dataset.tileIndex), middle: box.top + box.height / 2 };
      }, point);
    const before = await under();
    expect(before).not.toBeNull();

    // Spread ×1.5: one step to two columns; the tile held keeps its middle at the fingers.
    await pinch(cdp, SCREEN_CENTRE, 120, 180);
    await expect(grid).toHaveAttribute('data-columns', '2');
    await expectRest(page, 'open');
    const held = await page.locator(`button[data-tile-index="${before?.index}"]`).evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    expect(Math.abs(held - SCREEN_CENTRE.y)).toBeLessThan(2);
    await expect(page.getByRole('status')).toHaveText('2 columns');

    // Close ×0.5: two steps, to four columns.
    await pinch(cdp, SCREEN_CENTRE, 240, 120);
    await expect(grid).toHaveAttribute('data-columns', '4');
    await expectRest(page, 'open');

    // Spread past the largest tiles by 15 % more: the chip shows, the release opens the page.
    // Four columns leave a gap at the screen's middle: spread over a tile's middle instead.
    const onTile = { x: 150, y: SCREEN_CENTRE.y };
    const target = await under(onTile);
    expect(target).not.toBeNull();
    await pinchHold(cdp, onTile, 80, 200);
    await expect(page.getByTestId('compact-overview-chip')).toHaveText(
      `Release to open page ${(target?.index ?? 0) + 1}`,
    );
    await lift(cdp);
    await expectRest(page, 'closed');
    await expect(pageNumber(page)).toHaveText(`${(target?.index ?? 0) + 1} / 400`);
  });

  test('a tap on a tile dives back into that page', async ({ page }) => {
    await openPdf(page, 'many-pages.pdf');
    const cdp = await page.context().newCDPSession(page);
    await pinch(cdp, SCREEN_CENTRE, 300, 150);
    await expectRest(page, 'open');
    await page.getByRole('button', { name: 'Page 5 of 400' }).tap();
    // The way back is the same morph the other way, on the clock.
    await expect(overview(page)).toHaveAttribute('data-phase', 'morph');
    await expectRest(page, 'closed');
    await expect(pageNumber(page)).toHaveText('5 / 400');
    await expect(page.locator('[data-testid="compact-pages"] > div > div')).toHaveCSS(
      'transform',
      'none',
    );
    await expect(pages(page)).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('Page 5 of 400');
  });
});

test.describe('the page overview’s button path (MOB-2)', () => {
  test('Pages opens the same overview; Done and Esc go back to the page', async ({ page }) => {
    await openPdf(page, 'page-labels.pdf');
    await capsule(page).getByRole('button', { name: 'Pages' }).click();
    await expectRest(page, 'open');
    await expect(page.getByTestId('compact-overview-grid')).toHaveAttribute('data-columns', '3');
    const tiles = plane(page).getByRole('listitem');
    await expect(tiles).toHaveCount(8);
    const first = plane(page).locator('button[data-tile-index="0"]');
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute('aria-current', 'page');
    // Tiles are buttons named by their page.
    await expect(plane(page).locator('button[data-tile-index="2"]')).toHaveAccessibleName(
      /^Page 3 /,
    );

    await page.getByTestId('compact-overview-bar').getByRole('button', { name: 'Done' }).click();
    await expectRest(page, 'closed');
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');

    await capsule(page).getByRole('button', { name: 'Pages' }).click();
    await expectRest(page, 'open');
    await plane(page).locator('button[data-tile-index="3"]').focus();
    await page.keyboard.press('Escape');
    await expectRest(page, 'closed');
    await expect(pages(page)).toBeFocused();

    await capsule(page).getByRole('button', { name: 'Pages' }).click();
    await expectRest(page, 'open');
    await plane(page).locator('button[data-tile-index="6"]').click();
    await expectRest(page, 'closed');
    await expect(pageNumber(page)).toHaveText(/^7 \/ 8$/);
  });

  test('under reduced motion it cross-fades in at most 150 ms', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPdf(page, 'page-labels.pdf');
    await capsule(page).getByRole('button', { name: 'Pages' }).click();
    const fades = await overview(page).evaluate((el) =>
      el.getAnimations().map((a) => Number(a.effect?.getComputedTiming().duration ?? 0)),
    );
    for (const ms of fades) expect(ms).toBeLessThanOrEqual(150);
    await expectRest(page, 'open');
    // No morph: the plane never moved.
    expect(await planeClock(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expectRest(page, 'closed');
  });
});

if (SHOTS) {
  test.describe('overview review captures', () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`mid-pinch and settled, ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await openPdf(page, 'page-labels.pdf');
        const cdp = await page.context().newCDPSession(page);
        await pinchHold(cdp, SCREEN_CENTRE, 300, 220);
        await expect(overview(page)).toHaveAttribute('data-phase', 'morph');
        await page.waitForTimeout(200);
        await shot(page, `overview-mid-pinch-${colorScheme}`);
        await lift(cdp);
        await expectRest(page, 'open');
        await page.waitForTimeout(400);
        await shot(page, `overview-settled-${colorScheme}`);
        await pinch(cdp, SCREEN_CENTRE, 120, 180);
        await expectRest(page, 'open');
        await page.waitForTimeout(400);
        await shot(page, `overview-two-columns-${colorScheme}`);
      });
    }
  });
}
