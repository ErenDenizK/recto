/**
 * Undo of a close (PF-18): closing a tab parks its source (closed in the PDFium worker, bytes
 * kept), and undo opens it again from those bytes and replays its edits. The page renders
 * again with its annotation, and the reopen is timed (reported in the test output).
 */
import { expect, test } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';

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
  await page.locator('body').press('r');
  const box = await layer.boundingBox();
  if (!box) throw new Error('page not rendered');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  const before = await layer.locator('[data-annotation-kind="square"]').count();
  expect(before).toBeGreaterThan(0);

  const tab = page.getByRole('tab', { name: 'simple-text' });
  await tab.hover();
  await tab.locator('[title^="Close"]').click({ force: true });
  await expect(page.getByRole('tab', { name: 'simple-text' })).toHaveCount(0);

  const started = Date.now();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  await expect(rendered.first()).toBeAttached({ timeout: 20_000 });
  await expect(layer.locator('[data-annotation-kind="square"]')).toHaveCount(before, {
    timeout: 20_000,
  });
  const elapsed = Date.now() - started;
  info.annotations.push({ type: 'undo-of-close-ms', description: String(elapsed) });
  console.log(`undo of close: ${elapsed} ms`);
  expect(elapsed).toBeLessThan(5000);
});
