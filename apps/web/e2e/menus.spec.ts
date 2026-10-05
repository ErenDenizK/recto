/**
 * Menus keep to the window and hand over to sheets cleanly (the menu recipe,
 * `ui/Menu.module.css`; quality-bar Q-7; experience review XD-3):
 *
 * - **Room.** A menu taller than the room its positioner has (the Document menu: 922 px of rows
 *   in a 900 px window, more at 44 px rows on a tablet) stays inside the window and scrolls in
 *   its glass; the keyboard reaches its last item ("About this app"), which scrolls into view.
 * - **Hand-off.** Choosing an item that opens a sheet closes the menu at once: no frame shows
 *   the closing menu over the entering sheet (`ui/menu-handoff.ts`).
 *
 * Runs on the desktop projects at 1440 × 900 and on the `tablet` project at its own size.
 */
import { expect, type Page, test } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';

const TOUCH = new Set(['tablet', 'phone', 'phone-land']);

async function openDocument(page: Page, project: string): Promise<void> {
  if (!TOUCH.has(project)) await page.setViewportSize({ width: 1440, height: 900 });
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, ['simple-text.pdf']);
}

test.describe('the Document menu', () => {
  test('stays inside the window and scrolls; the keyboard reaches its last item', async ({
    page,
  }, info) => {
    await openDocument(page, info.project.name);
    // A shorter window than the menu, on the desktop projects (the tablet's rows are 44 px).
    if (!TOUCH.has(info.project.name)) await page.setViewportSize({ width: 1440, height: 700 });
    await page.getByTestId('document-menu').focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Document' });
    await expect(menu).toBeVisible();
    const fit = await menu.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        height: window.innerHeight,
        scrolls: el.scrollHeight > el.clientHeight + 1,
        overflowY: getComputedStyle(el).overflowY,
      };
    });
    expect(fit.top).toBeGreaterThanOrEqual(0);
    expect(fit.bottom).toBeLessThanOrEqual(fit.height);
    expect(fit.scrolls, 'the menu is taller than the window here').toBe(true);
    expect(fit.overflowY).toBe('auto');

    // Up from the first item wraps to the last, which scrolls into the menu's view.
    const last = menu.getByRole('menuitem', { name: 'About this app' });
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(last).toBeFocused();
    await expect
      .poll(() =>
        last.evaluate((item) => {
          const scroller = item.closest('[role="menu"]');
          if (!scroller) return false;
          const box = item.getBoundingClientRect();
          const view = scroller.getBoundingClientRect();
          return box.top >= view.top - 0.5 && box.bottom <= view.bottom + 0.5;
        }),
      )
      .toBe(true);
    // And it is a plain scroll: the first row is out of view now.
    await expect.poll(() => menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('an item that opens a sheet closes the menu at once, never over the sheet', async ({
    page,
  }, info) => {
    await openDocument(page, info.project.name);
    const trigger = page.getByTestId('document-menu');
    const item = page.getByRole('menuitem', { name: /^Save a copy/ });
    const sheet = page.getByTestId('save-copy-sheet');
    // The first open loads the sheet's code; the hand-off is measured on the second.
    await trigger.click();
    await item.click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    await trigger.click();
    await expect(page.getByRole('menu', { name: 'Document' })).toBeVisible();
    // Every frame from before the press until the sheet has been in for 20 frames: a frame
    // where the closing menu still shows (any opacity) with the sheet in the document is a
    // double exposure.
    const watching = page.evaluate(
      () =>
        new Promise<{ readonly both: number; readonly sheetSeen: boolean }>((resolve) => {
          let both = 0;
          let withSheet = 0;
          const end = performance.now() + 10_000;
          const tick = () => {
            const menu = document.querySelector<HTMLElement>('[role="menu"]');
            const panel = document.querySelector('[data-testid="save-copy-sheet"]');
            if (panel) withSheet += 1;
            if (menu && panel && Number(getComputedStyle(menu).opacity) > 0.01) both += 1;
            if (withSheet < 20 && performance.now() < end) requestAnimationFrame(tick);
            else resolve({ both, sheetSeen: withSheet > 0 });
          };
          requestAnimationFrame(tick);
        }),
    );
    await item.click();
    const seen = await watching;
    expect(seen.sheetSeen).toBe(true);
    expect(seen.both, 'frames with the menu over the sheet').toBe(0);
    await expect(sheet).toBeVisible();
  });
});
