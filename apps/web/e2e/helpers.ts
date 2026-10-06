/**
 * Shared end-to-end helpers.
 *
 * Files are opened through the Open button and Playwright's file chooser rather than a
 * synthetic drop: WebKit does not accept a script-constructed `dataTransfer` on a
 * dispatched `DragEvent`, so drop-based helpers only ever worked in Chromium and Firefox.
 * The file-chooser path is the one a Safari user takes (no `showOpenFilePicker`), and it
 * works in all three engines. Drag-and-drop itself is still covered by the light-table
 * spec and by the browser-mode unit tests.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { type Download, expect, type Locator, type Page } from '@playwright/test';

export const FIXTURES = new URL('../../../test/fixtures/', import.meta.url);

export function fixturePath(name: string): string {
  return fileURLToPath(new URL(name, FIXTURES));
}

/**
 * Call before the first `page.goto`: hides `showOpenFilePicker` so the app falls back to
 * the `<input type=file>` path, which Playwright can serve in every browser (the native
 * Chromium picker cannot be driven from a test).
 */
export async function useFileInputPicker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
  });
}

/** Opens corpus files through the Open button and waits for their tabs. */
export async function openFixtures(page: Page, names: readonly string[]): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
    .first()
    .click();
  await (await chooser).setFiles(names.map(fixturePath));
  for (const name of names) {
    await expect(page.getByRole('tab', { name: name.replace(/\.pdf$/, '') })).toBeVisible();
  }
}

/**
 * Call before the first `page.goto`: records the per-point widths of every ink annotation
 * the app sends to the PDFium worker (the create's payload), so a test can read what was
 * committed without a hook in the production build. Read them with `sentInkWidths`.
 */
export async function recordInkWidths(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const found: number[][][] = [];
    (window as unknown as { __inkWidths: number[][][] }).__inkWidths = found;
    const collect = (value: unknown, depth: number): void => {
      if (typeof value !== 'object' || value === null || depth > 8) return;
      if (Array.isArray(value)) {
        for (const item of value) collect(item, depth + 1);
        return;
      }
      if (Object.getPrototypeOf(value) !== Object.prototype) return;
      const record = value as Record<string, unknown>;
      if (record.kind === 'ink' && Array.isArray(record.widths)) {
        found.push(JSON.parse(JSON.stringify(record.widths)) as number[][]);
        return;
      }
      for (const key of Object.keys(record)) collect(record[key], depth + 1);
    };
    const post = Object.getOwnPropertyDescriptor(Worker.prototype, 'postMessage')?.value as (
      this: Worker,
      ...args: unknown[]
    ) => void;
    Worker.prototype.postMessage = function (this: Worker, ...args: unknown[]) {
      try {
        collect(args[0], 0);
      } catch {
        // Recording must never break the message.
      }
      post.apply(this, args);
    } as Worker['postMessage'];
  });
}

/** The widths recorded by `recordInkWidths`, one entry per ink sent (paths × points). */
export async function sentInkWidths(page: Page): Promise<number[][][]> {
  return page.evaluate(
    () => (window as unknown as { __inkWidths?: number[][][] }).__inkWidths ?? [],
  );
}

/**
 * Opens the inspector (Selection, Properties, History, Info), which is closed until the
 * person opens it (experience-redesign §4.2); tests that read the history or a section
 * call this first.
 */
export async function showInspector(page: Page): Promise<void> {
  const inspector = page.locator('#right-panel');
  if (!(await inspector.isVisible())) await page.keyboard.press('ControlOrMeta+Alt+b');
  await expect(inspector).toBeVisible();
}

/**
 * Puts the active document in Edit (Markup open) with `2` (ADR-0019 §3, ADR-0029): a file opens
 * in viewing, where the tool bar is one Edit button; in Markup it shows its groups (the frame
 * has no mode switch since D2-1, so the bar is what tells).
 */
export async function enterEdit(page: Page): Promise<void> {
  await page.keyboard.press('2');
  await expect(page.locator('[data-region="toolbar"]:not([data-bar-view="read"])')).toBeVisible();
}

/**
 * Waits for the launch's session restore to finish (`data-session` on <html>, ADR-0032 §2.5):
 * `ready` once restored or with nothing to restore, `off` where storage is refused. A restore
 * starts the engine and reopens the kept files, which takes seconds on a busy CI runner.
 */
export async function sessionSettled(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-session', /^(ready|off)$/, {
    timeout: 30_000,
  });
}

/**
 * Waits until everything changed so far is on this device: a snapshot written after now
 * (`data-session-saved`) and nothing left to write (`data-session-state="saved"`). A failure
 * names what the page says instead (`pending`, `failed`, `off (refused)`, …).
 */
export async function waitForSnapshot(page: Page): Promise<void> {
  const since = await page.evaluate(() => Date.now());
  await expect
    .poll(
      () =>
        page.evaluate((t) => {
          const data = document.documentElement.dataset;
          if (data.session === 'off') return `off (${data.sessionReason ?? '?'})`;
          if (data.sessionState !== 'saved') return data.sessionState ?? 'no snapshot yet';
          const saved = Number(data.sessionSaved ?? 0);
          // Saved after this call, or the change the test just made (noted in the last 5 s)
          // was already written before it: the writer can beat the call on a quick machine.
          const changed = Number(data.sessionChanged ?? 0);
          if (saved >= t || (changed >= t - 5000 && saved >= changed)) return 'saved';
          return 'older snapshot';
        }, since),
      { timeout: 10_000, message: 'the snapshot state on <html>' },
    )
    .toBe('saved');
}

/**
 * Reloads as a fresh start. Since snapshots (ADR-0032 §2.5) a reload restores the open
 * documents, so a test that reloads to check something remembered presses Start fresh (the
 * documents go to Recents) and waits until that is kept. `beforeunload` may ask while changes
 * are kept on storage that is not persistent (§2.7); the question is accepted.
 */
export async function reloadFresh(page: Page): Promise<void> {
  const accept = (dialog: { type(): string; accept(): Promise<void> }) => {
    if (dialog.type() === 'beforeunload') void dialog.accept();
  };
  page.on('dialog', accept);
  await page.reload();
  page.off('dialog', accept);
  await sessionSettled(page);
  const notice = page.getByTestId('session-notice');
  const fresh = notice.getByRole('button', { name: 'Start fresh' });
  if (await fresh.isVisible()) {
    await fresh.click();
    await notice.getByRole('button', { name: 'Dismiss' }).click();
    await waitForSnapshot(page);
  }
}

/**
 * Call before the first `page.goto`: hides `showSaveFilePicker`, so Save a copy downloads
 * (the path of Firefox and Safari) and Playwright can read the file; the native Chromium
 * save picker cannot be driven from a test.
 */
export async function useDownloadPath(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
}

/**
 * Opens Save a copy from the title menu (01-frame F5: File · Save a copy…), where the strip's
 * Export button went (D2-1).
 */
export async function openSaveCopyFromMenu(page: Page): Promise<void> {
  await page.getByTestId('document-menu').click();
  await page.getByRole('menuitem', { name: 'Save a copy…' }).click();
}

/**
 * Opens the sidebar's Find section and returns its field. Mod+F focuses the strip's Find entry
 * (01-frame F6 §6); Down from it opens the section with the hit list, Match case and Mark all.
 */
export async function openFindPanel(page: Page): Promise<Locator> {
  await page.keyboard.press('ControlOrMeta+f');
  await expect(page.locator('[data-find-entry] input[type="search"]').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const field = page.locator('#left-panel').getByRole('searchbox', { name: 'Find in document' });
  await expect(field).toBeFocused();
  return field;
}

/** Opens Save a copy (S2) for the active document from the title menu. */
export async function openSaveCopy(page: Page): Promise<Locator> {
  await openSaveCopyFromMenu(page);
  const sheet = page.getByTestId('save-copy-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}

/**
 * Presses Download copy in an open Save a copy sheet (see `useDownloadPath`): the sheet
 * closes, the copy is built and checked as a job, and the browser downloads it. Resolves to
 * the download and its bytes once the success toast says so.
 */
export async function downloadCopy(
  page: Page,
  sheet: Locator,
  timeout = 60_000,
): Promise<{ readonly download: Download; readonly bytes: Buffer }> {
  const downloading = page.waitForEvent('download', { timeout });
  await sheet.getByRole('button', { name: 'Download copy' }).click();
  const download = await downloading;
  await expect(page.getByTestId('save-copy-toast').last()).toBeVisible({ timeout });
  return { download, bytes: await readFile(await download.path()) };
}

/** Opens Save a copy and downloads the PDF with the sheet's current choices. */
export async function saveCopyBytes(page: Page, timeout = 60_000): Promise<Buffer> {
  const sheet = await openSaveCopy(page);
  return (await downloadCopy(page, sheet, timeout)).bytes;
}

/** The last copy's summary ("What changed on export"), from its toast's Details. */
export async function copySummary(page: Page): Promise<Locator> {
  await page.getByTestId('save-copy-toast').last().getByRole('button', { name: 'Details' }).click();
  const sheet = page.getByTestId('save-copy-sheet');
  await expect(sheet.getByTestId('save-copy-details')).toBeVisible();
  return sheet.getByRole('list', { name: 'What changed on export' });
}
