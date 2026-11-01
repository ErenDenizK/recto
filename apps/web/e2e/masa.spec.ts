/**
 * The desk's opening motion, exact resume and paint budget (DSN-87, Masa lane M3; behind Labs'
 * "Desk (new Home)", so every test opens `?desk=1`):
 *
 * - **Continue after close.** A document is read to page 4 at a zoom and 90 px into the page,
 *   then closed; the desk's Continue shows page 4 from a stored cover (a `blob:` image) and lands
 *   on the same page, zoom and offset (within 2 px). The sample joins Recents only once changed
 *   (02.14), so the test reads `many-pages.pdf`; it comes back from its kept snapshot, or through
 *   the file dialog ("Open again…") where there is none, which the test serves.
 * - **Continue after a cold start.** The same in a new page of the same context (the tab lock is
 *   released): the covers are `blob:` images served from storage, the engine is never started
 *   before the first open (no worker, no `.wasm` request), and `desk:painted` exists.
 *   Its time is recorded as an annotation; the 1 s target is checked on the perf baseline run
 *   (`tools/perf/baseline.ts`, "Desk painted"), this spec allows the CI noise (2.5 s).
 * - **The motion.** The sample hero and a reopened tile lift, hold and grow into the page (a
 *   clone of the cover laid on the window, gone at rest), and the arriving page never shows its
 *   bare sheet: every frame in which it is visible already holds the cover or a render. Under
 *   reduced motion there is no clone.
 */
import { expect, type Page, test } from '@playwright/test';

import {
  fixturePath,
  openFixtures,
  PAGE_CANVAS,
  sessionSettled,
  useFileInputPicker,
  waitForSnapshot,
} from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });
// Reading a 400-page file to page 4 and closing it takes a while on a shared runner.
test.setTimeout(120_000);

/** CI noise allowance for the desk's paint mark (ms); the 1 s target is the perf baseline's. */
const PAINT_CEILING_MS = 2500;
const MARK = 'desk:painted';

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
  // A kept document asks before the tab leaves (the session writer); a person would accept.
  page.on('dialog', (dialog) => void dialog.accept());
});

const viewportOf = (page: Page) => page.locator('[data-read-viewport]');

/** How far the viewport's top is below page `index`'s top (rounded), or null. */
const offsetOf = (page: Page, index: number) =>
  page.evaluate((i) => {
    const el = document.querySelector<HTMLElement>('[data-read-viewport]');
    const target = el?.querySelector<HTMLElement>(`[data-page-index="${i}"]`);
    if (!el || !target) return null;
    return Math.round(el.getBoundingClientRect().top - target.getBoundingClientRect().top);
  }, index);

interface Left {
  readonly label: string;
  readonly offset: number;
}

/**
 * Opens `many-pages.pdf`, zooms in, sits 90 px into page 4, waits for the reader to note it and
 * closes the document. Resolves to the pill's text and the offset the reader was left at.
 */
async function readAndClose(page: Page): Promise<Left> {
  await page.goto('/?lang=en&desk=1');
  await sessionSettled(page);
  await openFixtures(page, ['many-pages.pdf']);
  await expect(viewportOf(page)).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Control+=');
  await page.evaluate(async () => {
    const el = document.querySelector<HTMLElement>('[data-read-viewport]');
    if (!el) throw new Error('no viewport');
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
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
  const pill = page.getByTestId('page-pill');
  await expect(pill).toHaveText(/^4 \/ \d+ · /);
  const label = await pill.innerText();
  const offset = await offsetOf(page, 3);
  expect(offset).not.toBeNull();
  // Closing reads the place from the page view before it leaves (`watchResume`), so there is
  // nothing to wait for: the document closes into Recent where it is.
  await page.keyboard.press('ControlOrMeta+w');
  await expect(page.getByTestId('home')).toBeVisible();
  return { label, offset: offset ?? 0 };
}

/** The page of the place kept on the newest Recents row in IndexedDB, or -1 (`files/recents.ts`). */
const storedPlacePage = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('pdf-editor:recents:v1');
        open.onerror = () => resolve(-1);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('entries')) {
            db.close();
            resolve(-1);
            return;
          }
          const all = db.transaction('entries').objectStore('entries').getAll();
          all.onsuccess = () => {
            db.close();
            const pages = (all.result as { place?: { page?: number } }[]).map(
              (entry) => entry.place?.page ?? -1,
            );
            resolve(Math.max(-1, ...pages));
          };
          all.onerror = () => {
            db.close();
            resolve(-1);
          };
        };
      }),
  );

/** The Continue card shows page 4 from a stored cover (a `blob:` image). */
async function expectContinueCover(page: Page): Promise<void> {
  const card = page.getByTestId('continue-card');
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('continue-page')).toHaveText(/^Page 4 of \d+/, {
    timeout: 30_000,
  });
  await expect(card.locator('[data-library-sheet] img[data-cover]')).toHaveAttribute(
    'src',
    /^blob:/,
    { timeout: 30_000 },
  );
}

/**
 * Presses Continue and expects the place again. A closed document reopens from its kept snapshot
 * with no dialog; where the browser keeps none, the file dialog opens ("Open again…") and the
 * test serves it with the same file.
 */
async function continueAndExpectPlace(page: Page, left: Left): Promise<void> {
  page.once('filechooser', (chooser) => void chooser.setFiles([fixturePath('many-pages.pdf')]));
  await page.getByTestId('continue-resume').click();
  await expect(page.getByTestId('home')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('page-pill')).toHaveText(left.label, { timeout: 30_000 });
  await expect
    .poll(() => offsetOf(page, 3), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(left.offset - 2);
  expect(await offsetOf(page, 3)).toBeLessThanOrEqual(left.offset + 2);
}

test('Continue after closing the document lands on the same page, zoom and offset', async ({
  page,
}) => {
  const left = await readAndClose(page);
  await expectContinueCover(page);
  await continueAndExpectPlace(page, left);
});

test('Continue after a cold start: covers from storage, no engine, the paint mark', async ({
  page,
  context,
}) => {
  const left = await readAndClose(page);
  await expectContinueCover(page);
  // The reader's place is on its Recents row in storage (the cover is: the card shows it from
  // there), so the new page below starts from what is kept on the device.
  await expect.poll(() => storedPlacePage(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
  await page.close();

  const fresh = await context.newPage();
  await useFileInputPicker(fresh);
  fresh.on('dialog', (dialog) => void dialog.accept());
  const wasm: string[] = [];
  fresh.on('request', (request) => {
    if (request.url().includes('.wasm')) wasm.push(request.url());
  });
  await fresh.goto('/?lang=en&desk=1');
  await sessionSettled(fresh);
  await expectContinueCover(fresh);

  // Every cover on the desk is a stored image, decoded.
  const covers = fresh.locator('[data-testid="home"] img[data-cover]');
  expect(await covers.count()).toBeGreaterThan(0);
  for (const src of await covers.evaluateAll((images) =>
    images.map((img) => img.getAttribute('src')),
  )) {
    expect(src).toMatch(/^blob:/);
  }

  // No engine before the first open: no worker of the page, no wasm requested.
  expect(fresh.workers(), 'no worker before the first open').toHaveLength(0);
  expect(wasm, 'no .wasm request before the first open').toEqual([]);

  // The paint mark exists and is within the CI allowance; the number is recorded.
  const painted = await fresh.evaluate(
    (name) => performance.getEntriesByName(name)[0]?.startTime ?? null,
    MARK,
  );
  expect(painted, `${MARK} exists`).not.toBeNull();
  expect(painted ?? Infinity).toBeLessThan(PAINT_CEILING_MS);
  test.info().annotations.push({ type: 'desk painted (ms)', description: String(painted) });
  console.log(`[masa] ${MARK} at ${painted} ms (cold start, service worker in control)`);

  await continueAndExpectPlace(fresh, left);
});

interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface Frame {
  /** The lifted or flying cover's box and opacity, when it is on the window. */
  readonly clone: (Box & { readonly opacity: number; readonly phase: string }) | null;
  /** The reader's computed opacity, when it is mounted. */
  readonly reader: number | null;
  readonly inline: string | null;
  readonly viewports: number;
  /** The first page's box, when it is laid out. */
  readonly page: Box | null;
  /** The arriving page canvas's state. */
  readonly state: string | null;
  /** The reader's chrome is being held out of sight (`data-open-hold`), and its highest opacity. */
  readonly hold: boolean;
  readonly chrome: number;
}

/** Records, on every frame of an opening, the cover, the reader, its first page and its chrome. */
async function recordOpening(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const frames: unknown[] = [];
    (window as unknown as { __opening: unknown[] }).__opening = frames;
    const box = (el: Element): unknown => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    const loop = () => {
      const clone = document.querySelector<HTMLElement>('[data-open-grow]');
      const viewport = document.querySelector<HTMLElement>('[data-read-viewport]');
      if (clone || viewport) {
        const first = viewport?.querySelector('[data-page-index="0"]');
        const canvas = viewport?.querySelector<HTMLElement>(
          '[data-page-index] canvas[data-layer="page"]',
        );
        const chrome = [
          ...document.querySelectorAll(
            '[data-top-piece]:not([data-top-piece="home"]), [data-capsule], [data-region="pill"]',
          ),
        ].map((el) => Number(getComputedStyle(el).opacity));
        frames.push({
          clone: clone
            ? {
                ...(box(clone) as object),
                opacity: Number(getComputedStyle(clone).opacity),
                phase: clone.dataset.openPhase ?? '',
              }
            : null,
          reader: viewport ? Number(getComputedStyle(viewport).opacity) : null,
          inline: viewport ? viewport.style.opacity : null,
          viewports: document.querySelectorAll('[data-read-viewport]').length,
          page: first ? box(first) : null,
          state: canvas?.dataset.state ?? null,
          hold: document.documentElement.hasAttribute('data-open-hold'),
          chrome: Math.max(0, ...chrome),
        });
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

const framesOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { __opening: Frame[] }).__opening);

/** What every opening from the desk must show, frame by frame (DSN-87, `masa.md` §2.7). */
function expectOneObjectTravelling(frames: readonly Frame[]): void {
  const widths = frames.flatMap((f) => (f.clone ? [f.clone.width] : []));
  expect(widths.length, 'the cover was drawn').toBeGreaterThanOrEqual(2);
  expect(Math.max(...widths), 'it grew').toBeGreaterThan(Math.min(...widths) * 1.4);
  // The desk is the only screen until the cover flies: no reader chrome while it is held.
  const held = frames.filter((f) => f.hold && f.clone && !f.clone.phase.startsWith('flying'));
  for (const frame of held) {
    expect(frame.chrome, 'the reader chrome while the cover is held').toBe(0);
  }
  // The reader shows (any opacity) only over the cover, and then it already holds the cover's
  // picture or a render, never its bare sheet.
  const shown = frames.filter((f) => f.clone && f.reader !== null && f.reader > 0.02);
  expect(shown.length, 'the cross-fade was seen').toBeGreaterThan(0);
  for (const frame of shown) {
    expect(frame.state, 'the page under the fading cover').not.toBe('placeholder');
  }
  // The cover lands: when the page starts to show, the cover lies on its box to within 2 px.
  const [first] = shown;
  if (first?.clone && first.page) {
    const { clone, page } = first;
    console.log(
      `[masa] landing: cover ${[clone.left, clone.top, clone.width, clone.height].map((v) => v.toFixed(1)).join(',')}` +
        ` page ${[page.left, page.top, page.width, page.height].map((v) => v.toFixed(1)).join(',')}`,
    );
  }
  for (const frame of shown) {
    const { clone, page } = frame;
    if (!clone || !page) continue;
    for (const side of ['left', 'top', 'width', 'height'] as const) {
      expect(
        Math.abs(clone[side] - page[side]),
        `cover vs page ${side} in phase ${clone.phase} (reader ${frame.reader}, inline '${frame.inline ?? ''}', ${frame.viewports} viewports, hold ${frame.hold})`,
      ).toBeLessThanOrEqual(2);
    }
  }
}

test('the sample hero lifts and grows into the page, which never shows its bare sheet', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Frame sampling is Chromium-only');
  await recordOpening(page);
  await page.goto('/?lang=en&desk=1');
  await sessionSettled(page);
  await page.getByTestId('desk-sample-open').click();
  await expect(page.locator(`[data-page-index="0"] ${PAGE_CANVAS}`)).toHaveAttribute(
    'data-state',
    'rendered',
    { timeout: 30_000 },
  );
  await expect(page.locator('[data-open-grow]')).toHaveCount(0, { timeout: 10_000 });
  expectOneObjectTravelling(await framesOf(page));
  // Focus lands where Open files… and the sample put it: the page view.
  await expect(page.locator('[data-read-viewport]')).toBeFocused();
});

test('a kept document reopened from its tile holds, then grows into a page that is never bare', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Frame sampling is Chromium-only');
  await recordOpening(page);
  await page.goto('/?lang=en&desk=1');
  await sessionSettled(page);
  await openFixtures(page, ['simple-text.pdf']);
  // A change makes the document worth keeping: rotate its first page, then close it.
  await page.keyboard.press('3');
  await page
    .locator('[role="gridcell"][data-page-id]')
    .first()
    .click({ modifiers: ['ControlOrMeta'] });
  await page.keyboard.press('Shift+R');
  await waitForSnapshot(page);
  await page.getByRole('tab', { name: 'simple-text' }).focus();
  await page.keyboard.press('Delete');
  await waitForSnapshot(page);

  const tile = page.locator('button[data-desk-tile][data-recent-id]').first();
  await expect(tile.locator('[data-library-sheet] img[data-cover]')).toHaveAttribute(
    'src',
    /^blob:/,
    { timeout: 30_000 },
  );
  const mark = (await framesOf(page)).length;
  await tile.click();
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`[data-page-index="0"] ${PAGE_CANVAS}`)).toHaveAttribute(
    'data-state',
    'rendered',
    { timeout: 30_000 },
  );
  await expect(page.locator('[data-open-grow]')).toHaveCount(0, { timeout: 10_000 });
  expectOneObjectTravelling((await framesOf(page)).slice(mark));
  await expect(page.locator('[data-read-viewport]')).toBeFocused();
});

test('an open that fails settles the cover back into its tile and changes nothing', async ({
  page,
}) => {
  // The sample's file cannot be fetched: the press lifts the cover, nothing opens, and after the
  // wait for an action it settles back (masa.md §2.7 step 6).
  await page.route(/recto-sample-.*\.pdf/, (route) => route.abort());
  await page.goto('/?lang=en&desk=1');
  await sessionSettled(page);
  const sheet = page.locator('[data-testid="desk-sample"] [data-library-sheet]');
  await page.getByTestId('desk-sample-open').click();
  await expect(page.locator('[data-open-grow]')).toHaveCount(1);
  await expect(page.locator('[data-open-grow]')).toHaveCount(0, { timeout: 20_000 });
  // The desk never changed: its cover is back, nothing is busy, no reader mounted.
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(sheet).toHaveCSS('opacity', '1');
  await expect(page.getByTestId('desk-sample-open')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-read-viewport]')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-open-hold', '');
});

test('under reduced motion nothing lifts or grows', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Frame sampling is Chromium-only');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await recordOpening(page);
  await page.goto('/?lang=en&desk=1');
  await sessionSettled(page);
  await page.getByTestId('desk-sample-open').click();
  await expect(page.locator(`[data-page-index="0"] ${PAGE_CANVAS}`)).toHaveAttribute(
    'data-state',
    'rendered',
    { timeout: 30_000 },
  );
  // The copy of the desk has faded away and the reader is no longer held.
  await expect(page.locator('html')).not.toHaveAttribute('data-open-hold', '');
  await expect(page.locator('[data-read-viewport]')).toHaveCSS('opacity', '1');
  const frames = await framesOf(page);
  expect(frames.filter((f) => f.clone)).toHaveLength(0);
});
