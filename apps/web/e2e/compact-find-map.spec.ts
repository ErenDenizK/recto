/**
 * The find map on the phone (R26 concept 3; DSN-65, DSN-44; `?findmap=1`), on the `phone`
 * projects: while Find has hits, the reader's right edge carries the hit ticks on a rail; a tap
 * on one jumps there and makes that page's hit current, with the found word kept in sight (the
 * highlight lands inside the window, above the Find bar). The ticks are one canvas, so the spec
 * finds them by their pixels (`support/find-map.ts`).
 */
import { expect, test } from '@playwright/test';

import { tickPoints } from './support/find-map';

test('Find on the phone: the rail shows the hit ticks and a tap on one jumps there', async ({
  page,
}) => {
  await page.goto('./?sample&findmap=1');
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
  await page.getByTestId('compact-capsule').getByRole('button', { name: 'Find' }).tap();
  const field = page.getByRole('searchbox', { name: 'Find in document' });
  await expect(field).toBeFocused();
  await field.fill('the');
  const count = page.getByTestId('compact-find-count');
  await expect(count).toHaveText(/^1 of \d+$/, { timeout: 20_000 });
  await expect(page.locator('canvas[data-scroll-ticks]:not([hidden])')).toHaveCount(1);

  const scroller = page.locator('[data-read-viewport]');
  const top = await scroller.evaluate((el) => el.scrollTop);
  const ticks = await expect
    .poll(async () => (await tickPoints(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(1)
    .then(() => tickPoints(page));
  const target = ticks[ticks.length - 1]!;
  await page.touchscreen.tap(target.x, target.y);

  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(top + 200);
  await expect(count).not.toHaveText(/^1 of \d+$/);
  // The found word stays in sight: the current hit lies inside the window.
  const current = page.locator('[data-testid="search-highlights"] [data-current]');
  await expect(current).toBeVisible();
  const box = await current.boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  expect(box && box.y >= 0 && box.y + box.height <= height).toBe(true);
});

test('Without the flag the phone has no rail', async ({ page }) => {
  await page.goto('./?sample');
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await page.getByTestId('compact-capsule').getByRole('button', { name: 'Find' }).tap();
  await page.getByRole('searchbox', { name: 'Find in document' }).fill('the');
  await expect(page.getByTestId('compact-find-count')).toHaveText(/^1 of \d+$/, {
    timeout: 20_000,
  });
  await expect(page.locator('canvas[data-scroll-ticks]:not([hidden])')).toHaveCount(0);
});
