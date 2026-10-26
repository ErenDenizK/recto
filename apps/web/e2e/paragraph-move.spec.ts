/**
 * Moving and resizing the open paragraph (TXT-24, behind the Labs toggle `?paraframe=1`) end to
 * end on the Chromium export `text-edit-corpus/word-tagged.pdf` and the two-column file: a drag
 * on the grip moves the frame and the drawn text with it, leaving commits one "Move paragraph"
 * step that the page's text shows, and one Undo puts it back; a side bar changes the width and
 * the lines wrap again, and never past the room beside the paragraph. The same drag by a finger
 * on a touch tablet (CDP touch events: Playwright's touchscreen only taps).
 */
import { expect, type Page, test } from '@playwright/test';

import { fixturePath, historyStep, inHistory, useFileInputPicker } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Covered in Chromium');

interface Point {
  readonly x: number;
  readonly y: number;
}

async function openCorpus(page: Page, name: string, tab: string, firstLetter: string) {
  await useFileInputPicker(page);
  await page.goto('./?lang=en&paraframe=1');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await chooser).setFiles(fixturePath(`text-edit-corpus/${name}`));
  await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await page.locator('[data-read-viewport]').focus();
  await page.keyboard.press('e');
  await expect(page.getByRole('button', { name: 'Edit text' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const first = page.locator(`[data-text-edit-layer="0"] [data-text-run="${firstLetter}"]`).first();
  await expect(first).toBeVisible({ timeout: 20_000 });
  return first;
}

/** The first run's top-left corner: where the page says the paragraph's text is. */
async function cornerOf(page: Page, letter: string): Promise<Point> {
  const run = page.locator(`[data-text-edit-layer="0"] [data-text-run="${letter}"]`).first();
  await expect(run).toBeVisible({ timeout: 20_000 });
  const box = await run.boundingBox();
  if (!box) throw new Error('run not laid out');
  return { x: box.x, y: box.y };
}

async function openParagraph(page: Page, letter: string, touch = false) {
  const run = page.locator(`[data-text-edit-layer="0"] [data-text-run="${letter}"]`).first();
  const box = await run.boundingBox();
  if (!box) throw new Error('paragraph not laid out');
  if (touch) await page.touchscreen.tap(box.x + 1, box.y + box.height / 2);
  else await page.mouse.click(box.x + 1, box.y + box.height / 2);
  const editor = page.getByRole('textbox', { name: 'Paragraph on page 1' });
  await expect(editor).toBeFocused({ timeout: 20_000 });
  await expect(page.getByTestId('paragraph-grip')).toBeVisible();
  return editor;
}

async function centreOf(page: Page, testId: string): Promise<Point> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} not shown`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A finger drag by CDP touch events. */
async function fingerDrag(page: Page, from: Point, by: Point): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', at?: Point) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: at ? [{ x: at.x, y: at.y, id: 1 }] : [],
    });
  await touch('touchStart', from);
  for (let step = 1; step <= 8; step++) {
    await touch('touchMove', { x: from.x + (by.x * step) / 8, y: from.y + (by.y * step) / 8 });
  }
  await touch('touchEnd');
}

/** How many drawn lines the mirror holds (one block per line). */
async function lineCount(page: Page): Promise<number> {
  return page.locator('[data-paragraph-mirror] > div').count();
}

test.describe('with a mouse', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a grip drag moves the box and the text; one Undo restores it', async ({ page }) => {
    await openCorpus(page, 'word-tagged.pdf', 'word-tagged', 'T');
    const before = await cornerOf(page, 'T');
    const editor = await openParagraph(page, 'T');
    const mirrorBefore = await editor.boundingBox();
    const grip = await centreOf(page, 'paragraph-grip');
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + 40, grip.y + 20, { steps: 8 });
    await page.mouse.move(grip.x + 80, grip.y + 40, { steps: 8 });
    await page.mouse.up();
    const mirrorAfter = await editor.boundingBox();
    expect((mirrorAfter?.x ?? 0) - (mirrorBefore?.x ?? 0)).toBeGreaterThan(40);
    expect((mirrorAfter?.y ?? 0) - (mirrorBefore?.y ?? 0)).toBeGreaterThan(20);

    // The paragraph now lies over the next one: leaving asks, and the choice applies it.
    await expect(page.getByTestId('paragraph-move-overlap')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('paragraph-overlap').click();
    await expect(editor).toHaveCount(0, { timeout: 20_000 });
    await inHistory(page, (list) =>
      expect(historyStep(list, 'Move paragraph')).toHaveCount(1, { timeout: 20_000 }),
    );
    await expect
      .poll(async () => (await cornerOf(page, 'T')).x - before.x, { timeout: 20_000 })
      .toBeGreaterThan(40);

    await page.getByTestId('undo-button').click();
    await expect
      .poll(async () => Math.abs((await cornerOf(page, 'T')).x - before.x), { timeout: 20_000 })
      .toBeLessThan(1);
  });

  test('a side bar changes the width and the lines wrap again', async ({ page }) => {
    await openCorpus(page, 'word-tagged.pdf', 'word-tagged', 'T');
    const editor = await openParagraph(page, 'T');
    const lines = await lineCount(page);
    const bar = await centreOf(page, 'paragraph-width-right');
    await page.mouse.move(bar.x, bar.y);
    await page.mouse.down();
    await page.mouse.move(bar.x - 400, bar.y, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => lineCount(page)).toBeGreaterThan(lines);
    // Four lines run into the paragraph below: leaving asks, and the choice applies it.
    await page.keyboard.press('Escape');
    await page.getByTestId('paragraph-overlap').click();
    await expect(editor).toHaveCount(0, { timeout: 20_000 });
    await inHistory(page, (list) =>
      expect(historyStep(list, 'Resize paragraph')).toHaveCount(1, { timeout: 20_000 }),
    );
  });

  test('on two columns the side bar stops at the neighbour', async ({ page }) => {
    await openCorpus(page, 'two-column.pdf', 'two-column', 'E');
    await openParagraph(page, 'E');
    const bar = await centreOf(page, 'paragraph-width-right');
    const frame = page.locator('[data-paragraph-frame]');
    const narrow = await frame.boundingBox();
    await page.mouse.move(bar.x, bar.y);
    await page.mouse.down();
    await page.mouse.move(bar.x + 400, bar.y, { steps: 10 });
    await page.mouse.up();
    const wide = await frame.boundingBox();
    const grew = (wide?.width ?? 0) - (narrow?.width ?? 0);
    // The gap between the columns is 0.8 cm (about 23 pt): never the 400 px asked for.
    expect(grew).toBeGreaterThanOrEqual(0);
    expect(grew).toBeLessThan(120);
  });

  test('Arrow on a focused paragraph target nudges it once after 600 ms', async ({ page }) => {
    await openCorpus(page, 'word-tagged.pdf', 'word-tagged', 'T');
    const before = await cornerOf(page, 'T');
    await page.getByRole('button', { name: /The ferry left/ }).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight');
    await inHistory(page, (list) =>
      expect(historyStep(list, 'Move paragraph')).toHaveCount(1, { timeout: 20_000 }),
    );
    await expect
      .poll(async () => (await cornerOf(page, 'T')).x - before.x, { timeout: 20_000 })
      .toBeGreaterThan(20);
  });
});

test.describe('with a finger on a tablet', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

  test('the grip moves the paragraph', async ({ page }) => {
    await openCorpus(page, 'word-tagged.pdf', 'word-tagged', 'T');
    const before = await cornerOf(page, 'T');
    const editor = await openParagraph(page, 'T', true);
    const grip = await centreOf(page, 'paragraph-grip');
    await fingerDrag(page, grip, { x: 60, y: 30 });
    await page.keyboard.press('Escape');
    await page.getByTestId('paragraph-overlap').click();
    await expect(editor).toHaveCount(0, { timeout: 20_000 });
    await expect
      .poll(async () => (await cornerOf(page, 'T')).x - before.x, { timeout: 20_000 })
      .toBeGreaterThan(30);
  });
});
