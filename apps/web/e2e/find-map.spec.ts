/**
 * The find map (R26 concept 3; DSN-65, behind `?findmap=1`) on the desktop and the tablet: hit
 * ticks on the reader's scroll bar that show a card (page, thumbnail, the hit's sentence) and
 * jump on a click or a tap and make that page's hit current; the sidebar's Find results with a
 * thumbnail and a count in each page group header (no flag). The ticks are one canvas, so the
 * specs find them by their pixels (`support/find-map.ts`).
 */
import { expect, type Page, test } from '@playwright/test';

import { showSidebar } from './helpers';
import { tickPoints } from './support/find-map';

async function openAndSearch(page: Page, query: string, flags = '&findmap=1') {
  await page.goto(`./?sample${flags}`);
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await page.keyboard.press('ControlOrMeta+f');
  const field = page.getByRole('searchbox', { name: 'Find in document' }).locator('visible=true');
  await expect(field.first()).toBeFocused();
  await field.first().fill(query);
  const count = page
    .locator('[data-testid="find-count"], [data-testid="search-status"]')
    .locator('visible=true')
    .first();
  await expect(count).toContainText(/ of \d/);
  return count;
}

test('a hit tick shows its card on hover and jumps on a click or a tap', async ({
  page,
  hasTouch,
}) => {
  const count = await openAndSearch(page, 'the');
  const canvas = page.locator('canvas[data-scroll-ticks]:not([hidden])');
  await expect(canvas).toHaveCount(1);
  const before = await count.textContent();
  const scroller = page.locator('[data-read-viewport]');
  const top = await scroller.evaluate((el) => el.scrollTop);

  const ticks = await expect
    .poll(async () => (await tickPoints(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(1)
    .then(() => tickPoints(page));
  const target = ticks[ticks.length - 1]!;

  if (hasTouch) {
    // A finger: the tap lands on the rail, shows the card for a moment and jumps on lifting.
    await page.touchscreen.tap(target.x, target.y);
  } else {
    await page.mouse.move(target.x - 40, target.y);
    await page.mouse.move(target.x, target.y, { steps: 4 });
    const card = page.getByTestId('find-map-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Page \d+/);
    await expect(card).toContainText(/\d+ match/);
    await expect(card.locator('strong').first()).toHaveText(/the/i);
    await page.mouse.click(target.x, target.y);
  }
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(top + 200);
  await expect(count).not.toHaveText(before ?? '');
  await expect(page.locator('[data-testid="search-highlights"] [data-current]')).toBeVisible();
});

test('the card goes when the pointer leaves the tick', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'hover is a pointer thing');
  await openAndSearch(page, 'the');
  const ticks = await expect
    .poll(async () => (await tickPoints(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(1)
    .then(() => tickPoints(page));
  const target = ticks[ticks.length - 1]!;
  await page.mouse.move(target.x, target.y, { steps: 4 });
  const card = page.getByTestId('find-map-card');
  await expect(card).toBeVisible();
  await page.mouse.move(target.x - 200, target.y);
  await expect(card).toBeHidden();
});

test('without the flag a tick is only a mark: no card', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'hover is a pointer thing');
  await openAndSearch(page, 'the', '');
  const ticks = await expect
    .poll(async () => (await tickPoints(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(1)
    .then(() => tickPoints(page));
  const target = ticks[ticks.length - 1]!;
  await page.mouse.move(target.x, target.y, { steps: 4 });
  // No card must show after the hover delay: the wait is the thing tested.
  await page.waitForTimeout(400);
  await expect(page.getByTestId('find-map-card')).toHaveCount(0);
});

test('the results list shows a thumbnail and a count in each page group header', async ({
  page,
}) => {
  await openAndSearch(page, 'the', '');
  await showSidebar(page, 'Find');
  const header = page.locator('[data-page-heading]').first();
  await expect(header).toBeVisible();
  await expect(header.locator('canvas')).toHaveCount(1);
  await expect(header).toContainText(/Page \d+/);
  await expect(header).toContainText(/\d+$/);

  // Stepping with Enter keeps the current hit's row in view.
  const field = page.getByRole('searchbox', { name: 'Find in document' }).locator('visible=true');
  await field.first().focus();
  for (let step = 0; step < 30; step++) await field.first().press('Enter');
  const row = page.locator('[role="option"][aria-selected="true"]');
  await expect(row).toBeVisible();
  await expect
    .poll(async () => {
      const list = await page.getByRole('listbox', { name: 'Search results' }).evaluate((el) => {
        const r = el.parentElement?.getBoundingClientRect();
        return r ? { y: r.y, height: r.height } : null;
      });
      const box = await row.boundingBox();
      return (
        !!list && !!box && box.y >= list.y - 1 && box.y + box.height <= list.y + list.height + 1
      );
    })
    .toBe(true);
});
