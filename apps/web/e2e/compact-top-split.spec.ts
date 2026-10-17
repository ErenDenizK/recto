/**
 * The phone reader's split top (DSN-34, the default since DSN-37;
 * `shell/compact/CompactTopSplit.tsx`), on the `phone` and `phone-land` projects with touch: ‹ and
 * ⋯ as glass circles of their own and the title centred between them, cut in its middle when long
 * (DSN-38), over a scroll-edge fade in the theme's canvas tone (GLS-20); the ⋯ menu
 * keeps its rows, lies over its circle and grows out of it on the compositor (DSN-39, MOT-13), as
 * the file menu does out of the title; Find rides on the keyboard while the top stays (DSN-39);
 * the pieces hide on scroll with the capsule. `?top=capsule` keeps the capsule top (DSN-32), its
 * ⋯ menu below it on the container transform (DSN-36), Find in its field.
 */
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { useFileInputPicker } from './helpers';
import { expectGlassClean, settleAnimations } from './support/glass-walker';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(SHOTS, `${name}-${size?.width}x${size?.height}.png`) });
}

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

/** The container transform is fetched once the browser is idle after the reader opens. */
async function idle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestIdleCallback(() => resolve(), { timeout: 4000 })),
  );
  await page.waitForTimeout(300);
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

/** Opens a copy of the sample under `name` through Open PDF, and waits for its first page. */
async function openNamed(page: Page, name: string, fromReader = false): Promise<void> {
  if (fromReader) {
    // Back to the Library (a reload would restore the open document).
    await back(page).click();
  } else {
    await useFileInputPicker(page);
    await page.goto('./?lang=en');
  }
  const bytes = await page.evaluate(async () => {
    const response = await fetch('./sample/recto-sample-phone-en.pdf');
    return [...new Uint8Array(await response.arrayBuffer())];
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open PDF' }).click();
  await (await chooser).setFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from(bytes),
  });
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

/**
 * Watches a menu's motion on the animation clock (PRC-14): whether it grew by a Web Animation of
 * its transform (`grown`, and the scale it started from), whether it was its tier's solid twin
 * while it did (`solid`, MOT-12), and whether any frame clipped or masked it (never since MOT-13:
 * transform and opacity only).
 */
async function watchMorph(page: Page, testId: string): Promise<void> {
  await page.evaluate((id) => {
    const seen = { grown: 0, solid: 0, clipped: 0, masked: 0, from: 1, run: Math.random() };
    (window as unknown as { __morph: typeof seen }).__morph = seen;
    const tick = () => {
      if ((window as unknown as { __morph: typeof seen }).__morph !== seen) return;
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (el) {
        const style = getComputedStyle(el);
        const grow = el
          .getAnimations()
          .find((a) =>
            (a.effect as KeyframeEffect | null)?.getKeyframes().some((k) => k.transform),
          );
        if (el.hasAttribute('data-liquid') && grow) {
          seen.grown++;
          const first = String((grow.effect as KeyframeEffect).getKeyframes()[0]?.transform);
          const scale = Number(/scale\(([\d.]+)/.exec(first)?.[1] ?? 1);
          seen.from = Math.min(seen.from, scale);
          if (el.hasAttribute('data-glass-moving')) seen.solid++;
        }
        if (style.clipPath !== 'none') seen.clipped++;
        const mask = style.maskImage || style.getPropertyValue('-webkit-mask-image');
        if (mask && mask !== 'none') seen.masked++;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, testId);
}

const morphSeen = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __morph: { grown: number; solid: number; clipped: number; masked: number; from: number };
        }
      ).__morph,
  );

test.describe('the split top (DSN-34)', () => {
  test('‹, the title and ⋯ as pieces; the ⋯ menu grows out of its circle; hides on scroll', async ({
    page,
  }) => {
    await openSample(page, '');
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

    await idle(page);

    // ⋯: Contents and About (the copy and Document info are the file menu's, DSN-48), the
    // menu over its circle, grown out of it on the compositor (MOT-13): a transform from about
    // the circle's size, solid while it grows (MOT-12), never clipped or masked.
    await watchMorph(page, 'compact-menu');
    await tapCentre(page, more(page));
    if (SHOTS) {
      // Mid-morph: the circle and the growing blob as one body, its rim along the union.
      await page.waitForTimeout(140);
      await page.screenshot({
        path: join(SHOTS, `menu-mid-morph-${view.width}x${view.height}.png`),
      });
    }
    await expect(menu(page)).toBeVisible();
    await expect(menu(page)).not.toHaveAttribute('data-ct');
    await settled(page);
    await expect(menu(page)).not.toHaveAttribute('data-liquid');
    const opened = await morphSeen(page);
    expect(opened.grown).toBeGreaterThan(0);
    expect(opened.solid).toBe(opened.grown);
    expect(opened.from).toBeLessThan(0.5);
    expect(opened.clipped).toBe(0);
    expect(opened.masked).toBe(0);
    await expect(menu(page).getByRole('menuitem')).toHaveText(['Contents', 'About Recto']);
    await expectGlassClean(page, 'the split top with ⋯ open');
    const menuBox = await menu(page).boundingBox();
    if (!menuBox) throw new Error('no menu');
    expect(menuBox.y).toBeLessThanOrEqual(moreBox.y + 1);
    expect(menuBox.x + menuBox.width).toBeGreaterThanOrEqual(moreBox.x + moreBox.width - 1);
    // At rest nothing of the motion is left on it (Q-2): no mask, clip, transform or fade.
    expect(
      await menu(page).evaluate((el) => {
        const style = getComputedStyle(el);
        const first = el.firstElementChild;
        const content = first ? getComputedStyle(first).opacity : '1';
        const own = el.getAttribute('style') ?? '';
        const rim = getComputedStyle(el, '::after').content;
        return `${style.transform} ${style.clipPath} ${style.maskImage} ${content} ${rim} ${own}`;
      }),
    ).toBe('none none none 1 none ');
    // Back into the circle on a tap outside.
    await watchMorph(page, 'compact-menu');
    await page.touchscreen.tap(view.width / 2, view.height / 2);
    await expect(menu(page)).toHaveCount(0);
    const closed = await morphSeen(page);
    expect(closed.grown).toBeGreaterThan(0);
    expect(closed.clipped + closed.masked).toBe(0);

    // A row that opens a sheet hands off at once; the sheet takes the chrome away.
    await tapCentre(page, more(page));
    await menu(page).getByRole('menuitem', { name: 'Contents' }).click();
    const contents = page.getByTestId('compact-contents-sheet');
    await expect(contents).toBeVisible();
    await expect(topBar(page)).toHaveAttribute('data-hidden');
    await page.keyboard.press('Escape');
    await expect(contents).toHaveCount(0);
    await expect(topBar(page)).not.toHaveAttribute('data-hidden');

    // The title's ▾: the file menu, grown out of the title, the name whole, Document info.
    await watchMorph(page, 'compact-file-menu');
    await tapCentre(page, titleTrigger(page));
    const fileMenu = page.getByTestId('compact-file-menu');
    await expect(fileMenu).toBeVisible();
    await settled(page);
    expect((await morphSeen(page)).grown).toBeGreaterThan(0);
    await expect(fileMenu).not.toHaveAttribute('data-liquid');
    await expect(fileMenu.getByTestId('compact-file-name')).toHaveText(/\.pdf$/);
    await expect(fileMenu).toContainText(/PDF · .+ · \d+ pages/);
    await expect(fileMenu.getByRole('menuitem', { name: 'Document info' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fileMenu).toHaveCount(0);

    // Find, the capsule's (DSN-48), rides on the keyboard; the top stays (DSN-37).
    await capsule(page).getByRole('button', { name: 'Find' }).click();
    await expect(page.getByRole('searchbox')).toBeFocused();
    await expect(topBar(page)).toHaveAttribute('data-variant', 'split');
    await expect(page.getByTestId('compact-find-bar')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('compact-find-bar')).toHaveCount(0);
    await expect(topBar(page)).toHaveAttribute('data-variant', 'split');

    // ‹ goes back to the Library.
    await tapCentre(page, back(page));
    await expect(page.getByTestId('compact-library')).toBeVisible();
  });

  test('the tab keeps the choice; ?top=split goes back to the default', async ({ page }) => {
    await openSample(page, '&top=capsule');
    await expect(topBar(page)).not.toHaveAttribute('data-variant');
    await openSample(page, '');
    await expect(topBar(page)).not.toHaveAttribute('data-variant');
    await openSample(page, '&top=split');
    await expect(topBar(page)).toHaveAttribute('data-variant', 'split');
  });

  test('?top=capsule: the capsule top is unchanged, its ⋯ menu below it', async ({ page }) => {
    await openSample(page, '&top=capsule');
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
    // Find, the capsule's, is the bar's own field there; ⋯ keeps the copy and Document info.
    await bar.getByRole('button', { name: 'More' }).click();
    await expect(menu(page).getByRole('menuitem', { name: 'Document info' })).toBeVisible();
    await page.keyboard.press('Escape');
    await capsule(page).getByRole('button', { name: 'Find' }).click();
    await expect(bar.getByRole('searchbox')).toBeFocused();
    await expect(page.getByTestId('compact-find-bar')).toHaveCount(0);
  });

  test('the title is centred between the circles and cut in its middle when long', async ({
    page,
  }) => {
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    test.setTimeout(60_000);
    // Longer than the room on a phone on its side too.
    const name =
      'Serway_Physics_for_Scientists_and_Engineers_with_Modern_Physics_Ninth_Edition_International_Student_Version_Jewett';
    await openNamed(page, `${name}.pdf`);
    const text = page.getByTestId('compact-title-text');
    // The cut keeps the start and the end around one ellipsis; the accessible name is whole.
    await expect(text).toHaveText(/^Serway_Ph.*….*Jewett$/);
    await expect(titleTrigger(page)).toHaveAccessibleName(new RegExp(name));
    // Centred on the window between the circles, and clear of them.
    const backBox = await back(page).boundingBox();
    const moreBox = await more(page).boundingBox();
    const box = await titleTrigger(page).boundingBox();
    if (!backBox || !moreBox || !box) throw new Error('not laid out');
    expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThanOrEqual(1);
    expect(box.x).toBeGreaterThanOrEqual(backBox.x + backBox.width);
    expect(box.x + box.width).toBeLessThanOrEqual(moreBox.x);
    expect(await text.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
    await shot(page, 'title-long');

    // A short name stays whole and centred too.
    await openNamed(page, 'Memo.pdf', true);
    await expect(page.getByTestId('compact-title-text')).toHaveText('Memo');
    const short = await titleTrigger(page).boundingBox();
    if (!short) throw new Error('not laid out');
    expect(Math.abs(short.x + short.width / 2 - view.width / 2)).toBeLessThanOrEqual(1);
  });

  test('Find rides on the keyboard, else stands in the capsule’s place', async ({ page }) => {
    await openSample(page, '');
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    await capsule(page).getByRole('button', { name: 'Find' }).click();
    const bar = page.getByTestId('compact-find-bar');
    await expect(bar).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeFocused();
    // The top stays; the capsule has stepped away for the bar, which stands in its place.
    await expect(topBar(page)).toHaveAttribute('data-variant', 'split');
    await expect(back(page)).toBeVisible();
    await expect(capsule(page)).toHaveAttribute('data-hidden');
    await settled(page);
    const box = await bar.boundingBox();
    if (!box) throw new Error('no bar');
    expect(box.height).toBe(52);
    expect(Math.round(view.height - (box.y + box.height))).toBe(12);
    // ✓ · the field with its count · ▲ ▼.
    await expect(bar.getByRole('button', { name: 'Done' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Previous result' })).toBeDisabled();
    await page.getByRole('searchbox').fill('the');
    await expect(page.getByTestId('compact-find-count')).toHaveText(/^1 of \d+$/, {
      timeout: 15_000,
    });
    await bar.getByRole('button', { name: 'Next result' }).click();
    await expect(page.getByTestId('compact-find-count')).toHaveText(/^2 of \d+$/);

    // A keyboard rises (40 % of the screen's height, as compact-text.spec.ts simulates it): the
    // bar rides 8 px above it, by layout.
    const keyboard = Math.round(view.height * 0.4);
    await simulateKeyboard(page, keyboard);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.getPropertyValue('--kb-inset')),
      )
      .toBe(`${keyboard}px`);
    await expect
      .poll(async () => {
        const b = await bar.boundingBox();
        return b ? Math.round(view.height - (b.y + b.height)) : 0;
      })
      .toBe(keyboard + 8);
    await shot(page, 'find-on-keyboard');

    // ✓ closes Find; the capsule comes back and the inset goes with the bar.
    await bar.getByRole('button', { name: 'Done' }).click();
    await expect(bar).toHaveCount(0);
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');
    expect(
      await page.evaluate(() => document.documentElement.style.getPropertyValue('--kb-inset')),
    ).toBe('');
  });

  test('a found word lands clear of Find on the keyboard; on its side the top steps away', async ({
    page,
  }) => {
    await openSample(page, '');
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    const landscape = view.width > view.height;
    await capsule(page).getByRole('button', { name: 'Find' }).click();
    const bar = page.getByTestId('compact-find-bar');
    await expect(page.getByRole('searchbox')).toBeFocused();
    // A keyboard rises (40 % of the screen's height): the bar rides on it.
    const keyboard = Math.round(view.height * 0.4);
    await simulateKeyboard(page, keyboard);
    await expect
      .poll(async () => {
        const b = await bar.boundingBox();
        return b ? Math.round(view.height - (b.y + b.height)) : 0;
      })
      .toBe(keyboard + 8);
    // On its side the bar would reach the title row: the top steps away while the field has the
    // keyboard (DSN-44); upright it stays.
    if (landscape) {
      await expect(topBar(page)).toHaveAttribute('data-hidden');
      await expect(topBar(page)).toHaveAttribute('inert', '');
    } else {
      await expect(topBar(page)).not.toHaveAttribute('data-hidden');
    }
    await page.getByRole('searchbox').fill('the');
    await expect(page.getByTestId('compact-find-count')).toHaveText(/^1 of \d+$/, {
      timeout: 15_000,
    });
    const current = page.locator('[data-testid="search-highlights"] [data-current]');
    // Each hit shown lies in the free band: under the top (when it shows), above the bar.
    for (let step = 0; step < 4; step++) {
      await expect(current).toHaveCount(1);
      await settled(page);
      const hit = await current.boundingBox();
      const barBox = await bar.boundingBox();
      if (!hit || !barBox) throw new Error('no hit or bar');
      expect(hit.y + hit.height, `hit ${step + 1} above the bar`).toBeLessThanOrEqual(barBox.y - 8);
      const topFoot = landscape ? 0 : ((await back(page).boundingBox())?.y ?? 0) + 44;
      expect(hit.y, `hit ${step + 1} under the top`).toBeGreaterThanOrEqual(topFoot);
      if (step === 0) await shot(page, 'find-hit-on-keyboard');
      await bar.getByRole('button', { name: 'Next result' }).click();
      await page.getByRole('searchbox').focus();
    }
    // The keyboard goes: the top comes back.
    await simulateKeyboard(page, 0);
    await expect(topBar(page)).not.toHaveAttribute('data-hidden');
    await bar.getByRole('button', { name: 'Done' }).click();
    await expect(bar).toHaveCount(0);
    await expect(topBar(page)).not.toHaveAttribute('data-hidden');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`the fade and the title keep the theme's tone over any page, ${theme} (GLS-20)`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await openSample(page, '');
      const root = page.getByTestId('compact-app');
      const edge = topBar(page).locator('[data-gpu-glass="edge"]');
      // The fade's gradient and the title's ink, as the engine resolves them.
      const look = async () => ({
        fade: await edge.evaluate((el) => getComputedStyle(el).backgroundImage),
        ink: await titleTrigger(page).evaluate((el) => getComputedStyle(el).color),
      });
      // Nothing reads the page for a tone any more.
      await expect(root).not.toHaveAttribute('data-edge-tone');
      const atTop = await look();
      // The title is the theme's primary text: light ink in dark, dark ink in light.
      const brightness = (rgb: string) => {
        const [r = 0, g = 0, b = 0] = (rgb.match(/\d+(\.\d+)?/g) ?? []).map(Number);
        return (r + g + b) / 3;
      };
      if (theme === 'dark') expect(brightness(atTop.ink)).toBeGreaterThan(180);
      else expect(brightness(atTop.ink)).toBeLessThan(80);
      // The cover, a night photograph, under the band; the chrome back with a short scroll up.
      await scrollPages(page, 240);
      await scrollPages(page, -40);
      await expect(topBar(page)).not.toHaveAttribute('data-hidden');
      await settled(page);
      expect(await look()).toEqual(atTop);
      await shot(page, `edge-cover-${theme}`);
      // The editor's letter, a white page, under the band.
      // Pages mount as they near the screen: scroll until the letter's top has passed the band.
      await pages(page).evaluate(async (el) => {
        for (let i = 0; i < 40; i++) {
          const next = el.querySelector<HTMLElement>('[data-page-index="1"]');
          const top = next?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
          if (top < -120) return;
          el.scrollTop += Math.min(300, top + 160);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      });
      await scrollPages(page, -40);
      await expect(topBar(page)).not.toHaveAttribute('data-hidden');
      await settled(page);
      expect(await look()).toEqual(atTop);
      await shot(page, `edge-light-page-${theme}`);
    });
  }

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the ⋯ menu only fades in and out', async ({ page }) => {
      await openSample(page, '');
      await idle(page);
      await watchMorph(page, 'compact-menu');
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
      expect((await morphSeen(page)).grown).toBe(0);
      await page.keyboard.press('Escape');
      await expect(menu(page)).toHaveCount(0);
    });
  });
});
