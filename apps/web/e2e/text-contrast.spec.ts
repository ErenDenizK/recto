/**
 * A new text box reads on the page under it (TXT-23): white on the sample's dark cover while
 * typing and once committed, the ink black on a light page, and a colour the person picked
 * wins. Screenshots for the review with `CAPTURE_SCREENSHOTS=<dir>`.
 */
import { expect, type Page, test } from '@playwright/test';

import { enterEdit, openFixtures, useFileInputPicker } from './helpers';

const shots = process.env.CAPTURE_SCREENSHOTS;

const layer = (page: Page) => page.locator('[data-annotation-layer="0"]');

/** Types a box at a fraction of the first page; returns the field's colour while typing. */
async function typeBox(page: Page, at: [number, number], label: string): Promise<string> {
  await page.locator('body').press('t');
  const box = await layer(page).boundingBox();
  if (!box) throw new Error('page not rendered');
  await page.mouse.click(box.x + box.width * at[0], box.y + box.height * at[1]);
  const editor = page.getByRole('textbox', { name: 'Text box text' });
  await expect(editor).toBeFocused();
  await editor.fill('Great cover!');
  const colour = await editor.evaluate((el) => getComputedStyle(el).color);
  if (shots) await page.screenshot({ path: `${shots}/${label}-typing.png` });
  await editor.press('Escape');
  await expect(layer(page).locator('[data-annotation-kind="free-text"]')).toHaveCount(1);
  if (shots) await page.screenshot({ path: `${shots}/${label}-committed.png` });
  return colour;
}

test('a text box on the sample cover is white', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'Covered in Chromium');
  await page.goto('./?sample');
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await enterEdit(page);
  expect(await typeBox(page, [0.3, 0.32], 'dark')).toBe('rgb(255, 255, 255)');
});

test('a text box on a light page keeps the ink black', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'Covered in Chromium');
  await useFileInputPicker(page);
  await page.goto('./');
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await enterEdit(page);
  expect(await typeBox(page, [0.15, 0.25], 'light')).toBe('rgb(26, 26, 26)');
});
