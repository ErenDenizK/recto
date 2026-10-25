/**
 * The glass scroll bar (R29 study, GLS-26 amendment; `?scroll=glass-a` and `?scroll=glass-b`),
 * a prototype: on the desktop with a mouse and on the tablet with a finger, the bar grows a 44 px
 * target, and dragging it to page 4 of the sample names the page (A's bubble "4 / 8 | Roll three",
 * B's card); with no flag the bar is today's. Every wait names its condition (PRC-21).
 *
 * A finger's drag goes through the browser's own touch input (CDP), which Playwright offers on
 * Chromium only: the touch cases skip elsewhere, the pointer cases run on every engine.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { sampleEntry } from './sample-manifest';

const SAMPLE = sampleEntry('en', 'full');
const SECTION = SAMPLE.outline[3] ?? '';

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`./?lang=en&sample=en${query}`);
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
}

const bar = (page: Page) => page.locator('[data-axis="y"]');
const thumb = (page: Page) => bar(page).locator('[data-scroll-thumb-part="thumb"]');

/** Two frames: a scroll the drag caused has reached the bar's label. */
const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

/** Shows the bar the way a scroll does, then returns the thumb's centre. */
async function showBar(page: Page): Promise<{ x: number; y: number }> {
  await page.locator('[data-read-viewport]').evaluate((el) => el.scrollBy(0, 40));
  await expect(bar(page)).toHaveAttribute('data-shown', '');
  const box = await thumb(page).boundingBox();
  if (!box) throw new Error('no thumb');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Drags the thumb down the track a step at a time until `done` says it is on the page, and
 * returns what it saw. The press, the moves and the lift are a mouse's or, on a touch device, a
 * finger's.
 */
async function dragUntil(
  page: Page,
  hasTouch: boolean,
  from: { x: number; y: number },
  done: () => Promise<boolean>,
): Promise<void> {
  const track = await bar(page).boundingBox();
  if (!track) throw new Error('no bar');
  const cdp = hasTouch ? await page.context().newCDPSession(page) : null;
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
    cdp?.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: from.x, y }],
    });
  if (cdp) {
    // The bar fades a moment after a scroll, and a loaded machine can be slow to the press:
    // show it again and press until the drag has begun.
    await expect(async () => {
      const at = await showBar(page);
      await touch('touchStart', at.y);
      try {
        await expect(bar(page)).toHaveAttribute('data-drag', '', { timeout: 1500 });
      } catch (error) {
        await touch('touchEnd', 0);
        throw error;
      }
    }).toPass({ timeout: 20_000 });
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
  }
  let found = false;
  for (let step = 0; step <= 40 && !found; step += 1) {
    const y = track.y + track.height * (0.2 + step * 0.01);
    if (cdp) await touch('touchMove', y);
    else await page.mouse.move(from.x, y, { steps: 2 });
    await frames(page);
    found = await done();
  }
  expect(found, 'the drag reached page 4').toBe(true);
}

for (const flag of ['glass-a', 'glass-b'] as const) {
  test(`${flag}: a 44 px target, and a drag to page 4 names it`, async ({
    page,
    hasTouch,
    browserName,
  }) => {
    test.skip(
      hasTouch && browserName !== 'chromium',
      "a finger's drag needs Chromium's touch input",
    );
    await open(page, `&scroll=${flag}`);
    const from = await showBar(page);
    await expect(bar(page)).toHaveAttribute('data-glass', flag);
    expect((await bar(page).boundingBox())?.width).toBeGreaterThanOrEqual(44);

    // The pointer expands the bar by reaching for it; a finger does when it presses.
    if (!hasTouch) {
      await page.mouse.move(from.x - 20, from.y);
      await page.mouse.move(from.x, from.y, { steps: 3 });
      await expect(bar(page)).toHaveAttribute('data-hot', '');
    }
    const speech =
      flag === 'glass-a' ? thumb(page).locator('span') : page.getByTestId('scroll-card');
    const named = async (shown: Locator) => /(^|\D)4 \/ 8/.test((await shown.textContent()) ?? '');
    await dragUntil(page, hasTouch, from, () => named(speech));

    if (flag === 'glass-a') {
      await expect(speech).toHaveText(`4 / 8 | ${SECTION}`);
    } else {
      await expect(speech).toBeVisible();
      await expect(speech).toContainText(SECTION);
      await expect(speech).toContainText('4 / 8');
    }
    await expect(bar(page)).toHaveAttribute('data-drag', '');
    if (hasTouch) await expect(bar(page)).toHaveAttribute('data-hot', '');
  });
}

test("with no flag the bar is today's", async ({ page }) => {
  await open(page, '&scroll=0');
  await showBar(page);
  await expect(bar(page)).not.toHaveAttribute('data-glass');
  expect((await bar(page).boundingBox())?.width).toBe(14);
});
