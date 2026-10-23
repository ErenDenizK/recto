/**
 * The margin map (R26 concept 7, DSN-72; `?margin=1`): the outline beside the page on wide
 * windows, a heading goes there, zooming in withdraws it, the flag is off by default. Every wait
 * names its condition (PRC-21).
 */
import { expect, type Page, test } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';

const pill = (page: Page) => page.getByTestId('page-pill');
const map = (page: Page) => page.getByRole('navigation', { name: 'Contents in the margin' });

async function open(page: Page, query: string): Promise<void> {
  await useFileInputPicker(page);
  await page.goto(`./?lang=en&${query}`);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, ['outline-named-dests.pdf']);
  await expect(pill(page)).toHaveText(/^1 \/ \d+ · /);
}

test('off by default: no margin map', async ({ page }) => {
  await open(page, 'margin=0');
  await expect(map(page)).toHaveCount(0);
});

test('shows the outline, keeps 64 px from the page, goes to a heading, withdraws on zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'margin=1');
  await expect(map(page)).toHaveAttribute('data-shown', '');
  const links = map(page).getByRole('link');
  expect(await links.count()).toBeGreaterThan(1);
  await expect(map(page).locator('[aria-current="location"]')).toHaveCount(1);

  const nav = await map(page).boundingBox();
  const sheet = await page.locator('[data-read-viewport] [data-page-index="0"]').boundingBox();
  if (!nav || !sheet) throw new Error('no boxes');
  const gap =
    nav.x + nav.width <= sheet.x ? sheet.x - (nav.x + nav.width) : nav.x - (sheet.x + sheet.width);
  expect(gap).toBeGreaterThanOrEqual(63.5);

  await links.last().click();
  await expect(pill(page)).not.toHaveText(/^1 \/ /);

  // Zoomed far in the page grows into the margin and the map withdraws; zoom is not limited.
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('ControlOrMeta+=');
  await expect(map(page)).not.toHaveAttribute('data-shown', '');
});
