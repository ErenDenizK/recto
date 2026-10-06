/**
 * The Markup palette end to end (spec redesign D2-3; flows §8.2 J6, J8A, J10; `03-markup`;
 * `10-ink` §2), at large desktop size (Chromium) and on the tablet (820 × 1180, touch):
 *
 * - J6 "write two words in two colours": mouse 5 (Markup · pen · write · red · write), keys 4
 *   (P · write · red · write).
 * - Colour and width are one press from an armed pen: the ink strip shows from arming.
 * - J8A "place a saved signature": 3 (Fill & sign · the chip · the page); the first time 5
 *   (Fill & sign · Sign · draw · Use signature · the page).
 * - J10 "redact text and an area, apply": 6 by keys (select · X · X · drag the area · Apply ·
 *   Apply). The mouse path's 6 goes through the pending-marks bar's "Mark area", which D1-6
 *   builds; until then Apply sits in the Redact tool's strip.
 *
 * Each count is of real presses, drags and keys (`presses`).
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { openFixtures, sessionSettled, useFileInputPicker } from './helpers';

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
});

test.describe.configure({ mode: 'serial' });

function layer(page: Page): Locator {
  return page.locator('[data-annotation-layer="0"]');
}

function palette(page: Page): Locator {
  return page.getByRole('toolbar', { name: 'Markup', exact: true });
}

/** Counts the presses a journey takes, each a real press, drag or key. */
function presses() {
  let count = 0;
  return {
    async click(target: Locator) {
      count += 1;
      await target.click();
    },
    async key(page: Page, key: string) {
      count += 1;
      await page.keyboard.press(key);
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

/** One stroke on the first page, between two points given as shares of its box. */
async function stroke(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const box = await layer(page).boundingBox();
  if (!box) throw new Error('page not rendered');
  const height = Math.min(box.height, 700);
  await page.mouse.move(box.x + box.width * from[0], box.y + height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + height * to[1], { steps: 10 });
  await page.mouse.up();
}

async function open(page: Page, fixture = 'simple-text.pdf'): Promise<void> {
  await page.goto('./?lang=en');
  await sessionSettled(page);
  await openFixtures(page, [fixture]);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
}

for (const size of ['large', 'tablet'] as const) {
  test.describe(`at ${size}`, () => {
    test.skip(
      ({ browserName, isMobile }) => browserName !== 'chromium' || (size === 'tablet') !== isMobile,
      'Large runs in the desktop Chromium project, tablet in the tablet project',
    );
    if (size === 'large') test.use({ viewport: { width: 1440, height: 900 } });

    test('J6 by mouse in 5; colour and width one press from the armed pen', async ({ page }) => {
      await open(page);
      const inks = layer(page).locator('[data-annotation-kind="ink"]');
      const job = presses();
      await job.click(page.locator('[data-dock-item="markup"]'));
      await job.click(palette(page).getByRole('button', { name: 'Black pen, 1.5 pt' }));
      // The ink strip shows from arming: the colours and the width, one press each.
      const strip = page.getByRole('toolbar', { name: 'Pen options' });
      await expect(strip).toBeVisible();
      await expect(strip.getByRole('radio', { name: 'Red' })).toBeVisible();
      await expect(strip.getByRole('slider', { name: 'Width' })).toBeAttached();
      await job.run(() => stroke(page, [0.2, 0.3], [0.4, 0.32]));
      await expect(inks).toHaveCount(1, { timeout: 10_000 });
      await job.click(strip.getByRole('radio', { name: 'Red' }));
      await job.run(() => stroke(page, [0.2, 0.45], [0.4, 0.47]));
      await expect(inks).toHaveCount(2, { timeout: 10_000 });
      expect(job.count).toBe(5);
      // Two colours: the armed pen is red now.
      await expect(strip.getByRole('radio', { name: 'Red' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      // The width is one press too: a step of the width slider changes the armed pen.
      const width = strip.getByRole('slider', { name: 'Width' });
      const before = await width.getAttribute('aria-valuetext');
      await width.focus();
      await page.keyboard.press('ArrowRight');
      await expect(width).not.toHaveAttribute('aria-valuetext', before ?? '');
    });

    test('J6 by keys in 4: P · write · red · write', async ({ page }) => {
      await open(page);
      const inks = layer(page).locator('[data-annotation-kind="ink"]');
      const job = presses();
      await job.key(page, 'p');
      await expect(layer(page)).toHaveAttribute('data-tool', 'ink');
      await job.run(() => stroke(page, [0.2, 0.3], [0.4, 0.32]));
      await expect(inks).toHaveCount(1, { timeout: 10_000 });
      const strip = page.getByRole('toolbar', { name: 'Pen options' });
      await job.click(strip.getByRole('radio', { name: 'Red' }));
      await job.run(() => stroke(page, [0.2, 0.45], [0.4, 0.47]));
      await expect(inks).toHaveCount(2, { timeout: 10_000 });
      expect(job.count).toBe(4);
      // P again arms the next pen.
      await page.locator('[data-annotation-layer="0"]').hover();
      await page.keyboard.press('p');
      await expect(palette(page).getByRole('button', { name: /^Blue pen/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    test('J8A: the first signature in 5, then a saved one in 3', async ({ page }) => {
      await open(page);
      const stamps = layer(page).locator('[data-annotation-kind="stamp"]');
      const first = presses();
      await first.click(page.locator('[data-dock-item="sign"]'));
      await first.click(palette(page).getByRole('button', { name: 'Sign', exact: true }));
      const sheet = page.getByRole('dialog', { name: 'New signature' });
      await expect(sheet).toBeVisible();
      const pad = sheet.getByRole('img', {
        name: 'Signature pad: draw with the mouse, pen or finger',
      });
      await first.run(async () => {
        const box = await pad.boundingBox();
        if (!box) throw new Error('no pad');
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 6 });
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6, { steps: 6 });
        await page.mouse.up();
      });
      await first.click(sheet.getByRole('button', { name: 'Use signature' }));
      await expect(sheet).toBeHidden();
      await expect(layer(page)).toHaveAttribute('data-tool', 'signature');
      await first.run(async () => {
        const box = await layer(page).boundingBox();
        if (!box) throw new Error('no page');
        await page.mouse.click(box.x + box.width * 0.3, box.y + Math.min(box.height, 700) * 0.4);
      });
      await expect(stamps).toHaveCount(1, { timeout: 10_000 });
      expect(first.count).toBe(5);
      // A placing tool: back to Select.
      await expect(layer(page)).toHaveAttribute('data-tool', 'select');

      // From viewing again: Fill & sign · the chip · the page.
      await palette(page).getByRole('button', { name: 'Done' }).click();
      await expect(palette(page)).toHaveCount(0);
      const again = presses();
      await again.click(page.locator('[data-dock-item="sign"]'));
      const chip = page.locator('[data-saved-signature]').first();
      await expect(chip).toBeVisible();
      await expect(chip).toHaveAccessibleName(/^Signature, added /);
      await again.click(chip);
      await expect(layer(page)).toHaveAttribute('data-tool', 'signature');
      await again.run(async () => {
        const box = await layer(page).boundingBox();
        if (!box) throw new Error('no page');
        await page.mouse.click(box.x + box.width * 0.6, box.y + Math.min(box.height, 700) * 0.3);
      });
      await expect(stamps).toHaveCount(2, { timeout: 10_000 });
      expect(again.count).toBe(3);
    });

    test('J10 by keys in 6: select · X · X · drag · Apply · Apply', async ({ page }) => {
      test.setTimeout(120_000);
      await open(page);
      const marks = layer(page).locator('[data-annotation-kind="redact"]');
      const job = presses();
      const textLayer = page.getByTestId('text-layer').first();
      await expect(textLayer.getByText('quick brown fox').first()).toBeAttached({
        timeout: 20_000,
      });
      await job.run(() =>
        textLayer.evaluate((root) => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const at = node.textContent?.indexOf('quick brown fox') ?? -1;
            if (at < 0) continue;
            const range = document.createRange();
            range.setStart(node, at);
            range.setEnd(node, at + 'quick brown fox'.length);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
            return;
          }
          throw new Error('no token');
        }),
      );
      // X on the selection marks it, a targeted act: Markup stays closed.
      await job.key(page, 'x');
      await expect(marks).toHaveCount(1, { timeout: 10_000 });
      await expect(palette(page)).toHaveCount(0);
      // X with no selection opens Markup with Redact armed.
      await page.evaluate(() => window.getSelection()?.removeAllRanges());
      await job.key(page, 'x');
      const redactLayer = page.locator('[data-redaction-layer="0"]');
      await expect(redactLayer).toHaveAttribute('data-active', 'true');
      await job.run(async () => {
        const box = await redactLayer.boundingBox();
        if (!box) throw new Error('page not rendered');
        const height = Math.min(box.height, 700);
        await page.mouse.move(box.x + box.width * 0.55, box.y + height * 0.55);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.8, box.y + height * 0.65, { steps: 8 });
        await page.mouse.up();
      });
      await expect(marks).toHaveCount(2, { timeout: 10_000 });
      await job.click(page.locator('[data-apply-redactions]'));
      const dialog = page.getByTestId('redaction-apply-dialog');
      await expect(dialog).toBeVisible();
      await job.click(dialog.getByTestId('redaction-apply-confirm'));
      // The apply ran: its outcome shows (this phrase recurs on later pages, so the self-check
      // refuses it and the document stays as it was; redaction.spec covers applying).
      await expect(dialog.getByRole('button', { name: 'Close' }).last()).toBeVisible({
        timeout: 60_000,
      });
      expect(job.count).toBe(6);
    });
  });
}
