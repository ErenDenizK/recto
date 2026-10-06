/**
 * Read and Edit through the M8 control (ADR-0019 §2–§3, craft spec §3.2–§3.3, §10), with the
 * input rules of D1-5 (05-canvas §6; input-rules.spec.ts drives S1–S18): a file opens in Read;
 * nothing moves or arms there, while targeted acts (select an annotation, fill a field) and
 * the page menu's page operations need no Edit; `2` opens Markup and its palette appears; a
 * tab click leaves Home in the document's last state; `1` closes it and the dock shows its
 * doors again (D2-3); a tool key in viewing opens Markup and arms the tool. A selection's
 * "Edit text" opens the paragraph editor in Markup; there a first click on text shows
 * "Double-click to edit text", and Edit text armed opens a paragraph in one click.
 */
import { expect, type Page, test } from '@playwright/test';

import { enterEdit, openFixtures, useFileInputPicker } from './helpers';

const palette = (page: Page) => page.getByRole('toolbar', { name: 'Markup', exact: true });
/**
 * Read and Edit as the frame shows them now that the mode switch is gone (D2-1): in viewing the
 * capsule is the dock, whose Markup is the way in; in Markup it is the palette (spec X1, D2-2, D2-3).
 */
const dock = (page: Page) => page.getByRole('toolbar', { name: 'Document tools', exact: true });
const readShown = (page: Page) => dock(page).getByRole('button', { name: 'Markup', exact: true });
const editShown = (page: Page) => page.locator('[data-capsule="palette"]');

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test('opens in Read with the lock; nothing moves or arms; 2 and 1 switch; a tab click leaves Home', async ({
  page,
}) => {
  await openFixtures(page, ['annotations.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });

  // Read, with the lock; the capsule is the dock: Pages · Markup · Fill & sign · More.
  await expect(readShown(page)).toBeVisible();
  await expect(dock(page).getByRole('button')).toHaveCount(4);
  await expect(readShown(page)).toHaveAttribute('aria-keyshortcuts', '2');

  // A drag that starts on the unselected square selects it and moves nothing (S14; D1-5:
  // selecting is a targeted act in viewing, input-rules.spec covers the rest).
  const square = page.locator('[data-annotation-id="fixture-annot-square-1"]');
  await expect(square).toBeAttached();
  const before = await square.boundingBox();
  if (!before) throw new Error('no square');
  await page.mouse.move(before.x + 4, before.y + 4);
  await page.mouse.down();
  await page.mouse.move(before.x + 64, before.y + 44, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('annotation-bar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(square).toBeAttached();
  expect(await square.boundingBox()).toEqual(before);
  // Nothing armed: the page keeps the Select pointer and the bar has no tools.
  const layer = page.locator('[data-annotation-layer="0"]');
  await expect(layer).toHaveAttribute('data-tool', 'select');
  await expect(layer).not.toHaveAttribute('data-drawing', /.*/);

  // 2: Markup, the palette.
  await enterEdit(page);
  await expect(palette(page)).toBeVisible();
  // In Edit the square selects.
  await square.click({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId('annotation-bar')).toBeVisible();
  await page.keyboard.press('Escape');

  // Home, then the tab: back in the document's last mode (Edit).
  await page.keyboard.press('0');
  await expect(page.getByRole('radiogroup', { name: 'View mode' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'annotations' }).click();
  await expect(editShown(page)).toBeVisible();
  await expect(palette(page)).toBeVisible();

  // 1: viewing again; the palette goes.
  await page.keyboard.press('1');
  await expect(readShown(page)).toBeVisible();
  await expect(palette(page)).toHaveCount(0);

  // The dock's Markup opens it.
  await readShown(page).click();
  await expect(editShown(page)).toBeVisible();
});

test('a tool key in Read switches to Edit and arms the tool, changing nothing', async ({
  page,
}) => {
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await expect(readShown(page)).toBeVisible();
  await page.keyboard.press('r');
  await expect(editShown(page)).toBeVisible();
  const layer = page.locator('[data-annotation-layer="0"]');
  await expect(layer).toHaveAttribute('data-tool', 'rectangle');
  // Visibly armed: the palette with the tool pressed.
  await expect(palette(page).locator('[data-tool][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: /^Edit mode\. / })).toHaveCount(1);
  await expect(layer.locator('[data-annotation-id]')).toHaveCount(0);
});

test('form fields fill without leaving Read: a fill is a targeted act (D1-5, S6, S7)', async ({
  page,
}) => {
  await openFixtures(page, ['forms-a.pdf']);
  const target = page.locator('[data-form-layer="0"] [data-field-name="name"]');
  await expect(target).toBeVisible({ timeout: 20_000 });
  await target.click();
  const editor = page.locator('[data-form-editor="name"]');
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('Alice Example');
  await editor.press('Escape');

  // A checkbox toggles; the document stays where it was.
  const agree = page.locator('[data-form-layer="0"] [data-field-name="agree"]');
  const checked = await agree.getAttribute('aria-checked');
  await agree.click();
  await expect(agree).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true');
  await expect(readShown(page)).toBeVisible();
});

// ---------------------------------------------------------------------------
// The Edit policy (craft spec §3.5): double-click to edit text, the pen never opens it
// ---------------------------------------------------------------------------

const FOX = 'The quick brown fox jumps over the lazy dog';

/** The text layer's span of the first (Helvetica) line of text-edit-fonts.pdf. */
const foxLine = (page: Page) =>
  page.locator('[data-page-index="0"] [data-testid="text-layer"] span', { hasText: FOX }).first();

async function openFontsFixture(page: Page): Promise<{ x: number; y: number }> {
  await openFixtures(page, ['text-edit-fonts.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await expect(foxLine(page)).toBeAttached({ timeout: 20_000 });
  const box = await foxLine(page).boundingBox();
  if (!box) throw new Error('line not laid out');
  // On "fox" (a word, not the space after it).
  return { x: box.x + box.width * 0.4, y: box.y + box.height / 2 };
}

test('double-click on text opens the editor in Edit, not in Read', async ({ page }) => {
  const at = await openFontsFixture(page);
  // The line editor, or the paragraph editor where the line is part of a paragraph (T6).
  const editor = page.getByRole('textbox', { name: /^(Line text|Paragraph on page 1)$/ });

  // Read: the double-click selects a word, as on any page; no editor.
  await page.mouse.dblclick(at.x, at.y);
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString().trim() ?? ''))
    .not.toBe('');
  await page.waitForTimeout(400);
  await expect(editor).toHaveCount(0);

  // Edit, with Select: the editor opens with the caret at the point.
  await enterEdit(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.dblclick(at.x, at.y);
  await expect(editor).toBeFocused({ timeout: 20_000 });
  // A caret at the point, nothing selected (the field's own selection, or the document's
  // inside the paragraph editor's mirror).
  const [start, end] = await editor.evaluate((el) => {
    if (el instanceof HTMLInputElement) return [el.selectionStart ?? -1, el.selectionEnd ?? -1];
    const range = window.getSelection()?.getRangeAt(0);
    return range ? [range.startOffset, range.collapsed ? range.startOffset : -1] : [-1, -2];
  });
  expect(end).toBe(start);
  if ((await editor.getAttribute('aria-label')) === 'Line text') {
    await expect(editor).toHaveValue(FOX);
    expect(start).toBeGreaterThan(FOX.length * 0.25);
    expect(start).toBeLessThan(FOX.length * 0.65);
  }
  // The Select tool stays armed; Esc leaves without a change.
  await expect(page.locator('[data-annotation-layer="0"]')).toHaveAttribute('data-tool', 'select');
  await editor.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(foxLine(page)).toHaveText(FOX);
});

test('a pen stroke over text never opens the editor', async ({ page }) => {
  const at = await openFontsFixture(page);
  await enterEdit(page);
  const editor = page.getByRole('textbox', { name: /^(Line text|Paragraph on page 1)$/ });
  const layer = page.locator('[data-annotation-layer="0"]');

  // A pen (synthetic pointer events: Playwright has no pen): it hovers, which turns
  // "Pen draws in Edit" on, then writes across the line, then taps twice on it.
  await page.evaluate(
    async ({ x, y }) => {
      const pen = (type: string, px: number, init: PointerEventInit = {}) =>
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerType: 'pen',
          pointerId: 7,
          isPrimary: true,
          clientX: px,
          clientY: y,
          pressure: 0.5,
          button: 0,
          buttons: 1,
          ...init,
        });
      const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const under = () => document.elementFromPoint(x, y) ?? document.body;
      under().dispatchEvent(pen('pointermove', x, { buttons: 0, pressure: 0 }));
      await pause(200);
      under().dispatchEvent(pen('pointerdown', x - 60));
      for (let i = 1; i <= 12; i++) {
        window.dispatchEvent(pen('pointermove', x - 60 + i * 10));
        await pause(10);
      }
      window.dispatchEvent(pen('pointerup', x + 60, { buttons: 0, pressure: 0 }));
      await pause(100);
      for (let i = 0; i < 2; i++) {
        under().dispatchEvent(pen('pointerdown', x));
        window.dispatchEvent(pen('pointerup', x, { buttons: 0, pressure: 0 }));
      }
      under().dispatchEvent(
        new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          detail: 2,
        }),
      );
    },
    { x: at.x, y: at.y },
  );

  // The pen wrote ink; the text never took the press.
  await expect(layer.locator('[data-annotation-kind="ink"]')).not.toHaveCount(0, {
    timeout: 20_000,
  });
  await page.waitForTimeout(400);
  await expect(editor).toHaveCount(0);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  await expect(layer).toHaveAttribute('data-tool', 'select');
});

test("Read's page menu offers the page operations, pages acts without Edit (D1-5, S8)", async ({
  page,
}) => {
  await openFixtures(page, ['simple-text.pdf']);
  const first = page.locator('[data-page-index="0"]');
  await expect(first.locator('canvas[data-state="rendered"]')).toBeAttached({ timeout: 20_000 });
  const box = await first.boundingBox();
  if (!box) throw new Error('page 1 not laid out');
  await page.mouse.click(box.x + 40, box.y + 40, { button: 'right' });
  const menu = page.getByTestId('page-context-menu');
  for (const name of [/^Rotate page 1/, /^Delete page 1/, /^Crop/, /^Arrange/]) {
    await expect(menu.getByRole('menuitem', { name }).first()).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(readShown(page)).toBeVisible();
});

test('a Read selection offers "Edit text": Edit, with the paragraph editor at the selection', async ({
  page,
}) => {
  const at = await openFontsFixture(page);
  await page.mouse.dblclick(at.x, at.y);
  const selectionBar = page.getByRole('toolbar', { name: 'Selected text' });
  await expect(selectionBar).toBeVisible();
  await selectionBar.getByRole('button', { name: 'Edit text' }).click();
  await expect(editShown(page)).toBeVisible();
  const editor = page.getByRole('textbox', { name: /^(Line text|Paragraph on page 1)$/ });
  await expect(editor).toBeFocused({ timeout: 20_000 });
  // Nothing changed yet; Esc leaves it as it was.
  await editor.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(foxLine(page)).toHaveText(FOX);
});

test('in Edit a first click on text says "Double-click to edit text"; Edit text armed opens it in one click', async ({
  page,
}) => {
  const at = await openFontsFixture(page);
  await enterEdit(page);
  await page.mouse.click(at.x, at.y);
  await expect(
    page.getByRole('status').filter({ hasText: 'Double-click to edit text' }),
  ).toBeVisible();
  const editor = page.getByRole('textbox', { name: /^(Line text|Paragraph on page 1)$/ });
  await expect(editor).toHaveCount(0);

  // Edit text armed: one click opens the paragraph.
  await palette(page).getByRole('button', { name: 'Edit text', exact: true }).click();
  await expect(
    palette(page).getByRole('button', { name: 'Edit text', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Edit text locates the page's runs once armed; a click lands on a run's target, so wait for
  // them (a software-rendered engine takes a while).
  await expect(page.locator('[data-text-edit-layer="0"] [data-text-run]').first()).toBeAttached({
    timeout: 20_000,
  });
  await page.mouse.click(at.x, at.y);
  await expect(editor).toBeFocused({ timeout: 20_000 });
  await editor.press('Escape');
  await expect(editor).toHaveCount(0);
});
