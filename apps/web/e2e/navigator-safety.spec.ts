/**
 * Navigator safety (redesign spec §11 D1-9; flows §3.5 S10; 06-navigation §4.6): a navigating
 * click on a thumbnail never selects, so Delete after it changes nothing. Selection is
 * explicit (Mod-click, Shift-click, Space) and visible as the thumbnail's selected state, and
 * only such a selection is what Delete removes.
 */
import { expect, type Page, test } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';

const list = (page: Page) => page.getByRole('listbox', { name: /^Pages of outline-named-dests/ });
const thumb = (page: Page, n: number) =>
  list(page).getByRole('option', { name: `Page ${n}`, exact: true });
const pagesTab = (page: Page, count: number) =>
  page.getByRole('tab', { name: `Pages, ${count} items` });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, ['outline-named-dests.pdf']);
  await expect(pagesTab(page, 6)).toHaveAttribute('aria-selected', 'true');
  await expect(thumb(page, 3)).toBeVisible();
});

test('S10: click a thumbnail, press Delete, nothing changes', async ({ page }) => {
  await thumb(page, 3).click();
  // The click navigates: page 3 is current, focused, and not selected.
  await expect(page.getByTestId('status-pages')).toHaveText('Page 3 of 6');
  await expect(thumb(page, 3)).toBeFocused();
  await expect(thumb(page, 3)).toHaveAttribute('aria-current', 'page');
  await expect(thumb(page, 3)).toHaveAttribute('aria-selected', 'false');

  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  // Arrow keys navigate as well; they select nothing either.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('status-pages')).toHaveText('Page 4 of 6');
  await page.keyboard.press('Delete');

  await expect(pagesTab(page, 6)).toBeVisible();
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(0);
  await expect(page.getByTestId('toast')).toHaveCount(0);
  // The last step is still the open: ↶ offers no delete.
  await expect(page.getByTestId('undo-button')).not.toHaveAccessibleDescription(/delete/i);
});

test('Delete removes an explicit, visible selection; Esc clears it', async ({ page }) => {
  await thumb(page, 2).click({ modifiers: ['ControlOrMeta'] });
  await expect(thumb(page, 2)).toHaveAttribute('aria-selected', 'true');
  await thumb(page, 3).click({ modifiers: ['ControlOrMeta'] });
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(2);

  // Esc in the list clears the selection; Delete then has nothing to act on.
  await page.keyboard.press('Escape');
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(0);
  await page.keyboard.press('Delete');
  await expect(pagesTab(page, 6)).toBeVisible();

  await thumb(page, 2).click({ modifiers: ['ControlOrMeta'] });
  await page.keyboard.press('Delete');
  await expect(pagesTab(page, 5)).toBeVisible();
  await expect(page.getByTestId('toast').getByText('Deleted page 2')).toBeVisible();
});
