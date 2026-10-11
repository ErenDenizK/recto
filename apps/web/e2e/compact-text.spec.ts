/**
 * Adding text on phones (M10 WP4; design/phone-2026-10/README.md §3 row 2, §4), on the `phone`
 * and `phone-land` projects with CDP touch: Text's options in the drawer; a tap places a box
 * whose field has the focus at once (the keyboard's cue) in a 16 px font; the island steps away
 * for the keyboard's Done; a keyboard (simulated: the visual viewport shrinks) never covers the
 * box; Done commits, a tap on the box edits it again, an empty box is dropped; Undo removes
 * the box and the text comes back after Done and a reload.
 *
 * What only an iPhone can show (the keyboard really opening in the tap, Safari's own panning,
 * the accessory riding on the keyboard while it animates) is in the owner's hand check.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (drawer with Text's options,
 * placing, typing, typing over a simulated keyboard).
 */
import { join } from 'node:path';

import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker, waitForSnapshot } from './helpers';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

async function shot(page: Page, name: string, settle = 400): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  if (settle > 0) await page.waitForTimeout(settle);
  const scheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  const lang = await page.evaluate(() => document.documentElement.lang || 'en');
  await page.screenshot({
    path: join(SHOTS, `text-${name}-${lang}-${scheme}-${size?.width}x${size?.height}.png`),
  });
}

async function openReader(page: Page, lang = 'en'): Promise<void> {
  await useFileInputPicker(page);
  await page.goto(`./?lang=${lang}`);
  await expect(page.getByTestId('compact-library')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await waitForPage(page);
}

async function waitForPage(page: Page): Promise<void> {
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

const capsule = (page: Page) => page.getByTestId('compact-capsule');
const undo = (page: Page) => page.getByTestId('compact-undo');
const field = (page: Page) => page.locator('[data-annotation-layer] textarea');
const boxes = (page: Page) => page.locator('[data-annotation-kind="free-text"]');
const textBar = (page: Page) => page.getByTestId('compact-text-bar');

/** Enters editing and arms Text from the drawer (its options show there first). */
async function armText(page: Page): Promise<void> {
  await page.getByTestId('compact-edit').click();
  await expect(capsule(page)).toHaveAttribute('data-editing');
  await page.getByTestId('compact-tool-more').click();
  const drawer = page.getByTestId('compact-tool-drawer');
  await drawer.getByRole('button', { name: /^(Text|Metin)$/ }).click();
  await expect(drawer).toHaveCount(0);
}

/** A point on the first page's blank lower half, clear of the text. */
async function blankPoint(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('[data-page-index="0"]').boundingBox();
  if (!box) throw new Error('no page');
  const view = page.viewportSize() ?? { width: 390, height: 844 };
  const bottom = Math.min(box.y + box.height, view.height - 140);
  return { x: box.x + box.width * 0.15, y: bottom - 60 };
}

async function tap(cdp: CDPSession, at: { x: number; y: number }): Promise<void> {
  const point = { ...at, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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

async function rootVar(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name);
}

test.describe('adding text on phones (M10 WP4)', () => {
  test('place, type over a keyboard, Done, edit again, undo, and keep after a reload', async ({
    page,
  }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await openReader(page);
    await armText(page);
    await expect(page.getByTestId('compact-tool-chip')).toHaveAccessibleName('Text');

    // The drawer shows Text's sizes and colours; Large is chosen and kept.
    await page.getByTestId('compact-tool-more').click();
    const options = page.getByTestId('compact-text-options');
    await expect(options).toBeVisible();
    await options.getByRole('radio', { name: 'Large' }).click();
    await expect(options.getByRole('radio', { name: 'Large' })).toBeChecked();
    await options.getByRole('radio', { name: 'Small' }).click();
    await page.getByTestId('compact-drawer-scrim').dispatchEvent('pointerdown');
    await expect(page.getByTestId('compact-tool-drawer')).toHaveCount(0);

    // A tap places a box with the focus already in its field, set in 16 px at least.
    const cdp = await page.context().newCDPSession(page);
    const at = await blankPoint(page);
    await tap(cdp, at);
    await expect(field(page)).toBeFocused();
    const px = await field(page).evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    expect(px).toBeGreaterThanOrEqual(16);
    // The island steps away; the keyboard's Done takes its place.
    await expect(capsule(page)).toHaveAttribute('data-hidden');
    await expect(textBar(page)).toBeVisible();
    await page.keyboard.type('Hello phone');

    // A keyboard rises: the Done bar sits on it and the box stays above the bar.
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    const keyboard = Math.round(view.height * 0.4);
    await simulateKeyboard(page, keyboard);
    await expect.poll(() => rootVar(page, '--kb-inset')).toBe(`${keyboard}px`);
    await expect
      .poll(async () => (await textBar(page).boundingBox())?.y ?? 0)
      .toBeLessThan(view.height - keyboard);
    await expect
      .poll(async () => {
        const box = await field(page).boundingBox();
        const bar = await textBar(page).boundingBox();
        return box && bar ? bar.y - (box.y + box.height) : -1;
      })
      .toBeGreaterThanOrEqual(0);
    await expect(field(page)).toBeFocused();

    // Done commits the box; the island comes back.
    await page.getByTestId('compact-text-done').click();
    await expect(field(page)).toHaveCount(0);
    await expect(textBar(page)).toHaveCount(0);
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');
    await expect(boxes(page)).toHaveCount(1);
    await expect(undo(page)).not.toHaveAttribute('aria-disabled', 'true');
    expect(await rootVar(page, '--kb-inset')).toBe('');

    // A tap on the box edits it again, with its text.
    const hit = await boxes(page).boundingBox();
    if (!hit) throw new Error('no box');
    await tap(cdp, { x: hit.x + 4, y: hit.y + hit.height / 2 });
    await expect(field(page)).toBeFocused();
    await expect(field(page)).toHaveValue('Hello phone');
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await page.getByTestId('compact-text-done').click();
    await expect(field(page)).toHaveCount(0);
    await expect(boxes(page)).toHaveCount(1);

    // An empty box is dropped.
    const empty = { x: at.x, y: at.y - 120 };
    await tap(cdp, empty);
    await expect(field(page)).toBeFocused();
    await page.getByTestId('compact-text-done').click();
    await expect(field(page)).toHaveCount(0);
    await expect(boxes(page)).toHaveCount(1);

    // Undo takes the edit and then the box away; Redo brings both back.
    await undo(page).click();
    await undo(page).click();
    await expect(boxes(page)).toHaveCount(0);
    await expect(undo(page)).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('compact-redo').click();
    await page.getByTestId('compact-redo').click();
    await expect(boxes(page)).toHaveCount(1);

    // Done keeps it on the device: after a reload, editing shows the box again.
    await page.getByTestId('compact-edit-done').click();
    await expect(capsule(page)).not.toHaveAttribute('data-editing');
    await waitForSnapshot(page);
    await page.reload();
    await waitForPage(page);
    await page.getByTestId('compact-edit').click();
    await expect(capsule(page)).toHaveAttribute('data-editing');
    await expect(boxes(page)).toHaveCount(1);
  });
});

/**
 * The review set (CAPTURE_SCREENSHOTS only): the drawer on Text, a placed box, typing, and
 * typing over a simulated keyboard, in English and Turkish, dark and light.
 */
for (const lang of ['en', 'tr'] as const) {
  for (const colorScheme of ['dark', 'light'] as const) {
    test.describe(`text review captures, ${lang} ${colorScheme}`, () => {
      test.use({ colorScheme });

      test('captures', async ({ page }) => {
        test.skip(!SHOTS, 'screenshots only');
        await openReader(page, lang);
        await armText(page);
        await page.getByTestId('compact-tool-more').click();
        await shot(page, 'drawer', 800);
        await page.getByTestId('compact-drawer-scrim').dispatchEvent('pointerdown');
        await expect(page.getByTestId('compact-tool-drawer')).toHaveCount(0);
        const cdp = await page.context().newCDPSession(page);
        await tap(cdp, await blankPoint(page));
        await expect(field(page)).toBeFocused();
        await shot(page, 'placing', 500);
        await page.keyboard.type(lang === 'en' ? 'Signed copy attached' : 'İmzalı kopya ekte');
        await shot(page, 'typing');
        const view = page.viewportSize() ?? { width: 390, height: 844 };
        const keyboard = Math.round(view.height * 0.4);
        await simulateKeyboard(page, keyboard);
        // A grey stand-in where the keyboard would be, for the review only.
        await page.evaluate((h) => {
          const stand = document.createElement('div');
          stand.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${h}px;background:#8e8e93;z-index:99;`;
          document.body.append(stand);
        }, keyboard);
        await shot(page, 'keyboard', 600);
      });
    });
  }
}
