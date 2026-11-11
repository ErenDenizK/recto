/**
 * The desk end to end (DSN-87, DSN-93 Colophon; the only Home): the first visit's heading, buttons
 * and Margin cover, the one primary and first focus, the conversions found by name with nothing
 * open, and the cover shelf after a document is closed (a cover image, one tab stop, a press
 * reopens it).
 */
import { expect, test } from '@playwright/test';

import { fixturePath, sessionSettled, useFileInputPicker, waitForSnapshot } from './helpers';

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
});

test('first visit: the heading, Open or drop files as the one primary with first focus, the Margin cover', async ({
  page,
}) => {
  await page.goto('/');
  await sessionSettled(page);
  const home = page.getByTestId('home');
  await expect(home).toHaveAttribute('data-desk', '');
  await expect(
    home.getByRole('heading', { level: 1, name: 'Read, mark up, sign and arrange.' }),
  ).toBeVisible();
  await expect(home.getByTestId('desk-sample')).toBeVisible();
  const group = home.getByRole('group', { name: 'Ways to start' });
  const open = group.getByTestId('library-open');
  await expect(open).toBeFocused();
  await expect(open).toHaveText('Open or drop files');
  await expect(home.locator('.btn-prominent')).toHaveCount(1);
  await expect(group.getByTestId('library-sign')).toBeVisible();
  await expect(group.getByTestId('library-combine-files')).toBeVisible();
  await expect(group.getByTestId('home-all-commands')).toBeVisible();
  // Scan stays off without its flag, whatever the camera.
  await expect(group.getByTestId('library-scan')).toHaveCount(0);
  await expect(home.getByRole('heading', { name: 'Recent' })).toHaveCount(0);
  // The beam is decorative and still.
  await expect(home.getByTestId('home-beam')).toHaveAttribute('aria-hidden', 'true');
});

test('PDF to JPG and Images to PDF are found by name with nothing open', async ({ page }) => {
  await page.goto('/');
  await sessionSettled(page);
  await page.keyboard.press('ControlOrMeta+k');
  const field = page.getByRole('combobox', { name: 'Search commands' });
  await field.fill('pdf to jpg');
  await expect(page.getByRole('option', { name: /PDF to images…/ })).toBeVisible();
  await field.fill('images to pdf');
  await expect(page.getByRole('option', { name: /Images to PDF…/ })).toBeVisible();
  await field.fill('sign a pdf');
  await expect(page.getByRole('option', { name: /Sign a PDF…/ })).toBeVisible();
});

test('a closed document is a cover on the shelf, one tab stop, and a press reopens it', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  await sessionSettled(page);
  if ((await page.locator('html').getAttribute('data-session')) === 'off') {
    // An engine whose test context refuses OPFS keeps nothing, and says so (session.spec.ts,
    // J14 in jobs.spec.ts): there is no shelf to test. Chromium always keeps.
    expect(browserName, 'Chromium always keeps').not.toBe('chromium');
    test.skip(true, `${browserName} keeps nothing in this test context`);
  }
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('library-open').click();
  await (await chooser).setFiles([fixturePath('simple-text.pdf')]);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  await waitForSnapshot(page);
  // Close it: the document goes to Recent, and its cover is written once it has rendered.
  await page.keyboard.press('ControlOrMeta+w');
  const home = page.getByTestId('home');
  await expect(home).toBeVisible();
  const shelf = home.getByRole('list', { name: 'Recent files' });
  const tile = shelf.locator('button[data-desk-tile][data-recent-id]').first();
  await expect(tile).toBeVisible();
  await expect(tile.locator('[data-library-sheet] img[data-cover]')).toHaveAttribute(
    'src',
    /^blob:/,
    { timeout: 30_000 },
  );
  await expect(tile).toHaveAttribute('aria-label', /^simple-text\.pdf, /);
  await expect(shelf.locator('button[data-desk-tile][tabindex="0"]')).toHaveCount(1);
  // An unchanged file keeps no snapshot and this browser path no handle: the press opens the
  // file dialog ("Open again…"), with the note saying why, and the picked file opens.
  const again = page.waitForEvent('filechooser');
  await tile.click();
  await (await again).setFiles([fixturePath('simple-text.pdf')]);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
});
