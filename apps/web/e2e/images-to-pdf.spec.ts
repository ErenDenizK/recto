/**
 * Images as a new PDF end to end (Epic 5, PRD-23): a JPEG or a PNG opened through Open files or
 * dropped on the app becomes one new, unsaved document with one page per image. Two images give
 * "Images"; a PDF dropped with an image still opens as usual.
 */
import { expect, type Page, test } from '@playwright/test';

import { useFileInputPicker } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Covered in Chromium');
test.use({ viewport: { width: 1440, height: 900 } });

interface Made {
  readonly name: string;
  readonly mimeType: string;
  readonly base64: string;
}

/** A generated image, made by the page's own canvas (no fixture files). */
async function makeImage(page: Page, name: string, mimeType: string): Promise<Made> {
  const base64 = await page.evaluate(async (type) => {
    const canvas = new OffscreenCanvas(300, 200);
    const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    context.fillStyle = '#c63';
    context.fillRect(0, 0, 300, 200);
    const bytes = new Uint8Array(await (await canvas.convertToBlob({ type })).arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, mimeType);
  return { name, mimeType, base64 };
}

for (const [name, mimeType] of [
  ['receipt.jpg', 'image/jpeg'],
  ['scan.png', 'image/png'],
] as const) {
  test(`${name} opened with Open files is one new unsaved page`, async ({ page }) => {
    test.setTimeout(90_000);
    await useFileInputPicker(page);
    await page.goto('./?lang=en');
    const image = await makeImage(page, name, mimeType);
    const chooser = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /^Open files$/ })
      .first()
      .click();
    await (await chooser).setFiles({
      name: image.name,
      mimeType,
      buffer: Buffer.from(image.base64, 'base64'),
    });
    const title = name.replace(/\.\w+$/, '');
    await expect(page.getByRole('tab', { name: title })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-page-index="0"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-page-index="1"]')).toHaveCount(0);
    // Changed from the start (closing keeps the changes and says so), as PRD-19 sets.
    await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'save');
  });
}

test('a dropped JPEG and PNG become one document named Images with two pages', async ({ page }) => {
  test.setTimeout(90_000);
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  const jpeg = await makeImage(page, 'a.jpg', 'image/jpeg');
  const png = await makeImage(page, 'b.png', 'image/png');
  await page.getByTestId('app-shell').evaluate(
    (element, files) => {
      const data = new DataTransfer();
      for (const file of files) {
        const raw = atob(file.base64);
        const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        data.items.add(new File([bytes], file.name, { type: file.mimeType }));
      }
      for (const type of ['dragenter', 'dragover', 'drop']) {
        element.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
        );
      }
    },
    [jpeg, png],
  );
  await expect(page.getByRole('tab', { name: 'Images' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.locator('[data-page-index="1"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'save');
});
