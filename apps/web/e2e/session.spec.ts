/**
 * Snapshots on this device and restore (ADR-0032 §2.4–§2.7, spec redesign D0-7):
 * - edit, reload: the document comes back at the same page and zoom, and Undo walks the 20
 *   kept steps (and no further);
 * - a stamp and an image signature (today's signature tool), reload, Undo across them, Redo,
 *   then export succeeds with both in the file;
 * - a closed document reopens from Recents with its change and no file picker;
 * - Clear in the privacy popover is final: nothing comes back after a reload;
 * - the compact edition (ADR-0033 §2.3) restores a document edited in the full one, with its
 *   change, and its Download a copy goes through the export.
 *
 * Every test runs in a fresh browser context, so OPFS starts empty. `data-session` and
 * `data-session-saved` on <html> say when the launch restore finished and when the last
 * snapshot was written. `beforeunload` may ask (storage is not persistent in a fresh test
 * profile, ADR-0032 §2.7): the dialog is accepted, as a person leaving would.
 */
import { readFile } from 'node:fs/promises';

import { PDFDict, PDFDocument, PDFName } from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import {
  enterEdit,
  openFixtures,
  openSaveCopy,
  sessionSettled,
  showInspector,
  useFileInputPicker,
  waitForSnapshot,
} from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
  // The WebKit project starts with the not-kept warning dismissed (playwright.config.ts); this
  // spec checks the warning itself, so it is shown again.
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('pdf-editor:session:not-kept-dismissed:v1');
    } catch {
      // No storage: nothing was remembered.
    }
  });
  // Playwright cannot drive the native save picker: force the download path for export.
  await page.addInitScript({
    content:
      "Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });",
  });
  page.on('dialog', (dialog) => void dialog.accept());
});

/**
 * Opens the app and requires that changes can be kept. An engine whose test context refuses
 * OPFS (an ephemeral store, like a private window) keeps nothing; the app must then say so,
 * and the rest of the test cannot apply there. Chromium must always keep.
 */
async function launch(page: Page, browserName: string): Promise<void> {
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await sessionSettled(page);
  const html = page.locator('html');
  if ((await html.getAttribute('data-session')) !== 'off') return;
  const reason = (await html.getAttribute('data-session-reason')) ?? 'unknown';
  expect(browserName, `OPFS ${reason}`).not.toBe('chromium');
  await expect(page.getByTestId('session-notice')).toContainText(
    'Changes are not kept in this window',
  );
  test.info().annotations.push({ type: 'storage', description: `OPFS ${reason} (${browserName})` });
  test.skip(true, `${browserName} keeps nothing in this context (OPFS ${reason}); the app says so`);
}

async function reload(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await sessionSettled(page);
}

function historyRows(page: Page) {
  return page.getByRole('list', { name: /history/i }).getByRole('button');
}

function layer(page: Page) {
  return page.locator('[data-annotation-layer="0"]');
}

/** Presses a point of the first page (a fraction of its box), as a pointer does. */
async function clickPage(page: Page, x: number, y: number): Promise<void> {
  const box = await layer(page).boundingBox();
  if (!box) throw new Error('page not rendered');
  const at = { x: box.x + box.width * x, y: box.y + box.height * y };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x, at.y, { steps: 4 });
  await page.mouse.up();
}

test('edit, reload: same page and zoom, and Undo works for the 20 kept steps', async ({
  page,
  browserName,
}) => {
  await launch(page, browserName);
  await openFixtures(page, ['simple-text.pdf']);
  // 22 rotations in Arrange, alternating pages so no two join into one step.
  await page.keyboard.press('3');
  const cells = page.locator('[role="gridcell"][data-page-id]');
  await expect(cells).toHaveCount(3);
  for (let i = 0; i < 22; i++) {
    await cells.nth(i % 2).click();
    await page.keyboard.press('r');
  }
  await showInspector(page);
  await expect(historyRows(page)).toHaveCount(24);

  // The page view in Edit, page 3, 150 %.
  await page.keyboard.press('2');
  await page.keyboard.press(']');
  await page.keyboard.press(']');
  await expect(page.getByTestId('status-pages')).toHaveText('Page 3 of 3');
  await page.getByRole('button', { name: /^Zoom \d+%/ }).click();
  await page.getByRole('menuitemradio', { name: '150%' }).click();
  await expect(page.getByRole('button', { name: /^Zoom 150%/ })).toBeVisible();
  await waitForSnapshot(page);

  await reload(page);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  const notice = page.getByTestId('session-notice');
  await expect(notice).toContainText('Restored simple-text');
  await expect(notice.getByRole('button', { name: 'Start fresh' })).toBeVisible();
  await expect(page.getByTestId('status-pages')).toHaveText('Page 3 of 3');
  await expect(page.getByRole('button', { name: /^Zoom 150%/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Edit$/ })).toHaveAttribute('aria-checked', 'true');

  // 20 undo steps came back with the present one, and Undo walks all of them.
  await showInspector(page);
  const rows = historyRows(page);
  await expect(rows).toHaveCount(21);
  await expect(rows.last()).toHaveAttribute('data-state', 'present');
  await page.locator('[data-read-viewport]').focus();
  for (let i = 0; i < 20; i++) await page.keyboard.press('ControlOrMeta+z');
  await expect(rows.first()).toHaveAttribute('data-state', 'present');
  await expect(rows.nth(1)).toHaveAttribute('data-state', 'future');
  // Nothing older was kept: one more Undo changes nothing.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(rows.first()).toHaveAttribute('data-state', 'present');
  await expect(rows).toHaveCount(21);
});

test('a stamp and an image signature survive a reload; Undo across them; export succeeds', async ({
  page,
  browserName,
}) => {
  await launch(page, browserName);
  await openFixtures(page, ['simple-text.pdf']);
  await enterEdit(page);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  const stamps = layer(page).locator('[data-annotation-kind="stamp"]');

  // A built-in stamp from the Fill & sign group.
  const bar = page.getByRole('toolbar', { name: 'Tools' });
  await bar.getByRole('button', { name: 'Fill & sign' }).click();
  await bar.getByRole('button', { name: 'Stamp or image' }).click();
  await page.getByRole('menuitem', { name: 'Draft' }).click();
  await clickPage(page, 0.7, 0.3);
  await expect(stamps).toHaveCount(1, { timeout: 10_000 });

  // An image signature drawn on the pad (today's signature tool), placed on the page.
  await bar.getByRole('button', { name: 'Signature image' }).click();
  const pad = page.getByLabel('Signature pad: draw with the mouse, pen or finger');
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  if (!box) throw new Error('no pad');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 6 });
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Use signature' }).click();
  await expect(pad).toBeHidden();
  await expect(layer(page)).toHaveAttribute('data-tool', 'signature');
  // The dialog's backdrop fades out over the page first.
  await expect
    .poll(async () => {
      const box = await layer(page).boundingBox();
      if (!box) return false;
      return page.evaluate(
        ([x, y]) =>
          document
            .elementFromPoint(x as number, y as number)
            ?.closest('[data-annotation-layer]') !== null,
        [box.x + box.width * 0.3, box.y + box.height * 0.45],
      );
    })
    .toBe(true);
  await clickPage(page, 0.3, 0.45);
  await expect(stamps).toHaveCount(2, { timeout: 10_000 });
  await waitForSnapshot(page);

  await reload(page);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  // The edits are replayed on the kept bytes, with their images.
  await expect(stamps).toHaveCount(2, { timeout: 20_000 });
  await page.locator('[data-read-viewport]').focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(stamps).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(stamps).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(stamps).toHaveCount(2);

  const dialog = await openSaveCopy(page);
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download copy' }).click();
  const pdf = await PDFDocument.load(await readFile(await (await downloading).path()), {
    updateMetadata: false,
  });
  const subtypes = pdf
    .getPages()
    .flatMap((p) => p.node.Annots()?.asArray() ?? [])
    .map((ref) => String(pdf.context.lookup(ref, PDFDict).get(PDFName.of('Subtype'))));
  expect(subtypes.filter((s) => s === '/Stamp')).toHaveLength(2);
});

test('a reloaded tab restores its own documents, not those of the tab closed last', async ({
  page,
  context,
  browserName,
}) => {
  await launch(page, browserName);
  await openFixtures(page, ['simple-text.pdf']);
  await waitForSnapshot(page);

  // Another tab with a document of its own, closed after this one's last snapshot.
  const other = await context.newPage();
  await useFileInputPicker(other);
  other.on('dialog', (dialog) => void dialog.accept());
  await launch(other, browserName);
  await expect(other.getByRole('tab', { name: 'simple-text' })).toHaveCount(0);
  await openFixtures(other, ['outline-named-dests.pdf']);
  await waitForSnapshot(other);
  await other.close();

  // This tab reloads (by hand, after a crash, or after the browser discarded it).
  await reload(page);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'outline-named-dests' })).toHaveCount(0);
});

test('a closed document reopens from Recents with its change and no file picker', async ({
  page,
  browserName,
}) => {
  await launch(page, browserName);
  await openFixtures(page, ['simple-text.pdf']);
  // A change: page 2 deleted in Arrange.
  await page.keyboard.press('3');
  const cells = page.locator('[role="gridcell"][data-page-id]');
  await expect(cells).toHaveCount(3);
  await cells.nth(1).click();
  await page.keyboard.press('Delete');
  await expect(cells).toHaveCount(2);
  await waitForSnapshot(page);

  // Closed: Home lists it as edited, with its changes kept.
  await page.getByRole('tab', { name: 'simple-text' }).focus();
  await page.keyboard.press('Delete');
  const row = page
    .getByRole('list', { name: 'Recent files' })
    .getByRole('button', { name: /^simple-text\.pdf, / });
  await expect(row).toHaveAccessibleName(/Edited, changes kept/, { timeout: 10_000 });

  await reload(page);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toHaveCount(0);
  await expect(row).toHaveAccessibleName(/Edited, changes kept/);
  let picked = false;
  page.on('filechooser', () => {
    picked = true;
  });
  await row.click();
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  await expect(page.getByTestId('status-pages')).toHaveText(/of 2$/);
  expect(picked).toBe(false);
});

test('Clear in the privacy popover deletes every snapshot, for good', async ({
  page,
  browserName,
}) => {
  await launch(page, browserName);
  await openFixtures(page, ['simple-text.pdf', 'rotated-pages.pdf']);
  await page.keyboard.press('3');
  const cells = page.locator('[role="gridcell"][data-page-id]');
  await cells.first().click();
  await page.keyboard.press('r');
  await waitForSnapshot(page);
  // One closed document kept for Recents, one open.
  await page.getByRole('tab', { name: 'rotated-pages' }).focus();
  await page.keyboard.press('Delete');
  await waitForSnapshot(page);

  await page.getByTestId('privacy-indicator').click();
  const kept = page.getByTestId('privacy-kept');
  await expect(kept.getByTestId('privacy-kept-list').getByRole('listitem')).toHaveCount(2);
  await expect(kept).toContainText('simple-text');
  await expect(kept).toContainText('rotated-pages');
  await kept.getByTestId('privacy-kept-clear').click();
  await kept.getByTestId('privacy-kept-delete').click();
  await expect(kept.getByTestId('privacy-kept-empty')).toBeVisible();
  await page.keyboard.press('Escape');

  await reload(page);
  // Nothing restored, and Recents keep no changes.
  await expect(page.getByTestId('session-notice')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toHaveCount(0);
  const recents = page.getByRole('list', { name: 'Recent files' });
  await expect(recents.getByRole('button', { name: /changes kept/ })).toHaveCount(0);
  await page.getByTestId('privacy-indicator').click();
  await expect(page.getByTestId('privacy-kept-empty')).toBeVisible();
});

test('the compact edition restores a document edited in the full one and offers a copy', async ({
  page,
  browserName,
}) => {
  await launch(page, browserName);
  await openFixtures(page, ['simple-text.pdf']);
  await page.keyboard.press('3');
  const cells = page.locator('[role="gridcell"][data-page-id]');
  await cells.nth(1).click();
  await page.keyboard.press('Delete');
  await expect(cells).toHaveCount(2);
  await waitForSnapshot(page);

  // The same device opens the compact edition (ADR-0033 §2.3).
  await page.goto('./?edition=compact&lang=en');
  await expect(page.getByTestId('compact-app')).toHaveAttribute('data-place', 'reader', {
    timeout: 20_000,
  });
  const notice = page.getByTestId('session-notice');
  await expect(notice).toContainText('Restored simple-text');
  const downloading = page.waitForEvent('download');
  await notice.getByRole('button', { name: 'Download a copy' }).click();
  const pdf = await PDFDocument.load(await readFile(await (await downloading).path()), {
    updateMetadata: false,
  });
  // The copy has the change: the export wrote the edited document, not the opened file.
  expect(pdf.getPageCount()).toBe(2);
});
