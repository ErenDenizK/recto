/**
 * Clip 9, "Mark up a page": page 3 of the report (the foreword) at fit width. The dock's
 * Markup door turns the capsule into the Markup palette (spec redesign D2-2, D2-3); the
 * yellow highlighter marks a sentence, the red pen underlines a phrase in the next
 * paragraph, and Done turns the palette back into the dock. Each stroke is one step of the
 * history: the scene asserts that Undo is offered after the first.
 */
import { expect } from '@playwright/test';

import { scene } from '../lib/scene.ts';

const FIXTURES = ['demo-report-v1.pdf'] as const;
/** Where page 3's head sits, in CSS pixels from the top: just under the strip (44 px). */
const PAGE_TOP = 56;

scene({
  id: '09-markup',
  kind: 'clip',
  async prepare(stage) {
    const { page } = stage;
    await stage.openFixtures(FIXTURES);
    await expect(page.locator('[data-capsule="dock"]')).toBeVisible();
    await stage.showPage(2, PAGE_TOP);
    await stage.rendered(page.locator('[data-read-viewport]'), 1);
    await stage.cursor.place(1180, 560);
  },
  async run(stage) {
    const { page, cursor } = stage;
    await stage.hold(150);

    // 1. The dock's Markup door: the capsule becomes the palette.
    await cursor.click(page.locator('[data-capsule="dock"] [data-dock-item="markup"]'), 420);
    const palette = page.locator('[data-capsule="palette"]');
    await expect(palette).toBeVisible();
    await stage.hold(200);

    // 2. The yellow highlighter across the second paragraph's first line.
    const line = page.locator('[data-read-viewport] [data-page-index="2"]');
    const box = await line.boundingBox();
    if (!box) throw new Error('page 3 is not laid out');
    await cursor.click(palette.getByRole('button', { name: /^Yellow highlighter/ }), 420);
    await expect(palette.getByRole('button', { name: /^Yellow highlighter/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // "The highlight of the summer was the Port Allery Regatta, …": its baseline band.
    const y1 = 581;
    await cursor.move(193, y1, 340);
    await cursor.down();
    await cursor.move(1215, y1 + 1, 600);
    await cursor.up();
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    await expect(undo).toBeEnabled();
    await stage.hold(250);

    // 3. The red pen underlines "four hundred crews" on the next line.
    await cursor.click(palette.getByRole('button', { name: /^Red pen/ }), 420);
    await expect(palette.getByRole('button', { name: /^Red pen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const y2 = 631;
    await cursor.move(500, y2, 340);
    await cursor.down();
    await cursor.move(614, y2 + 2, 220);
    await cursor.move(728, y2, 220);
    await cursor.up();
    await stage.hold(300);

    // 4. Done: the palette folds back into the dock, the marks stay on the page.
    await cursor.click(palette.getByRole('button', { name: 'Done', exact: true }), 420);
    await expect(page.locator('[data-capsule="dock"]')).toBeVisible();
    await cursor.move(1240, 300, 320);
  },
});
