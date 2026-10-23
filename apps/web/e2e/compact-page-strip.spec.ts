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
  const third = rail(page).getByRole('option', { name: 'Page 3 of 6' });
  const at = await third.boundingBox();
  if (!at) throw new Error('no cell');
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2, { steps: 10 });
  await expect(third).toHaveAttribute('aria-selected', 'true');
  await expect(number(page)).toHaveText('3 / 6');
  await page.mouse.up();
  await expect(rail(page)).toHaveCount(0);
  await expect(number(page)).toHaveText('3 / 6');
});

test('a tap on the number still opens Go to page', async ({ page }) => {
  await open(page);
  await number(page).click();
  await expect(rail(page)).toHaveCount(0);
  await expect(page.getByTestId('compact-goto-sheet')).toBeVisible();
});
