/**
 * Editing text on phones (M10 WP5, EDN-17; design/phone-2026-10/README.md §3 row 1, §4), on the
 * `phone` project with CDP touch, on the sample (`?sample`): Edit text arms from the drawer; a
 * tap on a paragraph puts the focus in an editable at once, inside the tap (the stand-in that
 * makes iOS raise the keyboard), and the paragraph editor's mirror takes it over once laid out,
 * in 16 px at least; the island steps away for the keyboard's Done; typing and Done commit the
 * paragraph (the page's text reads the new word); the island's Undo takes it back.
 *
 * What only an iPhone can show (the keyboard really rising in the tap and staying up as the
 * focus moves to the mirror, Safari's own panning) is in the owner's hand check.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (editing a paragraph, Turkish,
 * dark and light, over a simulated keyboard).
 */
import { join } from 'node:path';

import { type CDPSession, expect, type Page, test } from '@playwright/test';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;
const WORD = 'Brightly';

async function shot(page: Page, name: string, settle = 400): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  if (settle > 0) await page.waitForTimeout(settle);
  const scheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  const lang = await page.evaluate(() => document.documentElement.lang || 'en');
  await page.screenshot({
    path: join(SHOTS, `D-edit-text-${name}-${lang}-${scheme}-${size?.width}x${size?.height}.png`),
  });
}

async function openSample(page: Page, lang = 'en'): Promise<void> {
  await page.goto(`./?sample&lang=${lang}`);
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

const capsule = (page: Page) => page.getByTestId('compact-capsule');
const undo = (page: Page) => page.getByTestId('compact-undo');
const mirror = (page: Page) => page.locator('[data-paragraph-mirror]');
const pageText = (page: Page) => page.locator('[data-page-index="0"] [data-text-layer]');

/** Enters editing and arms Edit text from the drawer (its tile is live, not "Soon"). */
async function armEditText(page: Page): Promise<void> {
  await page.getByTestId('compact-edit').click();
  await expect(capsule(page)).toHaveAttribute('data-editing');
  await page.getByTestId('compact-tool-more').click();
  const drawer = page.getByTestId('compact-tool-drawer');
  const tile = drawer.getByRole('button', { name: /^(Edit text|Metni düzenle)$/ });
  await expect(tile).not.toHaveAttribute('aria-disabled', 'true');
  await tile.click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId('compact-tool-chip')).toHaveAccessibleName(
    /^(Edit text|Metni düzenle)$/,
  );
}

async function tap(cdp: CDPSession, at: { x: number; y: number }): Promise<void> {
  const point = { ...at, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/**
 * A point at the start of the sample's first body paragraph on page 1 ("Recto reads, marks up",
 * in Turkish "Recto, PDF'leri"): its first text-layer line.
 */
async function paragraphPoint(page: Page): Promise<{ x: number; y: number }> {
  const line = pageText(page)
    .locator('span')
    .filter({ hasText: /^Recto(,| reads)/ })
    .first();
  await expect(line).toBeVisible();
  const box = await line.boundingBox();
  if (!box) throw new Error('no paragraph line on screen');
  return { x: box.x + 2, y: box.y + box.height / 2 };
}

/** The active element is an editable now: the stand-in or the mirror itself. */
async function editableFocused(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    return el instanceof HTMLElement && el.isContentEditable;
  });
}

/** A keyboard `height` px tall: the visual viewport shrinks by it (as on iOS), then reports. */
async function simulateKeyboard(page: Page, height: number): Promise<void> {
  await page.evaluate((h) => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    Object.defineProperty(viewport, 'height', {
      configurable: true,
      get: () => window.innerHeight - h,
    });
    viewport.dispatchEvent(new Event('resize'));
  }, height);
}

test.describe('editing text on phones (M10 WP5)', () => {
  test('tap a paragraph, type, Done commits it, Undo takes it back', async ({ page }) => {
    await openSample(page);
    await armEditText(page);

    const cdp = await page.context().newCDPSession(page);
    const at = await paragraphPoint(page);
    await tap(cdp, at);
    // The focus is in an editable as the tap returns: iOS raises the keyboard only for that.
    expect(await editableFocused(page)).toBe(true);

    // The paragraph editor opens and its mirror takes the focus over, set in 16 px at least.
    await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
    await expect(page.locator('[data-keyboard-hold]')).toHaveCount(0);
    const px = await mirror(page).evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).fontSize),
    );
    expect(px).toBeGreaterThanOrEqual(16);
    await expect(page.getByTestId('paragraph-header')).toContainText('Tap Done to apply');
    // The island steps away; Done rides where the keyboard will be.
    await expect(capsule(page)).toHaveAttribute('data-hidden');
    await expect(page.getByTestId('compact-edit-text-bar')).toBeVisible();

    const before = (await mirror(page).textContent()) ?? '';
    await page.keyboard.type(`${WORD} `);
    await expect(mirror(page)).toHaveText(new RegExp(`^${WORD} `));
    expect(((await mirror(page).textContent()) ?? '').length).toBe(before.length + WORD.length + 1);

    // A keyboard rises: Done stays above it and the paragraph above Done.
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    const keyboard = Math.round(view.height * 0.4);
    await simulateKeyboard(page, keyboard);
    await expect
      .poll(async () => (await page.getByTestId('compact-edit-text-bar').boundingBox())?.y ?? 0)
      .toBeLessThan(view.height - keyboard);
    const doneBox = await page.getByTestId('compact-edit-text-done').boundingBox();
    expect(doneBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Done commits: the editor closes, the island comes back, the page reads the new word.
    await page.getByTestId('compact-edit-text-done').click();
    await expect(mirror(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');
    await expect(pageText(page)).toContainText(WORD, { timeout: 20_000 });
    await expect(undo(page)).not.toHaveAttribute('aria-disabled', 'true');

    // Undo takes the paragraph back.
    await undo(page).click();
    await expect(pageText(page)).not.toContainText(WORD, { timeout: 20_000 });
    await expect(undo(page)).toHaveAttribute('aria-disabled', 'true');

    // Done on the island leaves editing.
    await page.getByTestId('compact-edit-done').click();
    await expect(capsule(page)).not.toHaveAttribute('data-editing');
  });

  test('a tap off the text holds no keyboard; Done on an unchanged paragraph writes nothing', async ({
    page,
  }) => {
    await openSample(page);
    await armEditText(page);
    const cdp = await page.context().newCDPSession(page);

    // A gap between pages is not a paragraph: nothing takes the focus.
    const first = await page.locator('[data-page-index="0"]').boundingBox();
    if (!first) throw new Error('no page');
    await tap(cdp, { x: first.x + first.width / 2, y: first.y + first.height + 4 });
    expect(await editableFocused(page)).toBe(false);

    // A paragraph opens; Done leaves it unchanged, with no history entry.
    await tap(cdp, await paragraphPoint(page));
    await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
    await page.getByTestId('compact-edit-text-done').click();
    await expect(mirror(page)).toHaveCount(0);
    await expect(undo(page)).toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('the selection bar’s Edit text (M10 WP5)', () => {
  test('opens the selected paragraph with the focus taken in the press', async ({ page }) => {
    await openSample(page);
    const bar = page.getByTestId('compact-selection-bar');
    // The bar's watch comes with the edit chunk, fetched when the browser is idle.
    await expect(async () => {
      await page.evaluate(() => {
        const span = [
          ...document.querySelectorAll('[data-page-index="0"] [data-text-layer] span'),
        ].find((el) => (el.textContent ?? '').startsWith('Recto reads'));
        if (!span) throw new Error('no paragraph line');
        const range = document.createRange();
        range.selectNodeContents(span);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
      });
      await expect(bar).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    const cdp = await page.context().newCDPSession(page);
    const button = await bar.getByRole('button', { name: 'Edit text' }).boundingBox();
    if (!button) throw new Error('no Edit text');
    await tap(cdp, { x: button.x + button.width / 2, y: button.y + button.height / 2 });
    expect(await editableFocused(page)).toBe(true);
    await expect(capsule(page)).toHaveAttribute('data-editing');
    await expect(page.getByTestId('compact-tool-chip')).toHaveAccessibleName('Edit text');
    await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
    await expect(mirror(page)).toHaveText(/^Recto reads/);
    await page.getByTestId('compact-edit-text-done').click();
    await expect(mirror(page)).toHaveCount(0);
  });
});

/** The review set (CAPTURE_SCREENSHOTS only): a paragraph being edited, Turkish, both schemes. */
for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`edit text review captures, tr ${colorScheme}`, () => {
    test.use({ colorScheme, deviceScaleFactor: 2 });

    test('captures', async ({ page }) => {
      test.skip(!SHOTS, 'screenshots only');
      await openSample(page, 'tr');
      await armEditText(page);
      const cdp = await page.context().newCDPSession(page);
      await tap(cdp, await paragraphPoint(page));
      await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
      await page.keyboard.type('Parlak ');
      await shot(page, 'typing', 1200);
      const view = page.viewportSize() ?? { width: 390, height: 844 };
      const keyboard = Math.round(view.height * 0.4);
      await simulateKeyboard(page, keyboard);
      // A grey stand-in where the keyboard would be, for the review only.
      await page.evaluate((h) => {
        const stand = document.createElement('div');
        stand.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${h}px;background:#8e8e93;z-index:99;`;
        document.body.append(stand);
      }, keyboard);
      await shot(page, 'keyboard', 1200);
    });
  });
}
