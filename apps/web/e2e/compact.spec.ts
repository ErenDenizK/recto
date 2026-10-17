/**
 * The compact edition (ADR-0033 §2.3, spec redesign D0-14), on the `phone` (390 × 844) and
 * `phone-land` (844 × 390) projects: Chromium with touch, a mobile viewport and a screen of
 * the same size, so the edition rule picks the compact edition with `?edition` unset.
 *
 * Covers: the Library and its reading-only line, opening a file through the file chooser,
 * scrolling with the chrome hiding and showing, a tap, a double tap and a pinch (CDP touch
 * events), Find with hits and ‹ ›, a jump from the page overview (MOB-2), Contents, Go to page, notes,
 * Document info, Settings and About, Download a copy, an encrypted file, Turkish; that a
 * settled sheet floats in the phone sheet's shape, its glass clear, with the chrome away (DSN-53), the first-run Recents placeholder and a disabled Go that still reads
 * (XD-3); that no editing control but Edit is reachable while reading; that the full shell's chunk is never
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

/**
 * Stores `count` Recents as earlier visits would leave them, then reloads so the Library reads
 * them: no file handle, so a tap reopens each through the file dialog (`files/recents.ts`).
 */
async function seedRecents(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('pdf-editor:recents:v1', 2);
        open.onerror = () => reject(new Error(String(open.error)));
        open.onsuccess = () => {
          const tx = open.result.transaction('entries', 'readwrite');
          const store = tx.objectStore('entries');
          const now = Date.now();
          for (let i = 0; i < n; i++) {
            store.put({
              id: `seeded-${i}`,
              name: `report-${String(i + 1).padStart(2, '0')}.pdf`,
              size: 48_000 + i * 1024,
              pages: 3 + i,
              openedAt: now - (i + 1) * 3_600_000,
            });
          }
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(new Error(String(tx.error)));
        };
      }),
    count,
  );
  await page.reload();
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
async function expectSettled(page: Page, sheet: Locator): Promise<void> {
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
        const box = el.getBoundingClientRect();
        return {
          // At rest the glass clears where it stands (MOT-12): its filter is back.
          moving: el.hasAttribute('data-glass-moving'),
          glass: filter !== 'none',
          // The phone sheet's shape (DSN-53): inset from the sides, its corners the island's.
          inset: Math.round(Math.min(box.left, window.innerWidth - box.right)),
          radius: style.borderTopLeftRadius,
        };
      }),
    )
    .toEqual({ moving: false, glass: true, inset: expect.any(Number), radius: '28px' });
  const box = await sheet.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(Math.min(box?.x ?? 0, width - (box?.x ?? 0) - (box?.width ?? 0))).toBeGreaterThanOrEqual(
    16,
  );
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
    // The composition of DSN-31: the brand and promise, the tools as chips (read as a list and
    // the line after it, DSN-51), the sample as a card, and Open PDF in the dock, a 44 px
    // target or more.
    await expect(page.getByRole('heading', { level: 1, name: 'Recto' })).toBeVisible();
    const tools = page.getByTestId('compact-tools');
    await expect(tools.getByRole('listitem')).toHaveText(['Pen', 'Highlight', 'Text', 'Sign']);
    await expect(tools.getByText('Every tool on a computer or tablet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try the sample' })).toBeVisible();
    const open = page.getByTestId('compact-library-dock').getByRole('button', { name: 'Open PDF' });
    const box = await open.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    // In thumb reach: the dock sits in the bottom quarter of the screen.
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(
      (page.viewportSize()?.height ?? 0) * 0.75,
    );
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
    await expect(page.getByText('Tüm araçlar bilgisayar ve tablette.')).toBeVisible();
    await expect(page.getByTestId('compact-tools')).toContainText('İmza');
    await expect(page.getByRole('button', { name: 'Örnek belgeyi deneyin' })).toBeVisible();
    // Turkish is longer: nothing in the Library clips or spills sideways.
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="compact-library"] *')]
        .filter((el) => el instanceof HTMLElement && el.children.length === 0 && el.textContent)
        .filter((el) => !el.closest('.visually-hidden'))
        .filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1)
        .map((el) => el.textContent),
    );
    expect(clipped).toEqual([]);
    await expect(page.getByTestId('compact-recents-empty')).toContainText('Henüz dosya yok');
    await shot(page, 'compact-library-tr');
    // Language is a setting, not a control on the page (DSN-46): the settings gear reaches it
    // before a file is open, in the Settings sheet (DSN-51, DSN-53), and changes the Library at
    // once.
    await expect(page.getByRole('button', { name: 'English' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Ayarlar' }).click();
    const about = page.getByTestId('compact-settings-sheet');
    const language = about.getByRole('radiogroup', { name: 'Dil' });
    await language.scrollIntoViewIfNeeded();
    await language.getByRole('radio', { name: 'English' }).click();
    // The sheet speaks English at once: the row is "Language" now.
    await expect(
      about.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'English' }),
    ).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(about).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open PDF' })).toBeVisible();
  });

  test('Recents show as a card list; on its side the column splits so several rows show', async ({
    page,
  }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    await page.getByRole('button', { name: 'Library' }).click();
    await openPdf(page, 'annotations.pdf');
    await page.getByRole('button', { name: 'Library' }).click();
    const recents = page.getByTestId('compact-recents');
    await expect(recents.getByRole('button')).toHaveCount(2);
    // Clear is set at the section title's size (visual audit 2026-10 item 6), with a 44 px target.
    const title = page.getByRole('heading', { name: 'Recent' });
    const clear = page.getByRole('button', { name: 'Clear recents' });
    const size = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontSize);
    expect(await size(clear)).toBe(await size(title));
    expect((await clear.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    const viewport = page.viewportSize();
    if (viewport && viewport.width > viewport.height) {
      // On its side, Recents start in the top third and both rows show whole, above the edge.
      const titleBox = await title.boundingBox();
      expect(titleBox?.y ?? Infinity).toBeLessThan(viewport.height / 3);
      for (const row of await recents.getByRole('button').all()) {
        const rowBox = await row.boundingBox();
        expect((rowBox?.y ?? 0) + (rowBox?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      }
    }
    await shot(page, 'compact-library-recents');
  });

  test('with twelve Recents a swipe scrolls the Library to the last, clear of the dock', async ({
    page,
  }) => {
    await openLibrary(page);
    // The Library has opened the store (first run), so the seed lands in its schema.
    await expect(page.getByTestId('compact-recents-empty')).toBeVisible();
    await seedRecents(page, 12);
    const rows = page.getByTestId('compact-recents').getByRole('button');
    await expect(rows).toHaveCount(12);
    const last = rows.last();
    const dock = page.getByTestId('compact-library-dock');
    const viewport = page.viewportSize() ?? { width: 390, height: 844 };
    // The page itself scrolls (DSN-33), moved by a finger's swipes, not by a script.
    const scrolled = () =>
      page.evaluate(() => {
        const el = document.scrollingElement;
        return el ? { top: el.scrollTop, end: el.scrollHeight - el.clientHeight } : undefined;
      });
    const cdp = await page.context().newCDPSession(page);
    const x = Math.round(viewport.width * 0.75);
    const from = Math.round(viewport.height * 0.7);
    const step = Math.round(viewport.height * 0.04);
    for (let i = 0; i < 8; i++) {
      const at = await scrolled();
      if (at && at.top >= at.end - 1) break;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y: from }],
      });
      for (let n = 1; n <= 10; n++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: from - n * step }],
        });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(150);
    }
    await expect.poll(async () => (await scrolled())?.top ?? 0).toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const at = await scrolled();
        return at ? at.end - at.top : Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(1);
    // The last row stands whole above the dock, which stands above the home indicator.
    const rowBox = await last.boundingBox();
    const dockBox = await dock.boundingBox();
    if (!rowBox || !dockBox) throw new Error('no row or dock');
    expect(rowBox.y).toBeGreaterThanOrEqual(0);
    expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(dockBox.y);
    expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(viewport.height);
    await shot(page, 'compact-library-many-recents');
    // A tap on it reopens it; a seeded entry keeps no handle, so through the file dialog.
    const chooser = page.waitForEvent('filechooser');
    await page.touchscreen.tap(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
    await (await chooser).setFiles(fixturePath('simple-text.pdf'));
    await expect(page.getByTestId('compact-reader')).toBeVisible();
    // The reader scrolls its own pages again, from the top of the window.
    expect(await page.evaluate(() => document.scrollingElement?.scrollTop)).toBe(0);
  });

  test('Try the sample opens the teaching sample in the reader', async ({ page }) => {
    await openLibrary(page);
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByTestId('compact-reader')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recto sample' })).toBeVisible();
    await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
      'data-state',
      'rendered',
    );
  });

  test('the pages take focus on arrival without a ring; Tab back to them shows it', async ({
    page,
  }) => {
    // A link straight to a document: no pointer was used, so Chromium would ring the scripted
    // focus as :focus-visible (V2 review item 2). The ring waits for Tab or F6.
    await page.goto('./?sample');
    await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
      'data-state',
      'rendered',
    );
    await expect(pages(page)).toBeFocused();
    await expect(pages(page)).toHaveCSS('outline-style', 'none');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(pages(page)).toBeFocused();
    await expect(pages(page)).toHaveCSS('outline-style', 'solid');
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

  test('the chrome leaves and comes back on a spring the scroll starts (MOT-16)', async ({
    page,
  }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    // The spring rides in the editing chunk: ✎ and Done bring it in now, not when idle.
    await page.getByTestId('compact-edit').click();
    await page.getByTestId('compact-edit-done').click();
    await expect(capsule(page)).not.toHaveAttribute('data-editing');
    // Focus back on the pages: the chrome never hides while it holds the focus (F12 §4).
    await pages(page).evaluate((el) => el.focus({ preventScroll: true }));
    /** Scrolls by `step` px a frame for `frames` frames, as a finger would at that speed. */
    const scroll = (step: number, frames: number) =>
      pages(page).evaluate(
        async (el, [by, count]) => {
          for (let i = 0; i < count; i++) {
            el.scrollTop += by;
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
        },
        [step, frames] as const,
      );
    /**
     * The spring the capsule's move takes: its transform transition's length and curve as the
     * stylesheet resolves them for this move (no frame is read, PRC-14).
     */
    const move = () =>
      capsule(page).evaluate((el) => {
        const style = getComputedStyle(el);
        const names = style.transitionProperty.split(',').map((n) => n.trim());
        const at = names.indexOf('transform');
        const ms = Number.parseFloat(style.transitionDuration.split(',')[at] ?? '0');
        const easing = style.transitionTimingFunction.split(/,(?![^(]*\))/)[at] ?? '';
        const stops = [...easing.matchAll(/(-?[\d.]+)(?: [\d.]+%)?[,)]/g)].map((m) => Number(m[1]));
        return {
          step: document.documentElement.dataset.chromeSpring ?? null,
          ms: Math.round(style.transitionDuration.includes('ms') ? ms : ms * 1000),
          peak: Math.max(0, ...stops),
        };
      });
    const rest = () =>
      page.waitForFunction(() =>
        document
          .querySelector('[data-testid="compact-capsule"]')
          ?.getAnimations()
          .every((a) => a.playState !== 'running'),
      );

    // A fling (about 7 000 px/s): off fast, on a spring with a small overshoot.
    await scroll(120, 4);
    await expectHidden(capsule(page), true);
    const fling = await move();
    expect(fling.step).toBe('3');
    expect(fling.ms).toBe(490);
    expect(fling.peak).toBeGreaterThan(1.01);
    await rest();

    // A slow scroll back (about 120 px/s): a long ease with no bounce.
    await scroll(-2, 8);
    await expectHidden(capsule(page), false);
    const slow = await move();
    expect(slow.step).toBe('0');
    expect(slow.ms).toBe(900);
    expect(slow.peak).toBe(1);
    await rest();
    // The step goes once the move is over: a tap moves the chrome on its tokens again.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.chromeSpring ?? null), {
        timeout: 3000,
      })
      .toBeNull();
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

  test('the page overview and Go to page jump', async ({ page }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    // Pages opens the page overview (MOB-2), a place over the reader with the chrome away.
    await capsule(page).getByRole('button', { name: 'Pages' }).click();
    const overview = page.getByTestId('compact-overview');
    await expect(overview).toHaveAttribute('data-phase', 'open');
    const grid = page.getByTestId('compact-overview-plane');
    await expect(grid.getByRole('button', { name: 'Page 1 of 3' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(grid.locator('canvas').first()).toHaveAttribute('data-state', 'rendered');
    await expectHidden(topBar(page), true);
    await expectHidden(capsule(page), true);
    await shot(page, 'compact-pages-overview');
    await grid.getByRole('button', { name: 'Page 3 of 3' }).click();
    await expect(overview).toHaveAttribute('data-phase', 'closed');
    await expect(pageNumber(page)).toHaveText('3 / 3');
    // The chrome comes back with the sheet gone.
    await expectHidden(capsule(page), false);
    await expectHidden(topBar(page), false);

    await pageNumber(page).click();
    const goto = page.getByTestId('compact-goto-sheet');
    const input = goto.getByRole('textbox', { name: 'Page number or label' });
    await expect(input).toBeFocused();
    await expectSettled(page, goto);
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
    const grid = page.getByTestId('compact-overview-plane');
    await expect(page.getByTestId('compact-overview')).toHaveAttribute('data-phase', 'open');
    expect(await grid.getByRole('listitem').count()).toBeLessThan(120);
    await grid.getByRole('button', { name: 'Page 7 of 400' }).click();
    await expect(pageNumber(page)).toHaveText('7 / 400');
  });

  test('the title menu, the one menu: Document info, Contents, Settings, Download a copy', async ({
    page,
  }) => {
    await openLibrary(page);
    await openPdf(page, 'outline-named-dests.pdf');
    // One menu (DSN-53): ⋯ folded into the title menu; Find and Go to page stay the capsule's.
    await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0);
    const title = page.getByTestId('compact-title-menu-trigger');
    const fileMenu = page.getByTestId('compact-file-menu');
    await title.click();
    await expect(fileMenu.getByRole('menuitem')).toHaveText([
      /^(Share|Download a copy)$/,
      'Document info',
      'Contents',
      'Settings',
    ]);
    await shot(page, 'compact-menu');
    await fileMenu.getByRole('menuitem', { name: 'Contents' }).click();
    const contents = page.getByTestId('compact-contents-sheet');
    await expect(contents).toBeVisible();
    await contents.getByRole('button', { name: /^Chapter 2/ }).click();
    await expect(contents).toHaveCount(0);
    await expect(pageNumber(page)).not.toHaveText('1 / 6');

    await title.click();
    await fileMenu.getByRole('menuitem', { name: 'Document info' }).click();
    const info = page.getByTestId('compact-info-sheet');
    await expect(info.getByTestId('compact-info-name')).toHaveText('outline-named-dests.pdf');
    await expect(info.getByTestId('compact-info-pages')).toHaveText('6');
    // The round close; focus goes back to the title, which opened the menu.
    await info.getByRole('button', { name: 'Close' }).click();
    await expect(info).toHaveCount(0);
    await expect(title).toBeFocused();

    await title.click();
    await fileMenu.getByRole('menuitem', { name: 'Settings' }).click();
    const settings = page.getByTestId('compact-settings-sheet');
    await expect(settings.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expectSettled(page, settings);
    // Reduce motion, the full edition's row: On reaches the root as in the full edition, and
    // System takes it off again.
    const motion = settings.getByRole('radiogroup', { name: 'Reduce motion' });
    await motion.scrollIntoViewIfNeeded();
    // 0.98, not 1: on a phone on its side the group ends a fraction of a pixel under the scroll
    // edge after rounding (CI measured 0.995), which no one can see.
    await expect(motion).toBeInViewport({ ratio: 0.98 });
    await motion.getByRole('radio', { name: 'On' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await shot(page, 'compact-settings-reduce-motion');
    await motion.getByRole('radio', { name: 'System' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-motion', 'reduced');
    // About is Settings' last row, a page within the sheet; ‹ goes back.
    const aboutRow = settings.getByRole('button', { name: /^About Recto/ });
    await aboutRow.scrollIntoViewIfNeeded();
    await aboutRow.click();
    await expect(settings.getByRole('heading', { name: 'About Recto' })).toBeVisible();
    await expect(settings).toContainText('Files never leave your device.');
    // Its body scrolls to the last link, the sheet pulled up to large on the way.
    const source = settings.getByRole('link', { name: /^Source/ });
    await source.scrollIntoViewIfNeeded();
    await expect(source).toBeInViewport({ ratio: 1 });
    await settings.getByRole('button', { name: 'Settings' }).click();
    await expect(settings.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);

    await title.click();
    const download = page.waitForEvent('download');
    await fileMenu.getByRole('menuitem', { name: 'Download a copy' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('outline-named-dests.pdf');
    const saved = await file.path();
    expect(statSync(saved).size).toBe(statSync(fixturePath('outline-named-dests.pdf')).size);
    expect(readFileSync(saved).equals(readFileSync(fixturePath('outline-named-dests.pdf')))).toBe(
      true,
    );
  });

  test('a sheet follows a finger on its head, solid while it moves, and a swipe down closes it', async ({
    page,
  }) => {
    await openLibrary(page);
    await openPdf(page, 'outline-named-dests.pdf');
    await pageNumber(page).click();
    const goto = page.getByTestId('compact-goto-sheet');
    await expectSettled(page, goto);
    const box = await goto.boundingBox();
    if (!box) throw new Error('no sheet');
    const cdp = await page.context().newCDPSession(page);
    const at = { x: box.x + box.width / 2, y: box.y + 16 };
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y = at.y) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: at.x, y }],
      });
    // The head takes the drag (DSN-53): the sheet moves with the finger, its glass solid.
    await touch('touchStart');
    for (let i = 1; i <= 6; i++) {
      await touch('touchMove', at.y + i * 12);
      await page.waitForTimeout(16);
    }
    await expect(goto).toHaveAttribute('data-glass-moving', '');
    await expect.poll(async () => (await goto.boundingBox())?.y ?? 0).toBeGreaterThan(box.y + 40);
    // A quick swipe on closes it, and the chrome comes back.
    for (let i = 7; i <= 14; i++) {
      await touch('touchMove', at.y + i * 24);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    await expect(goto).toHaveCount(0);
    await expectHidden(capsule(page), false);
  });

  test('a file without an outline has no Contents; the producer shows in info', async ({
    page,
  }) => {
    await openLibrary(page);
    await openPdf(page, 'metadata-xmp.pdf');
    await page.getByTestId('compact-title-menu-trigger').click();
    const menu = page.getByTestId('compact-file-menu');
    await expect(menu.getByRole('menuitem', { name: 'Document info' })).toBeVisible();
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
    // The phone sheet, not a popover (DSN-53): a dialog named "Note"; Esc closes it and gives
    // focus back to the note's target.
    const sheet = page.getByTestId('note-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Note' })).toBeVisible();
    // The page is inert under the modal sheet, so the target is found by its test id.
    const target = page.getByTestId('note-target').first();
    await expect(target).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(target).toBeFocused();

    // Reading shows no editing control but Edit (EDN-8: it opens the edit island,
    // compact-edit.spec.ts): no tools, Markup, Save, page operations.
    const editing =
      /^(Markup|Edit text|Highlight|Pen|Draw|Sign|Fill & sign|Save|Rotate|Delete|Undo|Redo|Arrange|Compare|Text box|Note|Stamp|Redact|Crop)\b/;
    await expect(page.getByRole('button', { name: editing })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(1);
    await expect(page.getByRole('radio')).toHaveCount(0);
    await page.getByTestId('compact-title-menu-trigger').click();
    await expect(page.getByTestId('compact-file-menu')).toBeVisible();
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
    await page.getByTestId('compact-title-menu-trigger').click();
    const menu = page.getByTestId('compact-file-menu');
    await expect(menu.getByRole('menuitem', { name: 'Kopyasını indir' })).toBeVisible();
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('[data-compact-chrome] *, [data-testid="compact-file-menu"] *')]
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

  test('a toast sits 8 px (--space-2) above the capsule, and above the home indicator when it is away', async ({
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
    // --space-2 above the capsule, the gap between pieces (Toast.module.css; 01-frame F13).
    expect(Math.round(c.y - (t.y + t.height))).toBe(8);
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

test.describe('the compact edition in the light theme (spec D3-7)', () => {
  test.use({ colorScheme: 'light' });

  test('follows the device’s light scheme, and Settings’ Theme row sets it', async ({ page }) => {
    await openLibrary(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const canvas = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(await canvas()).toBe('rgb(230, 232, 235)');
    await shot(page, 'compact-library-light');

    await openPdf(page, 'outline-named-dests.pdf');
    await expect(capsule(page)).toBeVisible();
    await shot(page, 'compact-reader-light');
    await page.getByTestId('compact-title-menu-trigger').click();
    await page.getByTestId('compact-file-menu').getByRole('menuitem', { name: 'Settings' }).click();
    const about = page.getByTestId('compact-settings-sheet');
    const theme = about.getByRole('radiogroup', { name: 'Theme' });
    await theme.scrollIntoViewIfNeeded();
    await expect(theme.getByRole('radio', { name: 'System' })).toBeChecked();
    // The sheet's text holds AA on its light surface.
    const colours = await about.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.color, style.backgroundColor];
    });
    expect(contrast(colours[0] ?? '', colours[1] ?? '')).toBeGreaterThanOrEqual(4.5);
    await shot(page, 'compact-settings-theme-light');
    await theme.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await canvas()).toBe('rgb(8, 9, 12)');
    await theme.getByRole('radio', { name: 'System' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
