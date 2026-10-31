/**
 * The desk's opening motion, exact resume and paint budget (DSN-87, Masa lane M3; behind Labs'
 * "Desk (new Home)", so every test opens `?desk=1`):
 *
 * - **Continue after close.** A document is read to page 4 at a zoom and 90 px into the page,
 *   then closed; the desk's Continue shows page 4 from a stored cover (a `blob:` image) and lands
 *   on the same page, zoom and offset (within 2 px). The sample joins Recents only once changed
 *   (02.14), so the test reads `many-pages.pdf`; the file comes back through the file dialog
 *   ("Open again…"), which the test serves.
 * - **Continue after a cold start.** The same in a new page of the same context (the tab lock is
 *   released): the covers are `blob:` images served from storage, the engine is never started
 *   before the first open (no worker, no `.wasm` request), and `recto:desk-painted` exists.
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

/** CI noise allowance for the desk's paint mark (ms); the 1 s target is the perf baseline's. */
const PAINT_CEILING_MS = 2500;
const MARK = 'recto:desk-painted';

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
  // The reader notes the place after a short quiet; then the document closes into Recent.
  await page.waitForTimeout(400);
  await page.keyboard.press('ControlOrMeta+w');
  await expect(page.getByTestId('home')).toBeVisible();
  return { label, offset: offset ?? 0 };
}

/** The Continue card shows page 4 from a stored cover (a `blob:` image). */
async function expectContinueCover(page: Page): Promise<void> {
  const card = page.getByTestId('continue-card');
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('continue-page')).toHaveText(/^Page 4 of \d+$/, {
    timeout: 30_000,
  });
  await expect(card.locator('[data-library-sheet] img[data-cover]')).toHaveAttribute(
    'src',
    /^blob:/,
    { timeout: 30_000 },
  );
}

/** Presses Continue; the file comes back through the dialog, and the place is found again. */
async function continueAndExpectPlace(page: Page, left: Left): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('continue-resume').click();
  await (await chooser).setFiles([fixturePath('many-pages.pdf')]);
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
  // The reader's place is on its Recents row and the cover is stored; let the writes settle.
  await waitForSnapshot(page).catch(() => undefined);
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

/** Records the clone's width on every frame it is on the window, and the arriving page's state. */
async function recordOpening(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface Frame {
      readonly clone: number;
      readonly viewport: string | null;
      readonly state: string | null;
    }
    const frames: Frame[] = [];
    (window as unknown as { __opening: Frame[] }).__opening = frames;
    const loop = () => {
      const clone = document.querySelector('[data-open-grow]');
      const viewport = document.querySelector<HTMLElement>('[data-read-viewport]');
      if (clone || viewport) {
        const canvas = viewport?.querySelector<HTMLElement>(
          '[data-page-index] canvas[data-layer="page"]',
        );
        frames.push({
          clone: clone ? clone.getBoundingClientRect().width : 0,
          viewport: viewport ? viewport.style.opacity : null,
          state: canvas?.dataset.state ?? null,
        });
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

const framesOf = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __opening: { clone: number; viewport: string | null; state: string | null }[];
        }
      ).__opening,
  );

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
  const frames = await framesOf(page);
  const grown = frames.map((f) => f.clone).filter((w) => w > 0);
  expect(grown.length, 'the clone was drawn').toBeGreaterThanOrEqual(2);
  expect(Math.max(...grown), 'it grew').toBeGreaterThan(Math.min(...grown) * 1.4);
  // Any frame in which the reader is visible (not held at 0) shows more than the bare sheet.
  for (const frame of frames) {
    const visible = frame.viewport === '' || Number(frame.viewport) > 0.02;
    if (visible && frame.clone > 0 && frame.state !== null) {
      expect(frame.state, 'the page under the dissolving clone').not.toBe('placeholder');
    }
  }
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
  const frames = (await framesOf(page)).slice(mark);
  const grown = frames.map((f) => f.clone).filter((w) => w > 0);
  expect(grown.length, 'the clone was drawn').toBeGreaterThanOrEqual(2);
  expect(Math.max(...grown), 'it grew').toBeGreaterThan(Math.min(...grown) * 1.4);
  for (const frame of frames) {
    const visible = frame.viewport === '' || Number(frame.viewport) > 0.02;
    if (visible && frame.clone > 0 && frame.state !== null) {
      expect(frame.state, 'the page under the dissolving clone').not.toBe('placeholder');
    }
  }
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
  await page.waitForTimeout(500);
  const frames = await framesOf(page);
  expect(frames.filter((f) => f.clone > 0)).toHaveLength(0);
});
