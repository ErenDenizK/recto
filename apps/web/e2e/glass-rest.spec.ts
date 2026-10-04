/**
 * Glass at rest in today's main states (docs/specs/redesign.md D0-1 and D0-QA; quality-bar.md
 * Q-1 to Q-5, Q-11): Read, Read with the text selection bar, Edit with the floating bar, an
 * options tier and a tool menu, the Document menu and the page context menu, the command
 * palette, Arrange with its contextual bar, and an annotation's bar and note. In each the walker
 * (e2e/support/glass-walker.ts) finds every backdrop-filter surface and checks one backdrop root,
 * no glass in glass, 32 px at the least, integer positions and no will-change at rest, the
 * coverage rule at the rendered size, and at most four surfaces.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { enterEdit, fixturePath, openFixtures, useFileInputPicker } from './helpers';
import { expectGlassClean } from './support/glass-walker';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
});

const bar = (page: Page): Locator => page.getByRole('toolbar', { name: 'Tools', exact: true });

async function open(page: Page, name: string): Promise<void> {
  await page.goto('./?lang=en');
  await openFixtures(page, [name]);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  // Nothing hovered.
  await page.mouse.move(700, 450);
}

/** The surfaces a state shows, by a part of their class names (CSS-module hashes vary). */
const names = (walk: { surfaces: readonly { name: string; visible: boolean }[] }) =>
  walk.surfaces.filter((s) => s.visible).map((s) => s.name);

test('Read, the selection bar, Edit with an options tier, menus and the palette', async ({
  page,
}) => {
  await open(page, 'simple-text.pdf');
  let walk = await expectGlassClean(page, 'Read');
  expect(names(walk).some((n) => n.includes('toolbar'))).toBe(true);

  // Read: a double-clicked word and its selection bar.
  const rows = page.getByTestId('text-layer').first().locator('span[data-row]');
  const word = await rows.first().boundingBox();
  if (!word) throw new Error('no text');
  await page.mouse.dblclick(word.x + 12, word.y + word.height / 2);
  await expect(page.getByRole('toolbar', { name: 'Selected text' })).toBeVisible();
  walk = await expectGlassClean(page, 'Read, text selection bar');
  expect(walk.visible).toBe(2);
  await page.keyboard.press('Escape');

  await enterEdit(page);
  await expectGlassClean(page, 'Edit');

  // A tool menu on the bar.
  await bar(page).getByRole('button', { name: 'Write', exact: true }).click();
  await bar(page).locator('[aria-haspopup="menu"]').first().click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expectGlassClean(page, 'Edit, a tool menu');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  // An armed tool's options tier (T, the Text box, twice).
  await page.locator('body').press('t');
  await page.locator('body').press('t');
  await expect(page.getByTestId('options-tier')).toBeVisible();
  walk = await expectGlassClean(page, 'Edit, options tier');
  expect(names(walk).some((n) => n.includes('tier'))).toBe(true);
  await page.keyboard.press('Escape');

  // The Document menu.
  await page
    .getByRole('button', { name: /^Document/ })
    .first()
    .click();
  await expect(page.getByRole('menu')).toBeVisible();
  walk = await expectGlassClean(page, 'the Document menu');
  expect(names(walk).some((n) => n.includes('glass-menu'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  // The page context menu.
  const first = await page.locator('[data-page-index="0"]').boundingBox();
  if (!first) throw new Error('page 1 not laid out');
  await page.mouse.click(first.x + 40, first.y + 40, { button: 'right' });
  await expect(page.getByTestId('page-context-menu')).toBeVisible();
  await expectGlassClean(page, 'the page context menu');
  await page.keyboard.press('Escape');

  // The command palette.
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('combobox', { name: 'Search commands' })).toBeVisible();
  await expectGlassClean(page, 'the command palette');
  await page.keyboard.press('Escape');
});

test('Arrange with its contextual bar', async ({ page }) => {
  await open(page, 'simple-text.pdf');
  await page.keyboard.press('3');
  await expect(page.getByTestId('light-table')).toBeVisible();
  await expectGlassClean(page, 'Arrange');
  await page.getByTestId('light-table').getByRole('gridcell').nth(1).click();
  await expect(page.getByTestId('contextual-bar')).toBeVisible();
  await page.mouse.move(700, 880);
  const walk = await expectGlassClean(page, 'Arrange, a page selected');
  expect(names(walk).some((n) => n.includes('contextBar'))).toBe(true);
});

test('an annotation’s bar and a note', async ({ page }) => {
  await open(page, 'annotations.pdf');
  await enterEdit(page);
  await page
    .locator('[data-annotation-layer="0"] [data-annotation-kind]')
    .first()
    .click({ force: true });
  await expect(page.getByTestId('annotation-bar')).toBeVisible();
  await expectGlassClean(page, 'Edit, an annotation selected');
  const note = page.locator('[data-annotation-kind="text"]').first();
  await note.dblclick({ force: true });
  await expect(page.locator('[class*="notePopup"]')).toBeVisible();
  await expectGlassClean(page, 'Edit, a note open');
});

/**
 * The compact edition (ADR-0033 §2.3), forced with `?edition=compact` at phone size: the reader
 * with its top bar and capsule, the ⋯ menu, the Pages sheet and a note. (The `phone` projects
 * run only compact.spec.ts; the walker reads styles and needs no touch.)
 */
test.describe('the compact edition', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function openCompact(page: Page, name: string): Promise<void> {
    await page.goto('./?lang=en&edition=compact');
    await expect(page.getByTestId('compact-library')).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
    await (await chooser).setFiles(fixturePath(name));
    await expect(page.locator('[data-page-index="0"] canvas')).toHaveAttribute(
      'data-state',
      'rendered',
    );
  }

  test('the reader, the ⋯ menu and the Pages sheet', async ({ page }) => {
    await openCompact(page, 'outline-named-dests.pdf');
    let walk = await expectGlassClean(page, 'compact reader');
    expect(names(walk).some((n) => n.includes('topBar'))).toBe(true);
    expect(names(walk).some((n) => n.includes('capsule'))).toBe(true);

    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByTestId('compact-menu')).toBeVisible();
    walk = await expectGlassClean(page, 'compact ⋯ menu');
    expect(walk.visible).toBe(3);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('compact-menu')).toHaveCount(0);

    await page.getByTestId('compact-capsule').getByRole('button', { name: 'Pages' }).click();
    await expect(page.getByTestId('compact-pages-sheet')).toBeVisible();
    await expectGlassClean(page, 'compact Pages sheet');
  });

  test('a note', async ({ page }) => {
    await openCompact(page, 'annotations.pdf');
    await page.getByTestId('compact-page-number').click();
    const input = page.getByRole('textbox', { name: 'Page number or label' });
    await input.fill('2');
    await input.press('Enter');
    await page.getByRole('button', { name: /^Show note/ }).click();
    await expect(page.getByTestId('note-popover')).toBeVisible();
    await expectGlassClean(page, 'compact note');
  });
});
