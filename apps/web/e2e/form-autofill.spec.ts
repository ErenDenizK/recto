/**
 * The browser's autofill hint on a form field's editor (PRD-32), desktop: on the sample's form
 * a field named like a person's name carries `autocomplete="name"`, one that matches nothing
 * (Date) stays `off`. The phone is checked in compact-forms.spec.ts.
 */
import { expect, test } from '@playwright/test';

test('form editors carry the autocomplete hint of their field, or off', async ({ page }) => {
  await page.goto('./?sample');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await page
    .locator('[data-capsule]')
    .getByRole('button', { name: /^Fill & sign/ })
    .click();
  for (const [field, token] of [
    ['name', 'name'],
    ['date', 'off'],
  ] as const) {
    const widget = page.locator(`[data-form-layer] [data-field-name="${field}"]`);
    await expect(widget).toBeInViewport({ timeout: 20_000 });
    await widget.click();
    await expect(page.locator(`[data-form-editor="${field}"]`)).toHaveAttribute(
      'autocomplete',
      token,
    );
  }
});
