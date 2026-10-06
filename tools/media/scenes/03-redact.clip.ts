/**
 * Clip 3, "Redact, and the text is gone" (spec §6): on the agreement's page 2, the sidebar's
 * Review section on its Marks filter (06-navigation N5, spec redesign D2-4); "Find sensitive
 * data" lists the IBAN (with the e-mail and the phone number on page 1); the finds are marked,
 * the IBAN boxed on the page, and applied; then the strip's Find field (01-frame F6) searches
 * for the IBAN and finds nothing. The scene asserts that the IBAN is no longer in the text, so
 * it doubles as an e2e test (spec §2.2).
 */
import { expect } from '@playwright/test';

import { scene } from '../lib/scene.ts';

const FIXTURES = ['demo-agreement.pdf'] as const;
/** The documentation IBAN on page 2 (test/fixtures/README.md, "demo-agreement.pdf"). */
const IBAN = 'GB82 WEST 1234 5698 7654 32';

scene({
  id: '03-redact',
  kind: 'clip',
  // The sidebar, the page and the strip's Find field (the strip's last controls and the page
  // pill, right of the field, are left out).
  crop: { x: 0, y: 0, width: 1228, height: 900 },
  async prepare(stage) {
    const { page } = stage;
    await stage.openFixtures(FIXTURES);
    // One file opens in its document, viewing: the capsule is the dock (spec X1, D2-2).
    await expect(page.locator('[data-capsule="dock"]')).toBeVisible();
    await stage.fitPage();
    // The sidebar's Review section on its Marks filter, where "Find sensitive data" is
    // ("Show redactions" from the palette opens both).
    await stage.command('Show redactions');
    await expect(page.locator('[data-review-panel]')).toHaveAttribute('data-filter', 'redactions');
    // The palette hands the focus back; neither a focus tooltip nor a ring may open the clip.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    // Page 2, where the IBAN is, in view: its hit is marked and then removed in front of
    // the viewer, with no trip through the list to reveal it.
    await stage.showPage(1);
    await stage.rendered(page.locator('[data-read-viewport]'), 1);
    await stage.cursor.place(1000, 560);
  },
  async run(stage) {
    const { page, cursor } = stage;
    const panel = page.locator('[data-review-panel]');
    await stage.hold(100);

    // 1. Find sensitive data: the IBAN is among the finds.
    await cursor.click(panel.getByRole('button', { name: 'Find sensitive data' }), 380);
    const finder = panel.getByRole('region', { name: 'Sensitive data' });
    const iban = finder.locator('[data-pattern="iban"]').getByRole('button', { name: /GB82/ });
    await expect(iban).toBeVisible();
    await stage.hold(450);

    // 2. Mark the finds (the IBAN is boxed on the page), then apply.
    await cursor.click(finder.getByRole('button', { name: /^Mark \d+ selected$/ }), 350);
    await expect(panel.getByTestId('redaction-summary')).toHaveText(/^3 marks · 3 selected$/);
    await stage.hold(250);
    await cursor.click(panel.getByTestId('redaction-apply'), 350);
    const dialog = page.getByTestId('redaction-apply-dialog');
    await expect(dialog).toBeVisible();
    await cursor.click(dialog.getByTestId('redaction-apply-confirm'), 350);
    const result = dialog.getByTestId('redaction-result');
    // While the app works, the pointer leaves for the dark gutter right of the page, where
    // it covers neither the result nor, later, the black box.
    await Promise.all([
      cursor.move(1180, 640, 450),
      expect(result).toBeVisible({ timeout: 30_000 }),
    ]);
    await expect(result.getByTestId('redaction-checks-summary')).toHaveText(
      /^Self-check: (\d+) of \1 checks passed$/,
    );
    await stage.hold(350);
    // Esc closes the finished dialog: no trip across the screen to its Close button.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // 3. Search for the IBAN in the strip's Find field: nothing.
    await page.keyboard.press('ControlOrMeta+f');
    const field = page.locator('[data-find-entry] input[type="search"]').first();
    await expect(field).toBeFocused();
    // Pasted whole, as from the agreement's own text.
    await field.fill(IBAN);
    await expect(page.getByTestId('find-count')).toHaveText('No matches', { timeout: 20_000 });
    // Nor is the IBAN in any page's text layer.
    await expect(page.getByTestId('text-layer').filter({ hasText: 'GB82' })).toHaveCount(0);
  },
});
