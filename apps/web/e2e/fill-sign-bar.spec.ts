/**
 * The Fill & sign bar (`?fillbar=1`, DSN-75): on a form PDF the dock's Fill & sign opens its own
 * short bar (stepper, Sign, Date, Done) instead of the shared palette; stepping focuses the next
 * field; Done leaves the mode. With the flag off the shared palette opens as before. Every wait
 * names its condition (PRC-21).
 */
import { expect, type Page, test } from '@playwright/test';

import { openFixtures, quiet, trackEngine, useFileInputPicker } from './helpers';

async function open(page: Page, query: string, fixture: string): Promise<void> {
  await trackEngine(page);
  await useFileInputPicker(page);
  await page.goto(`./?lang=en&${query}`);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, [fixture]);
  await expect(page.locator('[data-form-layer="0"]')).toBeAttached({ timeout: 20_000 });
  await quiet(page);
}

const fillSignDoor = (page: Page) =>
  page.locator('[data-capsule-layer="dock"] [data-dock-item="sign"]');
const bar = (page: Page) => page.locator('[data-fill-bar]');
const readout = (page: Page) => bar(page).locator('[data-item="stepper"]');

test('flag on: Fill & sign opens its bar; Next focuses a field; Done leaves', async ({ page }) => {
  await open(page, 'fillbar=1', 'forms-a.pdf');
  await fillSignDoor(page).click();
  await expect(bar(page)).toBeVisible();
  await quiet(page);
  await expect(page.locator('[data-capsule="palette"]')).toHaveAttribute('data-capsule', 'palette');
  // The shared palette's tools are not here.
  await expect(page.locator('[data-tool="ink"]')).toHaveCount(0);
  await expect(bar(page).getByRole('button', { name: 'Date' })).toBeVisible();
  await expect(bar(page).getByRole('button', { name: /^Sign/ })).toBeVisible();

  await expect(readout(page)).toContainText(/\d+ fields?/);
  await bar(page).locator('[data-field-step="next"]').click();
  await expect(readout(page)).toContainText(/1\s*\/\s*\d+/);
  await expect(page.locator('[data-form-editor]')).toBeFocused();
  await quiet(page);

  await bar(page).getByRole('button', { name: 'Done' }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator('[data-capsule="dock"]')).toBeVisible();
});

/** Steps Next until the focused editor is `name`; returns the readout's step number. */
async function stepTo(page: Page, name: string): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await bar(page).locator('[data-field-step="next"]').click();
    if ((await page.locator(`[data-form-editor="${name}"]`).count()) > 0) return;
  }
  throw new Error(`No step reached ${name}`);
}

test('flag on: stepping advances past 1/N and reaches the field on page 2', async ({ page }) => {
  await open(page, 'fillbar=1', 'forms-a.pdf');
  await fillSignDoor(page).click();
  await quiet(page);
  const next = bar(page).locator('[data-field-step="next"]');
  await next.click();
  await expect(readout(page)).toContainText(/1\s*\/\s*\d+/);
  await next.click();
  await expect(readout(page)).toContainText(/2\s*\/\s*\d+/);
  await next.click();
  await expect(readout(page)).toContainText(/3\s*\/\s*\d+/);
  // The last field of forms-a lives on page 2: stepping there brings its page into view.
  await stepTo(page, 'only_in_a');
  await expect(
    page.locator('[data-form-layer="1"] [data-form-editor="only_in_a"]'),
  ).toBeInViewport();
});

test('flag on: Date fills the focused empty text field with today, locale numerals', async ({
  page,
}) => {
  await open(page, 'fillbar=1', 'forms-a.pdf');
  await fillSignDoor(page).click();
  await quiet(page);
  await stepTo(page, 'address.city');
  const editor = page.locator('[data-form-editor="address.city"]');
  await expect(editor).toBeFocused();
  // The fixture's field has a value: empty it, then focus it again, as a user would.
  await editor.fill('');
  await editor.press('Enter');
  await expect(editor).toBeHidden();
  await page.locator('[data-form-layer] [data-field-name="address.city"]').click();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('');
  await bar(page).getByRole('button', { name: 'Date' }).click();
  const today = await page.evaluate(() =>
    new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(),
    ),
  );
  // The editor closed with the fill: opening the field again shows the date.
  await expect(editor).toBeHidden();
  await page.locator('[data-form-layer] [data-field-name="address.city"]').click();
  await expect(editor).toHaveValue(today);
});

test('flag on, touch: a tap on Next keeps the field editor, so stepping advances', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL: baseURL ?? '',
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await open(page, 'fillbar=1', 'forms-a.pdf');
    await fillSignDoor(page).tap();
    await quiet(page);
    const next = bar(page).locator('[data-field-step="next"]');
    await next.tap();
    await next.tap();
    await expect(readout(page)).toContainText(/2\s*\/\s*\d+/);
    await bar(page).getByRole('button', { name: 'Date' }).tap();
    await expect(bar(page).getByRole('button', { name: 'Date' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('flag on: typed text is kept when stepping, and Date never overwrites it', async ({
  page,
}) => {
  await open(page, 'fillbar=1', 'forms-a.pdf');
  await fillSignDoor(page).click();
  await quiet(page);
  const next = bar(page).locator('[data-field-step="next"]');
  const name = page.locator('[data-form-editor="name"]');
  await next.click();
  await expect(name).toBeFocused();
  await name.fill('Ada');
  await next.click();
  await expect(readout(page)).toContainText(/2\s*\/\s*\d+/);
  await bar(page).locator('[data-field-step="previous"]').click();
  await expect(name).toHaveValue('Ada');

  // Typed, not committed: Date arms its stamp and leaves the text alone.
  await name.fill('Ada Lovelace');
  const date = bar(page).getByRole('button', { name: 'Date' });
  await date.click();
  await expect(date).toHaveAttribute('aria-pressed', 'true');
  // Arming closes the editor; the text was committed, so opening the field shows it.
  await expect(name).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(date).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-form-layer] [data-field-name="name"]').click();
  await expect(name).toHaveValue('Ada Lovelace');
});

test('flag off: Fill & sign opens the shared palette', async ({ page }) => {
  await open(page, 'fillbar=0', 'forms-a.pdf');
  await fillSignDoor(page).click();
  await expect(page.locator('[data-markup-palette]')).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
});
