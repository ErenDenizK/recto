/**
 * The page strip on the phone (R26 concept 1, DSN-63; `?strip=1`): holding the "4 / 6" in the
 * capsule opens a vertical rail on the right edge, a thumb scrubbing it picks a page, letting go
 * jumps there; a tap keeps opening Go to page. Phone projects only (the compact edition).
 */
import { expect, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker } from './helpers';

const number = (page: Page) => page.getByTestId('compact-page-number');
const rail = (page: Page) => page.getByRole('listbox', { name: 'Page strip' });

async function open(page: Page): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./?lang=en&strip=1');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
  await (await chooser).setFiles(fixturePath('outline-named-dests.pdf'));
  await expect(number(page)).toHaveText('1 / 6');
}

test('hold the number, scrub the rail, release: the page changes', async ({ page }) => {
  await open(page);
  const box = await number(page).boundingBox();
  if (!box) throw new Error('no number');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(rail(page)).toBeVisible();
  await expect(rail(page)).toHaveAttribute('aria-orientation', 'vertical');
  // A short rail (landscape) cannot show six pages at once and scrolls its track, so the page
  // under the thumb is read from the rail rather than assumed from where a cell was at the hold.
  const box2 = await rail(page).boundingBox();
  if (!box2) throw new Error('no rail');
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height * 0.75, { steps: 10 });
  const picked = rail(page).getByRole('option', { selected: true });
  await expect(picked).not.toHaveAccessibleName('Page 1 of 6');
  const landed = /Page (\d+) of 6/.exec((await picked.getAttribute('aria-label')) ?? '')?.[1];
  expect(landed).toBeDefined();
  await expect(number(page)).toHaveText(`${landed} / 6`);
  await page.mouse.up();
  await expect(rail(page)).toHaveCount(0);
  await expect(number(page)).toHaveText(`${landed} / 6`);
});

test('a tap on the number still opens Go to page', async ({ page }) => {
  await open(page);
  await number(page).click();
  await expect(rail(page)).toHaveCount(0);
  await expect(page.getByTestId('compact-goto-sheet')).toBeVisible();
});
