/**
 * Form filling on phones (MOB-1; research phone-2026-10/forms.md §4.4 step 10), on the `phone`
 * and `phone-land` projects with CDP touch, on the sample's contributor agreement (`?sample`,
 * the phone cut's form page from the manifest, MOB-11), in reading (no ✎): the 9 px check box
 * has a 44 px target and ticks on a tap, with an Undo toast; a tap on Your name puts the focus
 * in its editor at once (inside the tap, for the iOS keyboard), laid out at 16 px at least,
 * with the reader zoomed in and the island away for the fill bar; › commits the name and moves
 * to Date; Done commits and ends the flow (the zoom goes back); the toast's Undo takes the last
 * fill back; Save a copy carries the values.
 *
 * What only an iPhone shows (the keyboard rising in the tap and staying up across ‹ ›, no
 * Safari zoom, the form assistant row, the picker) is in the owner's hand check.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (EN and TR, dark and light,
 * over a simulated keyboard).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PDFDocument } from '@cantoo/pdf-lib';
import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test';

import { sampleEntry } from './sample-manifest';

import { motionDone } from './helpers';

/** The form page of the phone cut, 0-based (the same in both languages). */
const FORM_INDEX = sampleEntry('en', 'phone').formPage - 1;
/** The fill bar's stops: one a widget, so the fee's two radios are two. */
const STOPS = sampleEntry('en', 'phone').fields.length + 1;

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

async function shot(page: Page, name: string, settle = 500): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  if (settle > 0) await motionDone(page);
  const scheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  const lang = await page.evaluate(() => document.documentElement.lang || 'en');
  await page.screenshot({
    path: join(SHOTS, `F-forms-${name}-${lang}-${scheme}-${size?.width}x${size?.height}.png`),
  });
}

const target = (page: Page, name: string) =>
  page.locator(`[data-fill-target][data-field-name="${name}"]`);
const editor = (page: Page, name: string) => page.locator(`[data-form-editor="${name}"]`);
const bar = (page: Page) => page.getByTestId('compact-fill-bar');
const capsule = (page: Page) => page.getByTestId('compact-capsule');
const toast = (page: Page) => page.getByTestId('compact-fill-toast');
const zoom = async (page: Page) =>
  Number(await page.getByTestId('compact-pages').getAttribute('data-zoom'));

/** Opens the sample and brings its form page under the top bar. */
async function openForm(page: Page, lang = 'en'): Promise<void> {
  await page.goto(`./?sample&lang=${lang}`);
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
  // Down until the form page is mounted (on its side the phone holds less) and its fields are
  // there.
  await page.evaluate(async (index) => {
    const scroller = document.querySelector<HTMLElement>('[data-read-viewport]');
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const find = () => document.querySelector<HTMLElement>(`[data-page-index="${index}"]`);
    for (let i = 0; i < 60 && scroller && !find(); i++) {
      scroller.scrollTop += scroller.clientHeight / 2;
      await frame();
      await frame();
    }
  }, FORM_INDEX);
  // The field layer arrives with the edit chunk, in reading too.
  await expect(target(page, 'agree')).toHaveCount(1);
  await bringToThird(page, 'name');
}

/**
 * Field `name` a third of the way down: past it, then back up to it, since a scroll up shows
 * the chrome again. (On its side the phone shows the name or the check box, not both.)
 */
async function bringToThird(page: Page, name: string): Promise<void> {
  await page.evaluate(async (field) => {
    const scroller = document.querySelector<HTMLElement>('[data-read-viewport]');
    const target = document.querySelector(`[data-fill-target][data-field-name="${field}"]`);
    if (!scroller || !target) return;
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const top =
      scroller.scrollTop +
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top -
      scroller.clientHeight / 3;
    scroller.scrollTop = top + 80;
    await frame();
    await frame();
    scroller.scrollTop = top;
    await frame();
    await frame();
  }, name);
  await expect(capsule(page)).not.toHaveAttribute('data-hidden', /.*/);
  await expect(target(page, name)).toBeInViewport();
}

async function tap(cdp: CDPSession, at: { x: number; y: number }): Promise<void> {
  const point = { ...at, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
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

async function fontPx(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const size = Number.parseFloat(getComputedStyle(el).fontSize);
    return size;
  });
}

test.describe('form filling on phones (MOB-1)', () => {
  test('tick, fill with the bar, Done, Undo; the copy carries the values', async ({ page }) => {
    await openForm(page);
    const cdp = await page.context().newCDPSession(page);

    // The 9 px check box: a 44 px target, ticked by a tap, in reading.
    await bringToThird(page, 'agree');
    const agree = target(page, 'agree');
    const box = await agree.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(agree).toHaveAttribute('aria-checked', 'false');
    await tap(cdp, await centreOf(agree));
    await expect(agree).toHaveAttribute('aria-checked', 'true');
    await expect(capsule(page)).not.toHaveAttribute('data-editing');
    // Its Undo toast takes the tick back, and a second tap ticks it again.
    await expect(toast(page)).toBeVisible();
    await toast(page).getByRole('button', { name: 'Undo' }).click();
    await expect(agree).toHaveAttribute('aria-checked', 'false');
    await tap(cdp, await centreOf(agree));
    await expect(agree).toHaveAttribute('aria-checked', 'true');

    // A tap on Your name: its editor has the focus at once, at 16 px at least, and the reader
    // zooms.
    await bringToThird(page, 'name');
    const before = await zoom(page);
    await tap(cdp, await centreOf(target(page, 'name')));
    await expect(editor(page, 'name')).toBeFocused();
    expect(await fontPx(editor(page, 'name'))).toBeGreaterThanOrEqual(16);
    await expect(bar(page)).toBeVisible();
    // The tick's toast gives way to the bar.
    await expect(toast(page)).toHaveCount(0);
    await expect(bar(page)).toContainText('Your name');
    await expect(bar(page)).toContainText(`1 of ${STOPS}`);
    // Upright the sample's 11 pt text is under 8 px at fit width; on its side it reads already.
    if ((page.viewportSize()?.width ?? 0) < 600) {
      await expect.poll(() => zoom(page)).toBeGreaterThan(before);
    }
    await expect(capsule(page)).toHaveAttribute('data-hidden', /.*/);
    // An iPhone keyboard: 336 px upright, about 160 px on its side.
    await simulateKeyboard(page, (page.viewportSize()?.height ?? 844) < 600 ? 160 : 336);
    await page.keyboard.type('Ada Lovelace');
    await shot(page, 'name');

    // › commits Name and moves to Date, the keyboard kept (the editor has the focus).
    await page.getByTestId('compact-fill-next').click();
    await expect(editor(page, 'date')).toBeFocused();
    await expect(bar(page)).toContainText(`2 of ${STOPS}`);
    // Kept above the bar riding on the keyboard.
    const field = await editor(page, 'date').boundingBox();
    const barBox = await bar(page).boundingBox();
    expect((field?.y ?? 0) + (field?.height ?? 0)).toBeLessThanOrEqual(barBox?.y ?? 0);
    await page.keyboard.type('14.10.2026');

    // Done: the flow ends, the zoom goes back, and the toast offers Undo for the last fill.
    await page.getByTestId('compact-fill-done').click();
    await expect(bar(page)).toHaveCount(0);
    await expect(editor(page, 'date')).toHaveCount(0);
    await expect.poll(() => zoom(page)).toBeCloseTo(before, 2);
    await expect(toast(page)).toBeVisible();
    await toast(page).getByRole('button', { name: 'Undo' }).click();
    await expect(toast(page)).toHaveCount(0);

    // The copy: Name filled, Date taken back, the box ticked. On its side the zoom's way back
    // may leave the chrome away: a scroll up brings it back.
    await bringToThird(page, 'name');
    // The title's file menu holds the copy (DSN-48).
    await page.getByTestId('compact-title-menu-trigger').click();
    await expect(page.getByTestId('compact-file-menu')).toBeVisible();
    const downloading = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Save a copy' }).click();
    const download = await downloading;
    const pdf = await PDFDocument.load(await readFile(await download.path()));
    const form = pdf.getForm();
    expect(form.getTextField('name').getText()).toBe('Ada Lovelace');
    expect(form.getTextField('date').getText() ?? '').toBe('');
    expect(form.getCheckBox('agree').isChecked()).toBe(true);
  });

  test('a drawing tool wins over the field', async ({ page }) => {
    await openForm(page);
    const cdp = await page.context().newCDPSession(page);
    // ✎ opens with the tool off (MOB-18); the chip arms Pen: the targets let the page through,
    // and a tap on the box is ink.
    await page.getByTestId('compact-edit').click();
    await expect(capsule(page)).toHaveAttribute('data-editing');
    await expect(page.getByTestId('compact-tool-chip')).toHaveAccessibleName('Pen');
    await page.getByTestId('compact-tool-chip').click();
    await expect(page.getByTestId('compact-tool-chip')).toHaveAttribute('aria-pressed', 'true');
    await bringToThird(page, 'agree');
    const at = await centreOf(target(page, 'agree'));
    await tap(cdp, at);
    await motionDone(page);
    await expect(target(page, 'agree')).toHaveAttribute('aria-checked', 'false');
    // The chip off (Select): the field fills again.
    await page.getByTestId('compact-tool-chip').click();
    await tap(cdp, at);
    await expect(target(page, 'agree')).toHaveAttribute('aria-checked', 'true');
    await expect(toast(page)).toHaveCount(0);
  });
});

/** The review set (CAPTURE_SCREENSHOTS only): EN and TR, dark and light. */
for (const colorScheme of ['dark', 'light'] as const) {
  for (const lang of ['en', 'tr'] as const) {
    test.describe(`forms review captures, ${lang}, ${colorScheme}`, () => {
      test.use({ colorScheme });

      test('captures', async ({ page }) => {
        test.skip(!SHOTS, 'screenshots only');
        await openForm(page, lang);
        const cdp = await page.context().newCDPSession(page);
        await shot(page, 'reading');
        await tap(cdp, await centreOf(target(page, 'agree')));
        await shot(page, 'ticked', 300);
        await tap(cdp, await centreOf(target(page, 'name')));
        await expect(bar(page)).toBeVisible();
        await simulateKeyboard(page, 336);
        await page.keyboard.type(lang === 'tr' ? 'Ayşe Yılmaz' : 'Ada Lovelace');
        await shot(page, 'filling', 700);
        await page.getByTestId('compact-fill-next').click();
        await page.getByTestId('compact-fill-next').click();
        await shot(page, 'toggle-stop', 700);
        await page.getByTestId('compact-fill-done').click();
        await shot(page, 'done', 700);
      });
    });
  }
}
