/**
 * The Library end to end (`02-library` L1–L9, L12; spec redesign D4-1; flows §8.1): the
 * journeys it carries, counted as a person does them (each click, tap, key press, drop and file
 * dialog choice is one step):
 *
 * - **J1** first visit: Open PDFs… · pick = 2 (Try the sample = 1).
 * - **J3** combine two: Open PDFs… · pick both · Combine 2 files = 3; by drop 2. The new
 *   document exists at once in card order, opens in its Pages grid, "Combined 2 files · Undo".
 * - **J12** compare two open versions from the Library: ○ A · ○ B · Compare = 3.
 * - **J14** back via Recents: 0 when the document was open as the browser closed (restored),
 *   else 1 (the row reopens the snapshot, no picker).
 *
 * Plus a card dragged with the mouse reorders the cards and the tabs, and the drop overlay over
 * a document. Script-built drops are Chromium's (as in batch.spec); the tablet project runs the
 * touch journeys (J3 by taps, J12 by long press and taps).
 */
import { readFile } from 'node:fs/promises';

import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  fixturePath,
  sessionSettled,
  useFileInputPicker,
  waitForSnapshot,
  expectOpenDocuments,
} from './helpers';

/** Counts what a person does: each click, tap, key press, drop and file choice is one step. */
class Person {
  steps = 0;
  constructor(private readonly page: Page) {}

  async press(target: Locator): Promise<void> {
    this.steps += 1;
    if (await this.page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
      await target.tap();
    } else {
      await target.click();
    }
  }

  /** Picks fixtures in the file dialog `opener` opens: the press, then the choice. */
  async pick(opener: Locator, names: readonly string[]): Promise<void> {
    const chooser = this.page.waitForEvent('filechooser');
    await this.press(opener);
    this.steps += 1;
    await (await chooser).setFiles(names.map(fixturePath));
  }

  /** Drops fixtures on `target` (dragenter, dragover, drop: one gesture). */
  async drop(target: Locator, names: readonly string[]): Promise<void> {
    this.steps += 1;
    await dropFiles(target, names);
  }
}

async function dropFiles(target: Locator, names: readonly string[], drop = true): Promise<void> {
  const files = await Promise.all(
    names.map(async (name) => ({ name, bytes: [...(await readFile(fixturePath(name)))] })),
  );
  await target.evaluate(
    (element, { list, release }) => {
      const data = new DataTransfer();
      for (const file of list) {
        data.items.add(
          new File([new Uint8Array(file.bytes)], file.name, { type: 'application/pdf' }),
        );
      }
      for (const type of release ? ['dragenter', 'dragover', 'drop'] : ['dragenter', 'dragover']) {
        element.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
        );
      }
    },
    { list: files, release: drop },
  );
}

const library = (page: Page) => page.getByTestId('home');
const cards = (page: Page) => page.getByRole('listbox', { name: 'Files' }).getByRole('option');
const card = (page: Page, title: string) =>
  page
    .getByRole('listbox', { name: 'Files' })
    .getByRole('option', { name: new RegExp(`^${title},`) });
const checked = (page: Page) => cards(page).and(page.getByRole('option', { selected: true }));
const tabs = (page: Page) => page.getByRole('tablist', { name: 'Open documents' }).getByRole('tab');
const openButton = (page: Page) => library(page).getByRole('button', { name: 'Open PDFs…' });

test.beforeEach(async ({ page }) => {
  await useFileInputPicker(page);
});

test('J1: a first visit opens a PDF in two steps, with Open PDFs… focused', async ({ page }) => {
  await page.goto('./?lang=en');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Read, mark up, sign and arrange PDFs.' }),
  ).toBeVisible();
  // The keyboard path's first step: Open PDFs… already has the focus.
  await expect(openButton(page)).toBeFocused();
  const person = new Person(page);
  await person.pick(openButton(page), ['simple-text.pdf']);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(library(page)).toHaveCount(0);
  expect(person.steps).toBe(2);
});

test('J1 by the sample: Try the sample opens it in one step', async ({ page }) => {
  await page.goto('./?lang=en');
  const person = new Person(page);
  await person.press(library(page).getByRole('button', { name: 'Try the sample' }));
  await expect(tabs(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(library(page)).toHaveCount(0);
  expect(person.steps).toBe(1);
});

test('J3: Open PDFs…, pick both, Combine 2 files: three steps, no dialog', async ({ page }) => {
  await page.goto('./?lang=en');
  const person = new Person(page);
  await person.pick(openButton(page), ['simple-text.pdf', 'rotated-pages.pdf']);
  // Both cards arrive checked, the bar is up and Combine is the view's lime.
  await expect(checked(page)).toHaveCount(2, { timeout: 20_000 });
  const bar = page.getByRole('toolbar', { name: 'Selected documents' });
  await person.press(bar.getByRole('button', { name: 'Combine 2 files' }));

  await expect(page.getByTestId('merge-all-dialog')).toHaveCount(0);
  await expectOpenDocuments(page, 3);
  await expect(tabs(page).and(page.getByRole('tab', { selected: true }))).toHaveAccessibleName(
    'Combined – simple-text + rotated-pages, edited',
  );
  await expect(library(page)).toHaveCount(0);
  const toast = page.getByTestId('combined-toast');
  await expect(toast).toContainText('Combined 2 files');
  expect(person.steps).toBe(3);

  // Undo takes away only the new document.
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expectOpenDocuments(page, 2);
});

test('J3 by drop: two files dropped, then Combine 2 files: two steps', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Script-built file drops need Chromium');
  await page.goto('./?lang=en');
  const person = new Person(page);
  // While the files are over the Library the launcher lifts and says what a release does.
  await dropFiles(page.getByTestId('app-shell'), ['simple-text.pdf', 'rotated-pages.pdf'], false);
  await expect(page.getByTestId('library-launcher')).toHaveAttribute('data-dragging', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Drop to open 2 files');
  await page.getByTestId('app-shell').dispatchEvent('dragleave');

  await person.drop(page.getByTestId('app-shell'), ['simple-text.pdf', 'rotated-pages.pdf']);
  await expect(checked(page)).toHaveCount(2, { timeout: 20_000 });
  await person.press(page.getByRole('button', { name: 'Combine 2 files' }));
  await expectOpenDocuments(page, 3);
  await expect(page.getByTestId('combined-toast')).toContainText('Combined 2 files');
  expect(person.steps).toBe(2);
});

test('J12: ○ A, ○ B, Compare: three steps from the Library', async ({ page }) => {
  await page.goto('./?lang=en');
  const chooser = page.waitForEvent('filechooser');
  await openButton(page).click();
  await (await chooser).setFiles(['compare-a.pdf', 'compare-b.pdf'].map(fixturePath));
  await expect(cards(page)).toHaveCount(2, { timeout: 20_000 });
  // Back to rest: nothing checked, not selecting.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(checked(page)).toHaveCount(0);

  const person = new Person(page);
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (touch) {
    // Touch: a long press checks A and enters Select mode (M-20); a tap checks B.
    person.steps += 1;
    const box = await card(page, 'compare-a').boundingBox();
    if (!box) throw new Error('no card');
    const cdp = await page.context().newCDPSession(page);
    const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + 60), id: 0 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(card(page, 'compare-a')).toHaveAttribute('aria-selected', 'true');
    await person.press(card(page, 'compare-b'));
  } else {
    await card(page, 'compare-a').hover();
    await person.press(card(page, 'compare-a').getByTestId('library-card-check'));
    await person.press(card(page, 'compare-b').getByTestId('library-card-check'));
  }
  await expect(checked(page)).toHaveCount(2);
  await person.press(
    page.getByRole('toolbar', { name: 'Selected documents' }).getByRole('button', {
      name: 'Compare',
    }),
  );
  await expect(library(page)).toHaveCount(0);
  // Compare shows (its setup or its view); the frame has no mode switch to read it from (D2-1).
  await expect(page.getByRole('heading', { name: 'Compare mode' })).toBeAttached();
  expect(person.steps).toBe(3);
});

/**
 * Whether this launch keeps snapshots (ADR-0032 §2.5). An engine whose test context refuses OPFS
 * (Playwright's WebKit, like a private window) keeps none and says so; Chromium always keeps.
 */
async function keepsSnapshots(page: Page, browserName: string): Promise<boolean> {
  await sessionSettled(page);
  if ((await page.locator('html').getAttribute('data-session')) !== 'off') return true;
  expect(browserName, 'Chromium always keeps').not.toBe('chromium');
  return false;
}

test('J14: a closed document reopens from Recents in one step, with its thumbnail', async ({
  page,
  browserName,
}) => {
  await page.goto('./?lang=en');
  const kept = await keepsSnapshots(page, browserName);
  const chooser = page.waitForEvent('filechooser');
  await openButton(page).click();
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await expect(tabs(page)).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole('tab', { name: 'simple-text' }).focus();
  await page.keyboard.press('Delete');
  await expect(openButton(page)).toBeVisible();
  const recents = page.getByRole('list', { name: 'Recent files' });
  const row = recents.getByRole('button', { name: /^simple-text\.pdf, / });
  if (!kept) {
    // No snapshot to reopen in one step: Recents (IndexedDB) still lists the closed file, and
    // says changes are not kept rather than that they are (L7's footnote).
    await expect(row).toBeVisible();
    await expect(page.getByTestId('recent-not-kept')).toContainText(
      'Changes are not kept in this window',
    );
    await expect(page.getByTestId('recent-kept-footnote')).toHaveCount(0);
    test.skip(
      true,
      `${browserName} keeps no snapshots in this context (OPFS refused): Recents lists the file and says so`,
    );
  }
  await waitForSnapshot(page);

  await page.reload();
  await sessionSettled(page);
  await expect(row).toBeVisible();
  // A kept row shows its first page (02.Q1) and the panel says where it is kept.
  await expect(row.getByTestId('recent-thumb')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('recent-kept-footnote')).toContainText(
    'Kept on this device while the browser keeps it',
  );

  let picked = false;
  page.on('filechooser', () => {
    picked = true;
  });
  const person = new Person(page);
  await person.press(row);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  expect(picked).toBe(false);
  expect(person.steps).toBe(1);
});

test('J14 at zero: documents open when the browser closed are back after a reload', async ({
  page,
  browserName,
}) => {
  await page.goto('./?lang=en');
  if (!(await keepsSnapshots(page, browserName))) {
    test.skip(true, `${browserName} keeps no snapshots in this context (OPFS refused)`);
  }
  const chooser = page.waitForEvent('filechooser');
  await openButton(page).click();
  await (await chooser).setFiles(['simple-text.pdf', 'rotated-pages.pdf'].map(fixturePath));
  await expect(cards(page)).toHaveCount(2, { timeout: 20_000 });
  await waitForSnapshot(page);
  await page.reload();
  await sessionSettled(page);
  await expectOpenDocuments(page, 2, 20_000);
});

test('a card dragged with the mouse reorders the cards and the tabs', async ({
  page,
  browserName,
}) => {
  test.skip(
    test.info().project.name === 'tablet',
    'Touch reorders with Alt+arrows for now (the touch drag is not wired)',
  );
  test.skip(browserName === 'webkit', 'Playwright WebKit drags with synthetic mouse events only');
  await page.goto('./?lang=en');
  const chooser = page.waitForEvent('filechooser');
  await openButton(page).click();
  await (await chooser).setFiles(
    ['simple-text.pdf', 'rotated-pages.pdf', 'mixed-sizes.pdf'].map(fixturePath),
  );
  await expect(cards(page)).toHaveCount(3, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Done' }).click();

  const from = await card(page, 'simple-text').boundingBox();
  const to = await card(page, 'mixed-sizes').boundingBox();
  if (!from || !to) throw new Error('no cards');
  await page.mouse.move(from.x + from.width / 2, from.y + 60);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + 60, { steps: 4 });
  await page.mouse.move(to.x + to.width - 10, to.y + 60, { steps: 8 });
  await page.mouse.up();

  await expect(
    cards(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')?.split(',')[0])),
  ).resolves.toEqual(['rotated-pages', 'mixed-sizes', 'simple-text']);
  await expect(tabs(page).first()).toHaveAccessibleName(/^rotated-pages/);
  // The drop did not open the dragged card.
  await expect(library(page)).toBeVisible();
});

test('files dragged over a document show the lit drop card, and open as tabs', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Script-built file drops need Chromium');
  await page.goto('./?lang=en');
  const chooser = page.waitForEvent('filechooser');
  await openButton(page).click();
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  const shell = page.getByTestId('app-shell');
  await dropFiles(shell, ['rotated-pages.pdf', 'mixed-sizes.pdf'], false);
  await expect(page.getByTestId('drop-overlay')).toContainText('Drop to open 2 files');
  await dropFiles(shell, ['rotated-pages.pdf', 'mixed-sizes.pdf']);
  await expectOpenDocuments(page, 3, 20_000);
  await expect(page.getByTestId('drop-overlay')).toHaveCount(0);
  const toast = page.getByTestId('library-opened-toast');
  await expect(toast).toContainText('Opened 2 files');
  await toast.getByRole('button', { name: 'Show in Library' }).click();
  await expect(checked(page)).toHaveCount(2);
});
