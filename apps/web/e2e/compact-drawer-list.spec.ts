/**
 * The tool drawer's list variant (EDN-16; `shell/compact/mark/ToolList.tsx`), on the `phone` and
 * `phone-land` projects with CDP touch: `?drawer=list` swaps the tiles for one row per tool over
 * the island, and the tab keeps the choice; a first tap selects a row, a second opens its options
 * under it, a third folds them, one row open at a time; Done, a press outside and a swipe down
 * close it and the island comes back with the chosen tool's chip. Also New signature's sheet
 * keeps the pages behind it still (the landscape pad defect).
 */
import { type CDPSession, expect, type Page, test } from '@playwright/test';

const drawer = (page: Page) => page.getByTestId('compact-tool-drawer');
const capsule = (page: Page) => page.getByTestId('compact-capsule');
const chip = (page: Page) => page.getByTestId('compact-tool-chip');
const more = (page: Page) => page.getByTestId('compact-tool-more');
const row = (page: Page, tool: string) => drawer(page).locator(`[data-tool="${tool}"]`);
const options = (page: Page) => page.getByTestId('compact-drawer-options');

/** Every finite animation in the document has finished. */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== 'running' ||
            !Number.isFinite(Number(a.effect?.getComputedTiming().endTime)),
        ),
    undefined,
    { timeout: 10_000 },
  );
}

async function openSample(page: Page, query = 'drawer=list'): Promise<void> {
  await page.goto(`./?sample&${query}&lang=en`);
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
  await page.getByTestId('compact-edit').click();
  await expect(capsule(page)).toHaveAttribute('data-editing');
  // The island opens with the tool off (MOB-18); the chip turns Pen on.
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
  await chip(page).click();
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'true');
}

async function openList(page: Page): Promise<void> {
  await more(page).click();
  await expect(drawer(page)).toBeVisible();
  await settled(page);
}

/** One finger down `dy` px from `from`, by CDP touch. */
async function swipe(cdp: CDPSession, from: { x: number; y: number }, dy: number): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y, id: 1 }],
  });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x, y: from.y + (dy * i) / 8, id: 1 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('the drawer’s list variant (EDN-16)', () => {
  test('rows over the island: select, expand, fold, one at a time; Done brings the island back', async ({
    page,
  }) => {
    await openSample(page);
    await openList(page);
    await expect(drawer(page)).toHaveAttribute('data-variant', 'list');

    // Over the island, inset from the sides, never over 60 % of the screen.
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    const box = await drawer(page).boundingBox();
    const island = await capsule(page).boundingBox();
    if (!box || !island) throw new Error('not laid out');
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width - 16);
    expect(box.y + box.height).toBeGreaterThanOrEqual(island.y + island.height - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height);
    expect(box.y).toBeLessThanOrEqual(island.y);
    expect(box.height).toBeLessThanOrEqual(view.height * 0.6 + 1);
    // The island it covers has faded out under it.
    await expect(capsule(page)).toHaveCSS('opacity', '0');

    // One row per tool, top to bottom, each 52 px at least; Pen is current. Edit text is live
    // since WP5 (EDN-17).
    const tools = await drawer(page)
      .locator('[data-tool]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-tool')));
    expect(tools).toEqual(['pen', 'highlight', 'text', 'sign', 'edit-text']);
    for (const tool of tools) {
      expect((await row(page, tool ?? '').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(52);
    }
    await expect(row(page, 'pen')).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, 'pen')).toHaveAttribute('aria-expanded', 'false');
    await expect(row(page, 'edit-text')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(options(page)).toHaveCount(0);
    // The list covers the island's Undo, so its quiet row has its own (EDN-18); nothing yet.
    await expect(drawer(page).getByTestId('compact-drawer-undo')).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    // A tap on the current row opens its options under it.
    await row(page, 'pen').click();
    await expect(row(page, 'pen')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('compact-ink-options')).toBeVisible();

    // A first tap on another row selects it and folds the open one; the list stays.
    await row(page, 'highlight').click();
    await expect(row(page, 'highlight')).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, 'pen')).toHaveAttribute('aria-pressed', 'false');
    await expect(options(page)).toHaveCount(0);
    await expect(drawer(page)).toBeVisible();
    await expect(chip(page)).toHaveAccessibleName('Highlight');

    // Its second tap opens it, alone; a third folds it.
    await row(page, 'highlight').click();
    await expect(row(page, 'highlight')).toHaveAttribute('aria-expanded', 'true');
    await expect(options(page)).toHaveCount(1);
    await expect(page.getByTestId('compact-ink-options')).toBeVisible();
    await row(page, 'highlight').click();
    await expect(row(page, 'highlight')).toHaveAttribute('aria-expanded', 'false');
    await expect(options(page)).toHaveCount(0);

    // Edit text arms like any other row, and the list stays; then back to Highlight.
    await row(page, 'edit-text').click();
    await expect(row(page, 'edit-text')).toHaveAttribute('aria-pressed', 'true');
    await expect(drawer(page)).toBeVisible();
    await row(page, 'highlight').click();
    await expect(row(page, 'highlight')).toHaveAttribute('aria-pressed', 'true');

    // Done: the list goes back into the chip and the island shows again, whole.
    await page.getByTestId('compact-drawer-done').click();
    await expect(drawer(page)).toHaveCount(0);
    await settled(page);
    await expect(capsule(page)).toHaveCSS('opacity', '1');
    await expect(chip(page)).toHaveAccessibleName('Highlight');
    await expect(chip(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('closes by a press outside and a swipe down; the tab keeps the variant', async ({
    page,
  }) => {
    await openSample(page);
    await openList(page);
    await page.getByTestId('compact-drawer-scrim').dispatchEvent('pointerdown');
    await expect(drawer(page)).toHaveCount(0);

    await openList(page);
    const box = await drawer(page).boundingBox();
    if (!box) throw new Error('no drawer');
    const cdp = await page.context().newCDPSession(page);
    await swipe(cdp, { x: box.x + box.width / 2, y: box.y + 10 }, 112);
    await expect(drawer(page)).toHaveCount(0);
    await settled(page);
    await expect(capsule(page)).toHaveCSS('opacity', '1');

    // A reload without the parameter keeps the list for this tab; `?drawer=tiles` goes back.
    await page.goto('./?sample&lang=en');
    await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
      'data-state',
      'rendered',
    );
    await page.getByTestId('compact-edit').click();
    await openList(page);
    await expect(drawer(page)).toHaveAttribute('data-variant', 'list');
    await page.getByTestId('compact-drawer-done').click();
    await expect(drawer(page)).toHaveCount(0);

    await openSample(page, 'drawer=tiles');
    await openList(page);
    await expect(drawer(page)).not.toHaveAttribute('data-variant', 'list');
  });

  test('New signature keeps the pages behind it still', async ({ page }) => {
    await openSample(page);
    await openList(page);
    await row(page, 'sign').click();
    await expect(row(page, 'sign')).toHaveAttribute('aria-pressed', 'true');
    await row(page, 'sign').click();
    await expect(row(page, 'sign')).toHaveAttribute('aria-expanded', 'true');
    await page.getByTestId('compact-sign-new').click();
    const sheet = page.getByTestId('new-signature-sheet');
    await expect(sheet).toBeVisible();
    await settled(page);

    const pages = page.getByTestId('compact-pages');
    await expect(pages).toHaveAttribute('data-locked', '');
    const before = await pages.evaluate((el) => el.scrollTop);
    // A finger that slips off the pad over the sheet's title, and one on the pad itself.
    const cdp = await page.context().newCDPSession(page);
    const head = await sheet.boundingBox();
    if (!head) throw new Error('no sheet');
    await swipe(cdp, { x: head.x + head.width * 0.3, y: head.y + 40 }, -120);
    const pad = await sheet.locator('canvas[data-strokes]').boundingBox();
    if (pad) await swipe(cdp, { x: pad.x + pad.width / 2, y: pad.y + 10 }, -60);
    // Nothing may scroll: the swipes' momentum has no signal to wait on.
    await page.waitForTimeout(300);
    expect(await pages.evaluate((el) => el.scrollTop)).toBe(before);

    // Closed, the pages scroll again.
    // The phone sheet's round close (DSN-53).
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(pages).not.toHaveAttribute('data-locked', '');
  });
});
