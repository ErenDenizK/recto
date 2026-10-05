/**
 * Save in place end to end (ADR-0032 §2.1, §2.2, §5.3; flows §8.2 J13A; spec redesign D0-8):
 *
 * - J13A on Chromium with a stubbed writable handle (Playwright cannot drive the native file
 *   pickers or the permission prompt): the first save over a file costs 3 presses (Save,
 *   Replace, the browser's write prompt), later saves 1, Mod+S included; "Saved · verified"; the
 *   tab's ● clears from the saved mark; the written bytes are the edited document. The document
 *   stays in M8 Read mode throughout: Read mode saves (0032.3).
 * - Engines without File System Access (and Chromium with it hidden): Save downloads a copy and
 *   the toast says so honestly.
 * - Revert to the opened version: one undoable step back to the opened bytes.
 * - Screenshots of Save, the Replace popover and the toast (SAVE_SHOTS=dir), looked at by the
 *   author; pinned baselines are the lead's (Q-13).
 */
import { readFile } from 'node:fs/promises';

import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import { fixturePath, openFixtures, useFileInputPicker } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

const SHOTS = process.env.SAVE_SHOTS;

test.beforeEach(({ page: _page }, info) => {
  test.skip(
    ['phone', 'phone-land'].includes(info.project.name),
    'the compact edition has no Save in place (ADR-0033)',
  );
});

interface StubState {
  prompts: number;
  writes: number;
  /** The file's bytes, base64. */
  bytes: string;
}

/**
 * Replaces `showOpenFilePicker` with one that hands out a writable handle over an in-memory
 * file, and hides `showSaveFilePicker`. Call before `page.goto`; seed the file with `seedFile`.
 * The handle asks for write permission once (`prompts`), like Chromium's prompt.
 */
async function stubFileSystemAccess(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const encode = (bytes: Uint8Array) => {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(binary);
    };
    const state = { prompts: 0, writes: 0, bytes: '', name: 'file.pdf', permission: 'prompt' };
    (window as unknown as { __saveStub: typeof state }).__saveStub = state;
    const handle = {
      kind: 'file' as const,
      get name() {
        return state.name;
      },
      getFile: () =>
        Promise.resolve(new File([decode(state.bytes)], state.name, { type: 'application/pdf' })),
      createWritable: () => {
        const chunks: Uint8Array[] = [];
        return Promise.resolve({
          write: (data: ArrayBufferView | ArrayBuffer) => {
            const view = ArrayBuffer.isView(data)
              ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
              : new Uint8Array(data);
            chunks.push(view.slice());
            return Promise.resolve();
          },
          close: () => {
            const all = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
            let at = 0;
            for (const chunk of chunks) {
              all.set(chunk, at);
              at += chunk.byteLength;
            }
            state.bytes = encode(all);
            state.writes += 1;
            return Promise.resolve();
          },
          abort: () => Promise.resolve(),
        });
      },
      queryPermission: ({ mode }: { mode: string }) =>
        Promise.resolve(mode === 'read' ? 'granted' : state.permission),
      requestPermission: () => {
        state.prompts += 1;
        state.permission = 'granted';
        return Promise.resolve('granted');
      },
    };
    Object.defineProperty(window, 'showOpenFilePicker', {
      value: () => Promise.resolve([handle]),
      configurable: true,
    });
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
}

async function seedFile(page: Page, name: string): Promise<void> {
  const bytes = (await readFile(fixturePath(name))).toString('base64');
  await page.evaluate(
    ([n, b]) => {
      const stub = (window as unknown as { __saveStub: { name: string; bytes: string } })
        .__saveStub;
      stub.name = n;
      stub.bytes = b;
    },
    [name, bytes] as const,
  );
}

async function stub(page: Page): Promise<StubState> {
  return page.evaluate(() => {
    const { prompts, writes, bytes } = (window as unknown as { __saveStub: StubState }).__saveStub;
    return { prompts, writes, bytes };
  });
}

async function rotationsOf(bytes: Buffer): Promise<number[]> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  return pdf.getPages().map((p) => p.getRotation().angle);
}

/** Rotates the first page in Arrange, then returns to the page view (still Read mode). */
async function rotateFirstPage(page: Page): Promise<void> {
  await page.keyboard.press('3');
  const cell = page.locator('[role="gridcell"][data-page-id]').first();
  await expect(cell).toBeVisible();
  await cell.click();
  await page.keyboard.press('r');
  await page.keyboard.press('1');
  await expect(page.getByRole('radio', { name: /^(Read|Okuma)\b/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

const saveButton = (page: Page) => page.getByTestId('save-button');
const editedDot = (page: Page) => page.getByTestId('tab-edited');

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test('J13A: Save in place costs 3 presses the first time and 1 after; Read mode saves', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'File System Access (writable handles) exists only in Chromium; the download path runs below',
  );
  await stubFileSystemAccess(page);
  await page.goto('./?lang=en');
  await seedFile(page, 'simple-text.pdf');
  await page.getByRole('button', { name: 'Open files' }).first().click();
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();

  // As opened: everything is in the file.
  await expect(saveButton(page)).toHaveAccessibleName('Saved');
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(editedDot(page)).toHaveCount(0);
  await shot(page, 'save-saved');

  await rotateFirstPage(page);
  await expect(editedDot(page)).toHaveCount(1);
  await expect(page.getByRole('tab', { name: 'simple-text, edited' })).toBeVisible();
  await expect(saveButton(page)).toHaveAccessibleName('Save');
  await expect(saveButton(page)).not.toHaveAttribute('aria-disabled', 'true');
  await shot(page, 'save-unsaved');

  // First save: Save (1), Replace (2), the browser's write prompt (3).
  let presses = 0;
  await saveButton(page).click();
  presses += 1;
  const replace = page.getByTestId('replace-popover');
  await expect(replace).toBeVisible();
  await expect(replace.getByText('Replace simple-text.pdf?')).toBeVisible();
  await expect(replace.getByRole('button', { name: 'Replace', exact: true })).toBeFocused();
  await shot(page, 'save-replace-popover');
  await replace.getByRole('button', { name: 'Replace', exact: true }).click();
  presses += 1;
  const toast = page.getByRole('group', { name: 'Saved · verified' });
  await expect(toast).toBeVisible({ timeout: 30_000 });
  await shot(page, 'save-toast');
  presses += (await stub(page)).prompts;
  expect(presses).toBe(3);
  await expect(editedDot(page)).toHaveCount(0);
  await expect(saveButton(page)).toHaveAccessibleName('Saved');
  await expect(saveButton(page)).toBeFocused();
  let written = await stub(page);
  expect(written.writes).toBe(1);
  expect(await rotationsOf(Buffer.from(written.bytes, 'base64'))).toEqual([90, 0, 0]);
  await toast.getByRole('button', { name: 'Dismiss' }).click();

  // Later saves: one press, no question, no prompt.
  await rotateFirstPage(page);
  await expect(editedDot(page)).toHaveCount(1);
  await saveButton(page).click();
  await expect(page.getByRole('group', { name: 'Saved · verified' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(replace).toHaveCount(0);
  written = await stub(page);
  expect(written.prompts).toBe(1);
  expect(written.writes).toBe(2);
  expect(await rotationsOf(Buffer.from(written.bytes, 'base64'))).toEqual([180, 0, 0]);
  await expect(editedDot(page)).toHaveCount(0);

  // Mod+S is Save, in Read mode too.
  await rotateFirstPage(page);
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(async () => (await stub(page)).writes, { timeout: 30_000 }).toBe(3);
  await expect(editedDot(page)).toHaveCount(0);
  expect(await rotationsOf(Buffer.from((await stub(page)).bytes, 'base64'))).toEqual([270, 0, 0]);
});

test('without File System Access, Save downloads a copy and says so', async ({ page }) => {
  // Firefox and WebKit have no save picker; Chromium is made to look like them.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await openFixtures(page, ['simple-text.pdf']);
  await rotateFirstPage(page);
  await expect(editedDot(page)).toHaveCount(1);

  const download = page.waitForEvent('download');
  await saveButton(page).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('simple-text.pdf');
  const toast = page.getByRole('group', { name: /^Downloaded simple-text\.pdf/ });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('The opened file is unchanged.');
  await expect(page.getByTestId('replace-popover')).toHaveCount(0);
  await expect(editedDot(page)).toHaveCount(0);
  await expect(saveButton(page)).toHaveAccessibleName('Saved');
  expect(await rotationsOf(await readFile(await file.path()))).toEqual([90, 0, 0]);
});

test('Revert to the opened version is one step that Undo takes back', async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await openFixtures(page, ['simple-text.pdf']);

  const menu = page.getByTestId('document-menu');
  const revertItem = page.getByRole('menuitem', { name: 'Revert to the opened version…' });
  await menu.click();
  await expect(revertItem).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');

  await rotateFirstPage(page);
  await rotateFirstPage(page);
  await menu.click();
  await revertItem.click();
  const dialog = page.getByTestId('confirm-sheet');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Your 2 changes since opening go. Undo brings them back.');
  await expect(dialog.getByRole('button', { name: 'Revert' })).toBeFocused();
  await shot(page, 'save-revert-dialog');
  await dialog.getByRole('button', { name: 'Revert' }).click();

  const toast = page.getByRole('group', { name: 'Reverted simple-text' });
  await expect(toast).toBeVisible({ timeout: 15_000 });
  // Back as opened: nothing to save, nothing to revert, the same tab.
  await expect(editedDot(page)).toHaveCount(0);
  await expect(saveButton(page)).toHaveAccessibleName('Saved');
  await expect(page.getByRole('tablist', { name: 'Open documents' }).getByRole('tab')).toHaveCount(
    1,
  );
  await menu.click();
  await expect(revertItem).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');

  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(editedDot(page)).toHaveCount(1);
  await expect(saveButton(page)).toHaveAccessibleName('Save');
});

test.describe('screenshots for review (SAVE_SHOTS)', () => {
  test.skip(!SHOTS, 'only when SAVE_SHOTS names a directory');
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 820, height: 1180 } });

  test('the tablet in Turkish: Save, the Replace popover and the toast', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'writable handles exist only in Chromium');
    await stubFileSystemAccess(page);
    await page.goto('./?lang=tr');
    await seedFile(page, 'simple-text.pdf');
    await page.getByRole('button', { name: 'Dosya aç' }).first().click();
    await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
    await shot(page, 'tr-820-saved');
    await rotateFirstPage(page);
    await expect(editedDot(page)).toHaveCount(1);
    await shot(page, 'tr-820-unsaved');
    await saveButton(page).click();
    await expect(page.getByTestId('replace-popover')).toBeVisible();
    await shot(page, 'tr-820-replace');
    await page.getByRole('button', { name: 'Değiştir', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Kaydedildi · doğrulandı' })).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, 'tr-820-toast');
  });
});
