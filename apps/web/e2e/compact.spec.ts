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

import {
  fixturePath,
  useFileInputPicker,
  waitForSnapshot,
  motionDone,
  frames,
  pastDeadline,
} from './helpers';

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
  await page.goto(`./?lang=${lang}&phonebar=0`);
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
  await motionDone(page);
  await page.screenshot({ path: join(SHOTS, `${name}-${size?.width}x${size?.height}.png`) });
}

test.describe('the compact edition', () => {
  test('a phone gets the compact Library, without the full shell', async ({ page }) => {
    const scripts = recordScripts(page);
    await openLibrary(page);
    await expect(page.locator('html')).toHaveAttribute('data-edition', 'compact');
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open PDF' })).toBeVisible();
    // The composition of EDN-29: the brand and the gear, the first visit's Margin cover with its
    // name and "Try the sample" as a link, and Open in the dock, a 44 px target or more.
    await expect(page.getByRole('heading', { level: 1, name: 'Recto' })).toBeVisible();
    await expect(page.getByTestId('compact-tools')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Margin, No. 07' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try the sample' })).toBeVisible();
    const open = page.getByTestId('compact-library-dock').getByRole('button', { name: 'Open PDF' });
    const box = await open.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    // In thumb reach: the dock sits in the bottom quarter of the screen.
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(
      (page.viewportSize()?.height ?? 0) * 0.75,
    );
    // First run: no Recent section until there is a file.
    await expect(page.getByRole('heading', { name: 'Recent' })).toHaveCount(0);
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
    await expect(page.getByRole('heading', { level: 2, name: 'Kenar, Sayı 07' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Örnek belgeyi dene' })).toBeVisible();
    // Turkish is longer: nothing in the Library clips or spills sideways.
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="compact-library"] *')]
        .filter((el) => el instanceof HTMLElement && el.children.length === 0 && el.textContent)
        .filter((el) => !el.closest('.visually-hidden'))
        .filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1)
        .map((el) => el.textContent),
    );
    expect(clipped).toEqual([]);
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

  test('a modal sheet covers the Library dock: nothing under it is visible or pressable', async ({
    page,
  }) => {
    // The Library's dock stands fixed above the page (z 1); the scrim sheet was in no layer, so
    // Open PDF showed over Settings and a press on it closed the sheet and opened the file
    // dialog. A modal sheet is in the sheet tier (DSN-53, DSN-58; 07-sheets §1.1): the scrim and
    // the sheet cover every piece under them.
    await openLibrary(page);
    const choosers: string[] = [];
    page.on('filechooser', () => choosers.push('filechooser'));
    // By the dock, not by role: a modal sheet takes the page under it out of the accessibility
    // tree, which is the point.
    const open = page
      .getByTestId('compact-library-dock')
      .locator('button', { hasText: 'Open PDF' });
    await expect(open).toBeVisible();
    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByTestId('compact-settings-sheet');
    await expect(settings.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await motionDone(page);
    // Every sampled point of the screen reaches the sheet or its scrim, never the page's own
    // pieces (the dock above all).
    const strays = () =>
      page.evaluate(() => {
        const sheet = document.querySelector('[data-testid="compact-settings-sheet"]');
        const layer = sheet?.closest('body > div:not(#root)');
        const found = new Set<string>();
        for (let y = 4; y < window.innerHeight; y += 24) {
          for (let x = 4; x < window.innerWidth; x += 24) {
            const hit = document.elementFromPoint(x, y);
            if (hit && !layer?.contains(hit))
              found.add(hit.getAttribute('data-testid') ?? hit.tagName);
          }
        }
        return [...found];
      });
    expect(await strays()).toEqual([]);
    // The dock's button is covered where it stands.
    const box = await open.boundingBox();
    if (!box) throw new Error('no Open PDF');
    const reached = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest('button')?.textContent ?? '',
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(reached).not.toContain('Open PDF');
    // Focus stays in the sheet through a full lap of Tab (Base UI's focus guards aside).
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      await expect(open).not.toBeFocused();
    }
    // A press where Open PDF stands lands on the sheet or its scrim: it opens no file dialog.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
    expect(choosers).toEqual([]);
    await expect(open).toBeVisible();
  });

  test('Recent shows as a shelf of covers on one baseline, with Clear and the sample last', async ({
    page,
  }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    await page.getByRole('button', { name: 'Library' }).click();
    await openPdf(page, 'annotations.pdf');
    await page.getByRole('button', { name: 'Library' }).click();
    const recents = page.getByTestId('compact-recents');
    // Two files and the sample as the shelf's last tile.
    await expect(recents.getByRole('button')).toHaveCount(3);
    // Clear is set at the section title's size, with a 44 px target.
    const title = page.getByRole('heading', { name: 'Recent' });
    const clear = page.getByRole('button', { name: 'Clear recents' });
    const size = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontSize);
    expect(await size(clear)).toBe(await size(title));
    expect((await clear.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    // The covers are 200 high and share one bottom edge, the shelf line.
    const tiles = await recents.getByTestId('compact-recent').all();
    const bottoms: number[] = [];
    for (const tile of tiles) {
      const sheet = await tile.locator('span').first().boundingBox();
      expect(sheet?.height).toBe(200);
      bottoms.push(Math.round((sheet?.y ?? 0) + (sheet?.height ?? 0)));
    }
    expect(new Set(bottoms).size).toBe(1);
    await shot(page, 'compact-library-recents');
  });

  test('with twelve Recents a swipe scrolls the shelf to the last, which reopens', async ({
    page,
  }) => {
    await openLibrary(page);
    // The Library has opened the store (first run), so the seed lands in its schema.
    await expect(page.getByTestId('compact-library')).toHaveAttribute('data-first-run');
    await seedRecents(page, 12);
    const tiles = page.getByTestId('compact-recent');
    await expect(tiles).toHaveCount(12);
    const shelf = page.getByTestId('compact-recents');
    const viewport = page.viewportSize() ?? { width: 390, height: 844 };
    const shelfBox = await shelf.boundingBox();
    if (!shelfBox) throw new Error('no shelf');
    // The shelf scrolls sideways under a finger's swipes, not by a script; the page does not.
    const scrolled = () =>
      shelf.evaluate((el) => ({ left: el.scrollLeft, end: el.scrollWidth - el.clientWidth }));
    const cdp = await page.context().newCDPSession(page);
    const y = Math.round(shelfBox.y + 100);
    for (let i = 0; i < 12; i++) {
      const at = await scrolled();
      if (at.left >= at.end - 1) break;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: viewport.width - 20, y }],
      });
      for (let n = 1; n <= 10; n++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: viewport.width - 20 - n * 30, y }],
        });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await frames(page, 2);
    }
    await expect.poll(async () => (await scrolled()).left).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    await shot(page, 'compact-library-many-recents');
    // The last cover is a sample tile; the twelfth file stands before it. A tap reopens it; a
    // seeded entry keeps no handle, so through the file dialog.
    const last = tiles.last();
    await last.scrollIntoViewIfNeeded();
    const chooser = page.waitForEvent('filechooser');
    await last.tap();
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
    await page.goto('./?sample&phonebar=0');
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
    await pastDeadline(page, 400); // the double-tap window
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
      await frames(page);
    }
    await expect(goto).toHaveAttribute('data-glass-moving', '');
    await expect.poll(async () => (await goto.boundingBox())?.y ?? 0).toBeGreaterThan(box.y + 40);
    // A quick swipe on closes it, and the chrome comes back.
    for (let i = 7; i <= 14; i++) {
      await touch('touchMove', at.y + i * 24);
      await frames(page);
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

  test('back to the Library continues the open file; another file replaces it', async ({
    page,
  }) => {
    await openLibrary(page);
    await openPdf(page, 'simple-text.pdf');
    await page.getByRole('button', { name: 'Library' }).click();
    // The open file is Continue (EDN-29): its name, its page, the one lime; the dock's Open is a
    // ghost pill meanwhile, and the shelf does not list the file a second time.
    const card = page.getByTestId('continue-card');
    await expect(card.getByTestId('continue-name')).toHaveText('simple-text');
    await expect(card.getByTestId('continue-page')).toHaveText(/^Page 1 of 3$/);
    await expect(
      page.getByTestId('compact-library-dock').getByRole('button', { name: 'Open PDF' }),
    ).toHaveAttribute('data-ghost');
    await card.getByTestId('continue-resume').click();
    await expect(pageNumber(page)).toHaveText('1 / 3');
    await page.getByRole('button', { name: 'Library' }).click();
    await openPdf(page, 'annotations.pdf');
    await page.getByRole('button', { name: 'Library' }).click();
    // One document at a time: annotations is Continue now, and simple-text leads the shelf.
    await expect(card.getByTestId('continue-name')).toHaveText('annotations');
    const recents = page.getByTestId('compact-recents');
    await expect(recents.getByRole('button').first()).toHaveAccessibleName(/^simple-text\.pdf/);
    await expect(recents.getByRole('button', { name: /Reading now$/ })).toHaveCount(0);
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
    await motionDone(page);
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

  test('R26: Continue returns to page 4 at the same zoom and offset (?home=continue)', async ({
    page,
  }) => {
    await page.goto('./?lang=en&home=continue');
    await expect(page.getByTestId('compact-library')).toBeVisible();
    await page.getByRole('button', { name: 'Try the sample' }).click();
    await expect(page.getByTestId('compact-reader')).toBeVisible();
    await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
      'data-state',
      'rendered',
    );
    const centre = await readerCentre(page);
    const cdp = await page.context().newCDPSession(page);
    await pinch(cdp, centre, 80, 200);
    await expect.poll(() => zoomOf(page)).toBeGreaterThan(1.5);
    // The release eases to rest: take the zoom once it holds across a few frames.
    await expect
      .poll(async () => {
        const was = await zoomOf(page);
        await frames(page, 3);
        return (await zoomOf(page)) === was;
      })
      .toBe(true);
    const zoom = await zoomOf(page);
    // Page 4, 90 px into it.
    await pages(page).evaluate(async (el) => {
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      for (let i = 0; i < 200; i += 1) {
        const target = el.querySelector<HTMLElement>('[data-page-index="3"]');
        if (target) {
          const gap = target.getBoundingClientRect().top - el.getBoundingClientRect().top;
          if (Math.abs(gap + 90) < 1) return;
          el.scrollTop += gap + 90;
        } else el.scrollTop += el.clientHeight * 0.8;
        await frame();
      }
    });
    const offsetOf = () =>
      pages(page).evaluate((el) => {
        const target = el.querySelector<HTMLElement>('[data-page-index="3"]');
        if (!target) return null;
        return Math.round(el.getBoundingClientRect().top - target.getBoundingClientRect().top);
      });
    const offset = await offsetOf();
    expect(offset).not.toBeNull();
    await page.waitForTimeout(400);
    // Scrolling hid the chrome; a tap on the page brings it back.
    await page.touchscreen.tap(centre.x, centre.y);
    await page.getByRole('button', { name: 'Library' }).click();
    const card = page.getByTestId('continue-card');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByTestId('continue-page')).toHaveText(/^Page 4 of \d+$/);
    await card.getByTestId('continue-resume').click();
    await expect(page.getByTestId('compact-reader')).toBeVisible();
    await expect.poll(async () => Math.abs((await zoomOf(page)) - zoom)).toBeLessThan(0.01);
    await expect.poll(offsetOf, { timeout: 20_000 }).toBeGreaterThanOrEqual((offset ?? 0) - 2);
    expect(await offsetOf()).toBeLessThanOrEqual((offset ?? 0) + 2);
  });
});

test.describe('the compact edition’s touch targets and Labs names (R33)', () => {
  /** Opens Settings from the reader with a Labs flag on by the address, so Labs shows. */
  async function openSettings(page: Page, lang: string): Promise<Locator> {
    await useFileInputPicker(page);
    await page.goto(`./?lang=${lang}&textview=1`);
    await expect(page.getByTestId('compact-library')).toBeVisible();
    await openPdf(page, 'outline-named-dests.pdf');
    await page.getByTestId('compact-title-menu-trigger').click();
    await page
      .getByTestId('compact-file-menu')
      .getByRole('menuitem', { name: /^(Settings|Ayarlar)$/ })
      .click();
    const settings = page.getByTestId('compact-settings-sheet');
    await expect(settings).toBeVisible();
    await motionDone(page);
    return settings;
  }

  /** Names of the elements whose text an ellipsis cuts (a name, a hint, a row label). */
  const truncated = (sheet: Locator) =>
    sheet.evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>('*')]
        .filter((el) => getComputedStyle(el).textOverflow === 'ellipsis')
        .filter((el) => el.scrollWidth > el.clientWidth)
        .map((el) => el.textContent?.trim() ?? ''),
    );

  test('every segment of Settings is a 44 px target, and so is the About credit', async ({
    page,
  }) => {
    const settings = await openSettings(page, 'en');
    const radios = settings.getByRole('radio');
    const count = await radios.count();
    // Theme, Reduce motion, Language and the Labs choices.
    expect(count).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < count; i += 1) {
      const radio = radios.nth(i);
      await radio.scrollIntoViewIfNeeded();
      const box = await radio.boundingBox();
      expect(box?.height, `segment ${i}`).toBeGreaterThanOrEqual(44);
    }
    const aboutRow = settings.getByRole('button', { name: /^About Recto/ });
    await aboutRow.scrollIntoViewIfNeeded();
    await aboutRow.click();
    const credit = settings.getByTestId('about-maker');
    await credit.scrollIntoViewIfNeeded();
    const box = await credit.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  });

  for (const lang of ['en', 'tr']) {
    test(`no name in the Labs list is cut off (${lang})`, async ({ page }) => {
      const settings = await openSettings(page, lang);
      const row = settings.getByRole('radiogroup', {
        name: lang === 'en' ? 'Tool drawer' : 'Araç çekmecesi',
      });
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      expect(await truncated(settings)).toEqual([]);
    });
  }
});
