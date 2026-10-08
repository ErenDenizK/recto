/**
 * The Pages grid end to end (`components/06-navigation.md` PG1–PG6, `04-context` §10,
 * `07-sheets` S15; spec redesign D2-5, §10.3: `light-table.spec.ts` became this spec).
 *
 * - **J4 through the grid in 5 presses** (flows §8.1): mouse, Pages · drag page 5 before 2 ·
 *   Mod-click 7 · Delete · Done; touch (`tablet`), Pages · long-press drag 5 before 2 ·
 *   long-press 7 · Delete · Done. Each counted press is a `press`.
 * - **Open or select** (PG4 §6, owner feedback F4: the Photos model): outside selection mode a
 *   click or a tap opens the page; Select, Mod-click, a long press or the hover check start the
 *   mode, where a click or a tap toggles; Done ends it.
 * - **Combine with open documents** goes straight into the new document's grid, with one
 *   outcome: the sources stay open and untouched (INV-12); M8's Merge dialog is gone.
 * - **A drop on a tab** after 500 ms moves the pages to that document (F4 §6, PG5).
 * - **A locked document** lifts nothing: the drag is refused and says why (§2.3, §2.4).
 * - **Pinch in and out** (touch): two fingers step the cell size; spread past the largest size
 *   and release, and the page under the fingers opens (PG1 §6).
 * - **The view change** runs as one View Transition, and Esc clears the selection, then leaves.
 *
 * Native drag and drop is driven with the mouse (Playwright intercepts HTML5 drags in Chromium
 * and Firefox); WebKit's Playwright cannot start one, so those steps skip there. Touches go
 * through CDP and need the touch project.
 */
import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test';

import {
  expectOpenDocuments,
  fixturePath,
  openDocumentTitles,
  openFixtures,
  useFileInputPicker,
} from './helpers';

/** Counts the presses of one job (as `jobs.spec.ts`); a tap where the pointer is a finger. */
function counter(tap: boolean) {
  let count = 0;
  return {
    async press(target: Locator) {
      count += 1;
      await (tap ? target.tap() : target.click());
    },
    count() {
      count += 1;
    },
    get value() {
      return count;
    },
  };
}

const coarse = (page: Page) => page.evaluate(() => matchMedia('(pointer: coarse)').matches);
const grid = (page: Page) => page.getByTestId('light-table');
const cells = (page: Page) => grid(page).locator('[role="gridcell"][data-page-id]');
const bar = (page: Page) => page.getByTestId('pages-bar');

/** The grid's pages, in order, by id. */
async function order(page: Page): Promise<string[]> {
  return cells(page).evaluateAll((all) =>
    all.map((cell) => cell.getAttribute('data-page-id') ?? ''),
  );
}

async function open(page: Page, names: string[]): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await openFixtures(page, names);
}

/** Opens a corpus file from a subfolder (its tab drops the folder). */
async function openNested(page: Page, name: string): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await chooser).setFiles(fixturePath(name));
  const title = name.replace(/^.*\//, '').replace(/\.pdf$/, '');
  await expect(page.getByRole('tab', { name: title })).toBeVisible();
}

/**
 * Waits out the view change: while it runs, the transition's snapshot takes the pointer, so a
 * press would land on no cell.
 */
async function settled(page: Page): Promise<void> {
  await expect(grid(page)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-vt-grid')))
    .toBe(false);
}

/** Enters the grid with its key, 3 (`mode.arrange`), and waits for it to settle. */
async function enterGrid(page: Page): Promise<void> {
  await page.keyboard.press('3');
  await settled(page);
}

/**
 * The cell size's name, from the Size piece in either form (GridPieces.tsx): the slider's value,
 * or the folded button's name ("Thumbnail size Large") where the Pages bar leaves no room.
 */
async function cellSize(page: Page): Promise<string | null> {
  const slider = page.getByRole('slider', { name: 'Thumbnail size' });
  if ((await slider.count()) > 0) return slider.getAttribute('aria-valuetext');
  const button = page.locator('[data-grid-piece="size"]').getByRole('button');
  const name = (await button.getAttribute('aria-label')) ?? (await button.textContent()) ?? '';
  return /^Thumbnail size (.+)$/.exec(name.trim())?.[1] ?? null;
}

/** Shows All open through the Scope piece in either form: the radio, or the folded toggle. */
async function showAllOpen(page: Page): Promise<void> {
  const radio = page.getByRole('radio', { name: /^All open/ });
  if ((await radio.count()) > 0) await radio.click();
  else
    await page
      .locator('[data-grid-piece="scope"]')
      .getByRole('button', { name: 'All open' })
      .click();
}

type Finger = [number, number];

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', at: Finger[]) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: at.map(([x, y], id) => ({ x, y, id })),
  });
}

const centreOf = async (target: Locator): Promise<Finger> => {
  const box = await target.boundingBox();
  if (!box) throw new Error('not laid out');
  return [box.x + box.width / 2, box.y + box.height / 3];
};

test('J4: move page 5 before 2, delete 7 and keep reading, in 5 presses through the grid', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', "WebKit's Playwright cannot start a native drag");
  await openNested(page, 'demo/demo-report-v1.pdf');
  const touchy = await coarse(page);
  const job = counter(touchy);

  await job.press(
    page.getByRole('toolbar', { name: 'Document tools' }).getByRole('button', {
      name: 'Pages',
    }),
  );
  await settled(page);
  await expect(cells(page)).toHaveCount(10);
  // The grid opens on the page that was current, its cell focused (PG1 §4).
  await expect(cells(page).first()).toBeFocused();
  const before = await order(page);

  // Drag page 5 before page 2.
  const from = await centreOf(cells(page).nth(4));
  const to = await cells(page).nth(1).boundingBox();
  if (!to) throw new Error('no target');
  if (touchy) {
    const cdp = await page.context().newCDPSession(page);
    await touch(cdp, 'touchStart', [from]);
    await page.waitForTimeout(600);
    for (let i = 1; i <= 12; i++) {
      const x = from[0] + ((to.x + 4 - from[0]) * i) / 12;
      const y = from[1] + ((to.y + to.height / 3 - from[1]) * i) / 12;
      await touch(cdp, 'touchMove', [[x, y]]);
    }
    await expect(grid(page).getByTestId('insertion-bar')).toHaveAttribute('data-index', '1');
    await touch(cdp, 'touchEnd', []);
  } else {
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    await page.mouse.move(to.x + 4, to.y + to.height / 3, { steps: 12 });
    await expect(grid(page).getByTestId('insertion-bar')).toHaveAttribute('data-index', '1');
    await page.mouse.up();
  }
  job.count();
  const moved = [before[0], before[4], before[1], before[2], before[3], ...before.slice(5)];
  await expect.poll(() => order(page)).toEqual(moved);
  // Lifting and dropping never select (§2.4).
  await expect(grid(page).locator('[aria-selected="true"]')).toHaveCount(0);

  // Page 7 stays seventh: a Mod-click (a long press on touch) selects it; a plain click or tap
  // would open it (PG4 §6).
  if (touchy) {
    job.count();
    const cdp = await page.context().newCDPSession(page);
    const at = await centreOf(cells(page).nth(6));
    await touch(cdp, 'touchStart', [at]);
    await page.waitForTimeout(600);
    await touch(cdp, 'touchEnd', []);
  } else {
    job.count();
    await cells(page)
      .nth(6)
      .click({ modifiers: ['ControlOrMeta'] });
  }
  await expect(bar(page)).toContainText('1 selected');
  await job.press(bar(page).getByRole('button', { name: 'Delete' }));
  await expect(cells(page)).toHaveCount(9);
  await expect.poll(() => order(page)).toEqual(moved.filter((_, i) => i !== 6));
  // The delete took the selection, and selection mode with it: Done leaves the grid.
  await expect(bar(page).getByRole('button', { name: 'Select' })).toBeVisible();
  await job.press(bar(page).getByRole('button', { name: 'Done' }));
  await expect(grid(page)).toHaveCount(0);
  await expect(page.locator('[data-read-viewport]')).toBeVisible();
  expect(job.value).toBe(5);
});

test('Esc clears the selection, then leaves the grid; 3 enters and leaves it too', async ({
  page,
}) => {
  await open(page, ['simple-text.pdf']);
  await enterGrid(page);
  await cells(page)
    .nth(1)
    .click({ modifiers: ['ControlOrMeta'] });
  await expect(bar(page)).toContainText('1 selected');
  await page.keyboard.press('Escape');
  await expect(bar(page)).toContainText('3 pages');
  await expect(grid(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(grid(page)).toHaveCount(0);
  await enterGrid(page);
  await page.keyboard.press('3');
  await expect(grid(page)).toHaveCount(0);
});

test('a click opens a page; Select, then clicks toggle; Done ends selecting', async ({ page }) => {
  await open(page, ['simple-text.pdf']);
  const touchy = await coarse(page);
  const press = (target: Locator) => (touchy ? target.tap() : target.click());
  await enterGrid(page);
  // At rest the bar has no page acts, and nothing shows a check (owner feedback F4).
  await expect(bar(page).getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await expect(grid(page).locator('[data-selecting]')).toHaveCount(0);

  // Select: the circles show, a click or a tap toggles, and the bar shows the acts.
  await bar(page).getByRole('button', { name: 'Select' }).click();
  await expect(bar(page)).toContainText('Select pages');
  await expect(grid(page).locator('[data-selecting]')).toHaveCount(1);
  await press(cells(page).nth(0));
  await press(cells(page).nth(2));
  await expect(bar(page)).toContainText('2 selected');
  await expect(bar(page).getByRole('button', { name: 'Delete' })).toBeVisible();
  await expect(cells(page).nth(2)).toHaveAttribute('aria-selected', 'true');
  await press(cells(page).nth(2));
  await expect(cells(page).nth(2)).toHaveAttribute('aria-selected', 'false');
  await expect(bar(page)).toContainText('1 selected');

  // Done ends selecting and stays in the grid.
  await bar(page).getByRole('button', { name: 'Done' }).click();
  await expect(bar(page)).toContainText('3 pages');
  await expect(grid(page).locator('[aria-selected="true"]')).toHaveCount(0);
  await expect(grid(page)).toBeVisible();

  // Outside selection mode a click or a tap opens the page, on the page view.
  await settled(page);
  await press(cells(page).nth(2));
  await expect(grid(page)).toHaveCount(0);
  await expect(page.locator('[data-read-viewport] [data-page-index="2"]')).toBeInViewport({
    ratio: 0.3,
  });
});

test('the hover check starts selecting; deselecting the last page ends it', async ({ page }) => {
  test.skip(await coarse(page), 'a fine pointer hovers');
  await open(page, ['simple-text.pdf']);
  await enterGrid(page);
  const cell = cells(page).nth(1);
  const check = cell.locator('[data-select-toggle]');
  await expect(check).toHaveCSS('opacity', '0');
  await cell.hover();
  await expect(check).toHaveCSS('opacity', '1');
  await check.click();
  await expect(cell).toHaveAttribute('aria-selected', 'true');
  await expect(bar(page)).toContainText('1 selected');
  // Its badge sits inside the page's corner, never over its edge (owner feedback F4).
  const [badge, sheet] = await Promise.all([
    check.boundingBox(),
    cell.locator('[data-thumb]').boundingBox(),
  ]);
  if (!badge || !sheet) throw new Error('not laid out');
  expect(badge.x + badge.width).toBeLessThanOrEqual(sheet.x + sheet.width);
  expect(badge.y).toBeGreaterThanOrEqual(sheet.y);
  // A click toggles in the mode; the last page deselected ends it, and a click opens again.
  await cell.click();
  await expect(bar(page)).toContainText('3 pages');
  await expect(grid(page).locator('[data-selecting]')).toHaveCount(0);
  await cell.click();
  await expect(grid(page)).toHaveCount(0);
});

test('the grid opens by one View Transition, the page morphing into its cell', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'View Transitions are measured in Chromium');
  await open(page, ['simple-text.pdf']);
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __vt: string[] }).__vt = seen;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
      seen.push(document.documentElement.getAttribute('data-vt-grid') ?? '');
      const page = document.querySelector<HTMLElement>('[data-read-viewport] [data-page-id]');
      seen.push(page?.style.viewTransitionName ?? '');
      return start(arg);
    }) as typeof document.startViewTransition;
  });
  await page.keyboard.press('3');
  await expect(grid(page)).toBeVisible();
  const seen = await page.evaluate(() => (window as unknown as { __vt: string[] }).__vt);
  expect(seen).toEqual(['in', 'page-current']);
});

test('no header band: the title in the tab, scope and size float clear of the Pages bar', async ({
  page,
}, info) => {
  // Owner feedback 2026-10-08, F1 ("two bars too many"); PG2 as amended.
  test.skip(info.project.name === 'tablet', 'sizes desktop windows');
  await open(page, ['simple-text.pdf']);
  await enterGrid(page);
  await expect(page.locator('[data-grid-header]')).toHaveCount(0);
  await expect(page.getByTestId('document-menu')).toContainText('simple-text');
  await expect(page.getByTestId('grid-title-count')).toHaveText('3 pages');
  const pieces = page.locator('[data-grid-piece]');
  await expect(pieces).toHaveCount(2);

  const rects = () =>
    page.evaluate(() => {
      const box = (el: Element | null) => {
        const r = el?.getBoundingClientRect();
        return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
      };
      return {
        capsule: box(document.querySelector('[data-frame-layer="band"] [data-region="toolbar"]')),
        pieces: [...document.querySelectorAll('[data-grid-piece]')].map((el) => ({
          ...box(el),
          compact: el.hasAttribute('data-compact'),
          raised: el.hasAttribute('data-raised'),
        })),
      };
    });
  for (const width of [1440, 1180, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    for (const selected of [false, true]) {
      if (selected)
        await cells(page)
          .nth(1)
          .click({ modifiers: ['ControlOrMeta'] });
      await expect(bar(page)).toContainText(selected ? '1 selected' : '3 pages');
      // The capsule's morph and the pieces' folding settle.
      await page.waitForTimeout(700);
      const { capsule, pieces: found } = await rects();
      if (!capsule) throw new Error('no capsule');
      for (const piece of found) {
        const apart =
          (piece.right ?? 0) + 12 <= capsule.left + 0.5 ||
          (piece.left ?? 0) >= capsule.right + 12 - 0.5 ||
          (piece.bottom ?? 0) <= capsule.top + 0.5;
        expect(
          apart,
          `${width}, ${selected ? 'a page selected' : 'none'}: ${JSON.stringify({ capsule, piece })}`,
        ).toBe(true);
      }
      if (width === 1440 && !selected) {
        expect(found.every((piece) => !piece.compact)).toBe(true);
      }
      if (selected) await page.keyboard.press('Escape');
    }
  }
  // At 1024 with a page selected the Size piece folds to a button whose popover has the slider.
  await cells(page)
    .nth(1)
    .click({ modifiers: ['ControlOrMeta'] });
  await expect(bar(page)).toContainText('1 selected');
  const size = page.locator('[data-grid-piece="size"]');
  await expect(size).toHaveAttribute('data-compact');
  await size.getByRole('button', { name: /^Thumbnail size/ }).click();
  await expect(page.getByRole('slider', { name: 'Thumbnail size' })).toBeVisible();
});

test('Combine with open documents goes straight into the grid, the sources kept', async ({
  page,
}) => {
  await open(page, ['simple-text.pdf', 'rotated-pages.pdf']);
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox', { name: 'Search commands' }).fill('combine with open');
  await page.keyboard.press('Enter');
  const sheet = page.getByTestId('combine-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('combine-row')).toHaveCount(2);
  await expect(sheet.getByRole('status')).toHaveText('Creates 1 document with 7 pages');
  await sheet.getByRole('button', { name: 'Combine', exact: true }).click();

  // One outcome (INV-12): a new document after its sources, which stay open.
  await expectOpenDocuments(page, 3);
  const titles = await openDocumentTitles(page);
  expect(titles).toContain('simple-text');
  expect(titles).toContain('rotated-pages');
  await expect(grid(page)).toBeVisible();
  await expect(cells(page)).toHaveCount(7);
  await expect(page.getByTestId('grid-sources')).toHaveText(
    /^Sources: (simple-text, rotated-pages|rotated-pages, simple-text)$/,
  );
  await expect(page.getByTestId('combined-toast')).toBeVisible();
  // M8's Merge dialog, which replaced its sources, is gone.
  await expect(page.getByTestId('merge-all-dialog')).toHaveCount(0);
});

test('a drop on a tab after 500 ms moves the pages to that document', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', "WebKit's Playwright cannot start a native drag");
  test.skip(await coarse(page), 'touch has no tab drop (Move to instead)');
  await open(page, ['simple-text.pdf', 'rotated-pages.pdf']);
  await page.getByRole('tab', { name: 'simple-text' }).click();
  await page.keyboard.press('Escape');
  await enterGrid(page);
  await expect(cells(page)).toHaveCount(3);
  const [lifted] = await order(page);
  const tab = page.getByRole('tab', { name: 'rotated-pages' });
  const from = await centreOf(cells(page).nth(0));
  const at = await centreOf(tab);
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(at[0], at[1], { steps: 10 });
  const wrap = page.locator('[data-tab-drop]');
  await expect(wrap).toHaveAttribute('data-tab-drop', 'hover');
  // 500 ms on the tab arms it; the drop lands at that document's end and the grid shows it.
  await expect(wrap).toHaveAttribute('data-tab-drop', 'armed');
  await expect(wrap).toHaveAttribute('data-tab-drop-label', 'Move 1 page here');
  await page.mouse.up();
  // The grid's title is the strip's selected tab (owner feedback F1: no header band).
  await expect(page.getByTestId('document-menu')).toContainText('rotated-pages');
  await expect(cells(page)).toHaveCount(5);
  await expect.poll(async () => (await order(page)).at(-1)).toBe(lifted);
  await expect(
    page.getByTestId('toast').filter({ hasText: 'Moved 1 page to rotated-pages' }),
  ).toBeVisible();
  await expect(page.locator('[data-tab-drop]')).toHaveCount(0);
  // One Undo puts it back, and shows where it came from.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByTestId('document-menu')).toContainText('simple-text');
  await expect(cells(page)).toHaveCount(3);
});

test.describe('All open', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'WebKit cannot start a native drag');

  async function allOpen(page: Page): Promise<void> {
    await open(page, ['simple-text.pdf', 'rotated-pages.pdf']);
    await enterGrid(page);
    await showAllOpen(page);
    await expect(page.getByRole('grid')).toHaveCount(2);
    // The cells glide to their places (FLIP); wait until they rest.
    const lastCell = page.getByRole('grid', { name: 'rotated-pages' }).getByRole('gridcell').last();
    let previous = '';
    await expect
      .poll(async () => {
        const box = JSON.stringify(await lastCell.boundingBox());
        const still = box === previous;
        previous = box;
        return still;
      })
      .toBe(true);
  }
  const section = (page: Page, name: string) => page.getByRole('grid', { name });

  test('drags a page from one document into another, one undo step', async ({ page }) => {
    await allOpen(page);
    const source = section(page, 'simple-text').getByRole('gridcell').nth(0);
    const target = section(page, 'rotated-pages').getByRole('gridcell').nth(1);
    await expect(section(page, 'rotated-pages').getByRole('gridcell')).toHaveCount(4);
    await source.hover();
    await page.mouse.down();
    const box = await target.boundingBox();
    if (!box) throw new Error('target cell not laid out');
    // The right part of the second cell → the gap after it (index 2).
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.4, { steps: 12 });
    await expect(page.getByTestId('insertion-bar')).toHaveAttribute('data-index', '2');
    await page.mouse.up();
    await expect(section(page, 'rotated-pages').getByRole('gridcell')).toHaveCount(5);
    await expect(section(page, 'simple-text').getByRole('gridcell')).toHaveCount(2);
    await expect(page.getByTestId('insertion-bar')).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(section(page, 'simple-text').getByRole('gridcell')).toHaveCount(3);
  });

  test('a marquee selects across sections', async ({ page }) => {
    await allOpen(page);
    const last = section(page, 'simple-text').getByRole('gridcell').nth(2);
    const first = section(page, 'rotated-pages').getByRole('gridcell').nth(0);
    const from = await last.boundingBox();
    const to = await first.boundingBox();
    if (!from || !to) throw new Error('cells not laid out');
    // Start in the empty space right of the first section's last cell.
    await page.mouse.move(from.x + from.width + 60, from.y + 10);
    await page.mouse.down();
    await page.mouse.move(to.x + 10, to.y + 20, { steps: 8 });
    await expect(page.getByTestId('marquee')).toBeVisible();
    await page.mouse.up();
    // The rectangle spans both sections: pages of each are selected.
    const picked = (name: string) => section(page, name).locator('[aria-selected="true"]');
    await expect(picked('simple-text')).not.toHaveCount(0);
    await expect(picked('rotated-pages')).not.toHaveCount(0);
    const total = (await picked('simple-text').count()) + (await picked('rotated-pages').count());
    await expect(bar(page)).toContainText(`${total} selected`);
  });
});

test('a locked document lifts nothing and says why', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', "WebKit's Playwright cannot start a native drag");
  await open(page, ['simple-text.pdf']);
  await page.getByRole('tab', { name: 'simple-text' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Lock' }).click();
  await enterGrid(page);
  await expect(cells(page)).toHaveCount(3);
  const before = await order(page);
  const from = await centreOf(cells(page).nth(0));
  const to = await cells(page).nth(2).boundingBox();
  if (!to) throw new Error('no target');
  if (await coarse(page)) {
    const cdp = await page.context().newCDPSession(page);
    await touch(cdp, 'touchStart', [from]);
    await page.waitForTimeout(600);
    await touch(cdp, 'touchMove', [[from[0] + 40, from[1]]]);
    await touch(cdp, 'touchMove', [[to.x + to.width - 4, from[1]]]);
    await touch(cdp, 'touchEnd', []);
  } else {
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width - 4, to.y + 20, { steps: 10 });
    await page.mouse.up();
  }
  await expect(page.getByTestId('grid-lock-notice')).toHaveText('Locked · unlock first');
  expect(await order(page)).toEqual(before);
  // The Pages bar keeps its locked form: what changes nothing, and Unlock.
  await cells(page)
    .nth(1)
    .click({ modifiers: ['ControlOrMeta'] });
  await expect(bar(page).getByRole('button', { name: 'Unlock' })).toBeVisible();
  await expect(bar(page).getByRole('button', { name: 'Delete' })).toHaveCount(0);
});

test.describe('touch', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.use.hasTouch !== true, 'real touches need a touch project');
  });

  test('a pinch steps the cell size; past the largest, its release opens the page', async ({
    page,
  }) => {
    await openNested(page, 'demo/demo-report-v1.pdf');
    await enterGrid(page);
    await expect(cells(page)).toHaveCount(10);
    await expect.poll(() => cellSize(page)).toBe('Medium');
    const cdp = await page.context().newCDPSession(page);
    const box = await grid(page).boundingBox();
    if (!box) throw new Error('no grid');
    const centre: Finger = [box.x + box.width / 2, box.y + 260];
    const pair = (gap: number): Finger[] => [
      [centre[0] - gap / 2, centre[1]],
      [centre[0] + gap / 2, centre[1]],
    ];
    // Pinch in (fingers together): one size smaller.
    await touch(cdp, 'touchStart', pair(200));
    for (let gap = 190; gap >= 130; gap -= 10) await touch(cdp, 'touchMove', pair(gap));
    await touch(cdp, 'touchEnd', []);
    await expect.poll(() => cellSize(page)).toBe('Small');

    // Spread past Largest (4 steps of ×1.4 from Small, then 15 % more): the cells grow live,
    // the chip names the page now under the fingers, and the release opens that page.
    await touch(cdp, 'touchStart', pair(60));
    for (let gap = 80; gap <= 280; gap += 20) await touch(cdp, 'touchMove', pair(gap));
    await expect.poll(() => cellSize(page)).toBe('Largest');
    const chip = page.getByTestId('grid-pinch-chip');
    await expect(chip).toHaveAttribute('data-shown', '');
    const named = /^Release to open page (\d+)$/.exec((await chip.textContent())?.trim() ?? '');
    expect(named).not.toBeNull();
    const index = Number(named?.[1]) - 1;
    // Pinching back below the threshold hides it again.
    await touch(cdp, 'touchMove', pair(250));
    await expect(chip).not.toHaveAttribute('data-shown', '');
    await touch(cdp, 'touchMove', pair(280));
    await expect(chip).toHaveAttribute('data-shown', '');
    await touch(cdp, 'touchEnd', []);
    await expect(grid(page)).toHaveCount(0);
    await expect(page.locator(`[data-read-viewport] [data-page-index="${index}"]`)).toBeInViewport({
      ratio: 0.3,
    });
  });
});
