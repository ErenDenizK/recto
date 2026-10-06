/**
 * Clip 2, "Move pages between documents" (spec §6): in the Pages grid over both documents
 * (06-navigation PG1–PG6, spec redesign D2-5), pages 3–4 of the report (the foreword and "The
 * year in numbers") are selected, the Pages bar in the capsule counting them, then dragged with
 * the app's drag image (two sheets and a count) into the agreement and dropped after its second
 * page; the agreement's section then holds them.
 */
import { expect } from '@playwright/test';

import { scene } from '../lib/scene.ts';
import { tabName } from '../lib/stage.ts';

/** The source and the target, in opening order (the order of the sections). */
const FIXTURES = ['demo-report-v1.pdf', 'demo-agreement.pdf'] as const;
const [REPORT, AGREEMENT] = FIXTURES.map(tabName) as [string, string];

scene({
  id: '02-move-pages',
  kind: 'clip',
  // The grid under the strip: its header, both sections, the drag, the drop and the Pages bar
  // (the header's size slider, right of the sections, is left out).
  crop: { x: 0, y: 44, width: 1200, height: 856 },
  async prepare(stage) {
    const { page } = stage;
    await stage.openFixtures(FIXTURES);
    // Two files opened together land in the Library, checked (02-library L6); the selection
    // bar's Pages lays both in the grid, at the smaller cell size so each fits on one row.
    await page
      .getByRole('toolbar', { name: 'Selected documents' })
      .getByRole('button', { name: 'Pages' })
      .click();
    await stage.gridSettled();
    await stage.command('Smaller thumbnails');
    // The grid focuses the current page's cell (PG1 §4); the clip is a pointer's.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const grid = page.getByTestId('light-table');
    await expect(grid.getByRole('grid')).toHaveCount(FIXTURES.length);
    await stage.rendered(grid, 14);
    await stage.cursor.place(1100, 640);
  },
  async run(stage) {
    const { page, cursor } = stage;
    const grid = page.getByTestId('light-table');
    const cells = (name: string) =>
      grid.getByRole('grid', { name }).locator('[role="gridcell"][data-page-id]');
    const report = cells(REPORT);
    const agreement = cells(AGREEMENT);
    const bar = page.getByTestId('pages-bar');
    await expect(report).toHaveCount(10);
    await expect(agreement).toHaveCount(4);
    const moving = await report
      .locator('nth=2')
      .evaluate((cell) => cell.getAttribute('data-page-id'));
    await stage.hold(300);

    // Select pages 3 and 4: a click, then a Shift-click; the Pages bar counts them.
    await cursor.click(report.nth(2), 420, { x: 0.5, y: 0.45 });
    await page.keyboard.down('Shift');
    await cursor.click(report.nth(3), 360, { x: 0.5, y: 0.45 });
    await page.keyboard.up('Shift');
    await expect(report.nth(3)).toHaveAttribute('aria-selected', 'true');
    await expect(bar).toContainText('2 selected');
    await stage.hold(300);

    // Drag them into the agreement, to the gap after its second page.
    await cursor.down();
    const target = await agreement.nth(1).boundingBox();
    if (!target) throw new Error('the agreement is not laid out');
    await cursor.move(target.x + target.width * 0.9, target.y + target.height * 0.45, 900);
    await expect(grid.getByTestId('insertion-bar')).toHaveAttribute('data-index', '2');
    await stage.hold(350);
    await cursor.up();
    await stage.ghost.clear();

    // The result: the agreement holds six pages, the two from the report after its second.
    await expect(agreement).toHaveCount(6);
    await expect(report).toHaveCount(8);
    await expect(agreement.nth(2)).toHaveAttribute('data-page-id', moving ?? '');
    await stage.rendered(grid, 14);
    await stage.hold();
    // Off the sections, so the poster shows both rows unobscured.
    await cursor.move(1000, 700, 420);
  },
});
