/**
 * The compact edition (ADR-0033 §2.3, spec redesign D0-14), on the `phone` (390 × 844) and
 * `phone-land` (844 × 390) projects: Chromium with touch, a mobile viewport and a screen of
 * the same size, so the edition rule picks the compact edition with `?edition` unset.
 *
 * Covers: the Library and its reading-only line, opening a file through the file chooser,
 * scrolling with the chrome hiding and showing, a tap, a double tap and a pinch (CDP touch
 * events), Find with hits and ‹ ›, a jump from the Pages sheet, Contents, Go to page, notes,
 * Document info, Download a copy, an encrypted file, Turkish; that a settled sheet is solid
 * with the chrome away, the first-run Recents placeholder and a disabled Go that still reads
 * (XD-3); that no editing control is reachable; that the full shell's chunk is never
 * requested; and that `?edition=full` on a phone loads today's app. Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker, waitForSnapshot } from './helpers';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

/** Every script the page requests, to check which chunks the compact edition loads. */
function recordScripts(page: Page): string[] {
  const scripts: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('.js')) scripts.push(url.pathname);
  });
  return scripts;
}

async function openLibrary(page: Page, lang = 'en'): Promise<void> {
  await useFileInputPicker(page);
  await page.goto(`./?lang=${lang}`);
  await expect(page.getByTestId('compact-library')).toBeVisible();
}

/** Opens a fixture through Open PDF and the file chooser, and waits for its first page. */
async function openPdf(page: Page, name: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
  await (await chooser).setFiles(fixturePath(name));
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

const pages = (page: Page) => page.getByTestId('compact-pages');
const topBar = (page: Page) => page.getByTestId('compact-top-bar');
const capsule = (page: Page) => page.getByTestId('compact-capsule');
const pageNumber = (page: Page) => page.getByTestId('compact-page-number');

async function zoomOf(page: Page): Promise<number> {
  return Number(await pages(page).getAttribute('data-zoom'));
}

/** Scrolls the pages by `dy` CSS px in small steps, as a finger would. */
async function scrollPages(page: Page, dy: number): Promise<void> {
  await pages(page).evaluate(async (el, delta) => {
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      el.scrollTop += delta / steps;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, dy);
}

/** The centre of the reader's free area, in page coordinates. */
/**
 * Waits until the page's main thread has been idle twice. Playwright sends a tap's touches one
 * after the other and each waits for the renderer to take it, so a long task between the two
 * taps of a double tap (the 2× page paint) spreads them past the 300 ms double-tap window, which
 * a finger's touches, timestamped when they happen, never are.
 */
async function idle(page: Page): Promise<void> {
  for (let i = 0; i < 2; i++) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestIdleCallback(() => resolve(), { timeout: 3000 });
        }),
    );
  }
}

async function readerCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await pages(page).boundingBox();
  if (!box) throw new Error('no reader');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Two-finger pinch by CDP touch events: the fingers move apart (or together) by `spread`. */
async function pinch(cdp: CDPSession, centre: { x: number; y: number }, from: number, to: number) {
  const points = (gap: number) => [
    { x: centre.x - gap / 2, y: centre.y, id: 1 },
    { x: centre.x + gap / 2, y: centre.y, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(from + ((to - from) * i) / steps),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function expectHidden(locator: Locator, hidden: boolean): Promise<void> {
  if (hidden) await expect(locator).toHaveAttribute('data-hidden');
  else await expect(locator).not.toHaveAttribute('data-hidden');
}

/**
 * A settled compact sheet (07-sheets §3, language.md §2.10): its solid fill has faded in and its
 * backdrop filter is gone, so nothing under it shows through; and the chrome is away (XD-3).
 */
async function expectSettledSolid(page: Page, sheet: Locator): Promise<void> {
  await expectHidden(topBar(page), true);
  await expectHidden(capsule(page), true);
  await expect
    .poll(() =>
      sheet.evaluate((el) => {
        const style = getComputedStyle(el);
        const filter =
          style.getPropertyValue('backdrop-filter') ||
          style.getPropertyValue('-webkit-backdrop-filter') ||
          'none';
        const alpha = /rgba?\([^)]*,\s*([\d.]+)\)$/.exec(style.backgroundColor)?.[1];
        const opaque = !style.backgroundColor.startsWith('rgba') || Number(alpha) === 1;
        return `${filter} ${opaque ? 'opaque' : style.backgroundColor}`;
      }),
    )
    .toBe('none opaque');
}

/** WCAG relative luminance of a computed `rgb()` colour. */
function luminance(colour: string): number {
  const [r = 0, g = 0, b = 0] = (colour.match(/[\d.]+/g) ?? []).map(Number);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(SHOTS, `${name}-${size?.width}x${size?.height}.png`) });
}

test.describe('the compact edition', () => {
  test('a phone gets the compact Library, without the full shell', async ({ page }) => {
    const scripts = recordScripts(page);
    await openLibrary(page);
    await expect(page.locator('html')).toHaveAttribute('data-edition', 'compact');
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open PDF' })).toBeVisible();
    await expect(
      page.getByText(
        'Reading only on phones for now. Open this file on a computer or tablet to mark it up.',
      ),
    ).toBeVisible();
    // First run: Recents holds its place with a calm empty row (XD-3).
    const empty = page.getByTestId('compact-recents-empty');
    await expect(empty.getByRole('heading', { name: 'Recent' })).toBeVisible();
    await expect(empty).toContainText('No files yet');
    await expect(empty).toContainText('PDFs you open show here, newest first.');
    // No horizontal page scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()?.width ?? 0,
    );
    await shot(page, 'compact-library-en');

    await openPdf(page, 'simple-text.pdf');
    await expect(page.getByRole('heading', { name: 'simple-text' })).toBeVisible();
    // The edition's chunk loaded; the full shell's (`app-*.js`) never did.
    expect(scripts.some((path) => /\/CompactApp-[^/]+\.js$/.test(path))).toBe(true);
    expect(scripts.filter((path) => /\/app-[^/]+\.js$/.test(path))).toEqual([]);
  });

  test('the Library speaks Turkish', async ({ page }) => {
    await openLibrary(page, 'tr');
    await expect(page.getByRole('button', { name: 'PDF aç' })).toBeVisible();
    await expect(
      page.getByText(
        'Telefonda şimdilik yalnızca okuma. İşaretlemek için dosyayı bir bilgisayarda ya da tablette açın.',
      ),
    ).toBeVisible();
    await expect(page.getByTestId('compact-recents-empty')).toContainText('Henüz dosya yok');
    await shot(page, 'compact-library-tr');
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('button', { name: 'Open PDF' })).toBeVisible();
  });

  test('scrolling hides the chrome and a scroll up or a tap shows it', async ({ page }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    await expect(pageNumber(page)).toHaveText('1 / 3');
    await shot(page, 'compact-reader');

    await scrollPages(page, 300);
    await expectHidden(topBar(page), true);
    await expectHidden(capsule(page), true);
    // Hidden bars hold no focus.
    await expect(topBar(page)).toHaveAttribute('inert', '');
    await expect(page.getByTestId('compact-page-pill')).toHaveAttribute('data-visible');
    await shot(page, 'compact-reader-hidden');

    await scrollPages(page, -40);
    await expectHidden(topBar(page), false);
    await expectHidden(capsule(page), false);

    // A tap on the page toggles the chrome (after the double-tap window).
    const centre = await readerCentre(page);
    await page.touchscreen.tap(centre.x, centre.y);
    await expectHidden(topBar(page), true);
    await page.touchscreen.tap(centre.x, centre.y);
    await expectHidden(topBar(page), false);

    // Further down the current page follows.
    await pages(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(pageNumber(page)).toHaveText('3 / 3');
  });

  test('double tap zooms to 2× and back; a pinch zooms about the fingers', async ({ page }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    const centre = await readerCentre(page);
    expect(await zoomOf(page)).toBe(1);

    await idle(page);
    await page.touchscreen.tap(centre.x, centre.y);
    await page.touchscreen.tap(centre.x, centre.y);
    await expect.poll(() => zoomOf(page)).toBe(2);
    // At rest the stage carries no transform (Q-2).
    await expect(page.locator('[data-testid="compact-pages"] > div > div')).toHaveCSS(
      'transform',
      'none',
    );
    // The chrome did not toggle on a double tap.
    await expectHidden(topBar(page), false);
    await page.waitForTimeout(400);
    await idle(page);
    await page.touchscreen.tap(centre.x, centre.y);
    await page.touchscreen.tap(centre.x, centre.y);
    await expect.poll(() => zoomOf(page)).toBe(1);

    const cdp = await page.context().newCDPSession(page);
    await pinch(cdp, centre, 80, 200);
    await expect.poll(() => zoomOf(page)).toBeGreaterThan(2);
    const zoomed = await zoomOf(page);
    expect(zoomed).toBeCloseTo(2.5, 0);
    await expect(page.locator('[data-testid="compact-pages"] > div > div')).toHaveCSS(
      'transform',
      'none',
    );
    // Pinching in past fit settles back to fit.
    await pinch(cdp, centre, 240, 40);
    await expect.poll(() => zoomOf(page)).toBe(1);
    // The pages never scroll the document itself sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()?.width ?? 0,
    );
  });

  test('Find highlights hits and steps through them; Done restores the bar', async ({ page }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    await capsule(page).getByRole('button', { name: 'Find' }).click();
    const field = page.getByRole('searchbox', { name: 'Find in document' });
    await expect(field).toBeFocused();
    await field.fill('OF simple-text');
    const count = page.getByTestId('compact-find-count');
    await expect(count).toHaveText('1 of 3');
    await expect(page.getByTestId('search-highlights').first()).toBeVisible();
    await shot(page, 'compact-find');
    await page.getByRole('button', { name: 'Next result' }).click();
    await expect(count).toHaveText('2 of 3');
    // The current hit is on page 2, inside the area the bars leave free.
    const current = page.locator(
      '[data-page-index="1"] [data-testid="search-highlights"] [data-current]',
    );
    await expect(current).toBeInViewport();
    await page.getByRole('button', { name: 'Previous result' }).click();
    await expect(count).toHaveText('1 of 3');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'simple-text' })).toBeVisible();
    await expect(page.getByTestId('search-highlights')).toHaveCount(0);

    // Ctrl+F opens it again; Esc closes it.
    await page.keyboard.press('Control+f');
    await expect(field).toBeFocused();
    await field.fill('nothing like this');
    await expect(count).toHaveText('No results');
    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
  });

  test('the Pages sheet and Go to page jump', async ({ page }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    await capsule(page).getByRole('button', { name: 'Pages' }).click();
    const sheet = page.getByTestId('compact-pages-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Page 1 of 3' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(sheet.locator('canvas').first()).toHaveAttribute('data-state', 'rendered');
    await expectSettledSolid(page, sheet);
    await shot(page, 'compact-pages-sheet');
    await sheet.getByRole('button', { name: 'Page 3 of 3' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(pageNumber(page)).toHaveText('3 / 3');
    // The chrome comes back with the sheet gone.
    await expectHidden(capsule(page), false);
    await expectHidden(topBar(page), false);

    await pageNumber(page).click();
    const goto = page.getByTestId('compact-goto-sheet');
    const input = goto.getByRole('textbox', { name: 'Page number or label' });
    await expect(input).toBeFocused();
    await expectSettledSolid(page, goto);
    // Go with nothing typed: disabled but present, the shared disabled step (Q-14), and inside
    // the sheet.
    const go = goto.getByRole('button', { name: 'Go' });
    await expect(go).toBeDisabled();
    const look = await go.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        color: style.color,
        fill: style.backgroundColor,
        right: el.getBoundingClientRect().right,
      };
    });
    expect(contrast(look.color, look.fill)).toBeGreaterThanOrEqual(3);
    expect(look.right).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) - 8);
    await input.fill('9');
    await expect(goto.getByText('No page “9”')).toBeVisible();
    await input.fill('2');
    await input.press('Enter');
    await expect(goto).toHaveCount(0);
    await expect(pageNumber(page)).toHaveText('2 / 3');
  });

  test('a long document stays virtualised in the reader and the grid', async ({ page }) => {
    await openLibrary(page);
    await openPdf(page, 'many-pages.pdf');
    await expect(pageNumber(page)).toHaveText('1 / 400');
    expect(await page.locator('[data-page-index]').count()).toBeLessThan(60);
    await capsule(page).getByRole('button', { name: 'Pages' }).click();
    const sheet = page.getByTestId('compact-pages-sheet');
    expect(await sheet.getByRole('listitem').count()).toBeLessThan(120);
    await sheet.getByRole('button', { name: 'Page 7 of 400' }).click();
    await expect(pageNumber(page)).toHaveText('7 / 400');
  });

  test('the ⋯ menu: Contents, Document info, About, Download a copy', async ({ page }) => {
    await openLibrary(page);
    await openPdf(page, 'outline-named-dests.pdf');
    const more = page.getByRole('button', { name: 'More' });
    await more.click();
    const menu = page.getByTestId('compact-menu');
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Find',
      'Contents',
      'Go to page',
      /^(Share|Download a copy)$/,
      'Document info',
      'About Recto',
    ]);
    await shot(page, 'compact-menu');
    await menu.getByRole('menuitem', { name: 'Contents' }).click();
    const contents = page.getByTestId('compact-contents-sheet');
    await expect(contents).toBeVisible();
    await contents.getByRole('button', { name: /^Chapter 2/ }).click();
    await expect(contents).toHaveCount(0);
    await expect(pageNumber(page)).not.toHaveText('1 / 6');

    await more.click();
    await menu.getByRole('menuitem', { name: 'Document info' }).click();
    const info = page.getByTestId('compact-info-sheet');
    await expect(info.getByTestId('compact-info-name')).toHaveText('outline-named-dests.pdf');
    await expect(info.getByTestId('compact-info-pages')).toHaveText('6');
    await info.getByRole('button', { name: 'Done' }).click();
    await expect(info).toHaveCount(0);

    await more.click();
    await menu.getByRole('menuitem', { name: 'About Recto' }).click();
    const about = page.getByTestId('compact-about-sheet');
    await expect(about).toContainText('Files never leave your device.');
    await expectSettledSolid(page, about);
    // On a phone on its side About meets the 92 % cap: its body scrolls to the last link.
    const source = about.getByRole('link', { name: /^Source/ });
    await source.scrollIntoViewIfNeeded();
    await expect(source).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape');

    await more.click();
    const download = page.waitForEvent('download');
    await menu.getByRole('menuitem', { name: 'Download a copy' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('outline-named-dests.pdf');
    const saved = await file.path();
    expect(statSync(saved).size).toBe(statSync(fixturePath('outline-named-dests.pdf')).size);
    expect(readFileSync(saved).equals(readFileSync(fixturePath('outline-named-dests.pdf')))).toBe(
      true,
    );
  });

  test('a file without an outline has no Contents; the producer shows in info', async ({
    page,
  }) => {
    await openLibrary(page);
    await openPdf(page, 'metadata-xmp.pdf');
    await page.getByRole('button', { name: 'More' }).click();
    const menu = page.getByTestId('compact-menu');
    await expect(menu.getByRole('menuitem', { name: 'Contents' })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Document info' }).click();
    await expect(page.getByTestId('compact-info-producer')).not.toBeEmpty();
  });

  test('a note shows its text on tap; nothing on the page edits the file', async ({ page }) => {
    await openLibrary(page);
    await openPdf(page, 'annotations.pdf');
    await pageNumber(page).click();
    const input = page.getByRole('textbox', { name: 'Page number or label' });
    await input.fill('2');
    await input.press('Enter');
    const note = page.getByRole('button', { name: /^Show note/ });
    await expect(note).toBeVisible();
    await note.click();
    await expect(page.getByTestId('note-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('note-popover')).toHaveCount(0);

    // No editing control anywhere: no tools, Markup, Edit, Save, page operations.
    const editing =
      /^(Markup|Edit|Highlight|Pen|Draw|Sign|Fill & sign|Save|Rotate|Delete|Undo|Redo|Arrange|Compare|Text box|Note|Stamp|Redact|Crop)\b/;
    await expect(page.getByRole('button', { name: editing })).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(0);
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('menuitem', { name: editing })).toHaveCount(0);
    await page.keyboard.press('Escape');
    // A long press or right-click on a page opens no menu of actions on the file.
    await page.locator('[data-page-index="1"]').click({ button: 'right', force: true });
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('an encrypted file asks for its password', async ({ page }) => {
    await openLibrary(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open PDF' }).click();
    await (await chooser).setFiles(fixturePath('encrypted-aes-128.pdf'));
    const sheet = page.getByTestId('compact-password-sheet');
    const field = sheet.getByLabel('Password');
    await expect(field).toBeFocused();
    await field.fill('wrong');
    await field.press('Enter');
    await expect(sheet.getByText('That password did not open the file. Try again.')).toBeVisible();
    await sheet.getByLabel('Password').fill('user');
    await sheet.getByLabel('Password').press('Enter');
    await expect(page.getByTestId('compact-reader')).toBeVisible();
    await expect(pageNumber(page)).toHaveText('1 / 3');
  });

  test('back to the Library lists the open file first; another file replaces it', async ({
    page,
  }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    await page.getByRole('button', { name: 'Library' }).click();
    const recents = page.getByTestId('compact-recents');
    const reading = recents.getByRole('button', { name: /^simple-text\.pdf, .*Reading now$/ });
    await expect(reading).toBeVisible();
    await reading.click();
    await expect(pageNumber(page)).toHaveText('1 / 3');
    await page.getByRole('button', { name: 'Library' }).click();
    await openPdf(page, 'annotations.pdf');
    await page.getByRole('button', { name: 'Library' }).click();
    await expect(recents.getByRole('button').first()).toHaveAccessibleName(/^annotations\.pdf/);
    // One document at a time.
    await expect(recents.getByRole('button', { name: /Reading now$/ })).toHaveCount(1);
  });

  test('Turkish chrome fits: menu, sheets and Find clip nothing', async ({ page }) => {
    await openLibrary(page, 'tr');
    await openPdf(page, 'outline-named-dests.pdf');
    await page.getByRole('button', { name: 'Diğer' }).click();
    const menu = page.getByTestId('compact-menu');
    await expect(menu.getByRole('menuitem', { name: 'Kopyasını indir' })).toBeVisible();
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('[data-compact-chrome] *, [data-testid="compact-menu"] *')]
        .filter((el) => el instanceof HTMLElement && el.children.length === 0 && el.textContent)
        .filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1)
        .map((el) => el.textContent),
    );
    expect(clipped).toEqual([]);
    await shot(page, 'compact-menu-tr');
    await page.keyboard.press('Escape');
    await capsule(page).getByRole('button', { name: 'Bul' }).click();
    await page.getByRole('searchbox').fill('Chapter');
    await expect(page.getByTestId('compact-find-count')).toHaveText(/^\d+\/\d+$/);
    await shot(page, 'compact-find-tr');
  });

  test('?edition=full on a phone loads today’s app', async ({ page }) => {
    const scripts = recordScripts(page);
    await page.goto('./?edition=full&lang=en');
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-edition', 'full');
    expect(scripts.filter((path) => /\/CompactApp-[^/]+\.js$/.test(path))).toEqual([]);
    // Kept for the session: a reload without the parameter stays full.
    await page.goto('./?lang=en');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  test('a toast sits 12 px above the capsule, and above the home indicator when it is away', async ({
    page,
  }) => {
    // The restore notice is the compact edition's toast (D0-5): "Restored simple-text · Start
    // fresh". `beforeunload` may ask while changes are kept (ADR-0032 §2.7).
    page.on('dialog', (dialog) => void dialog.accept());
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    await waitForSnapshot(page);
    await page.reload();
    const toast = page.getByTestId('session-notice');
    await expect(toast).toContainText('Restored simple-text');
    await expect(capsule(page)).toBeVisible();
    await page.waitForTimeout(600);
    const t = await toast.boundingBox();
    const c = await capsule(page).boundingBox();
    if (!t || !c) throw new Error('not laid out');
    expect(Math.round(c.y - (t.y + t.height))).toBe(12);
    expect(t.x).toBeGreaterThanOrEqual(12);
    expect(t.x + t.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) - 12);
    // 44 px targets on a coarse pointer (A-15).
    const start = await toast.getByRole('button', { name: 'Start fresh' }).boundingBox();
    expect(start?.height).toBe(44);
    await shot(page, 'compact-toast');
    // Capsule away (Find open): the stack drops to the home indicator.
    await capsule(page).getByRole('button', { name: 'Find' }).click();
    await expect(page.getByRole('region', { name: 'Notifications' })).toHaveAttribute(
      'data-band',
      'away',
    );
  });
});
