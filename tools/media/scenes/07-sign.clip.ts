/**
 * Clip 7, "Sign, and see what was checked" (spec §6): the agreement at fit page, the title menu
 * (opened from the active tab, 01-frame F5) → "Sign with certificate…" with the test PKI's
 * certificate (`test/fixtures/pki/signer-rsa.p12`, password "test-only", as in
 * `apps/web/e2e/signatures.spec.ts`), the signer read from it, then Save a copy, which signs
 * the copy it writes (components/07-sheets.md §4); its toast says the copy was verified and is
 * put away. The downloaded copy is dropped back on the window, and the title menu's facts row
 * opens S9, where its signature checks out as "Intact" under the certificate's name (spec
 * D2-9). The scene asserts that.
 */
import { readFile } from 'node:fs/promises';

import { expect } from '@playwright/test';

import { fixturePath } from '../../../apps/web/e2e/helpers.ts';
import { scene } from '../lib/scene.ts';

const FIXTURES = ['demo-agreement.pdf'] as const;
const CERTIFICATE = 'pki/signer-rsa.p12';
/** The test certificate's subject (test/fixtures/README.md, "pki"). */
const SIGNER = 'pdf-editor Test Signer';

scene({
  id: '07-sign',
  kind: 'clip',
  // No crop: the title menu opens from the tab at the left, the Sign dialog sits in the
  // middle, and Save a copy and S9 Signatures are side sheets on the right.
  async prepare(stage) {
    const { page } = stage;
    await stage.openFixtures(FIXTURES);
    // The whole page in the frame, beside the dialog and the sheets.
    await stage.fitPage();
    await stage.rendered(page.locator('[data-read-viewport]'), 1);
    // The title menu → Sign with certificate…, with the test certificate and its password,
    // checked: the clip opens on the dialog showing whose certificate it is. (Choosing the
    // file and typing the password took four seconds of an eight-second clip.)
    await page.getByTestId('document-menu').click();
    await page.getByRole('menuitem', { name: 'Sign with certificate…' }).click();
    const sign = page.getByTestId('sign-dialog');
    await sign
      .getByLabel('Certificate file (.p12 or .pfx)')
      .setInputFiles(fixturePath(CERTIFICATE));
    await sign.getByLabel('Password').fill('test-only');
    await sign.getByRole('button', { name: 'Check certificate' }).click();
    await expect(sign.getByTestId('signer-name')).toHaveText(SIGNER, { timeout: 20_000 });
    // The dialog is taller than the window: show the signer and the way on.
    await sign
      .getByRole('button', { name: /^(Continue to export|Use for export)$/ })
      .scrollIntoViewIfNeeded();
    await stage.cursor.place(1060, 700);
  },
  async run(stage) {
    const { page, cursor } = stage;
    const sign = page.getByTestId('sign-dialog');
    await stage.hold(450);

    // 1. On to Save a copy, which signs the copy it writes: the Signature row says whose
    //    certificate signs it. Download copy closes the sheet; the copy is built, signed and
    //    checked as a job, and its toast says it was verified.
    await cursor.click(
      sign.getByRole('button', { name: /^(Continue to export|Use for export)$/ }),
      380,
    );
    const sheet = page.getByTestId('save-copy-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: /^Signature, / })).toHaveAccessibleName(
      `Signature, Signed by ${SIGNER}`,
    );
    await stage.hold(400);
    const download = page.waitForEvent('download', { timeout: 60_000 });
    await cursor.click(sheet.getByRole('button', { name: 'Download copy' }), 380);
    const file = await download;
    const bytes = await readFile(await file.path());
    await expect(sheet).toBeHidden();
    const toast = page.getByTestId('save-copy-toast').last();
    await expect(toast).toContainText(/^Downloaded demo-agreement.*· verified/, {
      timeout: 60_000,
    });
    await stage.hold(300);
    // Read: the toast is put away (it would wait ten seconds, A-24), so it is not left
    // over the signed copy.
    await cursor.click(toast.getByRole('button', { name: 'Dismiss' }), 380);
    await expect(toast).toHaveCount(0);

    // 2. Re-open the signed file: dropped on the window, as from the downloads folder.
    const view = await page.locator('[data-read-viewport]').boundingBox();
    if (!view) throw new Error('the page view is not laid out');
    await stage.dropFiles(
      [{ name: 'demo-agreement-signed.pdf', bytes }],
      { x: view.x + view.width * 0.5, y: view.y + view.height * 0.5 },
      { x: 1440 + 8, y: 620 },
      480,
    );
    await expect(
      page.getByRole('tab', { name: 'demo-agreement-signed', selected: true }),
    ).toBeVisible();
    // 3. The title menu's facts row says the signature's status; it opens S9.
    await cursor.click(page.getByTestId('document-menu'), 350);
    const fact = page.getByTestId('title-menu-signatures');
    await expect(fact).toContainText('Intact', { timeout: 20_000 });
    await cursor.click(fact, 350);
    const section = page.getByTestId('signatures-section');
    await expect(section.getByTestId('signature-status')).toHaveText('Intact', { timeout: 20_000 });
    await expect(section).toContainText(SIGNER);
  },
});
