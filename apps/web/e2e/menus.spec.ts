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

import { atRest, openFixtures, useFileInputPicker } from './helpers';

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
          // What shows of the menu: its opacity times its ancestors' (the title menu's list sits
          // in a popover, which fades as a whole and stays mounted for its exit's last frame).
          const shown = (el: Element | null): number => {
            let o = 1;
            for (let at = el; at; at = at.parentElement) o *= Number(getComputedStyle(at).opacity);
            return o;
          };
          const tick = () => {
            const menu = document.querySelector<HTMLElement>('[role="menu"]');
            const panel = document.querySelector('[data-testid="save-copy-sheet"]');
            if (panel) withSheet += 1;
            if (menu && panel && shown(menu) > 0.01) both += 1;
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

/**
 * Pop-ups fit (owner feedback 2026-10-08, F2: "some pop-ups do not fit"): every popover, menu
 * and sheet stays inside the visual viewport and scrolls inside, its header kept. The privacy
 * panel was the one seen running off a tablet's bottom edge.
 */
test.describe('pop-ups fit the window', () => {
  const SIZES = [
    { width: 1180, height: 820 },
    { width: 1024, height: 768 },
    // Shorter than the privacy panel: it must scroll inside, its title kept.
    { width: 1024, height: 560 },
  ];

  async function inside(page: Page, selector: string, what: string): Promise<void> {
    const box = await page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`${what}: not laid out`);
    const view = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    }));
    expect(box.y, `${what}: top`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${what}: bottom`).toBeLessThanOrEqual(view.height + 0.5);
    expect(box.x, `${what}: left`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${what}: right`).toBeLessThanOrEqual(view.width + 0.5);
  }

  test('privacy, the title menu, the page pill menu, Move to and Settings', async ({
    page,
  }, info) => {
    test.skip(TOUCH.has(info.project.name), 'sizes desktop windows');
    test.setTimeout(120_000);
    await openDocument(page, info.project.name);
    for (const size of SIZES) {
      await page.setViewportSize(size);
      const at = `${size.width} × ${size.height}`;

      await page.getByTestId('privacy-indicator').click();
      const privacy = page.getByRole('dialog', { name: 'Nothing has left this device' });
      await expect(privacy).toBeVisible();
      // Its open spring has settled (the scale ends at exactly 1; G6). It grows from its trigger
      // and a re-measure retargets it by cancelling the running animation (motion-2026-10/
      // platform.md §1), whose `finished` then rejects: wait for rest instead.
      await atRest(privacy);
      await inside(page, '[role="dialog"]', `${at}: privacy`);
      // Its body scrolls under the title: the last line (the version) is reachable, and the
      // title stays where it was.
      const title = privacy.getByRole('heading', { name: 'Nothing has left this device' });
      const before = await title.boundingBox();
      const version = privacy.getByTestId('privacy-version');
      await version.scrollIntoViewIfNeeded();
      await expect(version).toBeInViewport();
      expect(await title.boundingBox(), `${at}: the title stays`).toEqual(before);
      await page.keyboard.press('Escape');
      await expect(privacy).toBeHidden();

      await page.getByTestId('document-menu').click();
      await expect(page.getByTestId('title-menu')).toBeVisible();
      await page.waitForTimeout(300);
      await inside(page, '[data-testid="title-menu"]', `${at}: title menu`);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('title-menu')).toHaveCount(0);

      await page.getByTestId('page-pill').click();
      await expect(page.getByTestId('page-pill-menu')).toBeVisible();
      await page.waitForTimeout(300);
      await inside(page, '[data-testid="page-pill-menu"]', `${at}: page pill menu`);
      // It scrolls vertically only (DSN-9): nothing inside is wider than it.
      const sideways = await page
        .getByTestId('page-pill-menu')
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(sideways, `${at}: page pill menu scrolls sideways`).toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('page-pill-menu')).toHaveCount(0);
    }

    // Move to ▾ on the Pages bar (shed into More when the bar is short of room).
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.locator('body').press('3');
    const cell = page.getByTestId('light-table').getByRole('gridcell').nth(1);
    await cell.click({ modifiers: ['ControlOrMeta'] });
    const pagesBar = page.getByTestId('pages-bar');
    await expect(pagesBar).toContainText('1 selected');
    const moveTo = pagesBar.getByRole('button', { name: /^Move to/ });
    if ((await moveTo.count()) > 0) await moveTo.click();
    else await pagesBar.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.waitForTimeout(300);
    await inside(page, '[role="menu"]', 'Move to');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // Settings in a short window.
    await page.setViewportSize({ width: 1024, height: 560 });
    await page.locator('body').press('ControlOrMeta+,');
    const settings = page.getByTestId('settings-sheet');
    await expect(settings).toBeVisible();
    await page.waitForTimeout(400);
    await inside(page, '[data-testid="settings-sheet"]', 'Settings');
  });
});
