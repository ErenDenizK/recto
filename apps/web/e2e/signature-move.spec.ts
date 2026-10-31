/**
 * A placed signature moves and keeps drawing (fresh-25oct finding 1): Fill & sign → Sign,
 * draw, Use signature, place it, then drag it with the mouse (desktop projects) or a finger
 * (the `tablet` project, real touch through the DevTools protocol). The page shows its ink
 * where it was dropped, Undo brings it back where it was and still drawn, and the downloaded
 * copy, opened again, draws it too. A moved stamp used to lose its image: the engine updated
 * it in place and rebuilt an empty appearance (PdfiumAdapter.updateAnnotation).
 */
import { writeFile } from 'node:fs/promises';

import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test';

import {
  atRest,
  PAGE_CANVAS,
  quiet,
  saveCopyBytes,
  trackEngine,
  useDownloadPath,
  useFileInputPicker,
  openFixtures,
} from './helpers';
import { decodePng } from './support/pixels';

test.skip(({ browserName }) => browserName !== 'chromium', 'Download flow is verified on Chromium');

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function layer(page: Page): Locator {
  return page.locator('[data-annotation-layer="0"]');
}

function bar(page: Page): Locator {
  return page.getByRole('toolbar', { name: 'Fill & sign', exact: true });
}

/**
 * Pixels of the signature's ink (SIGNATURE_INK, a dark blue) on screen inside `box`, inset by
 * 8 px so the selection's blue outline and handles on its edges are not counted.
 */
async function inkPixels(page: Page, box: Box): Promise<number> {
  const inset = 8;
  const clip = {
    x: box.x + inset,
    y: box.y + inset,
    width: box.width - 2 * inset,
    height: box.height - 2 * inset,
  };
  const image = decodePng(await page.screenshot({ clip }));
  let ink = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i] ?? 255;
    const b = image.data[i + 2] ?? 0;
    if (r < 140 && b - r > 30) ink += 1;
  }
  return ink;
}

/** A drag from `from` to `to`: a finger through `cdp` when there is one, else the mouse. */
async function drag(
  page: Page,
  cdp: CDPSession | null,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const steps = 12;
  if (cdp) {
    const at = (t: number) => ({
      x: Math.round(from.x + (to.x - from.x) * t),
      y: Math.round(from.y + (to.y - from.y) * t),
      id: 0,
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [at(i / steps)],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

/** One stroke across the signature pad, once the sheet has grown in. */
async function draw(page: Page, pad: Locator): Promise<void> {
  await atRest(pad);
  const box = await pad.boundingBox();
  if (!box) throw new Error('no pad');
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.25, { steps: 6 });
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.65, { steps: 6 });
  await page.mouse.up();
}

/** The placed stamp's on-screen box, once it has stopped moving. */
async function stampBox(stamp: Locator): Promise<Box> {
  await atRest(stamp);
  const box = await stamp.boundingBox();
  if (!box) throw new Error('no stamp');
  return box;
}

test('a placed signature moved by a drag still draws, after Undo and in the saved copy', async ({
  page,
  browserName,
}, testInfo) => {
  const touch = browserName === 'chromium' && testInfo.project.use.hasTouch === true;
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  await trackEngine(page);
  await useFileInputPicker(page);
  await useDownloadPath(page);
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.locator(`${PAGE_CANVAS}[data-state="rendered"]`).first()).toBeAttached({
    timeout: 20_000,
  });

  // Fill & sign → Sign → draw → Use signature → a press on the page.
  await page.locator('[data-dock-item="sign"]').click();
  await bar(page).getByRole('button', { name: 'Sign', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'New signature' });
  await expect(sheet).toBeVisible();
  await draw(page, sheet.getByRole('img', { name: /^Signature pad/ }));
  await sheet.getByRole('button', { name: 'Use signature' }).click();
  await expect(sheet).toBeHidden();
  await expect(layer(page)).toHaveAttribute('data-tool', 'signature');
  await atRest(layer(page));
  const pageBox = await layer(page).boundingBox();
  if (!pageBox) throw new Error('page not rendered');
  // Below the page's text and above the bottom bar, on every project's viewport.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  await page.mouse.click(pageBox.x + pageBox.width * 0.3, viewport.height * 0.6);
  const stamp = layer(page).locator('[data-annotation-kind="stamp"]');
  await expect(stamp).toHaveCount(1);
  await quiet(page);
  const placed = await stampBox(stamp);
  await expect.poll(() => inkPixels(page, placed)).toBeGreaterThan(40);

  await page.screenshot({ path: testInfo.outputPath('signature-placed.png') });
  // The drag: from the signature's middle, down and to the right by more than its size.
  const dx = Math.round(placed.width + 40);
  const dy = 60;
  const middle = { x: placed.x + placed.width / 2, y: placed.y + placed.height / 2 };
  // Tapped (or clicked) first, as the tester did: selected, with its handles.
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(middle.x), y: Math.round(middle.y), id: 0 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.click(middle.x, middle.y);
  }
  await expect(layer(page).locator('[data-selected-annotation]')).toHaveCount(1);
  await quiet(page);
  await drag(page, cdp, middle, { x: middle.x + dx, y: middle.y + dy });
  await quiet(page);
  await expect
    .poll(async () => Math.round((await stampBox(stamp)).x - placed.x))
    .toBeGreaterThan(dx - 8);
  const moved = await stampBox(stamp);
  await page.screenshot({ path: testInfo.outputPath('signature-moved.png') });
  await expect.poll(() => inkPixels(page, moved)).toBeGreaterThan(40);
  await expect.poll(() => inkPixels(page, placed)).toBeLessThan(10);

  // Undo: the signature returns where it was, still drawn; Redo moves it again, still drawn.
  await page.keyboard.press('ControlOrMeta+z');
  await quiet(page);
  await expect
    .poll(async () => Math.abs(Math.round((await stampBox(stamp)).x - placed.x)))
    .toBeLessThan(3);
  await expect.poll(() => inkPixels(page, placed)).toBeGreaterThan(40);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await quiet(page);
  await expect
    .poll(async () => Math.abs(Math.round((await stampBox(stamp)).x - moved.x)))
    .toBeLessThan(3);
  await expect.poll(() => inkPixels(page, moved)).toBeGreaterThan(40);

  // The saved copy, opened again, draws the moved signature at the same place.
  const bytes = await saveCopyBytes(page);
  const copy = testInfo.outputPath('signature-moved.pdf');
  await writeFile(copy, bytes);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await (await chooser).setFiles(copy);
  await expect(page.getByRole('tab', { name: 'signature-moved' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator(`${PAGE_CANVAS}[data-state="rendered"]`).first()).toBeAttached({
    timeout: 20_000,
  });
  const reopened = layer(page).locator('[data-annotation-kind="stamp"]');
  await expect(reopened).toHaveCount(1);
  await quiet(page);
  const there = await stampBox(reopened);
  await expect.poll(() => inkPixels(page, there)).toBeGreaterThan(40);
});
