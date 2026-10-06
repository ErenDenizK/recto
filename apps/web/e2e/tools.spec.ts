/**
 * Document tools end to end: the Edit bar's five groups by mouse and keyboard, the page
 * context menu, and the Document menu's sections (experience-redesign spec §5, craft spec
 * §3.4). Compress and Export as images now open Save a copy (`save-copy.spec.ts`); the
 * design screenshot of its What gets smaller page stays here.
 */
import { writeFile } from 'node:fs/promises';

import {
  concatTransformationMatrix,
  drawObject,
  PDFDocument,
  PDFName,
  popGraphicsState,
  pushGraphicsState,
  StandardFonts,
} from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import { useFileInputPicker } from './helpers';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Tool downloads are verified on Chromium',
);

async function openTool(page: Page, name: string): Promise<void> {
  await page.getByTestId('document-menu').click();
  await page.getByRole('menuitem', { name }).click();
}

/** A Letter page with a 1600 × 1200 Flate RGB "photo" placed 4 inches wide (400 dpi). */
async function photoPdf(): Promise<Uint8Array> {
  const width = 1600;
  const height = 1200;
  const pixels = new Uint8Array(width * height * 3);
  let seed = 7;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      const sky = y < height * 0.55;
      const hill = Math.sin(x / 180) * 60 + height * 0.62;
      const noise = (random() - 0.5) * 14;
      const [r, g, b] = sky
        ? [90 + (y / height) * 120, 150 + (y / height) * 70, 230]
        : y > hill
          ? [40 + (x / width) * 60, 120 + Math.sin(x / 40) * 20, 50]
          : [70, 150, 80];
      const sun = Math.hypot(x - width * 0.75, y - height * 0.2) < 110;
      pixels[o] = Math.max(0, Math.min(255, (sun ? 250 : r) + noise));
      pixels[o + 1] = Math.max(0, Math.min(255, (sun ? 210 : g) + noise));
      pixels[o + 2] = Math.max(0, Math.min(255, (sun ? 60 : b) + noise));
    }
  }
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const stream = doc.context.flateStream(pixels, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    ColorSpace: 'DeviceRGB',
    BitsPerComponent: 8,
  });
  const ref = doc.context.register(stream);
  const page = doc.addPage([612, 792]);
  page.drawText('Field report: 400 dpi photo', { x: 72, y: 720, size: 18, font });
  page.node.setXObject(PDFName.of('Photo'), ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(288, 0, 0, 216, 72, 470),
    drawObject('Photo'),
    popGraphicsState(),
  );
  return doc.save();
}

test('Save a copy, what gets smaller, with compare (design screenshot)', async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.CAPTURE_SCREENSHOTS,
    'Set CAPTURE_SCREENSHOTS=1 to write docs/design/screenshots/.',
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await useFileInputPicker(page);
  await page.goto('./');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  const file = testInfo.outputPath('field-report.pdf');
  await writeFile(file, await photoPdf());
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await chooser).setFiles(file);
  await expect(page.getByRole('tab', { name: 'field-report' })).toBeVisible();

  await openTool(page, 'Compress…');
  const dialog = page.getByTestId('save-copy-sheet');
  await dialog.getByTestId('save-copy-what-smaller').click();
  await expect(dialog.getByTestId('compress-estimate')).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole('table')).toContainText('Downsample to 600×450');
  await dialog.getByRole('switch', { name: 'Compare before and after' }).click();
  await expect(dialog.getByTestId('compress-result')).toContainText('→', { timeout: 30_000 });
  await expect(dialog.getByTestId('compress-compare').locator('canvas')).toHaveCount(2, {
    timeout: 15_000,
  });
  // Scroll both panes (they scroll together) to the photo.
  await dialog.getByRole('img', { name: 'Before' }).evaluate((element) => {
    element.scrollTop = 230;
    element.scrollLeft = 330;
    element.dispatchEvent(new Event('scroll'));
  });
  await page.screenshot({ path: '../../docs/design/screenshots/m3-compress-1440.png' });
});
