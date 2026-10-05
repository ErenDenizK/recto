/**
 * The jobs of flows §8.2 at their M9 step counts (spec redesign §10.3, §10.5). Each test counts
 * the presses a person makes, and a job's count is the number of `press` calls.
 *
 * **J13B Compress, then save** (8 → 5; components/07-sheets.md §4.6; spec D0-9). Today's shell
 * has no title menu yet, so the Document menu stands in for "title ▾":
 * - mouse, with File System Access (Chromium): Document ▾ · Save a copy… · Smaller · Save copy
 *   · picker (mocked, it cannot be driven) = 5. M8 took 8: Document ▾ · Compress… · Compress ·
 *   Apply to export · Export · Export · Save · picker.
 * - touch (`tablet`): Document ▾ · Save a copy… · Smaller · Share copy · share target (mocked
 *   Web Share) = 5.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';

/** Counts the presses of one job. */
function counter() {
  let count = 0;
  return {
    async press(target: Locator) {
      count += 1;
      await target.click();
    },
    /** A press the browser's own surface takes (the save picker, the share sheet). */
    native() {
      count += 1;
    },
    get count() {
      return count;
    },
  };
}

const coarse = (page: Page) => page.evaluate(() => matchMedia('(pointer: coarse)').matches);

test('J13B: compress, then save a copy, in 5 presses', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the save picker and Web Share are mocked in Chromium');
  await page.addInitScript(() => {
    const record = { picked: [] as string[], shared: [] as string[], written: 0 };
    (window as unknown as { __j13b: typeof record }).__j13b = record;
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async (options: { suggestedName: string }) => {
        record.picked.push(options.suggestedName);
        return {
          name: options.suggestedName,
          createWritable: async () => ({
            write: async (data: Blob) => {
              record.written += data.size;
            },
            close: async () => undefined,
            abort: async () => undefined,
          }),
        };
      },
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: { files?: File[] }) => Array.isArray(data.files),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: { files: File[] }) => {
        for (const file of data.files) record.shared.push(file.name);
      },
    });
  });
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await openFixtures(page, ['images.pdf']);
  const touch = await coarse(page);
  const job = counter();

  await job.press(page.getByTestId('document-menu'));
  await job.press(page.getByRole('menuitem', { name: 'Save a copy…' }));
  const sheet = page.getByTestId('save-copy-sheet');
  await job.press(sheet.getByRole('radio', { name: /^Smaller/ }));
  if (touch) {
    // The copy is pre-assembled once the settings rest; the press shares it.
    const share = sheet.getByRole('button', { name: 'Share copy' });
    await expect(share).toBeVisible({ timeout: 30_000 });
    await job.press(share);
    job.native();
    await expect(page.getByTestId('save-copy-toast').last()).toHaveText(/Shared images-small\.pdf/);
  } else {
    await job.press(sheet.getByRole('button', { name: 'Save copy' }));
    job.native();
    await expect(page.getByTestId('save-copy-toast').last()).toContainText(
      /^Saved images-small\.pdf · [\d.]+ (KB|MB) · verified/,
      { timeout: 30_000 },
    );
  }
  const record = await page.evaluate(
    () =>
      (window as unknown as { __j13b: { picked: string[]; shared: string[]; written: number } })
        .__j13b,
  );
  if (touch) expect(record.shared).toEqual(['images-small.pdf']);
  else {
    expect(record.picked).toEqual(['images-small.pdf']);
    expect(record.written).toBeGreaterThan(0);
  }
  expect(job.count).toBe(5);
});
