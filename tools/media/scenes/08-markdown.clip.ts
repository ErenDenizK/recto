/**
 * Clip 8, "Pages to Markdown" (spec §6): the report's pages 2–4 through the title menu
 * (opened from the active tab, 01-frame F5) → "Export as Markdown / text…", which opens Save
 * a copy on Text (components/07-sheets.md §4.1): Markdown, a page range; the preview shows
 * the pages' headings as Markdown headings, and Copy puts the Markdown on the clipboard. The
 * scene asserts the headings (test/fixtures/README.md: Contents, Chair's foreword, The year in
 * numbers) and what was copied.
 */
import { expect } from '@playwright/test';

import { atRest } from '../../../apps/web/e2e/helpers.ts';
import { scene } from '../lib/scene.ts';

const FIXTURES = ['demo-report-v1.pdf'] as const;

scene({
  id: '08-markdown',
  kind: 'clip',
  // No crop: the title menu opens from the tab at the left, the Save a copy sheet is a side
  // sheet on the right, and the report's cover sits between them.
  async prepare(stage) {
    const { page } = stage;
    // Copy writes to the clipboard, and the scene reads it back.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await stage.openFixtures(FIXTURES);
    await stage.fitPage();
    await stage.rendered(page.locator('[data-read-viewport]'), 1);
    await stage.cursor.place(1060, 620);
  },
  async run(stage) {
    const { page, cursor } = stage;
    await stage.hold(200);

    // 1. The title menu → Export as Markdown / text…: Save a copy, on Text, Markdown.
    await cursor.click(page.getByTestId('document-menu'), 400);
    // The menu grows in from its tab: a click mid-entrance can land on the item beside it
    // (Save a copy…, the same sheet on PDF).
    const exportItem = page.getByRole('menuitem', { name: 'Export as Markdown / text…' });
    await atRest(exportItem);
    await cursor.click(exportItem, 380);
    const sheet = page.getByTestId('save-copy-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('radio', { name: 'Text', exact: true })).toBeChecked();
    await expect(sheet.getByRole('radio', { name: 'Markdown', exact: true })).toBeChecked();

    // 2. Pages 2–4.
    await cursor.click(sheet.getByRole('radio', { name: 'Range', exact: true }), 380);
    const range = sheet.getByRole('textbox', { name: 'Page range' });
    // Range shows the field but leaves focus on its radio: Tab goes on to the field (a
    // pointer trip there cost most of a second of an eight-second clip).
    await page.keyboard.press('Tab');
    await expect(range).toBeFocused();
    await range.pressSequentially('2-4', { delay: 70 });

    // 3. The preview: the three pages' headings, as Markdown.
    const preview = sheet.getByTestId('convert-preview');
    // The range is applied: the preview starts at page 2's heading, not at the cover.
    await expect(preview).toHaveText(/^# Contents\n/, { timeout: 30_000 });
    await expect(preview).toHaveAttribute('data-state', 'ready');
    await expect(preview).toContainText(/^#+ Chair’s foreword$/m);
    await expect(preview).toContainText(/^#+ The year in numbers$/m);
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue(
      /^demo-report-v1\.(md|zip)$/,
    );
    await stage.hold(300);
    // Down the preview to the foreword's heading.
    await cursor.moveTo(preview, 400, { x: 0.6, y: 0.55 });
    await preview.evaluate((el) => el.scrollBy({ top: 150, behavior: 'smooth' }));
    await stage.hold(250);

    // 4. Copy: the Markdown to the clipboard.
    await cursor.click(sheet.getByRole('button', { name: 'Copy', exact: true }), 420);
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toMatch(/^# Contents\n/);
  },
});
