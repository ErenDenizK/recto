/**
 * The command bar does things (Epic 4, R12 E10): a typed page number jumps, a range acts, a
 * heading jumps, and every intent shows what it will do before Enter runs it; an invalid one
 * shows why and Enter does nothing. Runs on the teaching sample (8 pages, an outline).
 */
import { expect, type Page, test } from '@playwright/test';

import { sampleEntry } from './sample-manifest';

const FULL = sampleEntry('en', 'full');

async function openSample(page: Page): Promise<void> {
  await page.goto('./?sample&lang=en');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
}

/** Opens the palette and types `query`. */
async function type(page: Page, query: string): Promise<void> {
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeVisible();
  await input.fill(query);
}

const intentRow = (page: Page) => page.locator('[data-intent] [role="option"]').first();

/** A page's box, to see a turn: a quarter turn swaps its width and height. */
async function shape(page: Page, index: number): Promise<'portrait' | 'landscape'> {
  const box = await page.locator(`[data-page-index="${index}"]`).boundingBox();
  if (!box) throw new Error('page not on screen');
  return box.height >= box.width ? 'portrait' : 'landscape';
}

test.describe('palette intents', () => {
  test('a page number jumps, in either language', async ({ page }) => {
    await openSample(page);
    await type(page, '5');
    await expect(intentRow(page)).toHaveText(/Go to page 5/);
    await expect(intentRow(page)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('page-pill')).toHaveText(new RegExp(`^5 / ${FULL.pageCount}`));

    await type(page, 'son sayfa');
    await expect(intentRow(page)).toHaveText(new RegExp(`Go to page ${FULL.pageCount}`));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('page-pill')).toHaveText(
      new RegExp(`^${FULL.pageCount} / ${FULL.pageCount}`),
    );
  });

  test('"rotate 2-3 right" shows the pages, rotates them, and can be undone', async ({ page }) => {
    await openSample(page);
    expect(await shape(page, 1)).toBe('portrait');
    await type(page, 'rotate 2-3 right');
    await expect(intentRow(page)).toContainText('Rotate pages 2–3 right');
    await expect(intentRow(page)).toContainText('2 pages');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0);
    await expect.poll(() => shape(page, 1)).toBe('landscape');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => shape(page, 1)).toBe('portrait');
  });

  test('a heading from the outline jumps to its page', async ({ page }) => {
    await openSample(page);
    await type(page, 'go to Contributor agreement');
    const row = intentRow(page);
    await expect(row).toContainText('Go to ‘Contributor agreement’');
    const detail = (await row.locator('[data-reason]').textContent()) ?? '';
    const target = /\d+/.exec(detail)?.[0];
    expect(target).toBeDefined();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('page-pill')).toHaveText(
      new RegExp(`^${target} / ${FULL.pageCount}`),
    );
  });

  test('an invalid range says why, and Enter does nothing', async ({ page }) => {
    await openSample(page);
    await type(page, 'rotate 2-99 right');
    const row = intentRow(page);
    await expect(row).toHaveAttribute('aria-disabled', 'true');
    await expect(row).toContainText(`This document has ${FULL.pageCount} pages`);
    await expect(row).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    // The palette stays, and no page turned.
    await expect(page.getByRole('combobox', { name: 'Search commands' })).toBeVisible();
    expect(await shape(page, 1)).toBe('portrait');

    await page.getByRole('combobox', { name: 'Search commands' }).fill('delete 2 pages');
    await expect(intentRow(page)).toContainText('Say a range, like 2–3');
  });

  test('the empty state opens on commands, not on Clear recents', async ({ page }) => {
    await openSample(page);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('option').first()).toBeVisible();
    await expect(page.getByRole('option', { name: /Clear recents/ })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Search commands' }).fill('clear recents');
    await expect(page.getByRole('option', { name: /Clear recents/ })).toBeVisible();
  });
});
