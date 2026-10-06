/**
 * Clip 6, "Edit a line of text" (spec §6): page 3 of the report (the foreword). E arms Edit
 * text, which opens Markup: the capsule turns from the dock into the Markup palette with Edit
 * text pressed (spec redesign D2-2, D2-3). A click on the line that begins "2024 was a year"
 * opens the paragraph editor (ADR-0020), "2024" becomes "2025", and the settled preview shows
 * the line re-set in its own embedded font with no honesty line naming a substitute
 * (test/fixtures/README.md: the subsets hold the glyphs, so the edit stays in the same font).
 * The scene asserts that state.
 */
import { expect } from '@playwright/test';

import { scene } from '../lib/scene.ts';

const FIXTURES = ['demo-report-v1.pdf'] as const;
/** The text-edit target (test/fixtures/README.md, "demo-report-v1.pdf"). */
const LINE =
  '2024 was a year of steady water and full boats. We began the season with a waiting list for';
/** Where page 3's head sits, in CSS pixels from the top: just under the strip (44 px). */
const PAGE_TOP = 56;

scene({
  id: '06-edit-text',
  kind: 'clip',
  // The head of the page at fit width, large enough to read, from just inside its top edge
  // (clear of the strip's shadow): the heading, the line, the editor and its check, and the
  // capsule's palette below them (the page pill, right of the palette, is left out).
  crop: { x: 120, y: PAGE_TOP + 14, width: 1150, height: 900 - PAGE_TOP - 14 },
  async prepare(stage) {
    const { page } = stage;
    await stage.openFixtures(FIXTURES);
    // One file opens in its document, viewing: the capsule is the dock (spec X1, D2-2).
    await expect(page.locator('[data-capsule="dock"]')).toBeVisible();
    // Page 3, the foreword, its head under the strip, at the width it opens at (fit width;
    // its label is 1: the report counts i, ii, then 1).
    await stage.showPage(2, PAGE_TOP);
    await stage.rendered(page.locator('[data-read-viewport]'), 1);
    await stage.cursor.place(1180, 640);
  },
  async run(stage) {
    const { page, cursor } = stage;
    await stage.hold(200);

    // 1. E arms the Edit text tool: Markup opens (ADR-0019 §3) and the capsule shows the
    //    palette with Edit text pressed; the page's lines become targets.
    await page.keyboard.press('e');
    await expect(page.locator('[data-capsule="palette"]')).toBeVisible();
    const tool = page.getByRole('button', { name: 'Edit text' });
    await expect(tool).toHaveAttribute('aria-pressed', 'true');
    await stage.hold(300);
    const line = page.locator(`[data-text-edit-layer] [data-text-run="${LINE}"]`);
    await expect(line).toBeVisible({ timeout: 20_000 });

    // 2. A click before "2024" opens the line's paragraph in the paragraph editor, the caret
    //    at the click.
    await cursor.click(line, 450, { x: 0.02, y: 0.5 });
    const editor = page.getByRole('textbox', { name: 'Paragraph on page 3' });
    await expect(editor).toBeFocused({ timeout: 20_000 });
    await expect(editor).toHaveText(new RegExp(`^${LINE}`));
    await stage.hold(450);

    // 3. "2024" → "2025": the year selected from the keyboard, then typed over.
    await page.keyboard.press('Home');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');
    await stage.hold(250);
    await page.keyboard.type('2025', { delay: 90 });
    await expect(editor).toHaveText(new RegExp(`^${LINE.replace('2024', '2025')}`));

    // 4. The check: the settled preview (the engine's dry run, exactly what will be saved)
    //    replaces the drawn line, with no honesty line: every character stays in the
    //    paragraph's own embedded font.
    await expect(page.locator('[data-paragraph-editor]')).toHaveAttribute('data-preview', '', {
      timeout: 20_000,
    });
    await expect(page.getByTestId('paragraph-honesty')).toHaveCount(0);
    await expect(page.getByTestId('paragraph-error')).toHaveCount(0);
    await stage.hold(300);
    // Onto the blank page right of the heading: over text, a line would light up as a
    // target, and the line and the editor's header stay clear.
    await cursor.move(960, 270, 380);
  },
});
