/**
 * Hero still (spec §1.1 item 2, §2.4): the Pages grid over three documents, one section each,
 * with the grid header and the Pages bar in the capsule (06-navigation PG1–PG6, spec redesign
 * D2-5). Opened with the Open button (several files land in the Library with their cards
 * checked, 02-library L6), then the selection bar's Pages: a still shows the result, not the
 * way there.
 */
import { expect } from '@playwright/test';

import { scene } from '../lib/scene.ts';

/**
 * The documents in the grid, in opening order (the order of the sections): the demo
 * documents of spec §2.2, from `test/fixtures/demo/`.
 */
const FIXTURES = ['demo-report-v1.pdf', 'demo-agreement.pdf', 'demo-letter-scan.pdf'] as const;

scene({
  id: '00-hero',
  kind: 'still',
  async run(stage) {
    const { page } = stage;
    await stage.openFixtures(FIXTURES);
    // The Library's selection bar: Pages lays every checked document in the grid (06.9).
    await page
      .getByRole('toolbar', { name: 'Selected documents' })
      .getByRole('button', { name: 'Pages' })
      .click();
    await stage.gridSettled();
    const sections = page.getByTestId('light-table').getByRole('grid');
    await expect(sections).toHaveCount(FIXTURES.length);
    // Smaller cells, so all three sections are in the grid at once, the report in one row.
    await stage.command('Smaller thumbnails');
    // The grid opens with the current page's cell focused (PG1 §4) and the palette gives the
    // focus back to it: no focus ring in the still.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await stage.rendered(sections, 16);
    // The click left the mouse over the grid; empty canvas shows no hover.
    await page.mouse.move(1300, 760);
  },
});
