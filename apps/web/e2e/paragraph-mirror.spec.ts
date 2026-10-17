/**
 * The paragraph editor's mirror under a mouse and a finger, in every engine (TXT-5, TXT-6;
 * EDN-17): the hidden mirror lies over the drawn lines and takes the presses, so a click, a
 * drag, a double and a triple click, a shift-click, a right-click and the clipboard must all
 * still act on the drawn text. Positions come from the mirror's own line blocks, which
 * `mirror-dom.ts` lays onto the drawn lines (each block's left edge is its line's first glyph),
 * so the spec reads no engine's text metrics. On the tablet project, a tap places the caret.
 *
 * The other paragraph specs run in Chromium only; this one is the mirror's cross-engine check.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { fixturePath, quiet, trackEngine, useFileInputPicker } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await trackEngine(page);
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
});

/** Opens the first paragraph of `word-tagged.pdf` ("The ferry left the quay…") for editing. */
async function openFerry(page: Page, tap = false): Promise<Locator> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await chooser).setFiles(fixturePath('text-edit-corpus/word-tagged.pdf'));
  await expect(page.getByRole('tab', { name: 'word-tagged' })).toBeVisible();
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await page.locator('[data-read-viewport]').focus();
  await page.keyboard.press('e');
  await expect(page.getByRole('button', { name: 'Edit text' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const ferry = page.locator('[data-text-edit-layer="0"] [data-text-run="T"]').first();
  await expect(ferry).toBeVisible({ timeout: 20_000 });
  const box = await ferry.boundingBox();
  if (!box) throw new Error('paragraph not laid out');
  if (tap) await page.touchscreen.tap(box.x + 1, box.y + box.height / 2);
  else await page.mouse.click(box.x + 1, box.y + box.height / 2);
  const editor = page.getByRole('textbox', { name: 'Paragraph on page 1' });
  await expect(editor).toBeFocused({ timeout: 20_000 });
  await expect(editor).toHaveText(/^The ferry left the quay at dawn/);
  return editor;
}

interface MirrorLine {
  readonly text: string;
  /** The line's first character, as a text offset. */
  readonly start: number;
  /** Where its first glyph is drawn and the line's middle, page px. */
  readonly left: number;
  readonly middle: number;
  /** The middle of its first word, page px (from the mirror's scaled span). */
  readonly firstWord: number;
}

/** The mirror's lines where they lie on the page. */
async function mirrorLines(page: Page): Promise<MirrorLine[]> {
  return page.locator('[data-paragraph-mirror]').evaluate((mirror) => {
    let start = 0;
    return [...mirror.querySelectorAll('[data-mirror-line] > span')].map((span) => {
      const text = span.textContent ?? '';
      const rect = span.getBoundingClientRect();
      const node = span.firstChild;
      let firstWord = rect.left;
      if (node) {
        const word = /^\S+/u.exec(text)?.[0].length ?? 1;
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, word);
        const r = range.getBoundingClientRect();
        firstWord = r.left + r.width / 2;
      }
      const line = { text, start, left: rect.left, middle: rect.top + rect.height / 2, firstWord };
      start += text.length;
      return line;
    });
  });
}

async function linesOf(page: Page): Promise<MirrorLine[]> {
  const lines = await mirrorLines(page);
  expect(lines.length).toBeGreaterThanOrEqual(3);
  return lines;
}

/** The text offsets of the mirror's DOM selection. */
async function selected(page: Page): Promise<{ anchor: number; focus: number }> {
  return page.locator('[data-paragraph-mirror]').evaluate((mirror) => {
    const selection = window.getSelection();
    const at = (node: Node | null, offset: number) => {
      if (!node || !mirror.contains(node)) return -1;
      const range = document.createRange();
      range.setStart(mirror, 0);
      range.setEnd(node, offset);
      return range.toString().length;
    };
    return {
      anchor: at(selection?.anchorNode ?? null, selection?.anchorOffset ?? 0),
      focus: at(selection?.focusNode ?? null, selection?.focusOffset ?? 0),
    };
  });
}

test.describe('with a mouse', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop pointer');

  test('a click at a drawn line’s start puts the caret there', async ({ page }) => {
    const editor = await openFerry(page);
    const before = (await editor.textContent()) ?? '';
    const [, second] = await linesOf(page);
    if (!second) throw new Error('no second line');
    await page.mouse.click(second.left + 1, second.middle);
    await expect.poll(() => selected(page)).toEqual({ anchor: second.start, focus: second.start });
    await page.keyboard.type('Z');
    await expect(editor).toHaveText(
      `${before.slice(0, second.start)}Z${before.slice(second.start)}`,
    );
  });

  test('a drag across drawn lines selects the text between', async ({ page }) => {
    const editor = await openFerry(page);
    const before = (await editor.textContent()) ?? '';
    const [first, , third] = await linesOf(page);
    if (!first || !third) throw new Error('no third line');
    await page.mouse.move(first.left + 1, first.middle);
    await page.mouse.down();
    await page.mouse.move(third.left + 1, third.middle, { steps: 6 });
    await page.mouse.up();
    // The browser's own placement after the release never wins over the drag's: read once
    // the page has handled the release.
    await quiet(page);
    await expect.poll(() => selected(page)).toEqual({ anchor: 0, focus: third.start });
    await page.keyboard.type('Q');
    await expect(editor).toHaveText(`Q${before.slice(third.start)}`);
  });

  test('a double click selects the word, a triple click the paragraph', async ({ page }) => {
    const editor = await openFerry(page);
    const before = (await editor.textContent()) ?? '';
    const [, second] = await linesOf(page);
    if (!second) throw new Error('no second line');
    const word = /^\S+/u.exec(second.text)?.[0] ?? '';
    expect(word.length).toBeGreaterThan(1);
    await page.mouse.dblclick(second.firstWord, second.middle);
    await expect
      .poll(() => selected(page))
      .toEqual({ anchor: second.start, focus: second.start + word.length });
    await page.keyboard.type('W');
    await expect(editor).toHaveText(
      `${before.slice(0, second.start)}W${before.slice(second.start + word.length)}`,
    );
    const now = (await editor.textContent()) ?? '';
    await page.mouse.click(second.firstWord, second.middle, { clickCount: 3 });
    await expect.poll(() => selected(page)).toEqual({ anchor: 0, focus: now.length });
    await page.keyboard.type('T');
    await expect(editor).toHaveText('T');
  });

  test('a shift-click extends the selection from the caret', async ({ page }) => {
    const editor = await openFerry(page);
    const before = (await editor.textContent()) ?? '';
    const [first, second] = await linesOf(page);
    if (!first || !second) throw new Error('no second line');
    await page.mouse.click(first.left + 1, first.middle);
    await page.keyboard.down('Shift');
    await page.mouse.click(second.left + 1, second.middle);
    await page.keyboard.up('Shift');
    await expect.poll(() => selected(page)).toEqual({ anchor: 0, focus: second.start });
    await page.keyboard.type('S');
    await expect(editor).toHaveText(`S${before.slice(second.start)}`);
  });

  test('a right-click on the paragraph keeps the editor and its text', async ({ page }) => {
    const editor = await openFerry(page);
    const before = (await editor.textContent()) ?? '';
    const [, second] = await linesOf(page);
    if (!second) throw new Error('no second line');
    await page.mouse.click(second.firstWord, second.middle, { button: 'right' });
    await expect(editor).toBeFocused();
    await expect(editor).toHaveText(before);
    await expect(page.locator('[data-paragraph-editor]')).toHaveCount(1);
  });

  test('copy across drawn lines copies the text, without the lines’ breaks', async ({ page }) => {
    const editor = await openFerry(page);
    const before = (await editor.textContent()) ?? '';
    const [first, , third] = await linesOf(page);
    if (!first || !third) throw new Error('no third line');
    // What the page puts on the clipboard, read in the copy event once the editor has written it.
    await page.evaluate(() => {
      window.addEventListener('copy', (event) => {
        (window as unknown as { copied?: string }).copied =
          event.clipboardData?.getData('text/plain') ?? '';
      });
    });
    await page.mouse.click(first.left + 1, first.middle);
    await page.keyboard.down('Shift');
    await page.mouse.click(third.left + 1, third.middle);
    await page.keyboard.up('Shift');
    await expect.poll(() => selected(page)).toEqual({ anchor: 0, focus: third.start });
    await page.keyboard.press('ControlOrMeta+c');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { copied?: string }).copied))
      .toBe(before.slice(0, third.start));
    await expect(editor).toHaveText(before);
  });
});

test.describe('with a finger', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'touch screens');

  test('a tap at a drawn line’s start puts the caret there', async ({ page }) => {
    const editor = await openFerry(page, true);
    const before = (await editor.textContent()) ?? '';
    const [, second] = await linesOf(page);
    if (!second) throw new Error('no second line');
    await page.touchscreen.tap(second.left + 1, second.middle);
    // A tap's own caret placement at the lift never wins over the editor's: read once the
    // page has handled the lift.
    await quiet(page);
    await expect.poll(() => selected(page)).toEqual({ anchor: second.start, focus: second.start });
    await page.keyboard.type('Z');
    await expect(editor).toHaveText(
      `${before.slice(0, second.start)}Z${before.slice(second.start)}`,
    );
  });
});

test('copied lines paste back as the same text, with no line breaks added', async ({
  page,
  context,
  browserName,
  hasTouch,
}) => {
  // Reading the system clipboard needs a permission only Chromium grants here; the copy event
  // above checks what the page writes in every engine.
  test.skip(browserName !== 'chromium' || hasTouch, 'clipboard permission, desktop pointer');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const editor = await openFerry(page);
  const before = (await editor.textContent()) ?? '';
  const [first, , third] = await linesOf(page);
  if (!first || !third) throw new Error('no third line');
  await page.mouse.click(first.left + 1, first.middle);
  await page.keyboard.down('Shift');
  await page.mouse.click(third.left + 1, third.middle);
  await page.keyboard.up('Shift');
  await page.keyboard.press('ControlOrMeta+c');
  const copied = before.slice(0, third.start);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(copied);
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(editor).toHaveText(`${before}${copied}`);
});
