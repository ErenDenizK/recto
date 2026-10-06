/**
 * Glass at rest in today's main states (docs/specs/redesign.md D0-1 and D0-QA; quality-bar.md
 * Q-1 to Q-5, Q-8, Q-11): Home, Read, Read with the text selection bar, Edit with the floating bar, an
 * options tier and a tool menu, the title menu, the page pill's menu and the page context menu, the command
 * palette, Arrange with its contextual bar, and an annotation's bar and note. In each the walker
 * (e2e/support/glass-walker.ts) finds every backdrop-filter surface and checks one backdrop root,
 * no glass in glass, 32 px at the least, integer positions and no will-change at rest, the
 * coverage rule at the rendered size, at most four surfaces (six while a sheet comes in), and
 * the text on glass at 11 px or more, in the scale's three weights, under no scale at rest.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  enterEdit,
  fixturePath,
  openFixtures,
  useFileInputPicker,
  openSaveCopyFromMenu,
} from './helpers';
import { expectGlassClean, walkGlass } from './support/glass-walker';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
});

const bar = (page: Page): Locator => page.getByRole('toolbar', { name: 'Markup', exact: true });

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

test('Home: the budget and the text on its glass', async ({ page }) => {
  await page.goto('./?lang=en');
  await expect(page.getByRole('button', { name: /^Open files/ }).first()).toBeVisible();
  await page.mouse.move(700, 450);
  const walk = await expectGlassClean(page, 'Home');
  // Q-11: within the four of a resting screen.
  expect(walk.visible).toBeLessThanOrEqual(4);
});

test('Read, the selection bar, Edit with an options tier, menus and the palette', async ({
  page,
}) => {
  await open(page, 'simple-text.pdf');
  let walk = await expectGlassClean(page, 'Read');
  // The capsule is the dock's glass (spec X1, D2-2).
  expect(names(walk).some((n) => n.includes('capsule'))).toBe(true);
  // Q-8 read the bar's labels (so a clean walk means the text was looked at).
  expect(walk.texts).toBeGreaterThan(0);
  expect(walk.visible).toBeLessThanOrEqual(4);

  // Read: a double-clicked word and its selection bar.
  const rows = page.getByTestId('text-layer').first().locator('span[data-row]');
  const word = await rows.first().boundingBox();
  if (!word) throw new Error('no text');
  await page.mouse.dblclick(word.x + 12, word.y + word.height / 2);
  await expect(page.getByRole('toolbar', { name: 'Selected text' })).toBeVisible();
  walk = await expectGlassClean(page, 'Read, text selection bar');
  // The top strip (docked M3, ADR-0024 §2.8), the dock, the selection bar and the page pill
  // (01-frame F11): the four of a resting screen.
  expect(walk.visible).toBe(4);
  await page.keyboard.press('Escape');

  await enterEdit(page);
  await expectGlassClean(page, 'Edit');

  // A tool menu on the palette (Shapes ▾, its second press).
  await bar(page)
    .getByRole('button', { name: /^Shapes/ })
    .click();
  await bar(page)
    .getByRole('button', { name: /^Shapes/ })
    .click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expectGlassClean(page, 'Edit, a tool menu');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  // An armed tool's ink strip (T, the Text box): a second row inside the palette's own glass,
  // never glass of its own (quality-bar Q-4).
  await page.locator('body').press('t');
  await expect(page.getByTestId('ink-strip')).toBeVisible();
  walk = await expectGlassClean(page, 'Markup, ink strip');
  // (The top strip, a `header`, is docked glass of its own: not the ink strip.)
  expect(names(walk).some((n) => !n.startsWith('header') && n.includes('strip'))).toBe(false);
  await page.keyboard.press('Escape');

  // The title menu (01-frame F5) takes the M4 solid twin: it opens over the sidebar's dark edge
  // and the page at once, where blurred glass showed a seam (Q-1, Q-3).
  await page.getByTestId('document-menu').click();
  const titleMenu = page.getByTestId('title-menu');
  await expect(titleMenu).toBeVisible();
  expect(
    await titleMenu.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.getPropertyValue('backdrop-filter') || 'none';
    }),
  ).toBe('none');
  await expectGlassClean(page, 'the title menu');
  await page.keyboard.press('Escape');
  await expect(titleMenu).toHaveCount(0);

  // The tab menu (right-click on the active tab): a glass menu.
  await page.getByTestId('document-menu').click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  walk = await expectGlassClean(page, 'the Document menu');
  // What the menu looked like to the walk, should it not count it (seen on WebKit in CI).
  const look = await page
    .getByRole('menu')
    .evaluate((el) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const backdrop =
        style.getPropertyValue('backdrop-filter') ||
        style.getPropertyValue('-webkit-backdrop-filter');
      const data = el.getAttributeNames().filter((n) => n.startsWith('data-'));
      const seen = el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      return `opacity ${style.opacity}, backdrop ${backdrop}, box ${box.x},${box.y} ${box.width}×${box.height}, ${data.join(' ')}, visible ${seen}`;
    })
    .catch(() => 'gone');
  expect(
    names(walk).some((n) => n.includes('mat-menu')),
    `the Document menu among the visible glass (${names(walk).join(', ')}); the menu: ${look}`,
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  // The page context menu.
  const first = await page.locator('[data-page-index="0"]').boundingBox();
  if (!first) throw new Error('page 1 not laid out');
  await page.mouse.click(first.x + 40, first.y + 40, { button: 'right' });
  await expect(page.getByTestId('page-context-menu')).toBeVisible();
  await expectGlassClean(page, 'the page context menu');
  await page.keyboard.press('Escape');

  // The page pill's menu (01-frame F11).
  await page.getByTestId('page-pill').click();
  await expect(page.getByTestId('page-pill-menu')).toBeVisible();
  await expectGlassClean(page, 'the page pill menu');
  await page.keyboard.press('Escape');

  // The command palette.
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('combobox', { name: 'Search commands' })).toBeVisible();
  await expectGlassClean(page, 'the command palette');
  await page.keyboard.press('Escape');
});

test('a sheet over a document and a toast: six at most while it comes in, four at rest', async ({
  page,
}) => {
  await open(page, 'simple-text.pdf');
  // A toast: "Deleted page 2 · Undo".
  await page.keyboard.press('3');
  await page.getByTestId('light-table').getByRole('gridcell').nth(1).click();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('group', { name: 'Deleted page 2' })).toBeVisible();
  await page.keyboard.press('2');
  await page.mouse.move(700, 450);
  await expectGlassClean(page, 'Edit with a toast');
  // Save a copy comes in over it: the transition budget, read mid-entrance (Q-11).
  await openSaveCopyFromMenu(page);
  await expect(page.getByTestId('save-copy-sheet')).toBeAttached();
  const mid = await walkGlass(page, { atRest: false });
  expect(
    mid.violations.filter((v) => ['Q-3', 'Q-4', 'Q-8', 'Q-11'].includes(v.rule)),
    'glass while Save a copy comes in',
  ).toEqual([]);
  const walk = await expectGlassClean(page, 'Save a copy over a toast');
  expect(names(walk).some((n) => n.includes('panel'))).toBe(true);
  await page.keyboard.press('Escape');
});

test('the Pages grid with its Pages bar', async ({ page }) => {
  await open(page, 'simple-text.pdf');
  await page.keyboard.press('3');
  await expect(page.getByTestId('light-table')).toBeVisible();
  await expectGlassClean(page, 'Pages grid');
  await page.getByTestId('light-table').getByRole('gridcell').nth(1).click();
  await expect(page.getByTestId('pages-bar')).toContainText('1 selected');
  await page.mouse.move(700, 200);
  const walk = await expectGlassClean(page, 'Pages grid, a page selected');
  expect(names(walk).some((n) => n.includes('capsule'))).toBe(true);
});

test('the pen editor and its colour views, pushed in place', async ({ page }) => {
  await open(page, 'simple-text.pdf');
  await enterEdit(page);
  await page.locator('body').press('p');
  await page.getByRole('button', { name: 'Black pen, 1.5 pt', exact: true }).click();
  const editor = page.getByTestId('pen-preset-editor');
  await expect(editor).toBeVisible();
  await page.mouse.move(700, 200);
  await expectGlassClean(page, 'Edit, the pen editor');
  // The well pushes the colour views inside the editor: its own height springs (Q-6's rule),
  // so mid-resize it is still one glass element with one backdrop root and nothing nested.
  await editor.getByRole('button', { name: 'More colours' }).click();
  const mid = await walkGlass(page, { atRest: false });
  expect(
    mid.violations.filter((v) => ['Q-3', 'Q-4', 'Q-5', 'Q-11'].includes(v.rule)),
    'glass while the colour views come in',
  ).toEqual([]);
  await expect(editor.getByRole('group', { name: 'Colour' })).toBeVisible();
  await page.mouse.move(700, 200);
  const walk = await expectGlassClean(page, 'Edit, the pen editor on its colour views');
  // One popover: the colour views are not a second glass surface over the editor.
  expect(names(walk).filter((n) => n.includes('popup'))).toHaveLength(1);
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
  // The note is on page 2: with the sidebar closed by default (06-navigation N1) the page fits
  // a wider column, so go there first.
  await page.getByTestId('page-pill').click();
  await page.getByRole('textbox', { name: 'Go to page' }).fill('2');
  await page.keyboard.press('Enter');
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
