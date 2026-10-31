/**
 * The intent bar (PRD-39, PRD-40; spec niyet §4.3, lane N3): ⌘K reads a sentence in Turkish or
 * English, shows its reading with the affected pages, and runs it on Enter; ⌘Z takes it back.
 * Runs on the teaching sample (8 pages). Engine-agnostic: nothing here depends on a browser's own
 * behaviour beyond what the other palette specs rely on.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { sampleEntry } from './sample-manifest';

const FULL = sampleEntry('en', 'full');
const PAGES = FULL.pageCount;

async function openSample(page: Page, lang: 'en' | 'tr' = 'en'): Promise<void> {
  await page.goto(`./?sample&lang=${lang}`);
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
}

const palette = (page: Page): Locator => page.getByRole('combobox');

/** Opens the bar and types `text`. */
async function type(page: Page, text: string): Promise<void> {
  await page.keyboard.press('ControlOrMeta+k');
  await expect(palette(page)).toBeVisible();
  await palette(page).fill(text);
}

const readings = (page: Page): Locator => page.locator('[data-intent] [data-reading-row]');

/** Two frames, so a deferred render has committed. */
const frames = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );

/** Waits for the reading rows to be painted: a frame or two after they are in the DOM. */
async function painted(page: Page): Promise<void> {
  await expect(readings(page).first()).toBeVisible();
  await frames(page);
}

/** A page's box, to see a turn: a quarter turn swaps its width and height. */
async function shape(page: Page, index: number): Promise<'portrait' | 'landscape'> {
  const box = await page.locator(`[data-page-index="${index}"]`).boundingBox();
  if (!box) throw new Error('page not on screen');
  return box.height >= box.width ? 'portrait' : 'landscape';
}

const pageCount = async (page: Page): Promise<number> =>
  Number(/\/\s*(\d+)/.exec((await page.getByTestId('page-pill').textContent()) ?? '')?.[1]);

test.describe('the intent bar', () => {
  test('a chain shows its pages, runs as one step, and one undo takes it back', async ({
    page,
  }) => {
    await openSample(page);
    await type(page, 'rotate 2-3 right and delete page 8');
    await painted(page);
    const row = readings(page).first();
    await expect(row).toHaveAttribute('aria-label', /Rotate pages 2–3 right, then delete page 8/);
    const marked = row.locator('[data-affected="true"]');
    await expect(marked).toHaveCount(3);
    await expect(marked).toHaveText([/2/, /3/, /8/]);
    await page.keyboard.press('Enter');
    await expect(palette(page)).toHaveCount(0);
    await expect.poll(() => pageCount(page)).toBe(PAGES - 1);
    await expect.poll(() => shape(page, 1)).toBe('landscape');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => pageCount(page)).toBe(PAGES);
    await expect.poll(() => shape(page, 1)).toBe('portrait');
    expect(await shape(page, 2)).toBe('portrait');
  });

  test('two readings are stacked, the first runs, and one undo restores', async ({ page }) => {
    await openSample(page, 'tr');
    await type(page, 'çift sayfaları çıkar');
    await painted(page);
    const group = page.getByRole('group', { name: 'Bu iki türlü okunabilir' });
    await expect(group.getByRole('option')).toHaveCount(2);
    const first = group.getByRole('option').first();
    const second = group.getByRole('option').nth(1);
    const a = await first.boundingBox();
    const b = await second.boundingBox();
    // Stacked: the second sits wholly below the first.
    expect((b?.y ?? 0) >= (a?.y ?? 0) + (a?.height ?? 0) - 1).toBe(true);
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(palette(page)).toHaveCount(0);
    await expect.poll(() => pageCount(page)).toBe(PAGES - Math.floor(PAGES / 2));
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => pageCount(page)).toBe(PAGES);
  });

  test('"jpg olarak kaydet" opens Save a copy on Images with JPEG chosen', async ({ page }) => {
    await openSample(page, 'tr');
    await type(page, 'jpg olarak kaydet');
    await painted(page);
    await page.keyboard.press('Enter');
    const sheet = page.getByTestId('save-copy-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('save-copy-images')).toBeVisible();
    await expect(
      sheet.getByTestId('save-copy-images').getByRole('radio', { name: 'JPEG' }),
    ).toBeChecked();
    await expect.poll(() => pageCount(page)).toBe(PAGES);
  });

  test('turning pages and compressing opens Save a copy on Size; undo takes the turn back', async ({
    page,
  }) => {
    await openSample(page, 'tr');
    await type(page, '3-5. sayfaları döndür ve 2 MB altına sıkıştır');
    await painted(page);
    await page.keyboard.press('Enter');
    const sheet = page.getByTestId('save-copy-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('save-copy-target')).toBeVisible();
    await expect.poll(() => shape(page, 2)).toBe('landscape');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => shape(page, 2)).toBe('portrait');
  });

  test('a capability Recto lacks is an honest row with the nearest command under it', async ({
    page,
  }) => {
    await openSample(page, 'tr');
    await type(page, "pdf'i word'e çevir");
    await painted(page);
    const row = readings(page).first();
    await expect(row).toHaveAttribute('aria-disabled', 'true');
    await expect(row).toHaveAttribute('aria-label', /Word/);
    await expect(row.locator('xpath=following-sibling::*[@role="option"]').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(palette(page)).toBeVisible();
    await expect(page.getByTestId('save-copy-sheet')).toHaveCount(0);
  });

  test('a phrase it cannot read shows no reading and leaves the document alone', async ({
    page,
  }) => {
    await openSample(page, 'tr');
    for (const text of ['silme 3', '3. sayfadaki resmi sil']) {
      await type(page, text);
      await expect(page.getByRole('listbox')).toBeVisible();
      await frames(page);
      await expect(readings(page)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(palette(page)).toHaveCount(0);
    }
    expect(await pageCount(page)).toBe(PAGES);
  });

  test('fast typing never deletes a page whose reading was not in the DOM', async ({ page }) => {
    await openSample(page);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palette(page)).toBeVisible();
    // Logs, in order, whether a delete reading is in the DOM each time the page count text changes.
    await page.evaluate(() => {
      const log: string[] = [];
      (window as unknown as { __intentLog: string[] }).__intentLog = log;
      new MutationObserver(() => {
        log.push(document.querySelector('[data-intent] [data-reading-row]') ? 'row' : 'no-row');
      }).observe(document.body, { childList: true, subtree: true });
    });
    await palette(page).fill('delete 8');
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.locator('[data-intent] [data-reading-row]').count())
      .toBeLessThanOrEqual(1);
    // Either nothing ran, or the delete ran after its row painted; a second Enter then works.
    const count = await pageCount(page);
    if (count === PAGES) {
      await painted(page);
      await page.keyboard.press('Enter');
    }
    await expect.poll(() => pageCount(page)).toBe(PAGES - 1);
    const log = await page.evaluate(
      () => (window as unknown as { __intentLog: string[] }).__intentLog,
    );
    expect(log).toContain('row');
  });

  test('"imzala" reads two ways; the second opens the certificate sheet', async ({ page }) => {
    await openSample(page, 'tr');
    await type(page, 'imzala');
    await painted(page);
    const group = page.getByRole('group', { name: 'Bu iki türlü okunabilir' });
    await expect(group.getByRole('option')).toHaveCount(2);
    await page.keyboard.press('ArrowDown');
    await expect(group.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: /sertifika/i })).toBeVisible();
  });

  test('Esc closes the bar and leaves the document as it was', async ({ page }) => {
    await openSample(page);
    await type(page, 'delete 2');
    await painted(page);
    await page.keyboard.press('Escape');
    await expect(palette(page)).toHaveCount(0);
    expect(await pageCount(page)).toBe(PAGES);
  });
});
