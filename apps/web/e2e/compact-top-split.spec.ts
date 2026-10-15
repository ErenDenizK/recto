/**
 * The phone reader's split top (DSN-34, `?top=split`; `shell/compact/CompactTopSplit.tsx`), on
 * the `phone` and `phone-land` projects with touch: ‹ and ⋯ as glass circles of their own and the
 * title as text over a scroll-edge fade, kept for the tab's session; the ⋯ menu keeps its rows,
 * lies over its circle and grows out of it (DSN-36); the title's ▾ opens the file menu; the
 * pieces hide on scroll with the capsule. With the flag off the capsule top (DSN-32) is as it was.
 */
import { expect, type Page, test } from '@playwright/test';

import { expectGlassClean, settleAnimations } from './support/glass-walker';

const topBar = (page: Page) => page.getByTestId('compact-top-bar');
const capsule = (page: Page) => page.getByTestId('compact-capsule');
const back = (page: Page) => page.getByTestId('compact-back');
const more = (page: Page) => page.getByRole('button', { name: 'More' });
const menu = (page: Page) => page.getByTestId('compact-menu');
const titleTrigger = (page: Page) => page.getByTestId('compact-title-menu-trigger');
const pages = (page: Page) => page.getByTestId('compact-pages');

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

async function openSample(page: Page, query: string): Promise<void> {
  await page.goto(`./?sample${query}&lang=en`);
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
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

async function tapCentre(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not laid out');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe('the split top (DSN-34)', () => {
  test('‹, the title and ⋯ as pieces; the ⋯ menu grows out of its circle; hides on scroll', async ({
    page,
  }) => {
    await openSample(page, '&top=split');
    await expect(topBar(page)).toHaveAttribute('data-variant', 'split');
    const view = page.viewportSize() ?? { width: 390, height: 844 };

    // Two 44 px circles at the row's ends, the title between them, nothing over 48 px high.
    const backBox = await back(page).boundingBox();
    const moreBox = await more(page).boundingBox();
    const titleBox = await titleTrigger(page).boundingBox();
    if (!backBox || !moreBox || !titleBox) throw new Error('not laid out');
    expect(backBox.width).toBe(44);
    expect(backBox.height).toBe(44);
    expect(moreBox.width).toBe(44);
    expect(backBox.x).toBeGreaterThanOrEqual(12);
    expect(moreBox.x + moreBox.width).toBeLessThanOrEqual(view.width - 12);
    expect(titleBox.x).toBeGreaterThan(backBox.x + backBox.width - 1);
    expect(titleBox.x + titleBox.width).toBeLessThan(moreBox.x + 1);
    expect(Math.abs(backBox.y + 22 - (moreBox.y + 22))).toBeLessThan(1);
    await expect(titleTrigger(page)).toContainText('Recto sample');
    // The glass rules hold, and the pieces and the fade count as one surface (Q-11): the top,
    // the capsule and the edit button.
    await settleAnimations(page);
    const rest = await expectGlassClean(page, 'the split top at rest');
    expect(rest.visible).toBe(3);

    // Hides on scroll with the capsule: away, inert, each piece faded on itself; back on a
    // scroll up. First, before a key or a press puts the focus in the chrome (`canHide`).
    await scrollPages(page, 300);
    await expect(topBar(page)).toHaveAttribute('data-hidden');
    await expect(topBar(page)).toHaveAttribute('inert', '');
    await expect(capsule(page)).toHaveAttribute('data-hidden');
    await settled(page);
    await expect.poll(() => back(page).evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await scrollPages(page, -40);
    await expect(topBar(page)).not.toHaveAttribute('data-hidden');
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');
    await settled(page);
    await expect.poll(() => back(page).evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

    // The container transform installs once the browser is idle after the reader opens.
    await page.evaluate(
      () => new Promise<void>((resolve) => requestIdleCallback(() => resolve(), { timeout: 4000 })),
    );
    await page.waitForTimeout(300);

    // ⋯: the same rows as the capsule top's, the menu over its circle, grown out of it.
    await tapCentre(page, more(page));
    await expect(menu(page)).toBeVisible();
    await expect(menu(page)).toHaveAttribute('data-ct', '');
    await settled(page);
    await expect(menu(page).getByRole('menuitem')).toHaveText([
      'Find',
      'Contents',
      'Go to page',
      /^(Share|Download a copy)$/,
      'Document info',
      'About Recto',
    ]);
    await expectGlassClean(page, 'the split top with ⋯ open');
    const menuBox = await menu(page).boundingBox();
    if (!menuBox) throw new Error('no menu');
    expect(menuBox.y).toBeLessThanOrEqual(moreBox.y + 1);
    expect(menuBox.x + menuBox.width).toBeGreaterThanOrEqual(moreBox.x + moreBox.width - 1);
    // At rest nothing of the motion is left on it (Q-2).
    expect(
      await menu(page).evaluate((el) => {
        const style = getComputedStyle(el);
        return `${style.transform} ${style.clipPath}`;
      }),
    ).toBe('none none');
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);

    // A row that opens a sheet hands off at once; the sheet takes the chrome away.
    await tapCentre(page, more(page));
    await menu(page).getByRole('menuitem', { name: 'Document info' }).click();
    const info = page.getByTestId('compact-info-sheet');
    await expect(info).toBeVisible();
    await expect(topBar(page)).toHaveAttribute('data-hidden');
    await info.getByRole('button', { name: 'Done' }).click();
    await expect(info).toHaveCount(0);
    await expect(topBar(page)).not.toHaveAttribute('data-hidden');

    // The title's ▾: the file menu, the name whole, Document info.
    await tapCentre(page, titleTrigger(page));
    const fileMenu = page.getByTestId('compact-file-menu');
    await expect(fileMenu).toBeVisible();
    await expect(fileMenu.getByTestId('compact-file-name')).toHaveText(/\.pdf$/);
    await expect(fileMenu).toContainText(/PDF · .+ · \d+ pages/);
    await expect(fileMenu.getByRole('menuitem', { name: 'Document info' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fileMenu).toHaveCount(0);

    // Find takes the capsule's field, then the split top comes back.
    await tapCentre(page, more(page));
    await menu(page).getByRole('menuitem', { name: 'Find' }).click();
    await expect(page.getByRole('searchbox')).toBeFocused();
    await expect(topBar(page)).not.toHaveAttribute('data-variant');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(topBar(page)).toHaveAttribute('data-variant', 'split');

    // ‹ goes back to the Library.
    await tapCentre(page, back(page));
    await expect(page.getByTestId('compact-library')).toBeVisible();
  });

  test('the tab keeps the choice; ?top=capsule goes back to the capsule top', async ({ page }) => {
    await openSample(page, '&top=split');
    await expect(topBar(page)).toHaveAttribute('data-variant', 'split');
    await openSample(page, '');
    await expect(topBar(page)).toHaveAttribute('data-variant', 'split');
    await openSample(page, '&top=capsule');
    await expect(topBar(page)).not.toHaveAttribute('data-variant');
  });

  test('flag off: the capsule top is unchanged, its ⋯ menu below it', async ({ page }) => {
    await openSample(page, '');
    const bar = topBar(page);
    await expect(bar).not.toHaveAttribute('data-variant');
    await expect(back(page)).toHaveCount(0);
    await expect(bar.getByRole('heading')).toHaveText('Recto sample');
    const box = await bar.boundingBox();
    if (!box) throw new Error('not laid out');
    expect(box.height).toBe(48);
    await expect(bar.getByRole('button', { name: 'More' })).toBeVisible();
    await bar.getByRole('button', { name: 'More' }).click();
    await expect(menu(page)).toBeVisible();
    await settled(page);
    const menuBox = await menu(page).boundingBox();
    if (!menuBox) throw new Error('no menu');
    expect(menuBox.y).toBeGreaterThanOrEqual(box.y + box.height);
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the ⋯ menu only fades in and out', async ({ page }) => {
      await openSample(page, '&top=split');
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => requestIdleCallback(() => resolve(), { timeout: 4000 })),
      );
      await page.waitForTimeout(300);
      await tapCentre(page, more(page));
      await expect(menu(page)).toBeVisible();
      const clips = await menu(page).evaluate((el) =>
        el
          .getAnimations()
          .flatMap((a) =>
            (a.effect as KeyframeEffect | null)?.getKeyframes().map((k) => k.clipPath ?? 'none'),
          ),
      );
      expect(clips.every((clip) => clip === 'none' || clip === undefined)).toBe(true);
      await settled(page);
      await page.keyboard.press('Escape');
      await expect(menu(page)).toHaveCount(0);
    });
  });
});
