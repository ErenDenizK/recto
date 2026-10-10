/**
 * The sidebar end to end (`components/06-navigation.md` N1–N5; redesign spec D2-4), on the
 * desktop projects and the tablet:
 *
 * - **J4 sidebar 4** (flows.md §8.1): ▤ · drag thumbnail 5 above 2 · right-click thumbnail 7 ·
 *   Delete page, reading on; the drag is on the pointer path (mouse 4 px, a finger after a
 *   450 ms hold) and selects nothing.
 * - **S13**: a touch drag on the sidebar scrolls it and reorders nothing; a long press then a
 *   move reorders (tablet).
 * - **J15b 3**: page pill · Contents · the entry in the sidebar's Contents tree, which jumps.
 * - **J11 3** by the Find section's prompt: Find (the sidebar opens on "No text on these
 *   pages") · Recognize text… · Recognize 2 pages; then Review offers Words to check (X33).
 * - The width is kept per device; the section's own Find field shows only below 1280 px.
 */
import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test';

import { openFixtures, reloadFresh, showSidebar, useFileInputPicker } from './helpers';

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
});

const list = (page: Page) => page.getByRole('listbox', { name: /^Pages of / });
const thumb = (page: Page, n: number) =>
  list(page).getByRole('option', { name: `Page ${n}`, exact: true });

/**
 * The document's first page ids in order, read from the thumbnails on screen (the list is
 * virtualized; their position is `aria-posinset`). The reader renders only the pages near
 * the one being read.
 */
const order = (page: Page) =>
  list(page)
    .getByRole('option')
    .evaluateAll((els) =>
      els
        .map(
          (el) =>
            [Number(el.getAttribute('aria-posinset')), el.getAttribute('data-page-id')] as const,
        )
        .sort((a, b) => a[0] - b[0])
        .filter(([at], i) => at === i + 1)
        .slice(0, 8)
        .map(([, id]) => id ?? ''),
    );

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not laid out');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** One finger through CDP: a press, the moves (each after `stepMs`), the release. */
async function finger(
  cdp: CDPSession,
  points: readonly { x: number; y: number }[],
  options: { readonly holdMs?: number; readonly stepMs?: number } = {},
): Promise<void> {
  const [first, ...rest] = points;
  if (!first) return;
  const at = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 0 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(first) });
  if (options.holdMs) await new Promise((r) => setTimeout(r, options.holdMs));
  for (const point of rest) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(point) });
    if (options.stepMs) await new Promise((r) => setTimeout(r, options.stepMs));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('J4 by the sidebar in 4 steps: ▤ · drag 5 above 2 · right-click 7 · Delete page', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'tablet', 'mouse path; the tablet is S13 below');
  await openFixtures(page, ['many-pages.pdf']);
  await expect(page.getByTestId('page-pill')).toHaveText(/^1 \/ 400 · /);

  // 1. ▤ (closed by default, 06-navigation N1).
  await expect(page.getByRole('navigation', { name: 'Sidebar' })).toHaveCount(0);
  await page.getByTestId('sidebar-toggle').click();
  await expect(thumb(page, 5)).toBeVisible();
  const before = await order(page);

  // 2. Drag thumbnail 5 above thumbnail 2: the gap shows while dragging, nothing is selected.
  const from = await centre(thumb(page, 5));
  const target = await thumb(page, 2).boundingBox();
  if (!target) throw new Error('no thumbnail 2');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 12, { steps: 3 });
  await expect(thumb(page, 5)).toHaveAttribute('data-dragged', '');
  await page.mouse.move(target.x + target.width / 2, target.y + 6, { steps: 12 });
  await expect(page.getByTestId('thumbnail-gap')).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(() => order(page))
    .toEqual([before[0], before[4], before[1], before[2], before[3], ...before.slice(5, 8)]);
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(0);

  // 3. Right-click thumbnail 7 · 4. Delete page.
  await thumb(page, 7).click({ button: 'right' });
  await page.getByTestId('thumbnail-menu').getByRole('menuitem', { name: 'Delete page 7' }).click();
  await expect(page.getByTestId('page-pill')).toHaveText(/^1 \/ 399 · /);
  await expect
    .poll(async () => (await order(page)).slice(0, 7))
    .toEqual([before[0], before[4], before[1], before[2], before[3], before[5], before[7]]);
  await expect(page.getByTestId('toast').getByText('Deleted page 7')).toBeVisible();
});

test('S13: a touch drag scrolls the sidebar and moves nothing; a long press then a move does', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'tablet', 'touch, on the tablet project');
  await openFixtures(page, ['many-pages.pdf']);
  await showSidebar(page, 'Pages', 'Thumbnails');
  const scroller = page.getByTestId('thumbnail-scroll');
  const before = await order(page);
  const cdp = await page.context().newCDPSession(page);

  // A finger that moves at once is a scroll (S13).
  const start = await centre(thumb(page, 3));
  await finger(
    cdp,
    Array.from({ length: 10 }, (_, i) => ({ x: start.x, y: start.y - i * 30 })),
    { stepMs: 16 },
  );
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await order(page)).toEqual(before);
  // The fling goes on after the finger lifts: back to the top only once it has come to rest, or
  // it scrolls on under the next press, which then lifts another thumbnail than the one measured.
  await expect
    .poll(() =>
      scroller.evaluate(async (el) => {
        const at = el.scrollTop;
        await new Promise((resolve) => setTimeout(resolve, 150));
        return el.scrollTop === at;
      }),
    )
    .toBe(true);
  await scroller.evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);

  // A 450 ms hold, then a move: thumbnail 4 lands above thumbnail 2.
  const from = await centre(thumb(page, 4));
  const above = await thumb(page, 2).boundingBox();
  if (!above) throw new Error('no thumbnail 2');
  const to = { x: from.x, y: above.y + 6 };
  await finger(
    cdp,
    [
      from,
      ...Array.from({ length: 10 }, (_, i) => ({
        x: from.x,
        y: from.y + ((to.y - from.y) * (i + 1)) / 10,
      })),
    ],
    { holdMs: 650, stepMs: 30 },
  );
  await expect
    .poll(() => order(page))
    .toEqual([before[0], before[3], before[1], before[2], ...before.slice(4, 8)]);
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(0);
});

test('J15b in 3 steps by the page pill; the sidebar Contents jumps too', async ({ page }) => {
  await openFixtures(page, ['outline-named-dests.pdf']);
  await expect(page.getByTestId('page-pill')).toHaveText(/^1 \/ 6 · /);
  // 1. The pill · 2. its Contents row, which opens the sidebar's Contents (F11 §6, r15: the
  // menu no longer repeats the outline) · 3. the entry.
  await page.getByTestId('page-pill').click();
  await page.getByTestId('pill-contents').click();
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' });
  const tree = sidebar.getByRole('tree', { name: /^Contents of/ });
  await tree.getByRole('treeitem', { name: 'Appendix' }).click();
  await expect(page.getByTestId('page-pill')).toHaveText(/^6 \/ 6 · /);

  // The sidebar's Contents tree (06 N3): a click jumps, focus stays in the tree, and the
  // current location follows the page.
  await expect(sidebar.getByRole('button', { name: 'Contents' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(tree.getByRole('treeitem', { name: 'Appendix' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  await tree.getByRole('treeitem', { name: 'Chapter 1: Introduction' }).click();
  await expect(page.getByTestId('page-pill')).toHaveText(/^1 \/ 6 · /);
  await expect(tree.getByRole('treeitem', { name: 'Chapter 1: Introduction' })).toBeFocused();
});

test('the sidebar keeps its width on this device', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'the overlay is fixed at 320 (06.18)');
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixtures(page, ['simple-text.pdf']);
  const sidebar = await showSidebar(page, 'Pages');
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(280);
  const splitter = sidebar.getByRole('separator', { name: 'Resize sidebar' });
  await splitter.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(splitter).toHaveAttribute('aria-valuenow', '312');
  await reloadFresh(page);
  await openFixtures(page, ['simple-text.pdf']);
  // Open and 312 px wide, as this device left it.
  await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();
  await expect
    .poll(
      async () => (await page.getByRole('navigation', { name: 'Sidebar' }).boundingBox())?.width,
    )
    .toBe(312);
});

test('Find: one field from 1280 px; the section has its own below (06.20)', async ({
  page,
}, info) => {
  await openFixtures(page, ['simple-text.pdf']);
  const sidebar = await showSidebar(page, 'Find');
  const own = sidebar.getByRole('searchbox', { name: 'Find in document' });
  if (info.project.name === 'tablet') {
    // 820 px: the section's field edits the one query.
    await own.fill('quick');
    await expect(sidebar.getByTestId('search-hit')).toHaveCount(3, { timeout: 20_000 });
    await expect(sidebar.getByTestId('search-status')).toHaveText('1 of 3');
    return;
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(own).toHaveCount(0);
  await page.locator('[data-find-entry] input[type="search"]').first().fill('quick');
  await expect(sidebar.getByTestId('search-hit')).toHaveCount(3, { timeout: 20_000 });
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(own).toBeVisible();
  await expect(own).toHaveValue('quick');
});

test('J11 in 3 steps by the Find prompt, then Words to check in Review', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'one OCR run is enough; Chromium desktop');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixtures(page, ['scan-text.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });

  // 1. Find: nothing can match on a scan, so the sidebar opens on the prompt.
  await page.locator('[data-find-entry] input[type="search"]').first().click();
  const prompt = page.getByTestId('find-textless');
  await expect(prompt).toBeVisible({ timeout: 20_000 });
  await expect(prompt).toContainText('No text on these pages');
  // 2. Recognize text… · 3. Recognize 2 pages.
  await prompt.getByRole('button', { name: 'Recognize text…' }).click();
  const dialog = page.getByTestId('ocr-dialog');
  await dialog.getByRole('button', { name: 'Recognize 2 pages' }).click();
  const result = dialog.getByTestId('ocr-result');
  await expect(result).toBeVisible({ timeout: 180_000 });
  await dialog.getByRole('button', { name: 'Show results' }).click();
  await expect(dialog).toHaveCount(0);
  // The prompt goes once the pages carry text.
  await expect(prompt).toHaveCount(0, { timeout: 20_000 });

  // Review offers Words to check (X33): a row rings the word on the page.
  const sidebar = await showSidebar(page, 'Review');
  const words = sidebar.getByRole('radio', { name: /^Words to check/ });
  await expect(words).toBeVisible();
  await words.click();
  const rows = sidebar.getByTestId('review-word');
  await expect(rows).not.toHaveCount(0);
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('ocr-focus-ring')).toHaveCount(1);
});
