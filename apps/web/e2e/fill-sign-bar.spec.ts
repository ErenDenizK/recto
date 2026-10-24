/**
 * The Fill & sign bar (`?fillbar=1`, DSN-75): on a form PDF the dock's Fill & sign opens its own
 * short bar (stepper, Sign, Date, Done) instead of the shared palette; stepping focuses the next
 * field; Done leaves the mode. With the flag off the shared palette opens as before. Every wait
 * names its condition (PRC-21).
 */
import { expect, type Page, test } from '@playwright/test';

import { openFixtures, quiet, trackEngine, useFileInputPicker } from './helpers';

async function open(page: Page, query: string, fixture: string): Promise<void> {
  await trackEngine(page);
  await useFileInputPicker(page);
  await page.goto(`./?lang=en&${query}`);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, [fixture]);
  await expect(page.locator('[data-form-layer="0"]')).toBeAttached({ timeout: 20_000 });
  await quiet(page);
}

const fillSignDoor = (page: Page) =>
  page.locator('[data-capsule-layer="dock"] [data-dock-item="sign"]');
const bar = (page: Page) => page.locator('[data-fill-bar]');
const readout = (page: Page) => bar(page).locator('[data-item="stepper"]');

test('flag on: Fill & sign opens its bar; Next focuses a field; Done leaves', async ({ page }) => {
  await open(page, 'fillbar=1', 'forms-a.pdf');
  await fillSignDoor(page).click();
  await expect(bar(page)).toBeVisible();
  await quiet(page);
  await expect(page.locator('[data-capsule="palette"]')).toHaveAttribute('data-capsule', 'palette');
  // The shared palette's tools are not here.
  await expect(page.locator('[data-tool="ink"]')).toHaveCount(0);
  await expect(bar(page).getByRole('button', { name: 'Date' })).toBeVisible();
  await expect(bar(page).getByRole('button', { name: /^Sign/ })).toBeVisible();

  await expect(readout(page)).toContainText(/\d+ fields?/);
  await bar(page).locator('[data-field-step="next"]').click();
  await expect(readout(page)).toContainText(/^\s*1\s*\/\s*\d+|1\/\d+/);
  await expect(page.locator('[data-form-editor]')).toBeFocused();
  await quiet(page);

  await bar(page).getByRole('button', { name: 'Done' }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator('[data-capsule="dock"]')).toBeVisible();
});

test('flag off: Fill & sign opens the shared palette', async ({ page }) => {
  await open(page, 'fillbar=0', 'forms-a.pdf');
  await fillSignDoor(page).click();
  await expect(page.locator('[data-markup-palette]')).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
});
