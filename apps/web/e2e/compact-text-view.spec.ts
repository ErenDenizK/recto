/**
 * The phone's Text view (PRD-36, EDN-26, EDN-27, DSN-84; `shell/compact/textview-host.tsx`,
 * `textview/`), behind Labs `text-view` (`?textview=1`), on the `phone` project (390 × 844, touch).
 *
 * Covers: with the flag off there is no row and no Text view chunk is requested; with it on the
 * chunk is requested at the row's pointerdown and not when the menu opens; open and close keep
 * the place; Go to page and Find move the view and Find marks the hit; the Aa settings persist
 * across a reload; a scanned page offers OCR; the phone on its side works; axe passes; and under
 * reduced motion nothing but a fade of at most 150 ms runs. Only engine-agnostic steps are
 * used, so it needs no CDP.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { fixturePath, motionDone, useFileInputPicker } from './helpers';
import { settleAnimations } from './support/glass-walker';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;
const AXE_SOURCE = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

/** The door's lazy chunk (`textview-host.tsx`): its file name carries the module's name. */
const CHUNK = 'textview-shown';

const row = (page: Page) => page.getByTestId('compact-text-view-row');
const view = (page: Page) => page.getByTestId('text-view');
const article = (page: Page) => page.getByTestId('text-view-article');
const position = (page: Page) => page.getByTestId('text-view-position');

/** Opens a fixture on the phone; `query` is the address' query without the language. */
async function openPdf(
  page: Page,
  name: string,
  query = '',
): Promise<{ chunks: string[]; workers: string[] }> {
  const chunks: string[] = [];
  /** Workers that start once the reader is up: the analysis worker must not be one (EDN-26). */
  const workers: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes(CHUNK)) chunks.push(request.url());
  });
  await useFileInputPicker(page);
  await page.goto(`./?lang=en${query}`);
  await expect(page.getByTestId('compact-library')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
  await (await chooser).setFiles(fixturePath(name));
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
  page.on('worker', (worker) => workers.push(worker.url()));
  return { chunks, workers };
}

async function openMenu(page: Page): Promise<void> {
  await page.getByTestId('compact-title-menu-trigger').click();
  await expect(page.getByTestId('compact-file-menu')).toBeVisible();
}

async function enterTextView(page: Page): Promise<void> {
  await openMenu(page);
  await row(page).click();
  await expect(article(page)).toBeVisible({ timeout: 30_000 });
  // Pages after the visible ones stay skeletons; the first text has arrived when a block shows.
  await expect(
    article(page).locator('p, h2, h3, h4, [data-testid="text-view-scanned"]').first(),
  ).toBeVisible({ timeout: 30_000 });
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await settleAnimations(page);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

/** The reader's scroll position, CSS px. */
const readerTop = (page: Page) => page.getByTestId('compact-pages').evaluate((el) => el.scrollTop);

test.describe('Text view', () => {
  test('flag off: no row, no chunk', async ({ page }) => {
    const { chunks, workers } = await openPdf(page, 'markdown-source.pdf');
    await openMenu(page);
    await expect(row(page)).toHaveCount(0);
    await motionDone(page);
    expect(chunks).toEqual([]);
    expect(workers).toEqual([]);
  });

  test('?textview=0 keeps the row away', async ({ page }) => {
    const { chunks, workers } = await openPdf(page, 'markdown-source.pdf', '&textview=0');
    await openMenu(page);
    await expect(row(page)).toHaveCount(0);
    await motionDone(page);
    expect(chunks).toEqual([]);
    expect(workers).toEqual([]);
  });

  test('loads on the row, not on the menu', async ({ page }) => {
    const { chunks, workers } = await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await openMenu(page);
    await expect(row(page)).toBeVisible();
    await expect(row(page)).toHaveText('Text view');
    await shot(page, 'menu');
    // Opening the menu, once it has come to rest, loads nothing and starts no worker (EDN-26).
    await motionDone(page);
    expect(chunks).toEqual([]);
    expect(workers).toEqual([]);
    await row(page).dispatchEvent('pointerdown');
    await expect.poll(() => chunks.length).toBeGreaterThan(0);
    // The chunk alone starts no worker: the data opens on the tap.
    expect(workers).toEqual([]);
    await row(page).click();
    await expect(article(page)).toBeVisible({ timeout: 30_000 });
  });

  test('shows the document as text and keeps the place both ways', async ({ page }) => {
    await openPdf(page, 'demo/demo-report-v1.pdf', '&textview=1');
    // Into the middle of page 4 in the reader.
    await page.getByTestId('compact-pages').evaluate((el) => {
      const four = el.querySelector<HTMLElement>('[data-page-index="3"]');
      const top = four?.getBoundingClientRect().top ?? 0;
      el.scrollTop += top + 200 - 100;
    });
    // A scroll up shows the chrome again.
    await page.getByTestId('compact-pages').evaluate((el) => {
      el.scrollTop -= 24;
    });
    await expect(page.getByTestId('compact-top-bar')).not.toHaveAttribute('data-hidden', 'true');
    const before = await readerTop(page);
    await enterTextView(page);
    await expect(page.getByTestId('compact-pages')).toHaveAttribute('data-overview', 'true');
    await expect(position(page)).toContainText('4 / 10');
    await shot(page, 'text-page-4');
    await page.getByTestId('text-view-page-view').click();
    await expect(view(page)).toHaveCount(0);
    // Within a block (a paragraph is a few lines) of where it was.
    expect(Math.abs((await readerTop(page)) - before)).toBeLessThan(150);
    await shot(page, 'reader-after');
  });

  test('the title menu row leaves again, and Go to page moves the view', async ({ page }) => {
    await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await enterTextView(page);
    await expect(position(page)).toContainText('1 / 2');
    await position(page).click();
    const sheet = page.getByTestId('compact-goto-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('textbox').fill('2');
    await sheet.getByRole('button', { name: 'Go' }).click();
    await expect(sheet).toHaveCount(0);
    // The document ends on page 2, so its last lines cannot reach the top: assert what shows.
    await expect(article(page).getByRole('heading', { name: 'Two columns' })).toBeInViewport();
    await openMenu(page);
    await expect(row(page)).toHaveText('Page view');
    await row(page).click();
    await expect(view(page)).toHaveCount(0);
  });

  test('Find shows the same count and marks the hit', async ({ page }) => {
    await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await enterTextView(page);
    await page.getByTestId('text-view-find').click();
    const field = page.getByTestId('compact-find-bar').getByRole('searchbox');
    await field.fill('fixtures');
    const count = page.getByTestId('compact-find-count').first();
    await expect(count).toHaveText(/\d+ of \d+|\d+\/\d+|\d+/);
    const mark = page.getByTestId('text-view-mark').first();
    await expect(mark).toBeVisible({ timeout: 15_000 });
    await shot(page, 'find');
    const inText = await count.innerText();
    // Find's keyboard-docked bar may cover the view's bar in a window without a keyboard.
    await page.getByTestId('text-view-page-view').dispatchEvent('click');
    await expect(view(page)).toHaveCount(0);
    await expect(page.getByTestId('compact-find-count').first()).toHaveText(inText);
  });

  test('the Aa settings persist across a reload', async ({ page }) => {
    await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await enterTextView(page);
    await page.getByTestId('text-view-options').click();
    const size = page.getByTestId('text-view-size');
    await expect(size).toHaveText('18');
    await page.getByRole('button', { name: 'Larger text' }).click();
    await expect(size).toHaveText('20');
    await shot(page, 'options');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByTestId('compact-library')).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
    await (await chooser).setFiles(fixturePath('markdown-source.pdf'));
    await expect(page.getByTestId('compact-reader')).toBeVisible();
    await enterTextView(page);
    await page.getByTestId('text-view-options').click();
    await expect(page.getByTestId('text-view-size')).toHaveText('20');
  });

  test('a scanned page offers to recognize its text', async ({ page }) => {
    await openPdf(page, 'scan-text.pdf', '&textview=1');
    await enterTextView(page);
    await expect(page.getByTestId('text-view-scanned').first()).toBeVisible();
    await expect(page.getByTestId('text-view-ocr').first()).toBeVisible();
    await shot(page, 'scanned');
  });

  test('Find takes the bar, and closing Find returns focus to the column', async ({ page }) => {
    await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await enterTextView(page);
    await page.getByTestId('text-view-find').click();
    await expect(page.getByTestId('text-view-bar')).toHaveAttribute('data-away', 'true');
    await page.getByTestId('compact-find-done').click();
    await expect(page.getByTestId('text-view-bar')).not.toHaveAttribute('data-away', 'true');
    await expect(article(page)).toBeFocused();
  });

  test('a tap outside Aa leaves no tooltip and no focus ring on it', async ({ page }) => {
    await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await enterTextView(page);
    await page.getByTestId('text-view-options').tap();
    await expect(page.getByTestId('text-view-options-popup')).toBeVisible();
    await article(page).tap({ position: { x: 20, y: 200 } });
    await expect(page.getByTestId('text-view-options-popup')).toHaveCount(0);
    await motionDone(page);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page.getByTestId('text-view-options')).not.toHaveCSS('outline-style', 'solid');
  });

  test('leaving returns focus to the reader', async ({ page }) => {
    await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await enterTextView(page);
    await page.getByTestId('text-view-page-view').click();
    await expect(view(page)).toHaveCount(0);
    await expect(page.getByTestId('compact-pages')).toBeFocused();
  });

  test('works on its side', async ({ page }) => {
    await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await enterTextView(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(article(page)).toBeVisible();
    await expect(page.getByTestId('text-view-bar')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, 'landscape');
  });

  test('passes axe', async ({ page }) => {
    await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await enterTextView(page);
    await settleAnimations(page);
    if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(AXE_SOURCE);
    const violations = await page.evaluate(async () => {
      const { axe } = window as unknown as {
        axe: {
          run: (
            context: Document,
            options: object,
          ) => Promise<{ violations: { id: string; impact: string | null }[] }>;
        };
      };
      const result = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        resultTypes: ['violations'],
      });
      return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    });
    expect(violations.map((v) => v.id)).toEqual([]);
  });

  test('under reduced motion only a short fade runs', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPdf(page, 'markdown-source.pdf', '&textview=1');
    await enterTextView(page);
    const longest = await page.evaluate(() =>
      Math.max(
        0,
        ...document
          .getAnimations()
          .filter((a) => a.effect && Number.isFinite(Number(a.effect.getComputedTiming().endTime)))
          .map((a) => Number(a.effect?.getComputedTiming().endTime)),
      ),
    );
    expect(longest).toBeLessThanOrEqual(150);
  });
});
