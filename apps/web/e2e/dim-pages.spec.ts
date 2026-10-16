/**
 * Dim pages end to end (DESIGN.md §3's comfort toggle; decisions MOB-16 step 1, MOB-17): off by
 * default; Settings › Appearance (the phone: About's Appearance rows) turns it on; in the dark
 * theme the page bitmaps composite at 80 % brightness and the paper under them with them, while
 * the overlays over a page (text layer, selection, ink, highlights) keep their strength; the
 * light theme leaves the pages as authored and the switch disabled with its reason; the choice
 * survives a reload. The desktop projects run the first block, the phone the second.
 *
 * Engine-agnostic: it reads computed styles, never a pixel. `CAPTURE_SCREENSHOTS=<dir>` also
 * writes the dark reader with the dim off and on at 1440 × 900 (desktop) and 390 × 844 (phone).
 */
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { fixturePath, openFixtures, useFileInputPicker } from './helpers';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;
const DIM = 'brightness(0.8)';
const PAPER = { authored: 'rgb(255, 255, 255)', dimmed: 'rgb(204, 204, 204)' } as const;

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, `${name}-${size?.width}x${size?.height}.png`) });
}

/** The first page's sheet, its bitmap and its overlays, as computed styles say. */
function firstPage(page: Page) {
  return page
    .locator('[data-page-index="0"]')
    .first()
    .evaluate((sheet) => {
      const canvas = sheet.querySelector('canvas');
      const overlays = sheet.querySelector<HTMLElement>('.page-overlays');
      return {
        paper: getComputedStyle(sheet).backgroundColor,
        sheet: getComputedStyle(sheet).filter,
        bitmap: canvas ? getComputedStyle(canvas).filter : null,
        overlays: overlays ? getComputedStyle(overlays).filter : 'none',
      };
    });
}

async function expectDimmed(page: Page, dimmed: boolean): Promise<void> {
  await expect(page.locator('[data-page-index="0"] canvas').first()).toBeAttached();
  await expect
    .poll(() => firstPage(page))
    .toEqual({
      paper: dimmed ? PAPER.dimmed : PAPER.authored,
      sheet: 'none',
      bitmap: dimmed ? DIM : 'none',
      overlays: 'none',
    });
}

/** Runs a palette command by its title. */
async function palette(page: Page, query: string, option: RegExp | string): Promise<void> {
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('combobox').first();
  await expect(input).toBeVisible();
  await input.fill(query);
  await page.getByRole('option', { name: option }).first().click();
}

test.describe('Dim pages', () => {
  test.skip(({ isMobile }) => isMobile, 'the full edition’s Settings sheet');

  test('Settings › Appearance dims the pages in dark, not their overlays, and keeps it', async ({
    page,
  }) => {
    await useFileInputPicker(page);
    await page.goto('./?lang=en');
    await expect(page.getByTestId('home')).toBeVisible();
    await openFixtures(page, ['simple-text.pdf']);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).not.toHaveAttribute('data-dim-pages');
    await expectDimmed(page, false);
    if (SHOTS) await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, 'desktop-dim-off');

    await palette(page, 'Settings', /^Settings…/);
    const sheet = page.getByTestId('settings-sheet');
    await expect(sheet).toBeVisible();
    const dim = sheet.getByRole('switch', { name: 'Dim pages' });
    await expect(dim).toHaveAttribute('aria-checked', 'false');
    await dim.click();
    await expect(dim).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-dim-pages', '');
    await expectDimmed(page, true);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await shot(page, 'desktop-dim-on');

    // Kept with the other appearance settings: on again after a reload.
    await page.reload();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-dim-pages', '');

    // The light theme keeps the pages as authored; the switch says why it does nothing.
    await palette(page, 'Theme', 'Theme: Light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await palette(page, 'Settings', /^Settings…/);
    const light = page.getByTestId('settings-sheet').getByRole('switch', { name: 'Dim pages' });
    await expect(light).toHaveAttribute('data-disabled');
    await expect(light).toHaveAttribute('aria-checked', 'true');
    await expect(light).toHaveAccessibleDescription('Only in the dark theme');
  });

  test('is a palette command in both languages: “Sayfaları karart”', async ({ page }) => {
    await useFileInputPicker(page);
    await page.goto('./?lang=tr');
    await expect(page.getByTestId('home')).toBeVisible();
    await palette(page, 'karart', 'Sayfaları karart: Kapalı');
    await expect(page.locator('html')).toHaveAttribute('data-dim-pages', '');
    await openFixtures(page, ['simple-text.pdf']);
    await expectDimmed(page, true);
  });
});

test.describe('Dim pages on the phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'the compact edition’s About sheet');

  test('About’s Appearance rows dim the pages and keep it', async ({ page }) => {
    await useFileInputPicker(page);
    await page.goto('./?lang=en');
    await expect(page.getByTestId('compact-library')).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open PDF' }).click();
    await (await chooser).setFiles(fixturePath('simple-text.pdf'));
    await expect(page.getByTestId('compact-reader')).toBeVisible();
    await expectDimmed(page, false);
    await shot(page, 'phone-dim-off');

    await page.getByRole('button', { name: 'More' }).click();
    await page.getByTestId('compact-menu').getByRole('menuitem', { name: 'About Recto' }).click();
    const about = page.getByTestId('compact-about-sheet');
    const dim = about.getByRole('switch', { name: 'Dim pages' });
    await dim.scrollIntoViewIfNeeded();
    await expect(dim).toHaveAttribute('aria-checked', 'false');
    await dim.click();
    await expect(dim).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-dim-pages', '');
    await page.keyboard.press('Escape');
    await expect(about).toHaveCount(0);
    await expectDimmed(page, true);
    await shot(page, 'phone-dim-on');

    await page.reload();
    await expect(page.getByTestId('compact-library')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-dim-pages', '');
  });
});
