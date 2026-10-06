/**
 * Clip 1, "Open many PDFs at once" (spec §6): three files dragged in from the desktop and
 * dropped on the Library (02-library L1, L9: its launcher lifts and says "Drop to open 3
 * files"); they land as three checked cards with the selection bar up, and the bar's Pages lays
 * them in the Pages grid as three sections (06.9, spec redesign D4-1, D2-5).
 */
import { expect } from '@playwright/test';

import { scene } from '../lib/scene.ts';

/**
 * The dropped files, in drop order (the order of the cards and sections): the demo
 * documents of spec §2.2, from `test/fixtures/demo/`.
 */
const FIXTURES = ['demo-report-v1.pdf', 'demo-agreement.pdf', 'demo-letter-scan.pdf'] as const;

scene({
  id: '01-open-many',
  kind: 'clip',
  async prepare(stage) {
    // As in the hero still: smaller cells, so the grid shows all three sections at once.
    await stage.command('Smaller thumbnails');
    // The palette hands the focus back to Open PDFs…: no focus ring opens the clip.
    await stage.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await stage.cursor.place(1240, 700);
  },
  async run(stage) {
    const { page, cursor } = stage;
    await expect(page.getByTestId('library-launcher')).toBeVisible();
    await stage.hold(400);

    // From the right edge of the window (another app, say) to the middle of the Library.
    const target = await page.getByTestId('library-launcher').boundingBox();
    if (!target) throw new Error('the Library is not laid out');
    await stage.dropFiles(
      FIXTURES,
      { x: target.x + target.width * 0.5, y: target.y + target.height * 0.62 },
      { x: 1440 + 8, y: 640 },
      520,
    );
    const cards = page.getByRole('listbox', { name: 'Files' }).getByRole('option');
    await expect(cards).toHaveCount(FIXTURES.length);
    // The dropped cards arrive checked: the selection bar is up.
    await expect(page.getByRole('option', { selected: true })).toHaveCount(FIXTURES.length);
    await stage.rendered(cards, FIXTURES.length);
    await stage.hold();

    // The bar's Pages lays all three in the grid.
    const bar = page.getByRole('toolbar', { name: 'Selected documents' });
    await cursor.click(bar.getByRole('button', { name: 'Pages' }), 460);
    await stage.gridSettled();
    const sections = page.getByTestId('light-table').getByRole('grid');
    await expect(sections).toHaveCount(FIXTURES.length);
    // The grid focuses the current page's cell (PG1 §4); the clip is a pointer's, so no
    // keyboard ring sits on its poster.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await stage.rendered(sections, 16);
    await stage.hold(400);
    // To empty canvas below the sections, so the poster frame shows the grid unobscured.
    await cursor.move(1240, 740, 420);
  },
});
