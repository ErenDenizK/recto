/**
 * Key map v2 by keyboard (flows §7.2–§7.3; spec D2-7, lean): the places `0` `1` `M`/`2` `3`
 * `4`, Shift+R on the current page with its Undo toast while R stays inert in the grid, the `1`
 * notice on a device that ran M8, no tool key arming while focus is in Find, the title menu's
 * name field or a form field, and the shortcuts overlay listing the map in its groups, in
 * English and Turkish.
 *
 * Caret mode, Alt+Enter in Find and keyboard placement (`05-canvas` §7, §14) are the update
 * after V2 and are not driven here yet.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { openFindPanel, openFixtures, useFileInputPicker } from './helpers';

const dock = (page: Page) => page.getByRole('toolbar', { name: 'Document tools', exact: true });
const palette = (page: Page) => page.locator('[data-capsule="palette"]');
const layer = (page: Page) => page.locator('[data-annotation-layer="0"]');
const grid = (page: Page) => page.getByTestId('light-table');
const library = (page: Page) => page.getByTestId('home');
const undo = (page: Page) => page.getByTestId('undo-button');
/** What Undo would undo, as its description says. */
const undoDescription = (page: Page) =>
  undo(page).evaluate(
    (el) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? '',
  );

async function open(page: Page, name = 'simple-text.pdf', lang = 'en'): Promise<void> {
  await useFileInputPicker(page);
  await page.goto(`./?lang=${lang}`);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, [name]);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await expect(page.locator('[data-capsule="dock"]')).toBeVisible();
}

/** Viewing: the dock at rest, no tool armed, nothing but the page. */
async function viewing(page: Page): Promise<void> {
  await expect(dock(page)).toBeVisible();
  await expect(palette(page)).toHaveCount(0);
  await expect(grid(page)).toHaveCount(0);
  await expect(layer(page)).toHaveAttribute('data-tool', 'select');
  await expect(layer(page)).toHaveAttribute('data-input', 'viewing');
}

/** Types tool letters and place keys into the focused `field`; none of them may act. */
async function typeKeys(page: Page, field: Locator): Promise<void> {
  await expect(field).toBeFocused();
  // Rectangle, Highlighter, Markup, pen, Pages grid, the Library, Focus, previous page.
  await field.pressSequentially('rhmp30f[');
  await expect(field).toBeFocused();
  await expect(palette(page)).toHaveCount(0);
  await expect(grid(page)).toHaveCount(0);
  await expect(library(page)).toBeHidden();
  await expect(layer(page)).toHaveAttribute('data-tool', 'select');
}

test.describe('the places, by key', () => {
  test('M and 2 open and close Markup; 1, 3, 0 and 4 go between the places', async ({ page }) => {
    await open(page);
    await viewing(page);
    // The dock names its keys from the registry (F10 §8).
    await expect(dock(page).getByRole('button', { name: 'Markup', exact: true })).toHaveAttribute(
      'aria-keyshortcuts',
      'M 2',
    );
    await expect(dock(page).getByRole('button', { name: /^(Fill & sign|Sign)$/ })).toHaveAttribute(
      'aria-keyshortcuts',
      'G',
    );
    await expect(dock(page).getByRole('button', { name: 'Pages', exact: true })).toHaveAttribute(
      'aria-keyshortcuts',
      '3',
    );

    // M toggles Markup, Select armed; `2` is its alias; `1` closes it.
    await page.keyboard.press('m');
    await expect(palette(page)).toBeVisible();
    await expect(layer(page)).toHaveAttribute('data-input', 'markup-select');
    await page.keyboard.press('m');
    await viewing(page);
    await page.keyboard.press('2');
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press('2');
    await viewing(page);
    await page.keyboard.press('m');
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press('1');
    await viewing(page);

    // `3` the Pages grid, `1` back to the page; again from Markup.
    await page.keyboard.press('3');
    await expect(grid(page)).toBeVisible();
    await page.keyboard.press('1');
    await viewing(page);
    await page.keyboard.press('m');
    await page.keyboard.press('3');
    await expect(grid(page)).toBeVisible();
    await page.keyboard.press('1');
    await viewing(page);

    // `0` the Library, `1` the document again, in viewing.
    await page.keyboard.press('0');
    await expect(library(page)).toBeVisible();
    await page.keyboard.press('1');
    await expect(library(page)).toBeHidden();
    await viewing(page);

    // `4` Compare (one document open: its chooser); `4` again does nothing; `1` closes it.
    await page.keyboard.press('4');
    const setup = page.getByTestId('compare-setup');
    await expect(setup).toBeVisible();
    await page.keyboard.press('4');
    await expect(setup).toBeVisible();
    await page.keyboard.press('1');
    await expect(setup).toHaveCount(0);
    await viewing(page);
  });

  test('Shift+R rotates the current page with Undo; R is inert in the grid', async ({ page }) => {
    await open(page);
    // Undo undoes the opening until something changes.
    const opened = await undoDescription(page);

    // In the grid, with a page selected: R neither rotates nor arms (flows §7.3).
    await page.keyboard.press('3');
    await grid(page)
      .getByRole('gridcell')
      .first()
      .click({ modifiers: ['ControlOrMeta'] });
    await page.keyboard.press('r');
    await page.waitForTimeout(300);
    await expect(grid(page)).toBeVisible();
    expect(await undoDescription(page)).toBe(opened);
    await page.keyboard.press('1');
    await viewing(page);

    // Reading, nothing selected: the current page turns, said with Undo (S18).
    await page.locator('[data-read-viewport]').focus();
    await page.keyboard.press('Shift+R');
    const rotated = page.getByRole('group', { name: /^Rotated page 1 right/ });
    await expect(rotated).toBeVisible();
    await expect.poll(() => undoDescription(page)).not.toBe(opened);
    await rotated.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => undoDescription(page)).toBe(opened);
    await viewing(page);
  });

  test('the first 1 on a device that ran M8 says that 1 no longer locks, once', async ({
    page,
  }) => {
    // M8's panel layout, which M9 reads once and leaves where it was.
    await page.addInitScript(() => {
      localStorage.setItem('pdf-editor:ui:v2', JSON.stringify({ leftPanelOpen: false }));
    });
    await open(page);
    await page.keyboard.press('m');
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press('1');
    const notice = page.getByTestId('keymap-notice');
    await expect(notice).toContainText(
      '1 now returns to viewing. To lock a document, use Lock in its title menu.',
    );
    await viewing(page);
    await notice.getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice).toHaveCount(0);
    await page.keyboard.press('m');
    await page.keyboard.press('1');
    await viewing(page);
    await expect(notice).toHaveCount(0);
  });
});

test.describe('no key arms a tool while focus is in a field', () => {
  test('Find', async ({ page }) => {
    await open(page);
    const find = await openFindPanel(page);
    await typeKeys(page, find);
    await expect(find).toHaveValue('rhmp30f[');
  });

  test('the title menu’s name field (rename)', async ({ page }) => {
    await open(page);
    const tab = page.getByRole('tab', { name: /^simple-text/ });
    await tab.click();
    await tab.press('F2');
    const name = page.getByTestId('title-menu-name');
    await expect(name).toBeFocused();
    await name.press('End');
    await typeKeys(page, name);
    await expect(name).toHaveValue(/rhmp30f\[$/);
  });

  test('a form field in viewing', async ({ page }) => {
    await open(page, 'forms-a.pdf');
    const target = page.locator('[data-form-layer="0"] [data-field-name="name"]');
    await expect(target).toBeVisible({ timeout: 20_000 });
    await target.click();
    const field = page.locator('[data-form-editor="name"]');
    await expect(field).toBeFocused();
    await field.press('End');
    await typeKeys(page, field);
    await expect(field).toHaveValue('Alice Examplerhmp30f[');
    await expect(dock(page)).toBeVisible();
  });
});

test.describe('the shortcuts overlay lists the map', () => {
  for (const lang of ['en', 'tr'] as const) {
    test(`in its groups, with keycaps (${lang})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, 'simple-text.pdf', lang);
      await page.keyboard.press('?');
      const t = TEXT[lang];
      const overlay = page.getByRole('dialog', { name: t.title });
      await expect(overlay).toBeVisible();
      for (const group of t.groups) {
        await expect(overlay.getByRole('heading', { name: group, exact: true })).toBeVisible();
      }
      const places = overlay.getByRole('table', { name: t.groups[0] });
      await expect(places.getByRole('rowheader')).toHaveText(t.places);
      const markup = places.getByRole('row').filter({ hasText: t.places[2] });
      await expect(markup.locator('kbd')).toHaveText(['M', '2']);
      // Shift+R and Shift+Alt+R in Pages, with the platform's modifier names.
      const pages = overlay.getByRole('table', { name: t.groups[3] });
      await expect(
        pages.getByRole('row').filter({ hasText: t.rotateRight }).locator('kbd'),
      ).toHaveText(process.platform === 'darwin' ? ['⇧', 'R'] : ['Shift', 'R']);
      await expect(overlay.getByText(t.footer)).toBeVisible();
      await page.mouse.move(2, 450);
      await overlay.evaluate((el) =>
        Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
      );
      await page.screenshot({ path: testInfo.outputPath(`shortcuts-overlay-${lang}.png`) });
      // The rest of the map, for the design review: On a selection, Pages, Commands, History.
      for (const [index, heading] of [
        [1, t.groups[2]],
        [2, t.groups[7]],
      ] as const) {
        await overlay.getByRole('heading', { name: heading, exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath(`shortcuts-overlay-${lang}-${index}.png`),
        });
      }
      // Typing filters to the rows that hold the words.
      await page.keyboard.type(t.query);
      await expect(places.getByRole('rowheader')).toHaveText([t.places[2]]);
      await page.keyboard.press('Escape');
      await expect(overlay).toHaveCount(0);
    });
  }
});

const TEXT = {
  en: {
    title: 'Keyboard shortcuts',
    groups: ['Places', 'Tools', 'On a selection', 'Pages', 'Files', 'View', 'Commands', 'History'],
    places: ['Library', 'Back to viewing', 'Open or close Markup', 'Pages grid', 'Compare'],
    rotateRight: 'Rotate pages right',
    footer: 'Shortcuts never fire while you type in a field.',
    query: 'close markup',
  },
  tr: {
    title: 'Klavye kısayolları',
    groups: [
      'Yerler',
      'Araçlar',
      'Seçili metinde',
      'Sayfalar',
      'Dosyalar',
      'Görünüm',
      'Komutlar',
      'Geçmiş',
    ],
    places: [
      'Kitaplık',
      'Görüntülemeye dön',
      'İşaretlemeyi aç veya kapat',
      'Sayfa ızgarası',
      'Karşılaştır',
    ],
    rotateRight: 'Sayfaları sağa döndür',
    footer: 'Bir alana yazarken kısayollar çalışmaz.',
    query: 'aç veya kapat',
  },
} as const;
