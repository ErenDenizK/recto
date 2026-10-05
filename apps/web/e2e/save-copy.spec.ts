/**
 * Save a copy, S2, end to end (components/07-sheets.md §4; ADR-0032 §2 item 3; flows §5.1;
 * spec redesign D0-9 and §10.3, where `export.spec.ts` becomes this spec):
 *
 * - a rotated page saved as a verified PDF (the download path of Firefox and Safari);
 * - Compress… opens the sheet on Size with Smaller chosen and an estimate beside each preset;
 *   What gets smaller lists the images and compares a page; the copy is smaller and complete;
 * - Export pages as images… saves page 1 as a PNG of the expected size;
 * - picker first (Chromium, a mocked `showSaveFilePicker`): the picker opens inside the press,
 *   before any work, and cancelling it keeps the sheet; the copy is written into the handle;
 * - the empty-file rule (07.7): a write that fails aborts the writable and removes the picked
 *   file, or says it was left where `remove()` does not exist; Try again reopens the draft;
 * - Share copy on a coarse pointer (the `tablet` project, a mocked Web Share): the copy is
 *   pre-assembled, and the press shares it.
 *
 * Downloads and the mocked picker are read in Chromium; Firefox and WebKit run the sheet's
 * download path through the other specs that save copies.
 */
import { readFile, stat } from 'node:fs/promises';

import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import {
  downloadCopy,
  fixturePath,
  openFixtures,
  openSaveCopy,
  useDownloadPath,
  useFileInputPicker,
} from './helpers';

const EXPECTED: Readonly<Record<string, { pages: number; rotations: readonly number[] }>> = {
  'simple-text': { pages: 3, rotations: [0, 0, 0] },
  'rotated-pages': { pages: 4, rotations: [0, 90, 180, 270] },
};

const coarse = (page: Page) => page.evaluate(() => matchMedia('(pointer: coarse)').matches);

test.describe('the download path', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Downloads are read on Chromium');

  test.beforeEach(async ({ page }) => {
    await useDownloadPath(page);
    await useFileInputPicker(page);
    await page.goto('./?lang=en');
    await expect(page.getByTestId('app-shell')).toBeVisible();
    test.skip(await coarse(page), 'a coarse pointer shares instead (below)');
  });

  test('drop two files, rotate a page, save a copy and download a verified PDF', async ({
    page,
  }) => {
    await openFixtures(
      page,
      Object.keys(EXPECTED).map((name) => `${name}.pdf`),
    );
    const documentTabs = page.getByRole('tablist', { name: 'Open documents' }).getByRole('tab');
    await expect(documentTabs).toHaveCount(2);

    // Arrange mode, select the first page of the active document, rotate it right.
    await page.keyboard.press('3');
    const cell = page.locator('[role="gridcell"][data-page-id]').first();
    await expect(cell).toBeVisible();
    await cell.click();
    await page.keyboard.press('r');

    const title =
      (await documentTabs.and(page.getByRole('tab', { selected: true })).textContent())?.trim() ??
      '';
    const expected = EXPECTED[title];
    expect(expected, `active tab "${title}"`).toBeDefined();
    if (!expected) return;

    const sheet = await openSaveCopy(page);
    await expect(sheet.getByRole('radio', { name: 'PDF' })).toBeChecked();
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue(`${title}.pdf`);
    await expect(sheet.getByText('Built and checked on this device')).toBeVisible();
    const { download, bytes } = await downloadCopy(page, sheet);
    expect(download.suggestedFilename()).toBe(`${title}.pdf`);
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('save-copy-toast').last()).toContainText(
      new RegExp(`^Downloaded ${title}\\.pdf · [\\d.]+ (KB|B) · verified`),
    );

    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(pdf.getPageCount()).toBe(expected.pages);
    const rotations = pdf.getPages().map((p) => p.getRotation().angle);
    expect(rotations).toEqual(expected.rotations.map((r, i) => (i === 0 ? (r + 90) % 360 : r)));
  });

  test('Compress… opens Size on Smaller with estimates; the copy is smaller and complete', async ({
    page,
  }) => {
    await openFixtures(page, ['images.pdf']);
    const source = await stat(fixturePath('images.pdf'));
    await page.getByTestId('document-menu').click();
    await page.getByRole('menuitem', { name: 'Compress…' }).click();
    const sheet = page.getByTestId('save-copy-sheet');
    await expect(sheet).toBeVisible();
    // Focus starts on Size, with Smaller chosen (07 §4.1).
    const smaller = sheet.getByRole('radio', { name: /^Smaller, / });
    await expect(smaller).toBeChecked();
    await expect(smaller).toBeFocused();
    // Each preset carries its estimate in its name once the analysis is in (INV-18).
    await expect(smaller).toHaveAccessibleName(/^Smaller, about [\d.]+ (KB|MB)$/, {
      timeout: 30_000,
    });
    await expect(sheet.getByRole('radio', { name: /^Smallest, about / })).toBeVisible();
    await expect(
      sheet.getByRole('radio', { name: /^Same as original, [\d.]+ (KB|MB)$/ }),
    ).toBeVisible();
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('images-small.pdf');

    // What gets smaller: the images and what Smaller does to each; a page compared.
    await sheet.getByTestId('save-copy-what-smaller').click();
    await expect(sheet.getByRole('table')).toContainText('DeviceRGB + α');
    await sheet.getByRole('switch', { name: 'Compare before and after' }).click();
    await expect(sheet.getByTestId('compress-compare').locator('canvas')).toHaveCount(2, {
      timeout: 30_000,
    });
    await sheet.getByRole('button', { name: 'Back' }).click();

    await sheet.getByRole('radio', { name: /^Smallest, / }).click();
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('images-small.pdf');
    const { download, bytes } = await downloadCopy(page, sheet);
    expect(download.suggestedFilename()).toBe('images-small.pdf');
    expect(bytes.byteLength).toBeLessThan(source.size);
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(pdf.getPageCount()).toBe(3);
    // Details say what the size did.
    await page
      .getByTestId('save-copy-toast')
      .last()
      .getByRole('button', { name: 'Details' })
      .click();
    await expect(page.getByTestId('save-copy-details')).toContainText(/Smallest: .* → /);
  });

  test('Export pages as images… saves page 1 as a PNG with the expected pixel size', async ({
    page,
  }) => {
    await openFixtures(page, ['images.pdf']);
    const fixture = await PDFDocument.load(await readFile(fixturePath('images.pdf')), {
      updateMetadata: false,
    });
    const first = fixture.getPage(0);
    const expectedWidth = Math.round((first.getWidth() * 150) / 72);
    const expectedHeight = Math.round((first.getHeight() * 150) / 72);

    await page.getByTestId('document-menu').click();
    await page.getByRole('menuitem', { name: 'Export pages as images…' }).click();
    const sheet = page.getByTestId('save-copy-sheet');
    await expect(sheet.getByRole('radio', { name: 'Images' })).toBeChecked();
    await sheet.getByRole('textbox', { name: 'Pages' }).fill('1');
    await expect(sheet.getByTestId('images-output')).toHaveText(
      `One image, ${expectedWidth} × ${expectedHeight} px`,
    );
    const { download, bytes: png } = await downloadCopy(page, sheet);
    expect(download.suggestedFilename()).toBe('images-1.png');
    // PNG signature, then the IHDR chunk: width and height as big-endian 32-bit integers.
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.subarray(12, 16).toString('latin1')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(expectedWidth);
    expect(png.readUInt32BE(20)).toBe(expectedHeight);
  });

  test('the draft stays per document: Esc keeps it, a format switch keeps each format’s', async ({
    page,
  }) => {
    await openFixtures(page, ['simple-text.pdf']);
    let sheet = await openSaveCopy(page);
    await sheet.getByRole('radio', { name: /^Smallest/ }).click();
    await sheet.getByRole('radio', { name: 'Images' }).click();
    await sheet.getByRole('radio', { name: 'JPEG' }).click();
    await sheet.getByRole('radio', { name: 'PDF' }).click();
    await expect(sheet.getByRole('radio', { name: /^Smallest/ })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    sheet = await openSaveCopy(page);
    await expect(sheet.getByRole('radio', { name: /^Smallest/ })).toBeChecked();
    await sheet.getByRole('radio', { name: 'Images' }).click();
    await expect(sheet.getByRole('radio', { name: 'JPEG' })).toBeChecked();
  });
});

/** Mocks `showSaveFilePicker` (Chromium's picker cannot be driven): what it was asked, what was written. */
async function mockPicker(page: Page, mode: 'save' | 'cancel' | 'fail' | 'fail-no-remove') {
  await page.addInitScript((how: string) => {
    interface Record {
      calls: { name: string; sheetOpen: boolean; capsules: number }[];
      bytes: number;
      head: string;
      closed: boolean;
      aborted: boolean;
      removed: boolean;
    }
    const record: Record = {
      calls: [],
      bytes: 0,
      head: '',
      closed: false,
      aborted: false,
      removed: false,
    };
    (window as unknown as { __picker: Record }).__picker = record;
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async (options: { suggestedName: string }) => {
        record.calls.push({
          name: options.suggestedName,
          sheetOpen: document.querySelector('[data-testid="save-copy-sheet"]') !== null,
          capsules: document.querySelectorAll('[data-testid="progress-capsule"]').length,
        });
        if (how === 'cancel') throw new DOMException('The user aborted a request.', 'AbortError');
        return {
          name: options.suggestedName,
          createWritable: async () => ({
            write: async (data: Blob) => {
              if (how.startsWith('fail')) {
                throw new DOMException(
                  'There is not enough space on the disk.',
                  'QuotaExceededError',
                );
              }
              const bytes = new Uint8Array(await data.arrayBuffer());
              if (record.bytes === 0) record.head = String.fromCharCode(...bytes.subarray(0, 5));
              record.bytes += bytes.byteLength;
            },
            close: async () => {
              record.closed = true;
            },
            abort: async () => {
              record.aborted = true;
            },
          }),
          ...(how === 'fail-no-remove'
            ? {}
            : {
                remove: async () => {
                  record.removed = true;
                },
              }),
        };
      },
    });
  }, mode);
}

const picker = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __picker: {
            calls: { name: string; sheetOpen: boolean; capsules: number }[];
            bytes: number;
            head: string;
            closed: boolean;
            aborted: boolean;
            removed: boolean;
          };
        }
      ).__picker,
  );

test.describe('picker first (File System Access)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'the save picker is Chromium’s');

  async function start(page: Page, mode: Parameters<typeof mockPicker>[1]) {
    await mockPicker(page, mode);
    await useFileInputPicker(page);
    await page.goto('./?lang=en');
    test.skip(await coarse(page), 'a coarse pointer shares instead');
    await openFixtures(page, ['simple-text.pdf']);
  }

  test('the picker opens inside the press, before any work; the copy is written to it', async ({
    page,
  }) => {
    await start(page, 'save');
    const sheet = await openSaveCopy(page);
    await sheet.getByRole('button', { name: 'Save copy' }).click();
    await expect(page.getByTestId('save-copy-toast').last()).toContainText(
      /^Saved simple-text\.pdf · [\d.]+ KB · verified/,
      { timeout: 30_000 },
    );
    await expect(sheet).toBeHidden();
    const record = await picker(page);
    expect(record.calls).toEqual([{ name: 'simple-text.pdf', sheetOpen: true, capsules: 0 }]);
    expect(record.head).toBe('%PDF-');
    expect(record.bytes).toBeGreaterThan(1000);
    expect(record.closed).toBe(true);
    expect(record.removed).toBe(false);
  });

  test('cancelling the picker keeps the sheet and says nothing', async ({ page }) => {
    await start(page, 'cancel');
    const sheet = await openSaveCopy(page);
    await sheet.getByRole('button', { name: 'Save copy' }).click();
    await expect.poll(async () => (await picker(page)).calls.length).toBe(1);
    await expect(sheet).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Notifications' }).getByRole('group'),
    ).toHaveCount(0);
  });

  test('the empty-file rule: a failed write is aborted and the picked file removed', async ({
    page,
  }) => {
    await start(page, 'fail');
    const sheet = await openSaveCopy(page);
    await sheet.getByRole('radio', { name: /^Smallest/ }).click();
    await sheet.getByRole('button', { name: 'Save copy' }).click();
    const failed = page.getByTestId('save-copy-failed');
    await expect(failed).toContainText('Copy not saved: There is not enough space on the disk.', {
      timeout: 30_000,
    });
    await expect(failed).toContainText('The empty file was removed.');
    const record = await picker(page);
    expect(record.aborted).toBe(true);
    expect(record.removed).toBe(true);
    expect(record.closed).toBe(false);

    // Try again reopens the sheet with its draft.
    await failed.getByRole('button', { name: 'Try again' }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('radio', { name: /^Smallest/ })).toBeChecked();
  });

  test('without remove(), the failure says an empty file was left to delete', async ({ page }) => {
    await start(page, 'fail-no-remove');
    const sheet = await openSaveCopy(page);
    await sheet.getByRole('button', { name: 'Save copy' }).click();
    await expect(page.getByTestId('save-copy-failed')).toContainText(
      'An empty simple-text.pdf was left where you chose to save it; you can delete it.',
      { timeout: 30_000 },
    );
    expect((await picker(page)).aborted).toBe(true);
  });

  test('Mod+Shift+S opens Save a copy', async ({ page }) => {
    await start(page, 'cancel');
    await page.mouse.move(2, 450);
    await page.keyboard.press('ControlOrMeta+Shift+S');
    await expect(page.getByTestId('save-copy-sheet')).toBeVisible();
  });
});

test.describe('Share copy on a coarse pointer', () => {
  test('the copy is pre-assembled and the press shares it', async ({ page }) => {
    await page.addInitScript(() => {
      const shared: { name: string; type: string; size: number }[] = [];
      (window as unknown as { __shared: typeof shared }).__shared = shared;
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'canShare', {
        configurable: true,
        value: (data: { files?: File[] }) => Array.isArray(data.files),
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: { files: File[] }) => {
          for (const file of data.files) {
            shared.push({ name: file.name, type: file.type, size: file.size });
          }
        },
      });
    });
    await useFileInputPicker(page);
    await page.goto('./?lang=en');
    test.skip(!(await coarse(page)), 'Share copy is the primary on a coarse pointer only');
    await openFixtures(page, ['simple-text.pdf']);
    const sheet = await openSaveCopy(page);
    const share = sheet.getByRole('button', { name: 'Share copy' });
    await expect(share).toBeVisible({ timeout: 30_000 });
    await share.click();
    await expect(page.getByTestId('save-copy-toast').last()).toHaveText(/Shared simple-text\.pdf/);
    const shared = await page.evaluate(
      () => (window as unknown as { __shared: { name: string; type: string }[] }).__shared,
    );
    expect(shared).toEqual([
      expect.objectContaining({ name: 'simple-text.pdf', type: 'application/pdf' }),
    ]);
  });
});
