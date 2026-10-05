/**
 * Saved signatures end to end (spec redesign D0-11; flows.md J8A; components/07-sheets.md §9
 * and S3 §6; 03-markup.md MK-12, MK-13):
 *
 * - J8A on today's shell: the first signature takes six presses (Edit · Fill & sign · Signature
 *   image · draw · Use signature · the page) and is kept ("Save for next time" is on); after a
 *   reload it takes four (Edit · Fill & sign · its chip · the page).
 * - Settings → Saved signatures: Add… keeps a typed one and comes back to the page (New
 *   signature replaced Settings, and Settings comes back open), rename, remove with "Removed a
 *   saved signature · Undo", and Remove all…, which asks once and is final: nothing comes back
 *   after a reload and the tool offers New signature again.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { openFixtures, sessionSettled, useFileInputPicker, waitForSnapshot } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
  page.on('dialog', (dialog) => void dialog.accept());
});

function layer(page: Page): Locator {
  return page.locator('[data-annotation-layer="0"]');
}

function bar(page: Page): Locator {
  return page.getByRole('toolbar', { name: 'Tools', exact: true });
}

/** Counts the presses a journey takes (J8A), each a real click or key. */
function presses() {
  let count = 0;
  return {
    async click(target: Locator) {
      count += 1;
      await target.click();
    },
    async run(step: () => Promise<void>) {
      count += 1;
      await step();
    },
    get count() {
      return count;
    },
  };
}

/** One stroke across the pad, as a pointer draws it. */
async function draw(page: Page, pad: Locator): Promise<void> {
  const box = await pad.boundingBox();
  if (!box) throw new Error('no pad');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.3, { steps: 6 });
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6, { steps: 6 });
  await page.mouse.up();
}

/** Presses a point of the first page once the sheet's scrim has left it. */
async function placeOnPage(page: Page, x: number, y: number): Promise<void> {
  await expect
    .poll(async () => {
      const box = await layer(page).boundingBox();
      if (!box) return false;
      return page.evaluate(
        ([px, py]) =>
          (document
            .elementFromPoint(px as number, py as number)
            ?.closest('[data-annotation-layer]') ?? null) !== null,
        [box.x + box.width * x, box.y + box.height * y],
      );
    })
    .toBe(true);
  const box = await layer(page).boundingBox();
  if (!box) throw new Error('page not rendered');
  const at = { x: box.x + box.width * x, y: box.y + box.height * y };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();
}

async function launch(page: Page): Promise<void> {
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await sessionSettled(page);
}

/** A reload with nothing restored, so the next journey starts from Read on a fresh open. */
async function reloadAndReopen(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await sessionSettled(page);
  const fresh = page.getByTestId('session-notice').getByRole('button', { name: 'Start fresh' });
  if (await fresh.isVisible()) await fresh.click();
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
}

async function openSavedSignatures(page: Page): Promise<Locator> {
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').first().fill('Saved signatures');
  await page
    .getByRole('option', { name: /^Saved signatures…/ })
    .first()
    .click();
  const sheet = page.getByTestId('settings-sheet');
  await expect(sheet.getByTestId('settings-signatures')).toBeVisible();
  return sheet;
}

test('J8A: six presses the first time, four with a saved signature after a reload', async ({
  page,
}) => {
  await launch(page);
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  const stamps = layer(page).locator('[data-annotation-kind="stamp"]');

  // The first time: New signature opens from the signature button (nothing is saved yet).
  const first = presses();
  await first.click(page.locator('[data-read-edit]'));
  await first.click(bar(page).getByRole('button', { name: 'Fill & sign', exact: true }));
  await first.click(bar(page).getByRole('button', { name: 'Signature image', exact: true }));
  const sheet = page.getByRole('dialog', { name: 'New signature' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('checkbox', { name: 'Save for next time' })).toBeChecked();
  const pad = sheet.getByRole('img', { name: 'Signature pad: draw with the mouse, pen or finger' });
  await first.run(() => draw(page, pad));
  await first.click(sheet.getByRole('button', { name: 'Use signature' }));
  await expect(sheet).toBeHidden();
  await expect(layer(page)).toHaveAttribute('data-tool', 'signature');
  await first.run(() => placeOnPage(page, 0.3, 0.45));
  await expect(stamps).toHaveCount(1, { timeout: 10_000 });
  expect(first.count).toBe(6);

  // Kept on this device: after a reload the signature is one press from armed.
  await reloadAndReopen(page);
  const again = presses();
  await again.click(page.locator('[data-read-edit]'));
  await again.click(bar(page).getByRole('button', { name: 'Fill & sign', exact: true }));
  const chip = bar(page).locator('[data-saved-signature]');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveAccessibleName(/^Signature, added /);
  await again.click(chip);
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(layer(page)).toHaveAttribute('data-tool', 'signature');
  await again.run(() => placeOnPage(page, 0.6, 0.3));
  await expect(stamps).toHaveCount(1, { timeout: 10_000 });
  expect(again.count).toBe(4);
  // One-shot: placed, the tool returns and the chip lets go.
  await expect(chip).toHaveAttribute('aria-pressed', 'false');

  // The signature button now offers the saved ones first, then New signature….
  await bar(page).getByRole('button', { name: 'Signature image', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: /^Signature, added / })).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: 'New signature…' })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('Settings: add, rename, remove with Undo, and Remove all is final', async ({ page }) => {
  await launch(page);
  const sheet = await openSavedSignatures(page);
  await expect(sheet.getByTestId('settings-signatures-empty')).toBeVisible();

  // Add… keeps a typed signature and comes back here.
  await sheet.getByTestId('settings-signatures-add').click();
  const create = page.getByRole('dialog', { name: 'New signature' });
  await expect(create).toBeVisible();
  await create.getByRole('tab', { name: 'Type' }).click();
  await create.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
  await create.getByRole('button', { name: 'Save signature' }).click();
  await expect(sheet.getByTestId('settings-signatures')).toBeVisible();
  const rows = sheet.locator('[data-row^="signature:"]');
  await expect(rows).toHaveCount(1);
  await expect(sheet.getByText('1 of 5')).toBeVisible();

  // Rename in place.
  await rows
    .first()
    .getByRole('button', { name: /^Rename / })
    .click();
  await sheet.getByRole('textbox', { name: 'Signature name' }).fill('Full name');
  await page.keyboard.press('Enter');
  await expect(rows.first()).toContainText('Full name');

  // Remove, then Undo from the toast.
  await rows.first().getByRole('button', { name: 'Remove Full name' }).click();
  await expect(rows).toHaveCount(0);
  const removed = sheet.getByTestId('signature-removed');
  await expect(removed).toContainText('Removed a saved signature');
  await removed.getByRole('button', { name: 'Undo' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Full name');

  // Remove all asks once, then nothing is left, even after a reload.
  await sheet.getByTestId('settings-signatures-clear').click();
  const ask = page.getByRole('alertdialog', { name: 'Remove every saved signature?' });
  await ask.getByRole('button', { name: 'Remove all' }).click();
  await expect(rows).toHaveCount(0);
  await expect(sheet.getByTestId('settings-signatures-empty')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await sessionSettled(page);
  const after = await openSavedSignatures(page);
  await expect(after.getByTestId('settings-signatures-empty')).toBeVisible();
  await page.keyboard.press('Escape');
  // The tool has nothing to offer: its button opens New signature again.
  await openFixtures(page, ['simple-text.pdf']);
  await page.locator('[data-read-edit]').click();
  await bar(page).getByRole('button', { name: 'Fill & sign', exact: true }).click();
  await expect(bar(page).locator('[data-saved-signature]')).toHaveCount(0);
  await bar(page).getByRole('button', { name: 'Signature image', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New signature' })).toBeVisible();
});

test('a kept snapshot keeps a placed signature after its saved copy is removed', async ({
  page,
  browserName,
}) => {
  await launch(page);
  if ((await page.locator('html').getAttribute('data-session')) === 'off') {
    expect(browserName, 'Chromium keeps snapshots').not.toBe('chromium');
    test.skip(true, `${browserName} keeps no snapshots in this context`);
  }
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  const stamps = layer(page).locator('[data-annotation-kind="stamp"]');
  await page.locator('[data-read-edit]').click();
  await bar(page).getByRole('button', { name: 'Fill & sign', exact: true }).click();
  await bar(page).getByRole('button', { name: 'Signature image', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'New signature' });
  await sheet.getByRole('tab', { name: 'Type' }).click();
  await sheet.getByRole('textbox', { name: 'Your name' }).fill('Ada Lovelace');
  await sheet.getByRole('button', { name: 'Use signature' }).click();
  await expect(sheet).toBeHidden();
  await placeOnPage(page, 0.3, 0.3);
  await expect(stamps).toHaveCount(1, { timeout: 10_000 });
  await waitForSnapshot(page);

  // The saved copy goes for good; the document keeps its own.
  const settings = await openSavedSignatures(page);
  await settings.getByTestId('settings-signatures-clear').click();
  await page
    .getByRole('alertdialog', { name: 'Remove every saved signature?' })
    .getByRole('button', { name: 'Remove all' })
    .click();
  await expect(settings.getByTestId('settings-signatures-empty')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await sessionSettled(page);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  await expect(stamps).toHaveCount(1, { timeout: 20_000 });
  await page.locator('[data-read-viewport]').focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(stamps).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(stamps).toHaveCount(1);
});
