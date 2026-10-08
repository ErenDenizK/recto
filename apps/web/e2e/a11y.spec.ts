/**
 * Accessibility end to end (experience-redesign spec §10, WP A11; DESIGN.md §5), in Chromium:
 *
 * - the keyboard paths: F6 regions, Home's grid, the navigator's tablist and radio chips,
 *   the tool bar's groups and options tier, the pen presets and their editor, the
 *   contextual bar reached from a Review row, the lasso bar, the Document info sheet;
 * - announcements reach the live region, once and politely;
 * - axe-core on the main states of the new surfaces: no serious or critical violation;
 * - reduced motion turns the morph, the rise-in and every transition off;
 * - the focus ring tokens on the new controls;
 * - craft spec §9 (M8): Read with the lock, Edit with each of the five groups, the Edit text
 *   layer's paragraph targets (Tab between paragraphs, Enter opens) and the paragraph editor,
 *   the page context menu, the text selection bar in Read and Edit, a lasso selection with
 *   its handles and keyboard box, the Highlighter's announcement, Recents on Home, Glass Clear
 *   and Solid (spec D3-3), one state in Turkish; no Tab stop is ever hidden; the new surfaces
 *   neither move nor rise under reduced motion and turn solid under Glass Solid;
 * - D0's sheets and toasts (spec redesign §8, blocking from D0): F6 reaches the toast region and
 *   a modal sheet holds focus and gives it back, with no focus ever on an invisible element
 *   (A-13); one announcer, the toast region and the sheets silent, a toast said once (A-14);
 *   targets of 24 px or spaced on a fine pointer and 44 px on a coarse one, never overlapping,
 *   in every D0 floating surface (A-15). A-24's hold on hover is in toasts.spec.ts, its hold on
 *   focus and the 10 s floor in the toast region's and store's unit suites.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { devices, expect, type Locator, type Page, test } from '@playwright/test';

import {
  enterEdit,
  fixturePath,
  openFixtures,
  useFileInputPicker,
  openSaveCopyFromMenu,
  showSidebar,
} from './helpers';
import { settleAnimations } from './support/glass-walker';
import { auditTargets } from './support/targets';

test.skip(({ browserName }) => browserName !== 'chromium', 'One engine for axe and the keys');
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openSimple(page: Page): Promise<void> {
  await page.goto('./?lang=en');
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
}

const bar = (page: Page): Locator => page.getByRole('toolbar', { name: 'Markup', exact: true });
/** The dock in viewing (01-frame F10; spec X1, D2-2). */
const dock = (page: Page): Locator =>
  page.getByRole('toolbar', { name: 'Document tools', exact: true });
const layer = (page: Page): Locator => page.locator('[data-annotation-layer="0"]');
const viewport = (page: Page): Locator => page.locator('[data-read-viewport]');
/** The polite live region (shell/LiveRegion.tsx). */
const status = (page: Page): Locator =>
  page.locator('div[role="status"][aria-live="polite"].visually-hidden');
const holdsFocus = (locator: Locator): Promise<boolean> =>
  locator.evaluate((el) => el.contains(document.activeElement));
const focusedName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';
    return el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? el.tagName;
  });

/** A short stroke across the first page, by mouse, between fractions of the layer's box. */
async function stroke(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const box = await layer(page).boundingBox();
  if (!box) throw new Error('page not rendered');
  const h = Math.min(box.height, 800);
  await page.mouse.move(box.x + box.width * from[0], box.y + h * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + h * to[1], { steps: 12 });
  await page.mouse.up();
}

/** A closed lasso loop around the area between two fractions of the first page. */
async function lasso(
  page: Page,
  from: [number, number],
  to: [number, number],
  margin = 30,
): Promise<void> {
  const box = await layer(page).boundingBox();
  if (!box) throw new Error('page not rendered');
  const h = Math.min(box.height, 800);
  const x0 = box.x + box.width * from[0] - margin;
  const x1 = box.x + box.width * to[0] + margin;
  const y0 = box.y + h * from[1] - margin;
  const y1 = box.y + h * to[1] + margin;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (const [x, y] of [
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0 + 5],
  ] as const) {
    await page.mouse.move(x, y, { steps: 8 });
  }
  await page.mouse.up();
}

// ---------------------------------------------------------------------------
// Keyboard paths
// ---------------------------------------------------------------------------

test.describe('keyboard', () => {
  test('F6 and Shift+F6 cycle strip, sidebar, page, tool bar and page pill (X9)', async ({
    page,
  }) => {
    await openSimple(page);
    await enterEdit(page);
    // An armed tool with options: its ink strip sits in the palette, but F6 lands on the
    // palette's tools, on the armed tool (T, the Text box).
    await page.locator('body').press('t');
    await expect(page.getByTestId('ink-strip')).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    // The sidebar is closed by default (06-navigation N1): ▤ shows it, focus back on the body.
    await showSidebar(page, 'Pages', 'Thumbnails');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const title = page.getByRole('tablist', { name: 'Open documents' });
    // F6 stop 2 lands on the sidebar's current item (06 N1 §6): the current page's thumbnail.
    const navigator = page.getByRole('listbox', { name: /^Pages of/ });
    const highlight = bar(page).getByRole('button', { name: 'Text box', exact: true });
    const pill = page.getByTestId('page-pill');

    await page.keyboard.press('F6');
    await expect(title.getByRole('tab', { selected: true })).toBeFocused();
    await page.keyboard.press('F6');
    await expect(navigator.locator('[aria-current="page"]')).toBeFocused();
    await page.keyboard.press('F6');
    await expect(viewport(page)).toBeFocused();
    await page.keyboard.press('F6');
    await expect(highlight).toBeFocused();
    await page.keyboard.press('F6');
    await expect(pill).toBeFocused();
    // No inspector after the pill since D2-9: the cycle wraps to the strip.
    await page.keyboard.press('F6');
    await expect(title.getByRole('tab', { selected: true })).toBeFocused();

    // And back.
    await page.keyboard.press('Shift+F6');
    await expect(pill).toBeFocused();
    await page.keyboard.press('Shift+F6');
    await expect(highlight).toBeFocused();
    await page.keyboard.press('Shift+F6');
    await expect(viewport(page)).toBeFocused();
    await page.keyboard.press('Shift+F6');
    await expect(navigator.locator('[aria-current="page"]')).toBeFocused();
  });

  test('Library: the launcher, Select, then the cards; arrows, Space, the Esc ladder, Enter; F6 lands on a card', async ({
    page,
  }) => {
    await page.goto('./?lang=en');
    await openFixtures(page, ['simple-text.pdf', 'rotated-pages.pdf', 'mixed-sizes.pdf']);
    await page.keyboard.press('0');
    const home = page.getByTestId('home');
    await expect(home).toBeVisible();
    const grid = page.getByRole('listbox', { name: 'Files' });
    const card = (title: string) => grid.getByRole('option', { name: new RegExp(`^${title},`) });
    const stops = grid.locator('[role="option"][tabindex="0"]');

    // Opened together, they arrive checked: Esc clears the checks, the second Esc leaves Select.
    await card('simple-text').focus();
    await page.keyboard.press('Escape');
    await expect(grid.getByRole('option', { selected: true })).toHaveCount(0);
    await expect(page.getByTestId('library-select')).toHaveText('Done');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('library-select')).toHaveText('Select');

    // The launcher's actions first, then Select, then one Tab stop in the grid (L1 §6).
    const launcher = page.getByTestId('library-launcher').getByRole('button');
    const actions = await launcher.count();
    // Open PDFs…, Try the sample, Combine files…, Batch…; Library ⋯ is in the top strip (L12).
    expect(actions).toBe(4);
    await launcher.first().focus();
    await expect(launcher.first()).toHaveAccessibleName('Open PDFs…');
    for (let i = 1; i < actions; i++) {
      await page.keyboard.press('Tab');
      await expect(launcher.nth(i)).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('library-select')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(card('simple-text')).toBeFocused();
    await expect(stops).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    await expect(card('rotated-pages')).toBeFocused();
    await expect(stops).toHaveCount(1);
    await page.keyboard.press('Space');
    await expect(card('rotated-pages')).toHaveAttribute('aria-selected', 'true');
    await expect(status(page)).toHaveText('1 file selected');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(status(page)).toHaveText('2 files selected');
    // The bar's controls are reachable by Tab, the dimmed ones too (RA-21).
    const bar = page.getByRole('toolbar', { name: 'Selected documents' });
    await expect(bar.getByRole('button', { name: 'Combine 2 files' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(status(page)).toHaveText('0 files selected');
    await expect(bar).toHaveCount(0);
    await page.keyboard.press('Escape');

    // F6 from the strip: the Library has no sidebar, so the stage, which lands on the grid's stop.
    await page.getByTestId('home-button').focus();
    await page.keyboard.press('F6');
    await expect(card('mixed-sizes')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(home).toHaveCount(0);
    await expect(
      page.getByRole('tablist', { name: 'Open documents' }).getByRole('tab', { selected: true }),
    ).toHaveAccessibleName(/mixed-sizes/);
  });

  test('the sidebar: the section tabs, the Pages views and the Review filters', async ({
    page,
  }) => {
    await page.goto('./?lang=en');
    await openFixtures(page, ['annotations.pdf']);
    await showSidebar(page, 'Pages');
    const tabs = page.getByRole('tablist', { name: 'Sidebar sections' });
    const tab = (name: RegExp) => tabs.getByRole('tab', { name });
    await tab(/^Pages/).focus();

    // APG tabs drawn as the segmented control (06 N1 §6): Left and Right move and show
    // (automatic activation), Home and End; one Tab stop.
    await page.keyboard.press('ArrowRight');
    await expect(tab(/^Find/)).toBeFocused();
    await expect(tab(/^Find/)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tab(/^Review/)).toBeFocused();
    await expect(tab(/^Review/)).toHaveAccessibleName(/^Review, \d+ items?$/);
    await page.keyboard.press('Home');
    await expect(tab(/^Pages/)).toBeFocused();
    await expect(tabs.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press('End');
    await expect(tab(/^Review/)).toHaveAttribute('aria-selected', 'true');

    // Tab moves into the section: the filters, a radio group (arrows choose, and say so); the
    // four chips are static (06.13).
    const filters = page.getByRole('radiogroup', { name: 'Show' });
    await page.keyboard.press('Tab');
    await expect(filters.getByRole('radio', { name: /^All/ })).toBeFocused();
    await expect(filters.getByRole('radio')).toHaveCount(4);
    await page.keyboard.press('ArrowRight');
    const comments = filters.getByRole('radio', { name: /^Comments/ });
    await expect(comments).toBeFocused();
    await expect(comments).toHaveAttribute('aria-checked', 'true');
    await expect(status(page)).toHaveText(/^Comments: \d+ items?$/);
    await page.keyboard.press('End');
    await expect(filters.getByRole('radio').last()).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Home');
    await expect(filters.getByRole('radio', { name: /^All/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Pages: Thumbnails · Contents is a radio group too (no second "Pages").
    await tab(/^Review/).focus();
    await page.keyboard.press('Home');
    await expect(tab(/^Pages/)).toHaveAttribute('aria-selected', 'true');
    const view = page.getByRole('radiogroup', { name: 'Pages view' });
    await page.keyboard.press('Tab');
    await expect(view.getByRole('radio', { name: 'Thumbnails' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(view.getByRole('radio', { name: 'Contents' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('[data-pages-view="bookmarks"]')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(view.getByRole('radio', { name: 'Thumbnails' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await axe(page, 'Sidebar, thumbnails');
  });

  test('the palette: one Tab stop, arrows, a tool, its ink strip by Tab, Esc', async ({ page }) => {
    await openSimple(page);
    await enterEdit(page);
    await expect(bar(page).locator('button[tabindex="0"]')).toHaveCount(1);
    await bar(page).locator('button[tabindex="0"]').focus();
    await page.keyboard.press('Home');
    // Done leads the palette; Select, armed on opening, follows (03-markup MK-2, MK-3).
    await expect(bar(page).getByRole('button', { name: 'Done', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const select = bar(page).getByRole('button', { name: 'Select', exact: true });
    await expect(select).toBeFocused();
    await expect(select).toHaveAttribute('aria-pressed', 'true');

    // Arrows reach Note; Enter arms it (aria-pressed), its ink strip follows arming.
    const note = bar(page).getByRole('button', { name: 'Note', exact: true });
    for (let i = 0; i < 12; i++) {
      if (await note.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('ArrowRight');
    }
    await expect(note).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(note).toHaveAttribute('aria-pressed', 'true');
    await expect(status(page)).toHaveText('Note tool');
    const strip = page.getByRole('toolbar', { name: 'Note options' });
    await expect(strip).toBeVisible();

    // Tab goes from the tools to the strip: one Tab stop, arrows, and keys that work.
    await page.keyboard.press('Tab');
    expect(await holdsFocus(strip)).toBe(true);
    await expect(strip.locator('[tabindex="0"]')).toHaveCount(1);
    const before = await focusedName(page);
    await page.keyboard.press('ArrowRight');
    expect(await focusedName(page)).not.toBe(before);
    const swatch = strip.getByRole('radio').first();
    await swatch.focus();
    await page.keyboard.press('Space');
    await expect(swatch).toHaveAttribute('aria-checked', 'true');
    // Esc from the strip disarms; the strip goes.
    await page.keyboard.press('Escape');
    await expect(strip).toHaveCount(0);
    await expect(note).toHaveAttribute('aria-pressed', 'false');
    // With nothing armed, Esc in the palette closes Markup; focus goes to the dock's door.
    await note.focus();
    await page.keyboard.press('Escape');
    await expect(bar(page)).toHaveCount(0);
    await expect(page.locator('[data-dock-item="markup"]')).toBeFocused();
  });

  test('the pen well: arrows, Enter arms, Enter again opens the editor, Esc closes it only', async ({
    page,
  }) => {
    await openSimple(page);
    await enterEdit(page);
    await bar(page).locator('button[tabindex="0"]').focus();
    const blue = bar(page).getByRole('button', { name: 'Blue pen, 1.5 pt' });
    for (let i = 0; i < 6; i++) {
      if (await blue.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('ArrowRight');
    }
    await expect(blue).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(blue).toHaveAttribute('aria-pressed', 'true');
    await expect(layer(page)).toHaveAttribute('data-tool', 'ink');
    // The preset, said once, in place of "Pen tool".
    await expect(status(page)).toHaveText('Blue pen, 1.5 pt');
    await expect(page.getByTestId('pen-preset-editor')).toHaveCount(0);

    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Edit blue pen' })).toBeVisible();
    // By test id from here: a colour change renames the preset (and the dialog).
    const editor = page.getByTestId('pen-preset-editor');
    await expect.poll(() => holdsFocus(editor)).toBe(true);
    // The colours are a radio group: one Tab stop, the arrows choose.
    const colours = editor.getByRole('radiogroup', { name: 'Colour' });
    const stop = colours.locator('[role="radio"][tabindex="0"]');
    await expect(stop).toHaveCount(1);
    await stop.focus();
    await page.keyboard.press('ArrowRight');
    await expect(colours.locator('[role="radio"][aria-checked="true"]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(colours.getByRole('radio', { name: 'Blue' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Esc closes the editor only: the pen stays armed, focus back on its cell.
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(layer(page)).toHaveAttribute('data-tool', 'ink');
    await expect(blue).toBeFocused();
  });

  test('a Review row selects an ink; the contextual bar by keyboard; Delete', async ({ page }) => {
    await openSimple(page);
    await page.locator('body').press('p');
    await stroke(page, [0.3, 0.45], [0.5, 0.46]);
    const ink = layer(page).locator('[data-annotation-kind="ink"]');
    await expect(ink).toHaveCount(1, { timeout: 10_000 });
    await page.locator('body').press('Escape');

    await showSidebar(page, 'Review');
    const row = page.locator('[data-review-panel] [data-annotation-row]').first();
    await row.focus();
    await page.keyboard.press('Enter');
    const contextual = page.getByTestId('annotation-bar');
    await expect(contextual).toBeVisible();
    // F6 to the stage (the pages), then Tab into the bar: one Tab stop, arrows inside.
    await page.keyboard.press('F6');
    await expect(viewport(page)).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await holdsFocus(contextual)).toBe(true);
    await expect(contextual.locator('[tabindex="0"]')).toHaveCount(1);
    // End reaches ⋯ (the properties, D2-9); Delete sits just before it.
    await page.keyboard.press('End');
    await expect(contextual.getByRole('button', { name: 'More properties' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(contextual.getByRole('button', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(ink).toHaveCount(0, { timeout: 10_000 });
    await expect(contextual).toHaveCount(0);
    // Focus stays on the pages, not on <body>.
    await expect(viewport(page)).toBeFocused();
  });

  test('the lasso bar: said once, Tab into it, the grip nudges, Esc keeps the Lasso', async ({
    page,
  }) => {
    await openSimple(page);
    await page.locator('body').press('p');
    // Two strokes of one burst: one word, the second just right of the first on its line.
    await stroke(page, [0.3, 0.45], [0.36, 0.45]);
    await stroke(page, [0.39, 0.45], [0.45, 0.45]);
    // At once (within the burst's pause): the tool change closes the burst, and both are
    // said, once each.
    await page.locator('body').press('q');
    await expect(status(page)).toHaveText('Pen: 2 strokes on page 1. Lasso tool');
    const ink = layer(page).locator('[data-annotation-kind="ink"]');
    await expect(ink.locator('polyline')).toHaveCount(2, { timeout: 10_000 });
    await lasso(page, [0.3, 0.45], [0.36, 0.45], 10);
    const lassoBar = page.locator('[data-lasso-bar]');
    await expect(lassoBar).toBeVisible();
    await expect(status(page)).toHaveText('1 stroke selected');

    await viewport(page).focus();
    await page.keyboard.press('Tab');
    expect(await holdsFocus(lassoBar)).toBe(true);
    const grip = lassoBar.getByRole('button', { name: 'Move strokes' });
    await grip.focus();
    const path = layer(page).locator('[data-lasso-path]');
    const x = async () => (await path.boundingBox())?.x ?? 0;
    const from = await x();
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(x, { timeout: 10_000 }).toBeGreaterThan(from + 5);
    await expect(grip).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(lassoBar).toHaveCount(0);
    await expect(layer(page)).toHaveAttribute('data-tool', 'lasso');
    await expect(viewport(page)).toBeFocused();
  });

  test('the Document info sheet: focus trap, Esc, focus back on the opener', async ({ page }) => {
    await openSimple(page);
    const opener = page.getByTestId('document-menu');
    await opener.focus();
    await page.keyboard.press('Enter');
    const item = page.getByRole('menuitem', { name: 'Document info…' });
    await item.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByTestId('document-info');
    await expect(sheet).toBeVisible();
    // Trapped: in the sheet once focus has settled. A Tab off the last control lands on one of
    // the trap's own focus guards (Base UI's invisible edges), which hands focus back to the
    // sheet on the next animation frame (FloatingFocusManager's `enqueueFocus`); a Tab pressed
    // before that frame would leave from the guard, faster than any key repeat, so each read
    // waits for focus to leave a guard first. A focus that escaped the sheet still fails.
    const trapped = async () => {
      await page.waitForFunction(
        () => document.activeElement?.hasAttribute('data-base-ui-focus-guard') !== true,
        undefined,
        { timeout: 2_000 },
      );
      return page.evaluate(
        () => document.activeElement?.closest('[data-testid="document-info"]') != null,
      );
    };
    await expect.poll(() => holdsFocus(sheet)).toBe(true);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await trapped()).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await trapped()).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// axe
// ---------------------------------------------------------------------------

const AXE_SOURCE = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

interface AxeViolation {
  readonly id: string;
  readonly impact: string | null;
  readonly nodes: readonly { readonly target: readonly string[] }[];
}

/**
 * Accepted exceptions, by rule id, with the reason. Moderate and minor findings are
 * attached to the test's report and do not fail it; serious and critical ones fail it.
 */
const ACCEPTED: Readonly<Record<string, string>> = {};

async function axe(page: Page, name: string): Promise<void> {
  // Settled first: a dialog fading in would be measured at part opacity (color-contrast), and
  // so would the tool bar, faded while a stroke is in progress and a second after.
  await expect(page.locator('[data-stroking]')).toHaveCount(0, { timeout: 3000 });
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  );
  // Through the devtools protocol: the app's CSP refuses inline scripts.
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(AXE_SOURCE);
  const violations: AxeViolation[] = await page.evaluate(async () => {
    interface Result {
      id: string;
      impact: string | null;
      nodes: { target: string[] }[];
    }
    const { axe: runner } = window as unknown as {
      axe: { run: (context: Document, options: object) => Promise<{ violations: Result[] }> };
    };
    const result = await runner.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
      resultTypes: ['violations'],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target })),
    }));
  });
  const found = violations.filter((v) => !(v.id in ACCEPTED));
  const describe = (v: AxeViolation) =>
    `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`;
  const serious = (v: AxeViolation) => v.impact === 'serious' || v.impact === 'critical';
  const lesser = found.filter((v) => !serious(v));
  if (lesser.length > 0) {
    test
      .info()
      .annotations.push({ type: `axe: ${name}`, description: lesser.map(describe).join('; ') });
  }
  expect.soft(found.filter(serious).map(describe), name).toEqual([]);
}

test.describe('axe', () => {
  test('Home, empty and with files', async ({ page }) => {
    await page.goto('./?lang=en');
    await expect(
      page.getByRole('heading', { name: 'Read, mark up, sign and arrange PDFs.' }),
    ).toBeVisible();
    await axe(page, 'empty Home');
    await openFixtures(page, ['simple-text.pdf', 'rotated-pages.pdf']);
    await page.keyboard.press('0');
    await expect(page.getByTestId('home')).toBeVisible();
    await axe(page, 'Home with files');
  });

  test('Read and Edit with the bar open on each group, the page menu and an options tier', async ({
    page,
  }) => {
    await openSimple(page);
    await expect(dock(page).getByRole('button', { name: 'Markup', exact: true })).toHaveAttribute(
      'aria-keyshortcuts',
      'M 2',
    );
    await axe(page, 'Read, the lock and the dock');
    await enterEdit(page);
    await axe(page, 'Markup, Select');
    // Each ink strip, and + with its menu.
    for (const key of ['p', 'h', 'Shift+E', 't', 'r']) {
      await page.locator('body').press(key);
      await expect(page.getByTestId('ink-strip')).toBeVisible();
      await axe(page, `Markup, the strip after ${key}`);
    }
    await page.keyboard.press('Escape');
    await bar(page)
      .getByRole('button', { name: /^More tools/ })
      .click();
    await expect(page.getByRole('menu')).toBeVisible();
    await axe(page, 'Markup, More tools');
    await page.keyboard.press('Escape');
    // The page context menu (right-click on a page).
    const first = await page.locator('[data-page-index="0"]').boundingBox();
    if (!first) throw new Error('page 1 not laid out');
    await page.mouse.click(first.x + 40, first.y + 40, { button: 'right' });
    await expect(page.getByTestId('page-context-menu')).toBeVisible();
    await axe(page, 'Edit, the page context menu');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('page-context-menu')).toHaveCount(0);
    await page.locator('body').press('n');
    await expect(page.getByTestId('ink-strip')).toBeVisible();
    await axe(page, 'Markup, Note options');
  });

  test('the Review tab, the Document info sheet and the export dialog', async ({ page }) => {
    await page.goto('./?lang=en');
    await openFixtures(page, ['annotations.pdf']);
    await showSidebar(page, 'Review');
    await expect(page.locator('[data-review-panel] [data-annotation-row]').first()).toBeVisible();
    await axe(page, 'Review tab');

    await page.getByTestId('document-menu').click();
    await page.getByRole('menuitem', { name: 'Document info…' }).click();
    await expect(page.getByTestId('document-info')).toBeVisible();
    await axe(page, 'Document info sheet');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('document-info')).toHaveCount(0);

    // Save a copy (S2), each format and an open disclosure.
    await openSaveCopyFromMenu(page);
    const sheet = page.getByTestId('save-copy-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: /^Security, / }).click();
    await axe(page, 'Save a copy, PDF');
    await sheet.getByRole('radio', { name: 'Images' }).click();
    await axe(page, 'Save a copy, Images');
    await sheet.getByRole('radio', { name: 'Text', exact: true }).click();
    await expect(sheet.getByTestId('convert-preview')).toHaveAttribute('data-state', 'ready', {
      timeout: 30_000,
    });
    await axe(page, 'Save a copy, Text');
  });

  test('the pen editor and the lasso bar', async ({ page }) => {
    await openSimple(page);
    await page.locator('body').press('p');
    await page
      .getByRole('toolbar', { name: 'Markup', exact: true })
      .getByRole('button', { name: 'Black pen, 1.5 pt' })
      .click();
    await expect(page.getByTestId('pen-preset-editor')).toBeVisible();
    await axe(page, 'pen editor');
    // The colour views, pushed in place inside the editor (10-ink §6).
    const editor = page.getByTestId('pen-preset-editor');
    await editor.getByRole('button', { name: 'More colours' }).click();
    await expect(editor.getByRole('group', { name: 'Colour' })).toBeVisible();
    await axe(page, 'pen editor, colour views');
    await page.keyboard.press('Escape');
    await expect(editor.getByRole('group', { name: 'Colour' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pen-preset-editor')).toHaveCount(0);

    await stroke(page, [0.3, 0.45], [0.5, 0.46]);
    await expect(layer(page).locator('[data-annotation-kind="ink"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await page.locator('body').press('q');
    await lasso(page, [0.3, 0.45], [0.5, 0.46]);
    await expect(page.locator('[data-lasso-bar]')).toBeVisible();
    await axe(page, 'lasso bar');
  });
});

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------

/** Longest current animation (Web Animations, CSS animations and transitions), ms. */
const longestAnimation = (page: Page): Promise<number> =>
  page.evaluate(() =>
    Math.max(
      0,
      ...document.getAnimations().map((a) => {
        const duration = a.effect?.getComputedTiming().duration;
        return typeof duration === 'number' ? duration : 0;
      }),
    ),
  );

/**
 * Records every Web Animations call from now on (the morph animates through `animate`), so
 * a movement that has already finished is still seen; read with `longestScripted`.
 */
const recordScripted = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const seen: number[] = [];
    (window as unknown as { __animated: number[] }).__animated = seen;
    const animate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
      ?.value as Element['animate'];
    Element.prototype.animate = function (this: Element, keyframes, options) {
      seen.push(typeof options === 'number' ? options : Number(options?.duration ?? 0));
      return animate.call(this, keyframes, options);
    };
  });
const longestScripted = (page: Page): Promise<number> =>
  page.evaluate(() =>
    Math.max(0, ...((window as unknown as { __animated?: number[] }).__animated ?? [])),
  );

/** The longest transition or animation duration set on the element, ms. */
const longestDuration = (locator: Locator): Promise<number> =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const ms = (value: string) =>
      value.split(',').map((part) => {
        const v = part.trim();
        const n = Number.parseFloat(v);
        // `auto` (no time-based duration) counts as none.
        if (Number.isNaN(n)) return 0;
        return v.endsWith('ms') ? n : n * 1000;
      });
    return Math.max(...ms(style.transitionDuration), ...ms(style.animationDuration));
  });

/**
 * The reduced-motion ceiling (language.md §7.5; ADR-0028 §2.5, A-9): motion is reduced per token
 * (styles/motion.css), so springs are instant and fades keep 100–150 ms; nothing lasts longer.
 * `motion.spec.ts` sweeps what animates, property by property.
 */
const REDUCED_MS = 150;

test.describe('reduced motion', () => {
  test('with it, the presses, the preset editor and the strip do not move', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSimple(page);
    await enterEdit(page);
    const dot = bar(page).getByRole('button', { name: 'Black pen, 1.5 pt' });
    expect(await longestDuration(dot)).toBeLessThanOrEqual(REDUCED_MS);
    await recordScripted(page);
    // The preset editor rises in without movement (opened from the keyboard: arm, then
    // Enter again on the armed preset).
    await dot.focus();
    await page.keyboard.press('Enter');
    await expect(dot).toHaveAttribute('aria-pressed', 'true');
    const strip = page.getByTestId('ink-strip');
    await expect(strip).toBeVisible();
    expect(await longestDuration(strip)).toBeLessThanOrEqual(REDUCED_MS);
    await page.keyboard.press('Enter');
    const editor = page.getByTestId('pen-preset-editor');
    await expect(editor).toBeVisible();
    expect(await longestDuration(editor)).toBeLessThanOrEqual(REDUCED_MS);
    expect(await longestAnimation(page)).toBeLessThanOrEqual(REDUCED_MS);
    expect(await longestScripted(page)).toBeLessThanOrEqual(REDUCED_MS);
    await page.keyboard.press('Escape');
  });
});

// ---------------------------------------------------------------------------
// Focus ring
// ---------------------------------------------------------------------------

test('the focus ring tokens apply to the new controls', async ({ page }) => {
  await page.goto('./?lang=en');
  await openFixtures(page, ['simple-text.pdf', 'annotations.pdf']);
  await page.getByRole('tab', { name: 'annotations' }).click();
  await enterEdit(page);
  const expectRing = async (name: string, target: Locator) => {
    // After a key press, so :focus-visible applies to a scripted focus.
    await page.keyboard.press('Shift');
    await target.focus();
    await expect(target, name).toBeFocused();
    const found = await target.evaluate((el) => {
      const style = getComputedStyle(el);
      const probe = document.createElement('span');
      probe.style.color = 'var(--focus-light)';
      document.body.append(probe);
      const light = getComputedStyle(probe).color;
      probe.remove();
      return {
        visible: el.matches(':focus-visible'),
        style: style.outlineStyle,
        width: style.outlineWidth,
        colour: style.outlineColor,
        light,
      };
    });
    expect(found.visible, name).toBe(true);
    expect(found.style, name).toBe('solid');
    expect(found.width, name).toBe('2px');
    // The light band of the two-band ring (styles/focus.css, tokens.test.ts: 16.4:1 to the dark).
    expect(found.colour, name).toBe(found.light);
  };

  const sidebar = await showSidebar(page, 'Pages', 'Thumbnails');
  await expectRing('thumbnail', sidebar.locator('[role="option"][tabindex="0"]'));
  await expectRing('sidebar tab', sidebar.getByRole('tab', { name: /^Review/ }));
  await sidebar.getByRole('tab', { name: /^Review/ }).click();
  await expectRing('Review filter chip', page.getByRole('radio', { name: /^All/ }));
  await expectRing('Review row', page.locator('[data-annotation-row]').first());

  await page.keyboard.press('0');
  const firstCard = page.getByRole('listbox', { name: 'Files' }).getByRole('option').first();
  await expectRing('Library card', firstCard);
  await expectRing('Library action', page.getByTestId('library-open'));
  // The two arrived checked (Select mode, where a click toggles): Enter opens either way.
  await firstCard.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  // The pages' ring shows only when F6 or Tab brought the focus there (review finding 23).
  for (let i = 0; i < 8; i++) {
    if (await viewport(page).evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('F6');
  }
  await expect(viewport(page)).toBeFocused();
  expect(await viewport(page).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  await enterEdit(page);
  await expectRing('palette tool', bar(page).getByRole('button', { name: 'Eraser', exact: true }));
  await expectRing('ink dot', bar(page).getByRole('button', { name: 'Blue pen, 1.5 pt' }));
  await page.locator('body').press('p');
  await stroke(page, [0.3, 0.45], [0.5, 0.46]);
  await expect(layer(page).locator('[data-annotation-kind="ink"]')).toHaveCount(1, {
    timeout: 10_000,
  });
  await page.locator('body').press('q');
  await lasso(page, [0.3, 0.45], [0.5, 0.46]);
  // The lasso's grab area (an SVG rect over the taken strokes) takes the pointer only; its
  // keyboard form is the bar's move grip (arrows nudge), which carries the ring.
  await expectRing('lasso move grip', page.getByRole('button', { name: 'Move strokes' }));
});

// ---------------------------------------------------------------------------
// Craft spec §9 (M8)
// ---------------------------------------------------------------------------

/** Opens the tagged Chromium export (one text object per glyph) in `lang`. */
async function openWordTagged(page: Page, lang = 'en'): Promise<void> {
  await page.goto(`./?lang=${lang}`);
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
    .first()
    .click();
  await (await chooser).setFiles(fixturePath('text-edit-corpus/word-tagged.pdf'));
  await expect(page.getByRole('tab', { name: 'word-tagged' })).toBeVisible();
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
}

const paragraphTargets = (page: Page): Locator =>
  page.locator('[data-text-edit-layer="0"] [data-text-paragraph]');

/** Arms Edit text with E (switching to Edit) and waits for the paragraph targets. */
async function armEditText(page: Page): Promise<void> {
  await viewport(page).focus();
  await page.keyboard.press('e');
  await expect(paragraphTargets(page).first()).toBeAttached({ timeout: 20_000 });
}

/** A word of the first page's text layer, double-clicked: a selection and its bar. */
async function selectWord(page: Page): Promise<Locator> {
  const rows = page.getByTestId('text-layer').first().locator('span[data-row]');
  await expect(rows.first()).toBeAttached({ timeout: 20_000 });
  const box = await rows.first().boundingBox();
  if (!box) throw new Error('no text');
  await page.mouse.dblclick(box.x + Math.min(12, box.width / 4), box.y + box.height / 2);
  const selectionBar = page.getByRole('toolbar', { name: /^(Selected text|Seçili metin)$/ });
  await expect(selectionBar).toBeVisible();
  return selectionBar;
}

/** The first page's context menu, opened with a right-click on the paper. */
async function openPageMenu(page: Page): Promise<Locator> {
  const first = await page.locator('[data-page-index="0"]').boundingBox();
  if (!first) throw new Error('page 1 not laid out');
  await page.mouse.click(first.x + 40, first.y + 40, { button: 'right' });
  const menu = page.getByTestId('page-context-menu');
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * Presses Tab (or Shift+Tab) `steps` times and checks that every stop is shown: an element
 * with a box, visible, outside any `aria-hidden` or inert subtree. Base UI's focus guards
 * (invisible by design, they hand the focus on) and the document itself pass. Returns what
 * each stop is called.
 */
async function tabWalk(page: Page, steps: number, back = false): Promise<string[]> {
  const names: string[] = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { ok: true, name: 'body' };
      if (el.hasAttribute('data-base-ui-focus-guard')) return { ok: true, name: 'focus guard' };
      const box = el.getBoundingClientRect();
      const shown =
        el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
        box.width > 0 &&
        box.height > 0;
      const hidden = el.closest('[aria-hidden="true"], [inert]') !== null;
      const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '';
      return { ok: shown && !hidden, name: `${el.tagName.toLowerCase()} “${label}”` };
    });
    expect(stop.ok, `Tab stop ${i + 1} is hidden: ${stop.name}`).toBe(true);
    names.push(stop.name);
  }
  return names;
}

test.describe('craft spec §9', () => {
  test('the pages show their focus ring after Tab or F6 only, never after a click or a mode key', async ({
    page,
  }) => {
    await openSimple(page);
    const frame = viewport(page).locator('xpath=..');
    const ring = () => frame.evaluate((el) => getComputedStyle(el, '::after').content);
    const box = await page.locator('[data-page-index="0"]').boundingBox();
    if (!box) throw new Error('page 1 not laid out');
    // A click on the pages, then a mode key (review finding 23): no frame around the stage.
    await page.mouse.click(box.x + box.width / 2, box.y + 60);
    await expect(viewport(page)).toBeFocused();
    await page.keyboard.press('2');
    expect(await ring()).toBe('none');
    await page.keyboard.press('1');
    expect(await ring()).toBe('none');
    // F6 between the regions reaches the pages: the ring shows.
    await dock(page).getByRole('button', { name: 'Pages', exact: true }).focus();
    for (let i = 0; i < 8; i++) {
      if (await viewport(page).evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('F6');
    }
    await expect(viewport(page)).toBeFocused();
    expect(await ring()).not.toBe('none');
  });

  test('Read: F6 reaches the dock; the page menu and the selection bar; no hidden stop', async ({
    page,
  }) => {
    await openSimple(page);
    // F6 from the pages: the dock, on its Tab stop (Pages until another item had focus).
    await viewport(page).focus();
    await page.keyboard.press('F6');
    await expect(dock(page).getByRole('button', { name: 'Pages', exact: true })).toBeFocused();
    await viewport(page).focus();
    await tabWalk(page, 12);

    // The page context menu in viewing: the page operations are `pages` acts, offered without
    // Markup (ADR-0030, S8).
    const menu = await openPageMenu(page);
    await expect(menu.getByRole('menuitem', { name: 'Rotate page 1 right' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Edit text here/ })).toBeVisible();
    await axe(page, 'Read, the page context menu');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    // The text selection bar in Read: Copy and Mark up…, reached by Tab from the pages.
    const selectionBar = await selectWord(page);
    await expect(selectionBar.getByRole('button', { name: 'Copy' })).toBeVisible();
    await axe(page, 'Read, the text selection bar');
    await viewport(page).focus();
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await holdsFocus(selectionBar);
    }
    expect(reached, 'Tab reaches the selection bar').toBe(true);
    await selectionBar.getByRole('button', { name: 'Mark up…' }).focus();
    await page.keyboard.press('Enter');
    // The Edit row on the same selection, the focus on its first markup.
    await expect(page.locator('[data-capsule="palette"]')).toBeVisible();
    await expect(
      selectionBar.getByRole('button', { name: 'Underline', exact: true }),
    ).toBeVisible();
    expect(await holdsFocus(selectionBar)).toBe(true);
    await expect(selectionBar.getByRole('button', { name: 'Comment' })).toBeVisible();
    await axe(page, 'Edit, the text selection bar');
    await page.keyboard.press('Escape');
    await expect(selectionBar).toHaveCount(0);
  });

  test('Markup: F6 lands on the armed tool; the palette by keyboard with no hidden stop', async ({
    page,
  }) => {
    await openSimple(page);
    await enterEdit(page);
    await viewport(page).focus();
    await page.keyboard.press('F6');
    const select = bar(page).getByRole('button', { name: 'Select', exact: true });
    await expect(select).toBeFocused();
    // The page pill comes after the dock in the F6 order (01-frame X9).
    await page.keyboard.press('F6');
    await expect(page.getByTestId('page-pill')).toBeFocused();
    await page.keyboard.press('Shift+F6');
    await expect(select).toBeFocused();
    // Tab and Shift+Tab never stop on anything hidden, with Select and with a pen's strip.
    await tabWalk(page, 4);
    await select.focus();
    await tabWalk(page, 4, true);
    await page.locator('body').press('p');
    await bar(page).locator('button[tabindex="0"]').focus();
    await tabWalk(page, 4);
  });

  test('Edit text: Tab moves between paragraphs, Enter opens, Esc returns; axe', async ({
    page,
  }) => {
    await openWordTagged(page);
    await armEditText(page);
    const targets = paragraphTargets(page);
    const count = await targets.count();
    expect(count).toBeGreaterThanOrEqual(4);
    // One stop per paragraph: no glyph run is focusable or exposed.
    const exposedRuns = await page
      .locator('[data-text-edit-layer="0"] [data-text-run][data-editable]')
      .evaluateAll(
        (runs) =>
          runs.filter((r) => (r as HTMLElement).tabIndex >= 0 || !r.hasAttribute('aria-hidden'))
            .length,
      );
    expect(exposedRuns).toBe(0);
    for (let i = 0; i < count; i++) {
      await expect(targets.nth(i)).toHaveAttribute('aria-label', /^Edit paragraph “.+”$/);
      const box = await targets.nth(i).boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
    }
    await page.keyboard.press('Shift');
    await targets.first().focus();
    for (let i = 1; i < count; i++) {
      await page.keyboard.press('Tab');
      await expect(targets.nth(i)).toBeFocused();
    }
    await axe(page, 'Edit text armed, the paragraph targets');

    const ferry = page.locator(
      '[data-text-edit-layer="0"] [data-text-paragraph][aria-label*="The ferry"]',
    );
    await expect(ferry).toHaveCount(1);
    await ferry.focus();
    await page.keyboard.press('Enter');
    const editor = page.getByRole('textbox', { name: 'Paragraph on page 1' });
    await expect(editor).toBeFocused({ timeout: 20_000 });
    await expect(editor).toHaveAttribute('aria-multiline', 'true');
    await expect(editor).toHaveText(/^The ferry left the quay/);
    await expect(page.getByTestId('paragraph-header')).toBeVisible();
    await axe(page, 'the paragraph editor open');
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(ferry).toBeFocused();
    await expect(
      page
        .getByRole('list', { name: /history/i })
        .getByRole('button', { name: /^Paragraph edited/ }),
    ).toHaveCount(0);
    await tabWalk(page, count + 2);
  });

  test('the lasso selection: 24 px handles, the keyboard box, axe', async ({ page }) => {
    await openSimple(page);
    await page.locator('body').press('p');
    await stroke(page, [0.3, 0.45], [0.5, 0.46]);
    await expect(layer(page).locator('[data-annotation-kind="ink"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await page.locator('body').press('q');
    await lasso(page, [0.3, 0.45], [0.5, 0.46]);
    await expect(page.locator('[data-lasso-bar]')).toBeVisible();
    const handles = layer(page).locator('[data-lasso-handle]');
    await expect(handles).toHaveCount(8);
    for (const hit of [...(await handles.all()), layer(page).locator('[data-lasso-rotate]')]) {
      const box = await hit.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
    }
    // The keyboard path: the selection box, a labelled group in the tab order with its keys.
    const box = page.getByRole('group', { name: /^Selection: 1 stroke\. Arrow keys move it/ });
    await expect(box).toHaveAttribute('tabindex', '0');
    await expect(box).toHaveAttribute('aria-keyshortcuts', /Shift\+ArrowRight/);
    await page.keyboard.press('Shift');
    await box.focus();
    await expect(box).toBeFocused();
    expect(await box.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    await page.keyboard.press('Shift+ArrowRight');
    await expect(status(page)).toHaveText(/^Resized to \d+ × \d+ pt$/);
    await expect(box).toBeFocused();
    await axe(page, 'the lasso selection, its handles and box');
    await viewport(page).focus();
    await tabWalk(page, 10);
  });

  test('the Highlighter says the lines it highlighted', async ({ page }) => {
    await openSimple(page);
    await page.locator('body').press('h');
    await expect(layer(page)).toHaveAttribute('data-tool', 'ink');
    const rows = page.getByTestId('text-layer').first().locator('span[data-row]');
    await expect(rows.first()).toBeAttached({ timeout: 10_000 });
    const boxes = (await rows.evaluateAll((spans) =>
      spans.map((span) => {
        const r = span.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    )) as { x: number; y: number; width: number; height: number }[];
    const longest = boxes.reduce((a, b) => (b.width > a.width ? b : a));
    const y = longest.y + longest.height / 2;
    await page.mouse.move(longest.x + 3, y);
    await page.mouse.down();
    await page.mouse.move(longest.x + longest.width - 3, y, { steps: 20 });
    await page.mouse.up();
    await expect(layer(page).locator('[data-annotation-kind="highlight"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(status(page)).toHaveText('Highlighted 1 line on page 1');
  });

  test('Home: Recents, when the build has them', async ({ page }) => {
    await page.goto('./?lang=en');
    await openFixtures(page, ['simple-text.pdf', 'rotated-pages.pdf']);
    // Recents lists files opened lately that are not open now: close one (its tab's ✕).
    await page.getByRole('tab', { name: 'simple-text' }).click();
    await page.getByTitle('Close rotated-pages').click();
    await expect(page.getByRole('tab', { name: 'rotated-pages' })).toHaveCount(0);
    await page.keyboard.press('0');
    await expect(page.getByTestId('home')).toBeVisible();
    const recents = page.getByRole('list', { name: 'Recent files' });
    await recents.waitFor({ timeout: 3000 }).catch(() => undefined);
    if ((await recents.count()) === 0) {
      test.info().annotations.push({ type: 'skipped', description: 'No Recents list on Home' });
      return;
    }
    await expect(recents).toBeVisible();
    await axe(page, 'Home with Recents');
    await page.getByTestId('home-button').focus();
    await tabWalk(page, 12);
  });

  test('in Turkish: every new control is named; axe on Edit text and the page menu', async ({
    page,
  }) => {
    await openWordTagged(page, 'tr');
    await armEditText(page);
    // Markup is open (the mode switch is gone, D2-1): the palette shows Edit text armed.
    await expect(page.getByRole('button', { name: 'Metni düzenle', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(paragraphTargets(page).first()).toHaveAttribute(
      'aria-label',
      /^“.+” paragrafını düzenle$/,
    );
    await axe(page, 'Turkish, Edit text armed');
    const menu = await openPageMenu(page);
    await expect(menu.getByRole('menuitem', { name: 'Metni burada düzenle' })).toBeVisible();
    await axe(page, 'Turkish, the page context menu');
  });
});

/** Every glass surface on the page and what it paints (backdrop filter, background alpha). */
const glassSurfaces = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.mat')]
      .filter((el) => el.checkVisibility())
      .map((el) => {
        const style = getComputedStyle(el);
        const match = /rgba?\(([^)]+)\)/.exec(style.backgroundColor);
        const parts = match?.[1]?.split(/[\s,/]+/).filter(Boolean) ?? [];
        const alpha = parts.length === 4 ? Number(parts[3]) : 1;
        return {
          name: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`,
          filter: style.backdropFilter,
          alpha,
        };
      }),
  );

async function appearance(
  page: Page,
  settings: { glass: 'clear' | 'tinted' | 'solid' },
): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('pdf-editor:appearance:v1', value);
  }, JSON.stringify(settings));
}

test.describe('glass (craft spec §9; ADR-0024 §2.4, spec D3-3)', () => {
  test('Glass Clear: axe on Edit, the page menu and the selection bar', async ({ page }) => {
    await appearance(page, { glass: 'clear' });
    await openSimple(page);
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'clear');
    // Meaningful only if something is glass: the floating bar at least is translucent.
    expect(
      (await glassSurfaces(page)).some((surface) => surface.alpha < 1 || surface.filter !== 'none'),
    ).toBe(true);
    await axe(page, 'Glass Clear, Read');
    await selectWord(page);
    await axe(page, 'Glass Clear, the text selection bar');
    await page.keyboard.press('Escape');
    await enterEdit(page);
    await page.locator('body').press('p');
    await expect(page.getByTestId('ink-strip')).toBeVisible();
    await axe(page, 'Glass Clear, Markup, a pen and its strip');
    await openPageMenu(page);
    await axe(page, 'Glass Clear, the page context menu');
  });

  test('Glass Solid: every glass tier is solid on the new surfaces', async ({ page }) => {
    await appearance(page, { glass: 'solid' });
    await openWordTagged(page);
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'solid');
    const expectSolid = async (state: string) => {
      const surfaces = await glassSurfaces(page);
      expect(surfaces.length, state).toBeGreaterThan(0);
      for (const surface of surfaces) {
        expect(surface.filter, `${state}: ${surface.name}`).toBe('none');
        expect(surface.alpha, `${state}: ${surface.name}`).toBe(1);
      }
    };
    await expectSolid('Read: frame and the Edit button');
    await selectWord(page);
    await expectSolid('the text selection bar');
    await page.keyboard.press('Escape');
    await openPageMenu(page);
    await expectSolid('the page context menu');
    await page.keyboard.press('Escape');
    await armEditText(page);
    await paragraphTargets(page).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('paragraph-header')).toBeVisible({ timeout: 20_000 });
    await expectSolid('Edit, Text, the paragraph editor');
    await axe(page, 'Glass Solid, the paragraph editor');
  });
});

test('reduced motion: the new surfaces neither move nor rise', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWordTagged(page);
  const still = async (state: string, locator: Locator) => {
    expect(await longestDuration(locator), state).toBeLessThanOrEqual(REDUCED_MS);
    expect(await longestAnimation(page), state).toBeLessThanOrEqual(REDUCED_MS);
  };
  await recordScripted(page);
  await still('the text selection bar', await selectWord(page));
  await page.keyboard.press('Escape');
  await still('the page context menu', await openPageMenu(page));
  await page.keyboard.press('Escape');
  await armEditText(page);
  // The Text group's morph and its options tier.
  await still('the Edit bar', bar(page));
  await page.keyboard.press('Shift');
  await paragraphTargets(page).first().focus();
  await still('a paragraph target', paragraphTargets(page).first());
  await page.keyboard.press('Enter');
  const header = page.getByTestId('paragraph-header');
  await expect(header).toBeVisible({ timeout: 20_000 });
  await still('the paragraph editor header', header);
  expect(await longestScripted(page)).toBeLessThanOrEqual(REDUCED_MS);
});

// ---------------------------------------------------------------------------
// D0: sheets and toasts (spec redesign §8: A-13, A-14, A-15, A-24 blocking from D0)
// ---------------------------------------------------------------------------

/**
 * Before the app loads: records every focus that lands on an element the person cannot see
 * (A-13: `checkVisibility` with opacity and visibility false) and is still unseen once the
 * entrances running then have finished, so a control focused on the first frame of a popup's
 * fade (opacity rising from 0) does not count, and one left behind a hidden surface does.
 */
async function recordInvisibleFocus(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const found: string[] = [];
    (window as unknown as { __invisibleFocus: string[] }).__invisibleFocus = found;
    const seen = (el: Element) =>
      el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    document.addEventListener(
      'focusin',
      (event) => {
        const el = event.target;
        if (!(el instanceof Element) || el === document.body || seen(el)) return;
        void (async () => {
          // A starting style holds for a frame before its transition runs.
          await frame();
          await frame();
          await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)));
          await frame();
          if (document.activeElement !== el || seen(el)) return;
          const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30);
          found.push(`${el.tagName.toLowerCase()} "${label ?? ''}"`);
        })();
      },
      true,
    );
  });
}

const invisibleFocus = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __invisibleFocus: string[] }).__invisibleFocus);

/** Deletes page 2 in Arrange, so "Deleted page 2 · Undo" shows. */
async function deleteSecondPage(page: Page): Promise<Locator> {
  await page.keyboard.press('3');
  const cells = page.locator('[role="gridcell"][data-page-id]');
  await expect(cells).toHaveCount(3);
  await cells.nth(1).click({ modifiers: ['ControlOrMeta'] });
  await page.keyboard.press('Delete');
  await expect(cells).toHaveCount(2);
  const toast = page.getByRole('group', { name: 'Deleted page 2' });
  await expect(toast).toBeVisible();
  return toast;
}

async function openSettings(page: Page): Promise<Locator> {
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').first().fill('Settings');
  await page
    .getByRole('option', { name: /^Settings…/ })
    .first()
    .click();
  const settings = page.getByTestId('settings-sheet');
  await expect(settings).toBeVisible();
  return settings;
}

test.describe('D0 sheets and toasts', () => {
  test('A-13: F6 reaches the toasts; a modal sheet holds focus and gives it back; focus is never invisible', async ({
    page,
  }) => {
    await recordInvisibleFocus(page);
    await openSimple(page);
    const toast = await deleteSecondPage(page);

    // F6 from the title bar comes round to the toast region, the cycle's last stop (X9),
    // landing on the newest toast's action; Shift+F6 leaves it.
    await page.getByRole('tab', { name: 'simple-text' }).focus();
    for (let i = 0; i < 8 && !(await holdsFocus(toast)); i++) await page.keyboard.press('F6');
    await expect(toast.getByRole('button', { name: 'Undo' })).toBeFocused();
    await page.keyboard.press('Shift+F6');
    expect(await holdsFocus(toast)).toBe(false);

    // A modal sheet sits outside the cycle (X9): F6 and Tab stay inside it, Esc closes it and
    // focus goes back to the control that opened it.
    // Opened from the title menu, whose trigger (the active tab) takes the focus back.
    const opener = page.getByTestId('document-menu');
    await openSaveCopyFromMenu(page);
    const sheet = page.getByTestId('save-copy-sheet');
    await expect(sheet).toBeVisible();
    await expect.poll(() => holdsFocus(sheet)).toBe(true);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('F6');
      await expect.poll(() => holdsFocus(sheet), `F6 ${i + 1} in Save a copy`).toBe(true);
    }
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      // Past the last control, Tab lands on the trap's guard, which hands focus to the first
      // control in the next frame: the cycle never leaves the sheet.
      await expect.poll(() => holdsFocus(sheet), `Tab ${i + 1} in Save a copy`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(opener).toBeFocused();

    const settings = await openSettings(page);
    await expect.poll(() => holdsFocus(settings)).toBe(true);
    await page.keyboard.press('F6');
    await expect.poll(() => holdsFocus(settings)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);

    // The toast is still there (it paused while the sheets were open) and still reachable.
    await expect(toast).toBeVisible();
    await page.getByRole('tab', { name: 'simple-text' }).focus();
    await page.keyboard.press('Shift+F6');
    await expect(toast.getByRole('button', { name: 'Undo' })).toBeFocused();

    expect(await invisibleFocus(page)).toEqual([]);
  });

  test('A-14: one announcer; the toast region and the sheets are silent; a toast is said once', async ({
    page,
  }) => {
    const regions = () =>
      page.evaluate(() => {
        const live =
          '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]';
        const polite = document.querySelectorAll(
          'div.visually-hidden[role="status"][aria-live="polite"]',
        ).length;
        const assertive = document.querySelectorAll(
          'div.visually-hidden[aria-live="assertive"]',
        ).length;
        const toasts = document.querySelector('[data-region="toasts"]');
        const sheet = document.querySelector('[data-sheet]');
        return {
          polite,
          assertive,
          toastRegionLive: toasts ? toasts.matches(live) || !!toasts.querySelector(live) : false,
          sheetLive: sheet ? sheet.matches(live) : false,
        };
      });
    const one = { polite: 1, assertive: 1, toastRegionLive: false, sheetLive: false };

    await page.goto('./?lang=en');
    await expect(page.getByRole('button', { name: /^Open files/ }).first()).toBeVisible();
    expect(await regions(), 'Home').toEqual(one);
    await openFixtures(page, ['simple-text.pdf']);
    await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
      timeout: 20_000,
    });
    expect(await regions(), 'a document').toEqual(one);

    // Every change of the polite region, from just before the delete.
    await page.keyboard.press('3');
    await page
      .locator('[role="gridcell"][data-page-id]')
      .nth(1)
      .click({ modifiers: ['ControlOrMeta'] });
    await page.evaluate(() => {
      const said: string[] = [];
      (window as unknown as { __said: string[] }).__said = said;
      const region = document.querySelector('div.visually-hidden[role="status"]');
      if (!region) throw new Error('no polite region');
      new MutationObserver(() => {
        const text = region.textContent?.trim() ?? '';
        if (text) said.push(text);
      }).observe(region, { childList: true, subtree: true, characterData: true });
    });
    await page.keyboard.press('Delete');
    const toast = page.getByRole('group', { name: 'Deleted page 2' });
    await expect(toast).toBeVisible();
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    );
    const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said);
    // Spoken equals shown, once (FB10 §6): the toast's sentence, with the F6 hint the first time.
    expect(said.filter((text) => text.includes('Deleted page 2'))).toHaveLength(1);
    expect(await regions(), 'a toast').toEqual(one);

    await openSaveCopyFromMenu(page);
    await expect(page.getByTestId('save-copy-sheet')).toBeVisible();
    expect(await regions(), 'Save a copy').toEqual(one);
    await page.keyboard.press('Escape');
    await openSettings(page);
    expect(await regions(), 'Settings').toEqual(one);
    await page.keyboard.press('Escape');
  });

  /** The D0 floating surfaces, opened one by one, each audited for `min` px targets. */
  async function auditD0Targets(page: Page, min: 24 | 44): Promise<string[]> {
    const lines: string[] = [];
    const audit = async (state: string, surface: Locator) => {
      // Entrances scale from 0.96: measure the surface at rest.
      await settleAnimations(page);
      const { count, findings } = await auditTargets(surface, min);
      if (count === 0) lines.push(`${state}: no targets found`);
      for (const f of findings) {
        lines.push(`${state} · ${f.target}: ${f.problem}`);
      }
    };
    await page.goto('./?lang=en');
    await openFixtures(page, ['simple-text.pdf']);
    await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
      timeout: 20_000,
    });

    await openSaveCopyFromMenu(page);
    const saveCopy = page.getByTestId('save-copy-sheet');
    await expect(saveCopy).toBeVisible();
    await audit('Save a copy', saveCopy);
    await page.keyboard.press('Escape');
    await expect(saveCopy).toHaveCount(0);

    const settings = await openSettings(page);
    await audit('Settings', settings);
    await settings.getByRole('button', { name: /About Recto/ }).click();
    await expect(settings.getByTestId('settings-about')).toBeVisible();
    await audit('Settings, About Recto', settings);
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);

    await page.locator('body').press('?');
    const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(shortcuts).toBeVisible();
    await audit('the shortcuts overlay', shortcuts);
    await page.keyboard.press('Escape');
    await expect(shortcuts).toHaveCount(0);

    // The toast stack: "Deleted page 2 · Undo" over a failure, the Undo toast hovered (✕).
    const toast = await deleteSecondPage(page);
    const chooser = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /^Open files/ })
      .first()
      .click();
    await (await chooser).setFiles({
      name: 'scan.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nnot a pdf\n%%EOF\n'),
    });
    const region = page.getByRole('region', { name: 'Notifications' });
    await expect(region.getByRole('group')).toHaveCount(2);
    await toast.hover();
    await audit('the toast stack', region);
    await page.mouse.move(2, 450);

    // The History scrubber under ↶.
    await page.getByTestId('undo-button').click({ button: 'right' });
    const scrubber = page.getByTestId('history-scrubber');
    await expect(scrubber).toBeVisible();
    await audit('the History scrubber', scrubber);
    await page.keyboard.press('Escape');
    return lines;
  }

  test('A-15: targets of 24 px or spaced with a fine pointer, 44 px with a coarse one', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    expect(await auditD0Targets(page, 24), 'fine, 1440 × 900').toEqual([]);

    // The same surfaces on a tablet (coarse, the full edition at 820 × 1180).
    const size = { width: 820, height: 1180 };
    const tablet = await browser.newContext({
      ...devices['Galaxy Tab S4'],
      baseURL: test.info().project.use.baseURL ?? '',
      viewport: size,
      screen: size,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const touch = await tablet.newPage();
    try {
      await useFileInputPicker(touch);
      expect(await touch.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      expect(await auditD0Targets(touch, 44), 'coarse, 820 × 1180').toEqual([]);
    } finally {
      await tablet.close();
    }
  });
});
