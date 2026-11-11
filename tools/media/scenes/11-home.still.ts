/**
 * Home still (README hero, DSN-97): the Colophon Home with three documents on the desk, as a
 * person sees it after opening them with the desk's Open (DSN-93: cards, no tabs). A still
 * shows the result, not the way there, so selection mode is ended and the pointer is
 * off the desk.
 */
import { expect } from '@playwright/test';

import { scene } from '../lib/scene.ts';

/** The demo documents of spec §2.2, from `test/fixtures/demo/`. */
const FIXTURES = ['demo-report-v1.pdf', 'demo-agreement.pdf', 'demo-letter-scan.pdf'] as const;

scene({
  id: '11-home',
  kind: 'still',
  async run(stage) {
    const { page } = stage;
    await stage.openFixtures(FIXTURES);
    // Opening leaves the shelf in selection mode (02-library L6); its Done ends it.
    const done = page.getByRole('button', { name: 'Done', pressed: true });
    if (await done.isVisible()) {
      await done.click();
      await expect(done).toBeHidden();
    }
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    // Every card's cover and the Continue card's page are drawn before the still is taken.
    await stage.rendered(page.getByRole('main', { name: 'Home' }), FIXTURES.length + 1);
    await page.mouse.move(1430, 890);
  },
});
