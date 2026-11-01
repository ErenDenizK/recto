/**
 * Undo of a close (PF-18): closing a tab parks its source (closed in the PDFium worker, bytes
 * kept), and undo opens it again from those bytes and replays its edits. The page renders
 * again with its annotation; the reopen is timed and reported as an annotation, not asserted.
 */
import { expect, test } from '@playwright/test';

import { enterEdit, openFixtures, useFileInputPicker } from './helpers';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Chromium and the tablet project; the other engines run the same code through the unit suite',
);

test('undo of a close reopens the parked document with its edits', async ({ page }, info) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await openFixtures(page, ['simple-text.pdf']);
  const rendered = page.locator('canvas[data-state="rendered"]');
  await expect(rendered.first()).toBeAttached({ timeout: 20_000 });

  // One rectangle on page 1, so there is an engine edit to replay.
  const layer = page.locator('[data-annotation-layer="0"]');
  await enterEdit(page);
  await page.locator('body').press('r');
  const box = await layer.boundingBox();
  if (!box) throw new Error('page not rendered');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  // The rectangle reaches the layer once the engine worker has created it, a moment after the
  // pointer is up, so wait for it (a bare `count()` is a snapshot and read 0 on a slow runner).
  const squares = layer.locator('[data-annotation-kind="square"]');
  await expect(squares).toHaveCount(1, { timeout: 20_000 });

  const tab = page.getByRole('tab', { name: 'simple-text' });
  await tab.hover();
  await tab.locator('[title^="Close"]').click({ force: true });
  await expect(page.getByRole('tab', { name: 'simple-text' })).toHaveCount(0);

  const started = Date.now();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  await expect(rendered.first()).toBeAttached({ timeout: 20_000 });
  await expect(squares).toHaveCount(1, { timeout: 20_000 });
  const elapsed = Date.now() - started;
  info.annotations.push({ type: 'undo-of-close-ms', description: String(elapsed) });
  console.log(`undo of close: ${elapsed} ms`);
});
