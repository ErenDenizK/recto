/**
 * Clip 5, "Compare two versions" (spec §6): the report against its revision, from the Library
 * (02-library L6, journey J12): both cards checked, the selection bar's Compare sets the older
 * file as A. The comparison runs and lists the changed areas, the onion skin lays the revision
 * over the original, and J steps to the changed paragraph. The scene asserts the summary of
 * what changed (three pages; test/fixtures/README.md, "Changes from v1 to v2").
 */
import { expect } from '@playwright/test';

import { scene } from '../lib/scene.ts';
import { tabName } from '../lib/stage.ts';

const FIXTURES = ['demo-report-v1.pdf', 'demo-report-v2.pdf'] as const;
const [ORIGINAL, REVISED] = FIXTURES.map(tabName) as [string, string];

scene({
  id: '05-compare',
  kind: 'clip',
  async prepare(stage) {
    const { page } = stage;
    // Two files opened together land in the Library, both checked (02-library L6).
    await stage.openFixtures(FIXTURES);
    const cards = page.getByRole('listbox', { name: 'Files' }).getByRole('option');
    await expect(page.getByRole('option', { selected: true })).toHaveCount(FIXTURES.length);
    await stage.rendered(cards, FIXTURES.length);
    await stage.cursor.place(1100, 640);
  },
  async run(stage) {
    const { page, cursor } = stage;
    await stage.hold(200);

    // 1. The selection bar's Compare: the setup with the original as A and the revision as B
    //    (both files carry the same date, so the card order decides).
    const bar = page.getByRole('toolbar', { name: 'Selected documents' });
    await cursor.click(bar.getByRole('button', { name: 'Compare' }), 420);
    const setup = page.getByTestId('compare-setup');
    await expect(setup).toBeVisible();
    await expect(setup.getByRole('combobox', { name: 'Original (A)' })).toContainText(ORIGINAL);
    await expect(setup.getByRole('combobox', { name: 'Revised (B)' })).toContainText(REVISED);
    await stage.hold(250);

    // 2. Compare. The run (about three seconds here) is cut like OCR's, with the caption;
    //    then the changed pages and areas are listed.
    await cursor.click(setup.getByRole('button', { name: 'Compare', exact: true }), 420);
    const view = page.getByTestId('compare-view');
    await expect(page.getByTestId('compare-progress')).toBeVisible();
    await stage.hold(250);
    const panel = page.getByTestId('changes-panel');
    await stage.cut(
      async () => {
        await expect(view).toHaveAttribute('data-status', 'done', { timeout: 60_000 });
        await stage.rendered(view, 2);
      },
      async () => {
        const box = await view.boundingBox();
        if (!box) throw new Error('the compare view is not laid out');
        return { x: box.x + box.width / 2, y: box.y + 90 };
      },
    );
    await expect(panel.getByTestId('changes-summary')).toHaveText(
      'Pages: 3 changed · 0 inserted · 0 deleted · 7 unchanged',
    );
    await stage.hold(400);

    // 3. The changed area of the foreword's page, boxed on both sides.
    const area = panel
      .getByRole('region', { name: 'Page 3 ↔ 3' })
      .getByRole('button', { name: /changed area/ });
    await cursor.click(area, 420);
    await expect(view.locator('[data-current]').first()).toBeVisible();
    await stage.rendered(view, 2);
    await stage.hold(450);

    // 4. The onion skin: B over A.
    const overlay = page.getByRole('radio', { name: 'Overlay' });
    await cursor.click(overlay, 420);
    // The opacity slider joins the bar, which no longer has room for both segments: the
    // control folds into a select (ui/Segmented `layout`), so the choice is read from that.
    await expect(page.getByRole('combobox', { name: 'Layout' })).toContainText('Overlay');
    await stage.rendered(view, 1);
    // Off the compare bar into the gutter right of the page, so the poster shows the bar
    // and the paragraph with no pointer or hover on them.
    await cursor.move(1372, 600, 400);
    await stage.hold(150);

    // 5. J: to the next change, the paragraph's first changed words.
    // A shortcut of the whole view: nothing needs focusing (a focused viewport would draw
    // its focus ring round the clip's last frame).
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('j');
    await expect(view.locator('[data-change^="text:"][data-current]').first()).toBeVisible();
    await expect(panel.locator('[aria-current="true"]')).toContainText('“Over”');
    await stage.rendered(view, 1);
  },
});
