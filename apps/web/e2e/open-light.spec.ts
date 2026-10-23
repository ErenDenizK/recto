/**
 * Opening in light (R26 concept 2, DSN-64). The page is never bare white, and behind
 * `?open=light` a card opens with a grow and one pulse of light.
 *
 * - **No blank page.** A 400-page document is flung 60 pages down; one frame later the landing
 *   page is on screen and fewer than 98 % of its pixels are white (a stretched thumbnail, a
 *   soft render or the paper tone, never the sheet's bare white), and it settles to its sharp
 *   render with the same property.
 * - **The open moment.** From the Library the card's sheet grows into the page (a clone laid on
 *   the window, growing on a spring, gone at rest), the light pulses on the session's first
 *   open only, and nothing of it is left on the page.
 */
import { expect, type Page, test } from '@playwright/test';

import { openFixtures, PAGE_CANVAS, useFileInputPicker } from './helpers';
import { decodePng, type Image } from './support/pixels';

const FLING_PAGES = 60;

/** The share of pixels in the box (CSS px, of a full-viewport shot) whose channels are all >= 250. */
function whiteShare(
  image: Image,
  scale: number,
  box: { x: number; y: number; width: number; height: number },
): number {
  const x0 = Math.max(0, Math.floor(box.x * scale));
  const y0 = Math.max(0, Math.floor(box.y * scale));
  const x1 = Math.min(image.width, Math.ceil((box.x + box.width) * scale));
  const y1 = Math.min(image.height, Math.ceil((box.y + box.height) * scale));
  let white = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4;
      total += 1;
      if (
        (image.data[i] ?? 0) >= 250 &&
        (image.data[i + 1] ?? 0) >= 250 &&
        (image.data[i + 2] ?? 0) >= 250
      ) {
        white += 1;
      }
    }
  }
  return total === 0 ? 1 : white / total;
}

async function shareOf(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const image = decodePng(await page.screenshot());
  return whiteShare(image, image.width / (await page.evaluate(() => innerWidth)), box);
}

test.describe('no blank page', () => {
  test.beforeEach(async ({ page }) => {
    await useFileInputPicker(page);
  });

  test('a 60-page fling lands on a page that is not bare white', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Frame-timed sampling is Chromium-only');
    await page.goto('./?lang=en');
    await openFixtures(page, ['many-pages.pdf']);
    await expect(page.locator(`[data-page-index="0"] ${PAGE_CANVAS}`)).toHaveAttribute(
      'data-state',
      'rendered',
    );

    // The fling: jump 60 pages down, then wait for the landing page to be laid out (at most a
    // few frames) and stop at the first frame it is on screen.
    const landing = await page.evaluate(async (pages) => {
      const view = document.querySelector<HTMLElement>('[data-read-viewport]');
      const first = document.querySelector<HTMLElement>('[data-page-index="0"]');
      if (!view || !first) throw new Error('no reader');
      const step = first.getBoundingClientRect().height + 16;
      view.scrollTop += step * pages;
      for (let frame = 0; frame < 6; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const hit = [...view.querySelectorAll<HTMLElement>('[data-page-index]')]
          .map((el) => ({ el, box: el.getBoundingClientRect() }))
          .find(({ box }) => box.top < innerHeight * 0.5 && box.bottom > innerHeight * 0.5);
        if (hit) {
          const { x, y, width, height } = hit.box;
          return { index: Number(hit.el.dataset.pageIndex), frame, box: { x, y, width, height } };
        }
      }
      return null;
    }, FLING_PAGES);
    expect(landing, 'the landing page is laid out within a few frames').not.toBeNull();
    if (!landing) return;
    expect(landing.index).toBeGreaterThan(FLING_PAGES - 5);

    // Right away: whatever is under the landing page (a soft bitmap or the paper tone).
    const view = {
      x: Math.max(0, landing.box.x),
      y: Math.max(0, landing.box.y),
      width: landing.box.width,
      height: landing.box.height,
    };
    expect(await shareOf(page, view)).toBeLessThan(0.98);

    // And once the sharp render is on it.
    await expect(
      page.locator(`[data-page-index="${landing.index}"] ${PAGE_CANVAS}`),
    ).toHaveAttribute('data-state', 'rendered', { timeout: 20_000 });
    expect(await shareOf(page, view)).toBeLessThan(0.98);
  });
});

test.describe('opening in light (?open=light)', () => {
  test.beforeEach(async ({ page }) => {
    await useFileInputPicker(page);
    // Counts what the open adds to the window: the growing clone and the pulse of light.
    await page.addInitScript(() => {
      const seen = { halos: 0, widths: [] as number[] };
      (window as unknown as { __open: typeof seen }).__open = seen;
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches('[data-open-light]')) seen.halos += 1;
            if (node.matches('[data-open-grow]')) {
              const sample = () => {
                if (!node.isConnected) return;
                seen.widths.push(node.getBoundingClientRect().width);
                requestAnimationFrame(sample);
              };
              sample();
            }
          }
        }
      }).observe(document, { childList: true, subtree: true });
    });
  });

  test('the card grows into the page, the light pulses once per session', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Script-built file picks and frame sampling are Chromium-only',
    );
    await page.goto('./?lang=en&open=light');
    await openFixtures(page, ['simple-text.pdf']);
    await expect(page.locator(`[data-page-index="0"] ${PAGE_CANVAS}`)).toHaveAttribute(
      'data-state',
      'rendered',
    );
    const opened = () =>
      page.evaluate(
        () => (window as unknown as { __open: { halos: number; widths: number[] } }).__open,
      );
    const before = await opened();
    const card = page.getByRole('listbox', { name: 'Files' }).getByRole('option').first();

    for (const round of [1, 2]) {
      await page.getByRole('button', { name: 'Library' }).click();
      await expect(card).toBeVisible();
      const mark = (await opened()).widths.length;
      await card.click();
      await expect(page.locator(`[data-page-index="0"] ${PAGE_CANVAS}`)).toHaveAttribute(
        'data-state',
        'rendered',
      );
      // The clone is gone at rest, and nothing of the open is left on the page.
      await expect(page.locator('[data-open-grow]')).toHaveCount(0, {
        timeout: 10_000,
      });
      await expect(page.locator('[data-open-light]')).toHaveCount(0, { timeout: 10_000 });
      const after = await opened();
      const grown = after.widths.slice(mark);
      // Software rendering draws few frames: two samples show the grow.
      expect(grown.length, `round ${round}: the clone was drawn`).toBeGreaterThanOrEqual(2);
      expect(Math.max(...grown), `round ${round}: it grew`).toBeGreaterThan(
        Math.min(...grown) * 1.4,
      );
      // Only the first open of the session pulsed.
      expect(after.halos - before.halos, `round ${round}`).toBe(1);
    }
  });

  test('without the flag the card opens as before: no clone, no pulse', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Script-built file picks and frame sampling are Chromium-only',
    );
    await page.goto('./?lang=en&open=0');
    await openFixtures(page, ['simple-text.pdf']);
    await page.getByRole('button', { name: 'Library' }).click();
    await page.getByRole('listbox', { name: 'Files' }).getByRole('option').first().click();
    await expect(page.locator(`[data-page-index="0"] ${PAGE_CANVAS}`)).toHaveAttribute(
      'data-state',
      'rendered',
    );
    const seen = await page.evaluate(
      () => (window as unknown as { __open: { halos: number; widths: number[] } }).__open,
    );
    expect(seen.halos).toBe(0);
    expect(seen.widths.length).toBe(0);
  });
});
