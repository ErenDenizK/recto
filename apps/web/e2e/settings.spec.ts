/**
 * The Settings sheet, S3 (spec redesign D0-10; components/07-sheets.md §5, §25; flows.md §9.5):
 *
 * - **Presentation:** a 480 px side sheet at the trailing edge from the expanded class up, a
 *   centred form sheet (≤ 640) on the `tablet` project's medium class; the glass walker finds it
 *   clean at rest (one backdrop root, no glass in glass).
 * - **Openers:** ⌘K "Settings…" and Mod+, (Chromium; other browsers keep the key), the Document
 *   menu's "Settings…" where the Appearance submenu was, "About Recto" from ⌘K and the privacy
 *   popover's version line, both on the About Recto page; ‹ Back returns to the list.
 * - **Every setting from ⌘K and the sheet:** a switch applies at once and persists across a
 *   reload; the same setting's palette command says and changes it.
 * - **Search finds each row in EN and TR:** an English and a Turkish keyword (without its
 *   diacritics) each find the row in either language, a match inside About Recto lists that
 *   page's row, and nonsense says "No setting matches".
 * - **Language without a reload:** Türkçe re-titles the open sheet, Follow the browser returns
 *   to the browser's English, and the choice survives a reload.
 *
 * Photographs at 1440 × 900 and on the tablet, in English and Turkish, go to the test output, and
 * to SETTINGS_SHOT_DIR when set.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Page, test, type TestInfo } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';
import { expectGlassClean } from './support/glass-walker';

const TABLET = 'tablet';

async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  const dir = process.env.SETTINGS_SHOT_DIR;
  const file = `${name}-${info.project.name}.png`;
  const path = dir ? join(dir, file) : info.outputPath(file);
  if (dir) mkdirSync(dir, { recursive: true });
  await page.screenshot({ path, animations: 'disabled', caret: 'hide' });
}

const sheet = (page: Page) => page.getByTestId('settings-sheet');

/** Waits until nothing animates in the document. */
async function rest(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running'),
  );
}

/** Runs a palette command by its title. */
async function palette(page: Page, query: string, option: RegExp | string): Promise<void> {
  // The shortcut listener is the shell's: wait for it after a load.
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('combobox').first();
  await expect(input).toBeVisible();
  await input.fill(query);
  await page.getByRole('option', { name: option }).first().click();
}

async function openSettings(page: Page): Promise<void> {
  await palette(page, 'Settings', /^Settings…/);
  await expect(sheet(page)).toBeVisible();
  await rest(page);
}

test.beforeEach(async ({ page }, info) => {
  if (info.project.name !== TABLET) await page.setViewportSize({ width: 1440, height: 900 });
});

test('a side sheet of 480 px from expanded up, a form sheet on the tablet, glass clean', async ({
  page,
}, info) => {
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openSettings(page);
  const panel = sheet(page);
  await expect(panel).toHaveAttribute('role', 'dialog');
  await expect(panel.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('not laid out');
  if (info.project.name === TABLET) {
    await expect(panel).toHaveAttribute('data-presentation', 'form');
    expect(box.width).toBeLessThanOrEqual(640);
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  } else {
    await expect(panel).toHaveAttribute('data-presentation', 'side');
    expect(Math.round(box.width)).toBe(480);
    expect(Math.round(viewport.width - (box.x + box.width))).toBe(8);
  }
  // The sections of 07 S3 that have settings today, in order.
  const headings = await panel.locator('h3').allTextContents();
  expect(headings).toEqual(['Appearance', 'Language', 'Pen and touch', 'Documents and storage']);
  await expectGlassClean(page, 'the Settings sheet');
  await shot(page, info, 'settings-en');

  await panel.getByRole('button', { name: /About Recto/ }).click();
  await expect(panel.getByTestId('settings-about')).toBeVisible();
  await rest(page);
  await shot(page, info, 'settings-about-en');
  await panel.getByRole('button', { name: 'Back' }).click();
  await expect(panel.getByRole('heading', { name: 'Settings' })).toBeVisible();
  // Focus returns to the row that pushed the page.
  await expect(panel.getByRole('button', { name: /About Recto/ })).toBeFocused();
});

/**
 * The Glass row's control: a segmented control, or the menu it becomes where the row is too
 * narrow for its three segments (09-primitives §6; the tablet's form sheet at 44 px).
 */
const glassRow = (page: Page) => sheet(page).locator('[data-row="glass"]');

async function expectGlass(page: Page, value: 'Clear' | 'Tinted' | 'Solid'): Promise<void> {
  const menu = glassRow(page).getByRole('combobox', { name: 'Glass' });
  if ((await menu.count()) > 0) await expect(menu).toContainText(value);
  else await expect(glassRow(page).getByRole('radio', { name: value })).toBeChecked();
}

async function chooseGlass(page: Page, value: 'Clear' | 'Tinted' | 'Solid'): Promise<void> {
  const menu = glassRow(page).getByRole('combobox', { name: 'Glass' });
  if ((await menu.count()) > 0) {
    await menu.click();
    await page.getByRole('option', { name: value, exact: true }).click();
  } else {
    await glassRow(page).getByRole('radio', { name: value }).click();
  }
}

test('Glass: Clear · Tinted · Solid applies at once, persists, and ⌘K sets it (A-17)', async ({
  page,
}) => {
  await page.goto('./?lang=en');
  await openSettings(page);
  // Nothing picked: the start state (Clear under the test-only render override, X36).
  await expectGlass(page, 'Clear');
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'clear');
  await chooseGlass(page, 'Tinted');
  await expectGlass(page, 'Tinted');
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'tinted');
  // The sheet itself shows the effect: its tint is now at 0.90.
  const tint = await sheet(page).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(tint).toMatch(/, 0\.9\)$/);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'tinted');
  // The same setting from ⌘K.
  await palette(page, 'Glass solid', 'Glass: Solid');
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'solid');
  await openSettings(page);
  await expectGlass(page, 'Solid');
  // Solid: no backdrop filter on the sheet.
  const filter = await sheet(page).evaluate((el) => getComputedStyle(el).backdropFilter || 'none');
  expect(filter).toBe('none');
});

test('search finds each row in English and Turkish, and says when nothing matches', async ({
  page,
}, info) => {
  await page.goto('./?lang=en');
  await openSettings(page);
  const panel = sheet(page);
  const search = panel.getByRole('searchbox', { name: 'Search settings' });
  if (info.project.name === TABLET) {
    // A coarse pointer starts on the first row, Theme (spec D3-7), so no keyboard pops up
    // (07 S3 §6).
    await expect(
      panel
        .locator('[data-row="theme"]')
        .locator('[role="radio"][aria-checked="true"], [role="combobox"]')
        .first(),
    ).toBeFocused();
    await search.click();
  } else {
    // A fine pointer starts in the search field.
    await expect(search).toBeFocused();
  }

  const rows = () => panel.locator('[data-row]');
  const cases: readonly [string, string][] = [
    ['dark mode', 'theme'],
    ['karanlik', 'theme'],
    ['transparency', 'glass'],
    ['saydamlik', 'glass'],
    ['buzlu', 'glass'],
    ['kalem', 'penDrawsInEdit'],
    ['stylus', 'penDrawsInEdit'],
    ['yazar', 'commentName'],
    ['ipucu', 'showTips'],
    ['turkce', 'language'],
    ['saklanan', 'keptDocuments'],
    ['gecmis', 'recents'],
    ['gizlilik', 'privacy'],
  ];
  for (const [query, row] of cases) {
    await search.fill(query);
    await expect(panel.locator(`[data-row="${row}"]`), query).toBeVisible();
  }
  // A row inside About Recto shows under that page's row, which says what it found.
  await search.fill('licence');
  await expect(rows()).toHaveCount(1);
  await expect(panel.locator('[data-row="about"]')).toContainText('Licence');
  await search.fill('qqzz');
  await expect(rows()).toHaveCount(0);
  await expect(panel.getByText('No setting matches “qqzz”')).toBeVisible();
  // Esc clears the field first, then closes the sheet.
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await expect(rows().first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
});

test('Türkçe without a reload, Follow the browser, and the choice survives a reload', async ({
  page,
}, info) => {
  await page.goto('./?lang=en');
  await openSettings(page);
  const language = sheet(page).getByRole('radiogroup', { name: 'Language' });
  await language.getByRole('radio', { name: 'Türkçe' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(sheet(page).getByRole('heading', { name: 'Ayarlar' })).toBeVisible();
  await expect(sheet(page).locator('h3').first()).toHaveText('Görünüş');
  await rest(page);
  await shot(page, info, 'settings-tr');

  // Search in Turkish finds an English keyword too.
  const search = sheet(page).getByRole('searchbox', { name: 'Ayarlarda ara' });
  await search.fill('glass');
  await expect(sheet(page).locator('[data-row="glass"]')).toBeVisible();
  await search.fill('');

  await sheet(page)
    .getByRole('button', { name: /Recto hakkında/ })
    .click();
  await expect(sheet(page).getByTestId('settings-about')).toBeVisible();
  await rest(page);
  await shot(page, info, 'settings-about-tr');
  await sheet(page).getByRole('button', { name: 'Geri' }).click();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await palette(page, 'Ayarlar', /^Ayarlar…/);
  await expect(sheet(page)).toBeVisible();
  const again = sheet(page).getByRole('radiogroup', { name: 'Dil' });
  await again.getByRole('radio', { name: /Tarayıcıya uy/ }).click();
  // The test browser asks for English.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sheet(page).getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(
    sheet(page).getByRole('radiogroup', { name: 'Language' }).getByRole('radio', {
      name: 'Follow the browser (English)',
    }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('About Recto from ⌘K and from the privacy popover; Settings… in the Document menu', async ({
  page,
}, info) => {
  test.skip(info.project.name === TABLET, 'the status bar and Document menu are desktop chrome');
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await palette(page, 'About Recto', /^About Recto/);
  await expect(sheet(page).getByTestId('settings-about')).toBeVisible();
  await expect(sheet(page).getByTestId('about-version')).not.toBeEmpty();
  await expect(sheet(page).getByTestId('about-license')).toHaveText('Apache-2.0');
  await expect(sheet(page).getByRole('link', { name: /Release notes/ })).toHaveAttribute(
    'target',
    '_blank',
  );
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);

  const trigger = page.getByTestId('privacy-indicator');
  await trigger.click();
  await page.getByTestId('privacy-version').click();
  await expect(sheet(page).getByTestId('settings-about')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // The Document menu: Settings… where the Appearance submenu was.
  await openFixtures(page, ['simple-text.pdf']);
  await page.getByTestId('document-menu').click();
  await expect(page.getByRole('menuitem', { name: 'Appearance' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Settings…' }).click();
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press('Escape');

  // Mod+, opens it where the browser leaves the key (Chromium does on every platform here).
  if (info.project.name === 'chromium') {
    await page.locator('body').press('ControlOrMeta+,');
    await expect(sheet(page)).toBeVisible();
  }
});
