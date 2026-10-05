/**
 * The colour panel's eyedropper on a real page (10-ink.md §4.1, §4.4): it samples the rendered
 * page bitmap, not the screen, so a pick matches the PDF's colours. `colour-swatches.pdf` has
 * three DeviceRGB squares of known bytes (#1760EE, #DB1C22, #02853C, 144 pt each, top edge
 * 168 pt from the top of a Letter page, 72 / 234 / 396 pt from the left); each pick lands on a
 * square's centre and must read its colour within 1/255 per channel. The blue checks the
 * channel order.
 */
import { expect, type Page, test } from '@playwright/test';

import { enterEdit, openFixtures, useFileInputPicker } from './helpers';

const SWATCHES = [
  { hex: '#1760EE', left: 72 },
  { hex: '#DB1C22', left: 234 },
  { hex: '#02853C', left: 396 },
] as const;
const SIDE = 144;
const TOP = 168;
const PAGE_WIDTH = 612;
const PRESETS_KEY = 'pdf-editor:ui:pen-presets:v2';

function channels(hex: string): number[] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function blackPenColour(page: Page): Promise<string> {
  return page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      presets?: { color: string }[];
    };
    return stored.presets?.[0]?.color ?? '';
  }, PRESETS_KEY);
}

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
});

test('the eyedropper picks each page colour within 1/255', async ({ page }) => {
  await page.goto('./');
  await openFixtures(page, ['colour-swatches.pdf']);
  await enterEdit(page);
  const layer = page.locator('[data-annotation-layer="0"]');
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });

  // The black pen's editor, then its colour well: the colour panel.
  await page.locator('body').press('p');
  const black = page
    .getByRole('radiogroup', { name: 'Pen presets' })
    .getByRole('radio', { name: /^Black pen/ });
  await expect(black).toHaveAttribute('data-armed', '');
  await black.click();
  const editor = page.getByRole('dialog', { name: 'Edit black pen' });
  await expect(editor).toBeVisible();
  // The well pushes the colour views in place, inside the editor (10-ink §6).
  await editor.getByRole('button', { name: 'More colours' }).click();
  const panel = editor.getByRole('group', { name: 'Colour' });
  await expect(panel).toBeVisible();

  for (const swatch of SWATCHES) {
    await panel.getByRole('button', { name: 'Eyedropper' }).click();
    const box = await layer.boundingBox();
    if (!box) throw new Error('page not rendered');
    const scale = box.width / PAGE_WIDTH;
    const x = box.x + (swatch.left + SIDE / 2) * scale;
    const y = box.y + (TOP + SIDE / 2) * scale;
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.down();
    await page.mouse.up();
    await expect(panel).toBeVisible();
    await expect.poll(() => blackPenColour(page)).not.toBe('');
    const picked = channels(await blackPenColour(page));
    const want = channels(swatch.hex);
    picked.forEach((value, i) => {
      expect(Math.abs(value - (want[i] ?? 0)), `${swatch.hex} channel ${i}`).toBeLessThanOrEqual(1);
    });
  }
});
