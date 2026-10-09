/**
 * The light theme end to end (ADR-0022 §2.4; spec D3-7; language.md §10.2's {dark, light} axis of
 * the accessibility matrix):
 *
 * - **No flash.** A chosen theme is on the root at the first frame, before the app's script has
 *   run: `public/theme.js` writes it from the head. Light on a dark device and Dark on a light one
 *   both paint their own canvas first, with the browser's `theme-color` set to it.
 * - **System follows the device,** live, while the app runs; Light and Dark hold.
 * - **The setting:** Settings → Appearance → Theme and the palette's "Theme: …" commands set it at
 *   once and it survives a reload.
 * - **axe in light** on every V2 surface: the Library (empty and with cards), the frame and the
 *   dock, the Markup palette with the pen's strip, a menu, the command palette, the Settings
 *   sheet, the Pages grid and a toast. The dark run of the same surfaces is `a11y.spec.ts`.
 *
 * Engine-agnostic: the scheme comes from Playwright's `colorScheme`, the theme from the stored
 * setting; nothing reads a pixel.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { expect, type Page, test } from '@playwright/test';

import { enterEdit, fixturePath, openFixtures, useFileInputPicker } from './helpers';

const STORAGE_KEY = 'pdf-editor:appearance:v1';
/** Each theme's canvas (tokens.css §1, §2), as computed styles write it. */
const CANVAS = { dark: 'rgb(8, 9, 12)', light: 'rgb(230, 232, 235)' } as const;
const THEME_COLOUR = { dark: '#08090c', light: '#e6e8eb' } as const;

/** Stores a Theme choice before the page's own scripts run. */
async function chooseTheme(page: Page, theme: 'system' | 'light' | 'dark'): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('theme-chosen')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('theme-chosen', '1');
      }
    },
    [STORAGE_KEY, JSON.stringify({ theme })] as const,
  );
}

/**
 * Records the root's theme and background in the first animation frame, which runs before the
 * first paint, and the theme colours the head declares then.
 */
async function recordFirstFrame(page: Page): Promise<void> {
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      const root = document.documentElement;
      (window as { __firstFrame?: unknown }).__firstFrame = {
        theme: root.getAttribute('data-theme'),
        background: getComputedStyle(root).backgroundColor,
        colours: [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
          (meta) => meta.content,
        ),
      };
    });
  });
}

async function firstFrame(
  page: Page,
): Promise<{ theme: string | null; background: string; colours: string[] }> {
  await page.waitForFunction(() => '__firstFrame' in window);
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __firstFrame: { theme: string | null; background: string; colours: string[] };
        }
      ).__firstFrame,
  );
}

const canvasNow = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

/** Runs a palette command by its title. */
async function palette(page: Page, query: string, option: RegExp | string): Promise<void> {
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('combobox').first();
  await expect(input).toBeVisible();
  await input.fill(query);
  await page.getByRole('option', { name: option }).first().click();
}

async function rest(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      // The aura's endless drift (Q-10's one exception) never comes to rest.
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getTiming().iterations === Infinity,
      ),
  );
}

test.describe('before the first paint', () => {
  test.describe('Light chosen on a dark device', () => {
    test.use({ colorScheme: 'dark' });

    test('paints light from the first frame, with the light theme colour', async ({ page }) => {
      await chooseTheme(page, 'light');
      await recordFirstFrame(page);
      await page.goto('./?lang=en');
      expect(await firstFrame(page)).toEqual({
        theme: 'light',
        background: CANVAS.light,
        colours: [THEME_COLOUR.light, THEME_COLOUR.light],
      });
      await expect(page.getByTestId('home')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect(await canvasNow(page)).toBe(CANVAS.light);
    });
  });

  test.describe('Dark chosen on a light device', () => {
    test.use({ colorScheme: 'light' });

    test('paints dark from the first frame, with the dark theme colour', async ({ page }) => {
      await chooseTheme(page, 'dark');
      await recordFirstFrame(page);
      await page.goto('./?lang=en');
      expect(await firstFrame(page)).toEqual({
        theme: 'dark',
        background: CANVAS.dark,
        colours: [THEME_COLOUR.dark, THEME_COLOUR.dark],
      });
      await expect(page.getByTestId('home')).toBeVisible();
      expect(await canvasNow(page)).toBe(CANVAS.dark);
    });
  });

  test.describe('System on a light device', () => {
    test.use({ colorScheme: 'light' });

    test('paints light first, and each scheme keeps its own theme colour', async ({ page }) => {
      await recordFirstFrame(page);
      await page.goto('./?lang=en');
      expect(await firstFrame(page)).toEqual({
        theme: 'light',
        background: CANVAS.light,
        colours: [THEME_COLOUR.dark, THEME_COLOUR.light],
      });
    });
  });
});

test.describe('the setting', () => {
  test.use({ colorScheme: 'light' });

  test('System follows the device while the app runs; a chosen theme holds', async ({ page }) => {
    await page.goto('./?lang=en');
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await canvasNow(page)).toBe(CANVAS.dark);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await palette(page, 'Theme', 'Theme: Dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // The device's light no longer reaches a chosen theme.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await canvasNow(page)).toBe(CANVAS.dark);
  });

  test('Settings → Appearance → Theme applies at once and survives a reload', async ({ page }) => {
    await page.goto('./?lang=en');
    await expect(page.getByTestId('home')).toBeVisible();
    await palette(page, 'Settings', /^Settings…/);
    const sheet = page.getByTestId('settings-sheet');
    await expect(sheet).toBeVisible();
    const theme = sheet.getByRole('radiogroup', { name: 'Theme' });
    await expect(theme.getByRole('radio', { name: 'System' })).toBeChecked();
    await theme.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      'content',
      THEME_COLOUR.dark,
    );
    await theme.getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await canvasNow(page)).toBe(CANVAS.light);

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await palette(page, 'Settings', /^Settings…/);
    await expect(
      page
        .getByTestId('settings-sheet')
        .getByRole('radiogroup', { name: 'Theme' })
        .getByRole('radio', { name: 'Light' }),
    ).toBeChecked();
  });

  test('is a Turkish palette command too: “Tema: Açık”', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('./?lang=tr');
    await expect(page.getByTestId('home')).toBeVisible();
    await palette(page, 'tema', 'Tema: Açık');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

const AXE_SOURCE = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

/** axe on the page as it rests (serious and critical findings fail, as in a11y.spec.ts). */
async function axe(page: Page, name: string): Promise<void> {
  await rest(page);
  // Through the devtools protocol: the app's CSP refuses inline scripts.
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(AXE_SOURCE);
  const violations = await page.evaluate(async () => {
    const { axe: runner } = window as unknown as {
      axe: {
        run: (
          context: Document,
          options: object,
        ) => Promise<{
          violations: { id: string; impact: string | null; nodes: { target: string[] }[] }[];
        }>;
      };
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
      nodes: v.nodes.map((n) => n.target.join(' ')),
    }));
  });
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const lesser = violations.filter((v) => !serious.includes(v));
  if (lesser.length > 0) {
    test.info().annotations.push({
      type: `axe: ${name}`,
      description: lesser.map((v) => `${v.impact} ${v.id}: ${v.nodes.join(', ')}`).join('; '),
    });
  }
  expect
    .soft(
      serious.map((v) => `${v.impact} ${v.id}: ${v.nodes.join(', ')}`),
      name,
    )
    .toEqual([]);
}

test.describe('axe in light (the a11y matrix’s light column)', () => {
  test.use({ colorScheme: 'light' });

  test.beforeEach(async ({ page }) => {
    await useFileInputPicker(page);
  });

  test('the Library, empty and with cards', async ({ page }) => {
    await page.goto('./?lang=en');
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await axe(page, 'light: empty Library');
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('home').getByRole('button', { name: 'Open PDFs…' }).click();
    await (await chooser).setFiles(['compare-a.pdf', 'compare-b.pdf'].map(fixturePath));
    await expect(page.getByTestId('home').locator('[role="option"]')).toHaveCount(2, {
      timeout: 20_000,
    });
    await axe(page, 'light: Library in Select with two cards and its bar');
    await page.getByRole('button', { name: 'Done' }).click();
    await axe(page, 'light: Library with cards');
  });

  test('the frame, the dock, Markup with the pen, a menu, the palette, Settings, the grid, a toast', async ({
    page,
  }) => {
    await page.goto('./?lang=en');
    await openFixtures(page, ['simple-text.pdf']);
    await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
      timeout: 20_000,
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await axe(page, 'light: Read, the frame and the dock');

    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();
    await axe(page, 'light: the sidebar');
    await page.getByTestId('sidebar-toggle').click();

    await enterEdit(page);
    await page.locator('body').press('p');
    await expect(page.getByTestId('ink-strip')).toBeVisible();
    await axe(page, 'light: Markup, the pen and its strip');
    await page.locator('body').press('t');
    await axe(page, 'light: Markup, the text box armed (ink fill, lime glyph)');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    const tab = await page.getByTestId('document-menu').boundingBox();
    if (!tab) throw new Error('no active tab');
    await page.mouse.click(tab.x + 24, tab.y + tab.height / 2, { button: 'right' });
    await expect(page.getByTestId('tab-menu')).toBeVisible();
    await axe(page, 'light: the tab menu');
    await page.keyboard.press('Escape');

    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await axe(page, 'light: the command palette');
    await page.keyboard.press('Escape');

    await palette(page, 'Settings', /^Settings…/);
    await expect(page.getByTestId('settings-sheet')).toBeVisible();
    await axe(page, 'light: the Settings sheet');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-sheet')).toHaveCount(0);

    await page.keyboard.press('3');
    const cells = page.locator('[role="gridcell"][data-page-id]');
    await expect(cells).toHaveCount(3);
    await axe(page, 'light: the Pages grid');
    await cells.nth(1).click({ modifiers: ['ControlOrMeta'] });
    await page.keyboard.press('Delete');
    await expect(page.getByRole('group', { name: 'Deleted page 2' })).toBeVisible();
    await axe(page, 'light: the grid with a toast');
  });
});
