/**
 * The Markup palette's labels that bloom (DSN-71, `?labels=1`): on the first open the capsule
 * grows by a label line, each icon shows its name, and it settles back to icons only; off by
 * default. Set `LABELS_SHOTS=<dir>` to also write the bloomed and settled screenshots there.
 */
import { expect, type Page, test } from '@playwright/test';

async function openMarkup(page: Page, query: string): Promise<void> {
  await page.goto(`./?sample&lang=en${query}`);
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Markup', exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Markup', exact: true })).toBeVisible();
}

const shots = process.env.LABELS_SHOTS;

async function bloomAndSettle(page: Page, name: string): Promise<void> {
  await openMarkup(page, '&labels=1');
  const bloom = page.locator('[data-bloom]');
  await expect(bloom).toBeVisible({ timeout: 5000 });
  await expect(bloom.getByText('Lasso', { exact: true })).toBeVisible();
  await expect(bloom.getByText('Text box', { exact: true })).toBeVisible();
  // Q-8: a label is never under 11 px.
  const label = await bloom.getByText('Lasso', { exact: true }).evaluate((el) => {
    return Number.parseFloat(getComputedStyle(el).fontSize);
  });
  expect(label).toBeGreaterThanOrEqual(11);
  if (shots) await page.screenshot({ path: `${shots}/bloomed-${name}.png` });
  await expect(bloom).toHaveCount(0, { timeout: 8000 });
  await page.waitForTimeout(800);
  if (shots) await page.screenshot({ path: `${shots}/settled-${name}.png` });
}

test.describe('labels that bloom', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the first open names the icons, then settles', async ({ page }) => {
    await bloomAndSettle(page, '1440x900');
  });

  test('is off by default and with ?labels=0', async ({ page }) => {
    await openMarkup(page, '&labels=0');
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-bloom]')).toHaveCount(0);
  });
});

test.describe('labels that bloom on a tablet', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

  test('the same on a touch screen', async ({ page }) => {
    await bloomAndSettle(page, '1180x820-touch');
  });
});
