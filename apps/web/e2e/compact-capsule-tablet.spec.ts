/**
 * The single capsule is the phone's alone (EDN-24): on the tablet `?phonebar=1` changes nothing.
 * The full edition keeps its `Capsule` dock and no `compact-capsule` exists.
 */
import { expect, test } from '@playwright/test';

import { fixturePath, useFileInputPicker } from './helpers';

test('?phonebar=1 on the tablet leaves the full edition as it is', async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en&phonebar=1');
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
    .first()
    .click();
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await expect(page.locator('[data-capsule="dock"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('compact-capsule')).toHaveCount(0);
  await expect(page.getByTestId('compact-capsule-edit')).toHaveCount(0);
  await expect(page.getByTestId('compact-reader')).toHaveCount(0);
});
