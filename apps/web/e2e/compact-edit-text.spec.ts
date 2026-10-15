/**
 * Editing text on phones (M10 WP5, EDN-17; design/phone-2026-10/README.md §3 row 1, §4), on the
 * `phone` project with CDP touch, on the sample's feature (`?sample`, the phone cut's justified
 * article, MOB-11; its page and paragraph come from the manifest): Edit text arms from the drawer; a
 * tap on a paragraph puts the focus in an editable at once, inside the tap (the stand-in that
 * makes iOS raise the keyboard), and the paragraph editor's mirror takes it over once laid out,
 * in 16 px at least; the island steps away for the keyboard's Done; typing and Done commit the
 * paragraph (the page's text reads the new word); the island's Undo takes it back.
 *
 * What only an iPhone can show (the keyboard really rising in the tap and staying up as the
 * focus moves to the mirror, Safari's own panning) is in the owner's hand check.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (editing a paragraph, Turkish,
 * dark and light, over a simulated keyboard).
 */
import { join } from 'node:path';

import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { sampleEntry } from './sample-manifest';

/**
 * The feature page of the phone cut, 0-based, and the first words of its fourth paragraph, the
 * last of column 1: free lines under it, so typed words grow into them and Done commits
 * straight away (the second paragraph has no room and asks how to fit, design §4 p3).
 */
const FEATURE_INDEX = sampleEntry('en', 'phone').featurePage - 1;
const PARAGRAPH: Readonly<Record<string, string>> = {
  en: sampleEntry('en', 'phone').edit.p4?.start ?? '',
  tr: sampleEntry('tr', 'phone').edit.p4?.start ?? '',
};
const paragraphStart = (page: Page) =>
  page.evaluate(() => document.documentElement.lang || 'en').then((l) => PARAGRAPH[l] ?? '');

const SHOTS = process.env.CAPTURE_SCREENSHOTS;
const WORD = 'Brightly';

async function shot(page: Page, name: string, settle = 400): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  if (settle > 0) await page.waitForTimeout(settle);
  const scheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  const lang = await page.evaluate(() => document.documentElement.lang || 'en');
  await page.screenshot({
    path: join(SHOTS, `D-edit-text-${name}-${lang}-${scheme}-${size?.width}x${size?.height}.png`),
  });
}

/** Opens the sample and brings the feature's fourth paragraph a third of the way down. */
async function openSample(page: Page, lang = 'en'): Promise<void> {
  await page.goto(`./?sample&lang=${lang}`);
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
  await page.evaluate(
    async ({ index, start }) => {
      const scroller = document.querySelector<HTMLElement>('[data-read-viewport]');
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const find = () =>
        [...document.querySelectorAll(`[data-page-index="${index}"] [data-text-layer] span`)].find(
          (el) => (el.textContent ?? '').startsWith(start),
        );
      for (let i = 0; i < 80 && scroller && !find(); i++) {
        scroller.scrollTop += scroller.clientHeight / 2;
        await frame();
        await frame();
      }
      const span = find();
      if (!scroller || !span) return;
      // Past it, then back up to it, since a scroll up shows the chrome again.
      const top =
        scroller.scrollTop +
        span.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top -
        scroller.clientHeight / 3;
      scroller.scrollTop = top + 80;
      await frame();
      await frame();
      scroller.scrollTop = top;
      await frame();
      await frame();
    },
    { index: FEATURE_INDEX, start: PARAGRAPH[lang] ?? '' },
  );
  await expect(page.locator(`[data-page-index="${FEATURE_INDEX}"] canvas`).first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

const capsule = (page: Page) => page.getByTestId('compact-capsule');
const undo = (page: Page) => page.getByTestId('compact-undo');
const mirror = (page: Page) => page.locator('[data-paragraph-mirror]');
const pageText = (page: Page) =>
  page.locator(`[data-page-index="${FEATURE_INDEX}"] [data-text-layer]`);

const drawer = (page: Page) => page.getByTestId('compact-tool-drawer');

/**
 * Enters editing and arms Edit text from the drawer (its tile is live, not "Soon"). The drawer
 * stays open (EDN-18); it is put away by its Done unless `keepOpen`.
 */
async function armEditText(page: Page, { keepOpen = false } = {}): Promise<void> {
  await page.getByTestId('compact-edit').click();
  await expect(capsule(page)).toHaveAttribute('data-editing');
  await page.getByTestId('compact-tool-more').click();
  const tile = drawer(page).getByRole('button', { name: /^(Edit text|Metni düzenle)$/ });
  await expect(tile).not.toHaveAttribute('aria-disabled', 'true');
  await tile.click();
  await expect(page.getByTestId('compact-tool-chip')).toHaveAccessibleName(
    /^(Edit text|Metni düzenle)$/,
  );
  await expect(drawer(page)).toBeVisible();
  if (keepOpen) return;
  await page.getByTestId('compact-drawer-done').click();
  await expect(drawer(page)).toHaveCount(0);
}

async function tap(cdp: CDPSession, at: { x: number; y: number }): Promise<void> {
  const point = { ...at, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/**
 * A point at the start of the feature's fourth paragraph ("Nobody, that is, except", in
 * Turkish "Nevin dışında kimsenin."): its first text-layer line.
 */
async function paragraphPoint(page: Page): Promise<{ x: number; y: number }> {
  const start = await paragraphStart(page);
  const line = pageText(page).locator('span').filter({ hasText: start }).first();
  await expect(line).toBeVisible();
  const box = await line.boundingBox();
  if (!box) throw new Error('no paragraph line on screen');
  return { x: box.x + 2, y: box.y + box.height / 2 };
}

/** The active element is an editable now: the stand-in or the mirror itself. */
async function editableFocused(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    return el instanceof HTMLElement && el.isContentEditable;
  });
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

test.describe('editing text on phones (M10 WP5)', () => {
  test('tap a paragraph, type, Done commits it, Undo takes it back', async ({ page }) => {
    await openSample(page);
    await armEditText(page, { keepOpen: true });

    const cdp = await page.context().newCDPSession(page);
    const at = await paragraphPoint(page);
    // With the drawer still open, the tap on the paragraph closes it and acts (EDN-18), where
    // the drawer leaves the paragraph uncovered (a phone held upright).
    await page.waitForTimeout(500);
    const top = (await drawer(page).boundingBox())?.y ?? 0;
    if (at.y >= top - 8) {
      await page.getByTestId('compact-drawer-done').click();
      await expect(drawer(page)).toHaveCount(0);
    }
    await tap(cdp, at);
    // The focus is in an editable as the tap returns: iOS raises the keyboard only for that.
    expect(await editableFocused(page)).toBe(true);

    await expect(drawer(page)).toHaveCount(0);

    // The paragraph editor opens and its mirror takes the focus over, set in 16 px at least.
    await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
    await expect(page.locator('[data-keyboard-hold]')).toHaveCount(0);
    const px = await mirror(page).evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).fontSize),
    );
    expect(px).toBeGreaterThanOrEqual(16);
    await expect(page.getByTestId('paragraph-header')).toContainText('Tap Done to apply');
    // The island steps away; Done rides where the keyboard will be.
    await expect(capsule(page)).toHaveAttribute('data-hidden');
    await expect(page.getByTestId('compact-edit-text-bar')).toBeVisible();

    const before = (await mirror(page).textContent()) ?? '';
    await page.keyboard.type(`${WORD} `);
    await expect(mirror(page)).toHaveText(new RegExp(`^${WORD} `));
    expect(((await mirror(page).textContent()) ?? '').length).toBe(before.length + WORD.length + 1);

    // A keyboard rises: Done stays above it and the paragraph above Done.
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    const keyboard = Math.round(view.height * 0.4);
    await simulateKeyboard(page, keyboard);
    await expect
      .poll(async () => (await page.getByTestId('compact-edit-text-bar').boundingBox())?.y ?? 0)
      .toBeLessThan(view.height - keyboard);
    const doneBox = await page.getByTestId('compact-edit-text-done').boundingBox();
    expect(doneBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Done commits: the editor closes, the island comes back, the page reads the new word.
    await page.getByTestId('compact-edit-text-done').click();
    await expect(mirror(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');
    await expect(pageText(page)).toContainText(WORD, { timeout: 20_000 });
    await expect(undo(page)).not.toHaveAttribute('aria-disabled', 'true');

    // Undo takes the paragraph back.
    await undo(page).click();
    await expect(pageText(page)).not.toContainText(WORD, { timeout: 20_000 });
    await expect(undo(page)).toHaveAttribute('aria-disabled', 'true');

    // Done on the island leaves editing.
    await page.getByTestId('compact-edit-done').click();
    await expect(capsule(page)).not.toHaveAttribute('data-editing');
  });

  test('a tap off the text holds no keyboard; Done on an unchanged paragraph writes nothing', async ({
    page,
  }) => {
    await openSample(page);
    await armEditText(page);
    const cdp = await page.context().newCDPSession(page);

    // A gap between pages is not a paragraph: nothing takes the focus.
    const first = await page.locator(`[data-page-index="${FEATURE_INDEX}"]`).boundingBox();
    if (!first) throw new Error('no page');
    await tap(cdp, { x: first.x + first.width / 2, y: first.y + first.height + 4 });
    expect(await editableFocused(page)).toBe(false);

    // A paragraph opens; Done leaves it unchanged, with no history entry.
    await tap(cdp, await paragraphPoint(page));
    await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
    await page.getByTestId('compact-edit-text-done').click();
    await expect(mirror(page)).toHaveCount(0);
    await expect(undo(page)).toHaveAttribute('aria-disabled', 'true');
  });
});

/** The mirror's caret as a text offset (it holds a node per drawn line). */
async function caretOffset(page: Page): Promise<number> {
  return page.evaluate(() => {
    const mirror = document.querySelector('[data-paragraph-mirror]');
    const selection = getSelection();
    if (!mirror || !selection?.focusNode || !mirror.contains(selection.focusNode)) return -1;
    const range = document.createRange();
    range.setStart(mirror, 0);
    range.setEnd(selection.focusNode, selection.focusOffset);
    return range.toString().length;
  });
}

/** The text of the mirror's lines (the drawn lines' breaks). */
async function mirrorLines(page: Page): Promise<string[]> {
  return mirror(page)
    .locator('[data-mirror-line]')
    .evaluateAll((lines) => lines.map((line) => line.textContent ?? ''));
}

/**
 * The iOS keyboard's trackpad, as WebKit runs it: from the caret's rectangle, the finger's
 * travel (`dx`, `dy`, CSS px), the point kept inside the focused editable's box, then the
 * position the topmost text there resolves to becomes the selection. The new offset, or -1
 * when the point did not resolve into the mirror.
 */
async function trackpad(page: Page, dx: number, dy: number): Promise<number> {
  return page.evaluate(
    ([moveX, moveY]) => {
      const mirror = document.querySelector('[data-paragraph-mirror]');
      const selection = getSelection();
      if (!mirror || !selection || selection.rangeCount === 0) return -1;
      const range = selection.getRangeAt(0).cloneRange();
      const caret = range.getClientRects()[0] ?? range.getBoundingClientRect();
      const box = mirror.getBoundingClientRect();
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const x = clamp(caret.left + moveX, box.left + 0.5, box.right - 0.5);
      const y = clamp(caret.top + caret.height / 2 + moveY, box.top + 0.5, box.bottom - 0.5);
      const at = document.caretPositionFromPoint(x, y);
      if (!at || !mirror.contains(at.offsetNode)) return -1;
      selection.collapse(at.offsetNode, at.offset);
      const before = document.createRange();
      before.setStart(mirror, 0);
      before.setEnd(at.offsetNode, at.offset);
      return before.toString().length;
    },
    [dx, dy] as const,
  );
}

test.describe('the hidden mirror on phones (EDN-17)', () => {
  test('the keyboard trackpad and moves follow; delete everything, retype, Done commits', async ({
    page,
  }) => {
    await openSample(page);
    await armEditText(page);
    const cdp = await page.context().newCDPSession(page);
    await tap(cdp, await paragraphPoint(page));
    await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
    const lines = await mirrorLines(page);
    expect(lines.length).toBeGreaterThan(1);
    const text = lines.join('');
    await expect(mirror(page)).toHaveText(text);

    // The trackpad, sideways: a few glyphs on along the first line, then a typed letter
    // lands there (the model follows the DOM caret).
    const start = await caretOffset(page);
    const right = await trackpad(page, 24, 0);
    expect(right).toBeGreaterThan(start);
    expect(right).toBeLessThan((lines[0] ?? '').length);
    await expect.poll(() => caretOffset(page)).toBe(right);
    await page.keyboard.type('X');
    await expect(mirror(page)).toHaveText(`${text.slice(0, right)}X${text.slice(right)}`);

    // Down a drawn line: the caret lands on the second line.
    const band = await mirror(page)
      .locator('[data-mirror-line]')
      .first()
      .evaluate((line) => line.getBoundingClientRect().height);
    const down = await trackpad(page, 0, band);
    const second = await mirrorLines(page);
    const lineStart = (second[0] ?? '').length;
    expect(down).toBeGreaterThanOrEqual(lineStart);
    expect(down).toBeLessThanOrEqual(lineStart + (second[1] ?? '').length);
    await page.keyboard.type('Y');
    await expect(mirror(page)).toContainText('Y');
    const typed = (await mirror(page).textContent()) ?? '';
    expect(typed.indexOf('Y')).toBe(down);

    // The selection's own moves (what assistive technology does) are followed too.
    const from = await caretOffset(page);
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) getSelection()?.modify('move', 'backward', 'character');
    });
    await expect.poll(() => caretOffset(page)).toBe(from - 3);
    await page.keyboard.type('Z');
    expect(((await mirror(page).textContent()) ?? '').indexOf('Z')).toBe(from - 3);

    // Delete everything: the emptied paragraph takes typing again, in its place.
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await expect(mirror(page)).toHaveText('');
    await expect(mirror(page)).toBeFocused();
    await page.keyboard.type('Hello Recto');
    await expect(mirror(page)).toHaveText('Hello Recto');
    expect(await caretOffset(page)).toBe('Hello Recto'.length);
    await page.keyboard.press('Backspace');
    await page.keyboard.type('o!');
    await expect(mirror(page)).toHaveText('Hello Recto!');
    await shot(page, 'retyped');
  });

  test('delete everything, retype, Done commits the new text', async ({ page }) => {
    await openSample(page);
    await armEditText(page);
    const cdp = await page.context().newCDPSession(page);
    await tap(cdp, await paragraphPoint(page));
    await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Hello Recto!');
    await expect(mirror(page)).toHaveText('Hello Recto!');
    await page.getByTestId('compact-edit-text-done').click();
    await expect(mirror(page)).toHaveCount(0, { timeout: 20_000 });
    await expect(pageText(page)).toContainText('Hello Recto!', { timeout: 20_000 });
  });

  test('the mirror lies over the paragraph in its drawn lines, at 16 px', async ({ page }) => {
    await openSample(page);
    await armEditText(page);
    const cdp = await page.context().newCDPSession(page);
    await tap(cdp, await paragraphPoint(page));
    await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
    const box = await mirror(page).boundingBox();
    if (!box) throw new Error('no mirror');
    // Topmost where the paragraph is drawn: a point there resolves into its text.
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-paragraph-mirror]') !== null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(hit).toBe(true);
    // Every line inside the box (nothing the trackpad cannot reach), the font still 16 px.
    const inside = await mirror(page)
      .locator('[data-mirror-line] > span')
      .evaluateAll((spans, outer) => {
        const o = outer;
        return spans.every((span) => {
          const r = span.getBoundingClientRect();
          return (
            r.left >= o.x - 1 &&
            r.right <= o.x + o.width + 1 &&
            r.top >= o.y - 1 &&
            r.bottom <= o.y + o.height + 1
          );
        });
      }, box);
    expect(inside).toBe(true);
    const px = await mirror(page).evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).fontSize),
    );
    expect(px).toBeGreaterThanOrEqual(16);
    await shot(page, 'mirror');
  });
});

test.describe('the selection bar’s Edit text (M10 WP5)', () => {
  test('opens the selected paragraph with the focus taken in the press', async ({ page }) => {
    await openSample(page);
    const bar = page.getByTestId('compact-selection-bar');
    // The bar's watch comes with the edit chunk, fetched when the browser is idle.
    await expect(async () => {
      await page.evaluate(
        ({ index, start }) => {
          const span = [
            ...document.querySelectorAll(`[data-page-index="${index}"] [data-text-layer] span`),
          ].find((el) => (el.textContent ?? '').startsWith(start));
          if (!span) throw new Error('no paragraph line');
          const range = document.createRange();
          range.selectNodeContents(span);
          getSelection()?.removeAllRanges();
          getSelection()?.addRange(range);
        },
        { index: FEATURE_INDEX, start: PARAGRAPH.en ?? '' },
      );
      await expect(bar).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    const cdp = await page.context().newCDPSession(page);
    const button = await bar.getByRole('button', { name: 'Edit text' }).boundingBox();
    if (!button) throw new Error('no Edit text');
    await tap(cdp, { x: button.x + button.width / 2, y: button.y + button.height / 2 });
    expect(await editableFocused(page)).toBe(true);
    await expect(capsule(page)).toHaveAttribute('data-editing');
    await expect(page.getByTestId('compact-tool-chip')).toHaveAccessibleName('Edit text');
    await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
    await expect(mirror(page)).toHaveText(new RegExp(`^${PARAGRAPH.en}`));
    await page.getByTestId('compact-edit-text-done').click();
    await expect(mirror(page)).toHaveCount(0);
  });
});

/** The review set (CAPTURE_SCREENSHOTS only): a paragraph being edited, Turkish, both schemes. */
for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`edit text review captures, tr ${colorScheme}`, () => {
    test.use({ colorScheme, deviceScaleFactor: 2 });

    test('captures', async ({ page }) => {
      test.skip(!SHOTS, 'screenshots only');
      await openSample(page, 'tr');
      await armEditText(page);
      const cdp = await page.context().newCDPSession(page);
      await tap(cdp, await paragraphPoint(page));
      await expect(mirror(page)).toBeFocused({ timeout: 20_000 });
      await page.keyboard.type('Parlak ');
      await shot(page, 'typing', 1200);
      const view = page.viewportSize() ?? { width: 390, height: 844 };
      const keyboard = Math.round(view.height * 0.4);
      await simulateKeyboard(page, keyboard);
      // A grey stand-in where the keyboard would be, for the review only.
      await page.evaluate((h) => {
        const stand = document.createElement('div');
        stand.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${h}px;background:#8e8e93;z-index:99;`;
        document.body.append(stand);
      }, keyboard);
      await shot(page, 'keyboard', 1200);
    });
  });
}
