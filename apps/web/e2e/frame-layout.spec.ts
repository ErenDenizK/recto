/**
 * The frame (redesign spec D2-1; components/01-frame.md F1–F13): the free rectangle per size
 * class with the sidebar open and closed (A-12: every jump lands inside it and under no glass),
 * the short viewport at 320 × 256 (A-20: chrome at most a quarter of the window), hide on scroll
 * on compact windows (F12), Focus (F13), and the jobs J2, J15a and J16 through the frame.
 *
 * Runs on `chromium` (fine pointer; the classes by window size, with `?edition=full` so a narrow
 * window keeps the full edition) and `tablet` (coarse, 820 × 1180, the medium class).
 */
import { expect, type Page, test } from '@playwright/test';

import { fixturePath, openFixtures, sessionSettled, useFileInputPicker } from './helpers';

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The free rectangle the frame publishes (`--free-*` on :root, frame-insets.ts). */
async function freeRect(page: Page): Promise<Rect> {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const px = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    return {
      left: px('--free-left'),
      top: px('--free-top'),
      right: window.innerWidth - px('--free-right'),
      bottom: window.innerHeight - px('--free-bottom'),
    };
  });
}

/** The frame's glass and docked surfaces at rest: strip or bar, dock, pill, docked sidebar. */
async function chromeRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '[data-region="top"], [data-frame-layer="band"] [data-region="toolbar"], [data-region="pill"], [data-frame-layer="sidebar"]',
      ),
    ]
      .filter((el) => el.closest('[inert]') === null && el.getClientRects().length > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }),
  );
}

const intersects = (a: Rect, b: Rect) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5;

/** A-12: `target` lies inside the free rectangle and under none of the frame's surfaces. */
async function expectInFree(page: Page, target: Rect, what: string): Promise<void> {
  const free = await freeRect(page);
  expect(target.top, `${what}: below the strip`).toBeGreaterThanOrEqual(free.top - 0.5);
  expect(target.bottom, `${what}: above the dock band`).toBeLessThanOrEqual(free.bottom + 0.5);
  expect(target.left, `${what}: right of a docked sidebar`).toBeGreaterThanOrEqual(free.left - 0.5);
  expect(target.right, `${what}: inside the right edge`).toBeLessThanOrEqual(free.right + 0.5);
  for (const surface of await chromeRects(page)) {
    // The overlay sidebar (medium) lies over the stage by design; it is a sheet, not chrome. It
    // floats on the piece inset, 16 from the leading edge (system-audit-2026-10 §3.1).
    const overlay = await page
      .locator('[data-frame-layer="sidebar"][data-overlay]')
      .count()
      .then((n) => n > 0);
    if (overlay && surface.left <= 16.5 && surface.top >= free.top - 0.5) continue;
    expect(
      intersects(target, surface),
      `${what}: under the frame at ${JSON.stringify(surface)}`,
    ).toBe(false);
  }
}

async function box(page: Page, selector: string): Promise<Rect> {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`no ${selector}`);
  return { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height };
}

/** The top 40 px of a page: what a jump to it must show (the page itself may be taller). */
async function pageHead(page: Page, index: number): Promise<Rect> {
  const sheet = await box(page, `[data-read-viewport] [data-page-index="${index}"]`);
  return { ...sheet, bottom: Math.min(sheet.bottom, sheet.top + 40) };
}

async function setSidebar(page: Page, open: boolean): Promise<void> {
  const toggle = page.getByTestId('sidebar-toggle');
  if ((await toggle.count()) === 0) return;
  if ((await toggle.getAttribute('aria-pressed')) !== String(open)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(open));
}

/** Opens files through + (or the Library's Open on a compact window, which has no tabs). */
async function openAny(page: Page, names: readonly string[]): Promise<void> {
  // A reload restores the last session first; Open waits for it.
  await sessionSettled(page);
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Open PDFs…|Dosya aç|PDF aç…)$/ })
    .first()
    .click();
  await (await chooser).setFiles(names.map(fixturePath));
  await expect(page.locator('[data-read-viewport] canvas').first()).toBeVisible({
    timeout: 20_000,
  });
}

const CLASSES = [
  { name: 'compact', width: 560, height: 800 },
  { name: 'expanded', width: 1180, height: 820 },
  { name: 'large', width: 1440, height: 900 },
  { name: 'xlarge', width: 1920, height: 1080 },
] as const;

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
});

test.describe('A-12: jumps land in the free rectangle', () => {
  for (const sidebar of [false, true]) {
    test(`go to page, a Find hit and a Contents entry, sidebar ${sidebar ? 'open' : 'closed'}`, async ({
      page,
    }, info) => {
      test.setTimeout(120_000);
      const classes =
        info.project.name === 'tablet' ? [{ name: 'medium', width: 820, height: 1180 }] : CLASSES;
      for (const size of classes) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.goto('./?lang=en&edition=full');
        await openAny(page, ['outline-named-dests.pdf']);
        await expect(
          page.locator('[data-read-viewport] canvas[data-state="rendered"]').first(),
        ).toBeVisible({ timeout: 20_000 });
        await setSidebar(page, sidebar);
        const at = `${size.name} ${size.width} × ${size.height}`;

        // Go to page (Mod+G, the page pill's menu): page 4's head in the free rectangle.
        await page.keyboard.press('ControlOrMeta+g');
        const field = page.getByRole('textbox', { name: 'Go to page' });
        await field.fill('4');
        await field.press('Enter');
        await expect(page.getByTestId('page-pill')).toHaveText(/^4 \/ 6 · /);
        await page.waitForTimeout(400);
        await expectInFree(page, await pageHead(page, 3), `${at}: go to page 4`);

        // A Find hit (Mod+F): the current hit in the free rectangle.
        await page.keyboard.press('ControlOrMeta+f');
        // The field has focus before the typing starts: letters that land on the page are tool
        // shortcuts (P opens Markup, which hides the pill at the narrow classes), and WebKit
        // moves focus a frame later than Chromium.
        await expect(page.locator('input[type="search"]:focus')).toHaveCount(1);
        await page.keyboard.type('Appendix');
        await page.keyboard.press('Enter');
        const hit = page.locator('[data-testid="search-highlights"] [data-current]').first();
        await expect(hit).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(400);
        await expectInFree(
          page,
          await box(page, '[data-testid="search-highlights"] [data-current]'),
          `${at}: a Find hit`,
        );
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');

        // A Contents entry: the pill's menu names the section and opens the sidebar's Contents
        // (F11 §2), whose entries jump.
        await page.getByTestId('page-pill').click();
        await page.getByTestId('pill-contents').click();
        await page
          .getByRole('tree', { name: /Contents of/ })
          .getByRole('treeitem', { name: /^Chapter 2/ })
          .click();
        await expect(page.getByTestId('page-pill')).toHaveText(/^3 \/ 6 · /);
        await page.waitForTimeout(400);
        await expectInFree(page, await pageHead(page, 2), `${at}: Contents, Chapter 2`);
      }
    });
  }

  test('Tab into a form field lands in the free rectangle', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto('./?lang=en');
    await openFixtures(page, ['forms-a.pdf']);
    const field = page.locator('[data-form-layer="0"] [data-field-name="name"]');
    await expect(field).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-read-viewport]').focus();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const inField = await page.evaluate(
        () => document.activeElement?.closest('[data-form-layer]') !== null,
      );
      if (inField) break;
    }
    const focused = await page.evaluate(() => {
      const r = document.activeElement?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
    });
    expect(focused).not.toBeNull();
    if (focused) await expectInFree(page, focused, 'the first form field');
  });
});

test.describe('the frame per class', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name === 'tablet', 'sizes desktop windows; the tablet runs the jumps');
  });

  test('the strip from medium up, the compact bar below 600 px, the capsule in a short window', async ({
    page,
  }) => {
    await page.goto('./?lang=en&edition=full');
    await openFixtures(page, ['simple-text.pdf']);
    await page.setViewportSize({ width: 1440, height: 900 });
    const top = page.locator('[data-region="top"]');
    await expect(top).toHaveAttribute('aria-label', 'Document bar');
    // Two floating pieces, one piece high (40 px fine, G1) and inset 16 px like the dock (owner
    // feedback F1): the strip's box, the free rectangle's top, is the inset and a piece.
    await expect(top).toHaveCSS('height', '56px');
    await expect(top).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const pieces = top.locator('[data-top-piece]');
    await expect(pieces).toHaveCount(2);
    for (const piece of await pieces.all()) {
      await expect(piece).toHaveCSS('height', '40px');
      const box = await piece.boundingBox();
      expect(box?.y).toBe(16);
    }
    expect((await pieces.first().boundingBox())?.x).toBe(16);
    const trail = await pieces.last().boundingBox();
    expect(trail ? 1440 - (trail.x + trail.width) : 0).toBe(16);
    // The bottom pieces mirror them (G1): the dock and the page pill one piece high, 16 px up
    // from the window's bottom edge, the pill 16 px in from its trailing edge.
    for (const selector of ['[data-capsule]', '[data-testid="page-pill"]']) {
      const box = await page.locator(selector).first().boundingBox();
      expect(box?.height, selector).toBe(40);
      expect(box ? 900 - (box.y + box.height) : 0, selector).toBe(16);
    }
    const pill = await page.getByTestId('page-pill').boundingBox();
    expect(pill ? 1440 - (pill.x + pill.width) : 0).toBe(16);
    await expect(page.getByTestId('sidebar-toggle')).toBeVisible();

    await page.setViewportSize({ width: 560, height: 800 });
    await expect(page.getByTestId('sidebar-toggle')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Library, 1 open document/ })).toBeVisible();
    await expect(page.getByTestId('document-menu')).toHaveText(/simple-text/);
    await expect(page.locator('#left-panel')).toHaveCount(0);

    // A-20 at 320 × 256 (400 % zoom of a 1280 × 1024 window): one 40 px capsule, ≤ 25 % chrome.
    await page.setViewportSize({ width: 320, height: 256 });
    await expect(top).toHaveAttribute('data-tight');
    const area = await page.evaluate(() => {
      let sum = 0;
      for (const el of document.querySelectorAll<HTMLElement>(
        '[data-region="top"], [data-frame-layer="band"] [data-region="toolbar"], [data-region="pill"]',
      )) {
        if (el.getClientRects().length === 0) continue;
        const r = el.getBoundingClientRect();
        sum += r.width * r.height;
      }
      return sum / (window.innerWidth * window.innerHeight);
    });
    expect(area).toBeLessThanOrEqual(0.25);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('hide on scroll on a compact window: away after 24 px down, back on a key (F12)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 560, height: 800 });
    await page.goto('./?lang=en&edition=full');
    await openAny(page, ['many-pages.pdf']);
    const top = page.locator('[data-region="top"]');
    const band = page.locator('[data-frame-layer="band"]');
    await expect(page.locator('[data-read-viewport] canvas').first()).toBeVisible({
      timeout: 20_000,
    });
    // A pointer was the last input (the keyboard keeps the bars, F12 §4).
    await page.mouse.click(280, 400);
    await page.mouse.move(280, 400);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(80);
    }
    await expect(top).toHaveAttribute('inert');
    await expect(band).toHaveAttribute('inert');
    // Up 8 px or more: back.
    await page.mouse.wheel(0, -60);
    await expect(top).not.toHaveAttribute('inert');
    // Away again, then any key shows the bars before it acts.
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(80);
    }
    await expect(top).toHaveAttribute('inert');
    await page.keyboard.press('Shift');
    await expect(top).not.toHaveAttribute('inert');
  });

  test('Focus: F hides the dock and the pill, the strip stays; Esc and the pill menu', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./?lang=en');
    await openFixtures(page, ['simple-text.pdf']);
    const band = page.locator('[data-frame-layer="band"]');
    await page.locator('[data-read-viewport]').focus();
    await page.keyboard.press('f');
    await expect(band).toHaveAttribute('data-away');
    await expect(page.locator('[data-region="top"]')).toBeVisible();
    // The free rectangle's bottom falls to the band's offset.
    expect((await freeRect(page)).bottom).toBe(900 - 16);
    await page.keyboard.press('Escape');
    await expect(band).not.toHaveAttribute('data-away');
    // The touch route: the pill menu's Focus.
    await page.getByTestId('page-pill').click();
    await page.getByTestId('pill-focus').click();
    await expect(band).toHaveAttribute('data-away');
    await page.keyboard.press('f');
    await expect(band).not.toHaveAttribute('data-away');
  });
});

test.describe('jobs through the frame', () => {
  test('J2: open and read page 7 by the pill (2 after opening)', async ({ page }) => {
    await page.goto('./?lang=en');
    await openFixtures(page, ['many-pages.pdf']);
    await page.getByTestId('page-pill').click();
    await page.getByRole('textbox', { name: 'Go to page' }).fill('7');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('page-pill')).toHaveText(/^7 \/ 400 · /);
  });

  test('the pill menu: typing replaces the page; a press keeps the field unfocused', async ({
    page,
    hasTouch,
  }) => {
    // V2 review item 3: the field held "1" unselected, so typing 7 gave 17; and on touch the
    // menu focused the number field, raising the on-screen keyboard over it. A click opens it
    // on the menu too (system-audit-2026-10 I-28: no lime ring at open).
    await page.goto('./?lang=en');
    await openFixtures(page, ['many-pages.pdf']);
    const menu = page.getByTestId('page-pill-menu');
    const field = page.getByRole('textbox', { name: 'Go to page' });
    if (hasTouch) {
      await page.getByTestId('page-pill').tap();
      await expect(menu).toBeFocused();
      await field.tap();
    } else {
      await page.getByTestId('page-pill').click();
      await expect(menu).toBeFocused();
      await field.click();
    }
    await expect(field).toBeFocused();
    await page.keyboard.type('7');
    await expect(field).toHaveValue('7');
    // Fit and layout are both Segmented, never the Select fallback (09 §6.2).
    await expect(menu.getByRole('radiogroup')).toHaveCount(2);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('page-pill')).toHaveText(/^7 \/ 400 · /);
  });

  test('the pill menu’s Fit and layout rows stay Segmented in Turkish', async ({ page }) => {
    await page.goto('./?lang=tr');
    await openFixtures(page, ['many-pages.pdf']);
    await page.getByTestId('page-pill').click();
    const menu = page.getByTestId('page-pill-menu');
    await expect(menu.getByRole('radio', { name: 'İki sayfa' })).toBeVisible();
    await expect(menu.getByRole('radiogroup')).toHaveCount(2);
  });

  test('J15a: Find in three steps (field or ⌕ · type · Enter)', async ({ page }) => {
    await page.goto('./?lang=en');
    await openFixtures(page, ['simple-text.pdf']);
    const field = page.getByRole('searchbox', { name: 'Find in document' }).first();
    if (!(await field.isVisible())) await page.getByRole('button', { name: 'Find' }).click();
    await field.click();
    await field.fill('the');
    await field.press('Enter');
    await expect(page.getByTestId('find-count')).toHaveText(/^\d+ of \d+$/);
    await expect(
      page.locator('[data-testid="search-highlights"] [data-current]').first(),
    ).toBeVisible();
  });

  test('J16: page numbers from the title menu (title ▾ · Page numbers…)', async ({ page }) => {
    await page.goto('./?lang=en');
    await openFixtures(page, ['simple-text.pdf']);
    await page.getByTestId('document-menu').click();
    await page.getByRole('menuitem', { name: 'Page numbers…' }).click();
    await expect(page.getByTestId('furniture-dialog-page-numbers')).toBeVisible();
  });

  test('the Lock switch locks with "You locked it" and the tab shows the padlock', async ({
    page,
  }) => {
    await page.goto('./?lang=en');
    await openFixtures(page, ['simple-text.pdf']);
    await page.getByTestId('document-menu').click();
    const lock = page.getByRole('switch', { name: /Lock/ });
    await lock.click();
    await expect(lock).toBeChecked();
    await expect(page.getByTestId('title-menu').getByText('You locked it')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tab-lock')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'simple-text, locked' })).toBeVisible();
  });
});

test('the sidebar shows only in a document, and as it was stored (moved from home.spec)', async ({
  page,
}, info) => {
  // On the tablet the sidebar is laid over the page and shows only when asked for.
  test.skip(info.project.name === 'tablet', 'docked sidebars only');
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  const panel = page.locator('#left-panel');
  const rail = page.getByRole('tablist', { name: 'Sidebar sections' });
  // No file open: the Library, no sidebar and no ▤ (01-frame F2 §4).
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('sidebar-toggle')).toHaveCount(0);

  // Closed by default (06-navigation N1, 06.17); ▤ opens it on Pages.
  await openFixtures(page, ['simple-text.pdf']);
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('sidebar-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('sidebar-toggle').click();
  await expect(panel).toBeVisible();
  await expect(rail.getByRole('tab', { name: /^Pages/ })).toHaveAttribute('aria-selected', 'true');
  // ▤ closes and opens it.
  await page.getByTestId('sidebar-toggle').click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('sidebar-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('sidebar-toggle').click();
  await expect(panel).toBeVisible();

  // Closing the last file leaves for the Library: no sidebar there.
  await page.getByTitle('Close simple-text').click();
  await expect(panel).toHaveCount(0);
});
