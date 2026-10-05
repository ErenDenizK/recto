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
 *
 * **J14 Return via Recents** (flows §8.2: 0 if it was open when the browser closed; spec D0-7,
 * §12 D0 exit; ADR-0032 §2.5): a document changed and kept as a snapshot comes back, with its
 * change, on the next launch with nothing pressed. The reopen from a Recents row (mouse 1) is
 * `session.spec.ts`'s "a closed document reopens from Recents".
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { openFixtures, sessionSettled, useFileInputPicker, waitForSnapshot } from './helpers';

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
      value: (options: { suggestedName: string }) => {
        record.picked.push(options.suggestedName);
        return Promise.resolve({
          name: options.suggestedName,
          createWritable: () =>
            Promise.resolve({
              write: (data: Blob) => {
                record.written += data.size;
                return Promise.resolve();
              },
              close: () => Promise.resolve(),
              abort: () => Promise.resolve(),
            }),
        });
      },
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: { files?: File[] }) => Array.isArray(data.files),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data: { files: File[] }) => {
        for (const file of data.files) record.shared.push(file.name);
        return Promise.resolve();
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

test('J14: a document open when the browser closed is back, with its change, in 0 presses', async ({
  page,
  browserName,
}) => {
  await useFileInputPicker(page);
  // Storage is not persistent in a test profile, so `beforeunload` may ask (ADR-0032 §2.7);
  // leaving is the person's answer.
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto('./?lang=en');
  await sessionSettled(page);
  if ((await page.locator('html').getAttribute('data-session')) === 'off') {
    // An engine whose test context refuses OPFS keeps nothing, and says so (session.spec.ts).
    expect(browserName, 'Chromium always keeps').not.toBe('chromium');
    test.skip(true, `${browserName} keeps nothing in this test context`);
  }
  await openFixtures(page, ['simple-text.pdf']);
  // The change: page 2 deleted in Arrange.
  await page.keyboard.press('3');
  const cells = page.locator('[role="gridcell"][data-page-id]');
  await expect(cells).toHaveCount(3);
  await cells.nth(1).click();
  await page.keyboard.press('Delete');
  await expect(cells).toHaveCount(2);
  await waitForSnapshot(page);

  // The browser closes and opens again: a reload, then nothing pressed.
  const job = counter();
  await page.reload();
  await sessionSettled(page);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  await expect(page.getByTestId('session-notice')).toContainText('Restored simple-text');
  await expect(cells).toHaveCount(2);
  expect(job.count).toBe(0);
});
