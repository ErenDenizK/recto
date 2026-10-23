/**
 * The page strip (R26 concept 1, DSN-63; `?strip=1`): holding the page pill opens a glass strip
 * of every page, scrubbing picks one, releasing jumps there; a tap still opens the menu (DSN-29);
 * the strip is a listbox for the keyboard. Runs on the desktop and the tablet projects (mouse
 * events on both: the hold is a pointer one). Every wait names its condition (PRC-21).
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';

const pill = (page: Page) => page.getByTestId('page-pill');
const strip = (page: Page) => page.getByRole('listbox', { name: 'Page strip' });

async function open(page: Page, fixture: string): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./?lang=en&strip=1');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, [fixture]);
  await expect(pill(page)).toHaveText(/^1 \/ \d+ · /);
}

async function centre(target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (!box) throw new Error('no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses the pill and holds until the strip is open. */
async function holdPill(page: Page): Promise<void> {
  const at = await centre(pill(page));
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await expect(strip(page)).toBeVisible();
}

test('hold the pill, scrub to page 3, release: the page changes', async ({ page }) => {
  await open(page, 'outline-named-dests.pdf');
  await holdPill(page);
  // The press itself moves nothing: page 1 is the scrubbed page until the pointer leaves the pill.
  await expect(strip(page).getByRole('option', { selected: true })).toHaveAccessibleName(
    'Page 1 of 6',
  );
  const third = strip(page).getByRole('option', { name: 'Page 3 of 6' });
  const at = await centre(third);
  await page.mouse.move(at.x, at.y, { steps: 8 });
  await expect(third).toHaveAttribute('aria-selected', 'true');
  // The pill's number follows the scrub before anything is released.
  await expect(pill(page)).toHaveText(/^3 \/ 6 · /);
  await page.mouse.up();
  await expect(strip(page)).toHaveCount(0);
  await expect(pill(page)).toHaveText(/^3 \/ 6 · /);
});

test('a tap keeps opening the menu, not the strip', async ({ page }) => {
  await open(page, 'outline-named-dests.pdf');
  await pill(page).click();
  await expect(pill(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(strip(page)).toHaveCount(0);
});

test('500-page budget: a 400-page document keeps a handful of cells and scrubs by scale', async ({
  page,
}) => {
  await open(page, 'many-pages.pdf');
  await holdPill(page);
  const box = await strip(page).boundingBox();
  if (!box) throw new Error('no strip');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  const cells = strip(page).getByRole('option');
  await expect.poll(async () => cells.count()).toBeLessThan(40);
  await expect(strip(page).getByRole('option', { selected: true })).toHaveCount(1);
  await page.mouse.up();
  await expect(strip(page)).toHaveCount(0);
  // About the middle of 400 pages.
  await expect(pill(page)).toHaveText(/^(1[5-9]\d|2[0-4]\d) \/ 400 · /);
});

test('keyboard: ArrowUp opens a listbox, arrows move, Enter goes, Esc closes', async ({ page }) => {
  await open(page, 'outline-named-dests.pdf');
  await pill(page).focus();
  await page.keyboard.press('ArrowUp');
  await expect(strip(page)).toBeFocused();
  await expect(strip(page)).toHaveAttribute('aria-orientation', 'horizontal');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(strip(page).getByRole('option', { selected: true })).toHaveAccessibleName(
    'Page 3 of 6',
  );
  await page.keyboard.press('Enter');
  await expect(strip(page)).toHaveCount(0);
  await expect(pill(page)).toHaveText(/^3 \/ 6 · /);
  await expect(pill(page)).toBeFocused();

  await page.keyboard.press('ArrowUp');
  await expect(strip(page)).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Escape');
  await expect(strip(page)).toHaveCount(0);
  await expect(pill(page)).toHaveText(/^3 \/ 6 · /);
});

test('reduced motion: the strip opens with a fade, nothing travels', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'outline-named-dests.pdf');
  await holdPill(page);
  await expect
    .poll(async () => strip(page).evaluate((el) => getComputedStyle(el).clipPath))
    .toBe('none');
  await page.mouse.up();
  await expect(strip(page)).toHaveCount(0);
});
