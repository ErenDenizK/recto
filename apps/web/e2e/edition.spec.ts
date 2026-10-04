/**
 * The edition on a desktop (ADR-0033 §2.1): the full edition by default, and the compact
 * one with `?edition=compact`, kept for the session. Runs on the desktop projects; the phone
 * projects cover the reverse (`compact.spec.ts`, `?edition=full`).
 */
import { expect, test } from '@playwright/test';

test('a desktop gets the full edition, and ?edition=compact the compact one', async ({ page }) => {
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-edition', 'full');

  const scripts: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith('.js')) scripts.push(path);
  });
  await page.goto('./?edition=compact&lang=en');
  await expect(page.getByTestId('compact-library')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-edition', 'compact');
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
  // A reload without the parameter keeps the compact edition for this session.
  await page.goto('./?lang=en');
  await expect(page.getByTestId('compact-library')).toBeVisible();
  expect(scripts.filter((path) => /\/app-[^/]+\.js$/.test(path))).toEqual([]);
});
