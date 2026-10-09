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
import { readFile } from 'node:fs/promises';

import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  enterEdit,
  fixturePath,
  markupDoor,
  openFindPanel,
  openFixtures,
  seedFile,
  sessionSettled,
  stageAsBesideInspector,
  stub,
  stubFileSystemAccess,
  useDownloadPath,
  useFileInputPicker,
  waitForSnapshot,
} from './helpers';
import { Job, type Presses } from './support/job-report';

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
  await cells.nth(1).click({ modifiers: ['ControlOrMeta'] });
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

/*
 * ── V1-F1…F12: the core jobs (PLAN §2.2, W0-q) ─────────────────────────────────────────────
 *
 * One test per job. A job is walked as acts (`support/job-report.ts`); each act counts the
 * presses a person makes and its time, and writes both to the test's annotations and to
 * `test-results/jobs/<project>/<id>.json`. Report-only: an act that cannot be completed is
 * recorded as blocked with its reason and the test still passes; `JOBS_STRICT=1` makes blocked
 * acts and budget overruns fail (the wave that enforces the budgets).
 *
 * A press is a click or tap, a key, one drag, one typed word, or a native step (the browser's
 * picker or prompt). Setup that a person would not do for the job (opening the fixture, closing
 * a tab to reach the Library) is not counted. The jobs that need a fine pointer skip on the
 * tablet project until their touch walks are written.
 */
const FINE = 'this walk needs a fine pointer; its touch walk is not written yet';

/** Starts a job's page: the file picker is the input path, saving downloads. */
async function startJob(page: Page): Promise<void> {
  // `beforeunload` may ask while changes sit on storage that is not persistent (ADR-0032 §2.7).
  page.on('dialog', (dialog) => void dialog.accept());
  await useFileInputPicker(page);
  await useDownloadPath(page);
  await page.goto('./?lang=en');
}

const rendered = (page: Page) => page.locator('canvas[data-state="rendered"]').first();

/** One stroke on the first page between two points given as shares of its box. */
async function strokeOnPage(page: Page, from: [number, number], to: [number, number]) {
  const box = await page.locator('[data-annotation-layer="0"]').boundingBox();
  if (!box) throw new Error('page not rendered');
  const height = Math.min(box.height, 700);
  await page.mouse.move(box.x + box.width * from[0], box.y + height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + height * to[1], { steps: 10 });
  await page.mouse.up();
}

/** Closes the active document from its tab with the keyboard (setup, not a press of the job). */
async function closeActiveTab(page: Page, name: string | RegExp): Promise<void> {
  const tab = page.getByRole('tab', { name }).first();
  if ((await tab.count()) > 0) {
    await tab.focus();
    await page.keyboard.press('Delete');
  }
  await expect(page.getByTestId('home')).toBeVisible();
}

async function dropOn(target: Locator, name: string): Promise<void> {
  const bytes = [...(await readFile(fixturePath(name)))];
  await target.evaluate(
    (element, file) => {
      const data = new DataTransfer();
      data.items.add(
        new File([new Uint8Array(file.bytes)], file.name, { type: 'application/pdf' }),
      );
      for (const type of ['dragenter', 'dragover', 'drop']) {
        element.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
        );
      }
    },
    { name, bytes },
  );
}

test.describe('core jobs', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    if (!isMobile) await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('V1-F1 Open: Open PDFs…, Recents, the sample, a drop, ?sample', async ({
    page,
    isMobile,
  }, info) => {
    test.setTimeout(180_000);
    await startJob(page);
    const job = new Job('V1-F1', 'Open', page, info);
    const home = page.getByTestId('home');
    const openButton = home.getByRole('button', { name: 'Open PDFs…' });

    await job.act('first visit: Open PDFs… and pick', 2, async (p) => {
      const chooser = page.waitForEvent('filechooser');
      await p.press(openButton);
      await p.gesture(async () => (await chooser).setFiles(fixturePath('simple-text.pdf')));
      await expect(rendered(page)).toBeVisible({ timeout: 20_000 });
    });
    await job.act('Recents: the closed file reopens', 2, async (p) => {
      // A kept change makes the row reopen its snapshot with no picker (ADR-0032 §2.5).
      await page.keyboard.press('3');
      const cells = page.locator('[role="gridcell"][data-page-id]');
      await expect(cells).toHaveCount(3);
      await cells.nth(1).click({ modifiers: ['ControlOrMeta'] });
      await page.keyboard.press('Delete');
      await expect(cells).toHaveCount(2);
      await waitForSnapshot(page);
      // The launch after it restores the document (J14: 0 presses); closing it files it under
      // Recents, and the row reopens the kept copy (session.spec.ts).
      await page.reload();
      await sessionSettled(page);
      await expect(page.getByRole('tab', { name: /^simple-text/ })).toBeVisible();
      await closeActiveTab(page, /^simple-text/);
      // Recents reopens the kept copy on a later launch (a row picked in the same launch asks
      // for the file again): one more reload, then the one press of the job.
      const row = page
        .getByRole('list', { name: 'Recent files' })
        .getByRole('button', { name: /^simple-text\.pdf, / });
      await expect(row).toHaveAccessibleName(/Edited, changes kept/, { timeout: 10_000 });
      await page.reload();
      await sessionSettled(page);
      await expect(page.getByRole('tab', { name: /^simple-text/ })).toHaveCount(0);
      await p.press(row);
      await expect(rendered(page)).toBeVisible({ timeout: 20_000 });
    });
    await job.act('the sample: Try the sample', 2, async (p) => {
      await closeActiveTab(page, 'simple-text');
      await p.press(home.getByRole('button', { name: 'Try the sample' }));
      await expect(page.getByRole('tab', { name: 'Recto sample' })).toBeVisible({
        timeout: 20_000,
      });
    });
    if (isMobile) {
      job.skip('a drop on the Library', 2, 'a drop is a fine-pointer gesture');
    } else {
      await job.act('a drop on the Library', 2, async (p) => {
        await closeActiveTab(page, /^Recto sample/);
        await p.gesture(() => dropOn(home, 'simple-text.pdf'));
        await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible({
          timeout: 20_000,
        });
      });
    }
    await job.act('a ?sample link: nothing pressed', 2, async () => {
      await page.goto('./?lang=en&sample');
      await expect(page.getByRole('tab', { name: /^Recto sample/ }).first()).toBeVisible({
        timeout: 20_000,
      });
    });
    job.finish();
  });

  test('V1-F2 Read: page, link, outline, Find', async ({ page }, info) => {
    test.setTimeout(120_000);
    await startJob(page);
    const job = new Job('V1-F2', 'Read', page, info);
    const pill = page.getByTestId('page-pill');
    await job.act(
      'open the document',
      null,
      async () => {
        await openFixtures(page, ['outline-named-dests.pdf']);
        await expect(pill).toHaveText(/^1 \/ 6 · /, { timeout: 20_000 });
      },
      { gate: true },
    );

    await job.act('page by the pill: Go to page 5', 2, async (p) => {
      await p.press(pill);
      const input = page.getByRole('textbox', { name: 'Go to page' });
      await p.gesture(async () => {
        await input.fill('5');
        await input.press('Enter');
      });
      await expect(pill).toHaveText(/^5 \/ 6 · /);
      await page.keyboard.press('Escape');
    });
    await job.act('outline: a Contents entry', 2, async (p) => {
      await page.keyboard.press('Home');
      await expect(pill).toHaveText(/^1 \/ 6 · /);
      await p.press(pill);
      await p.press(page.getByRole('button', { name: /^Appendix/ }));
      await expect(pill).toHaveText(/^6 \/ 6 · /);
    });
    await job.act('follow a link', 2, async (p) => {
      await page.keyboard.press('Home');
      await page.keyboard.press(']');
      await expect(pill).toHaveText(/^2 \/ 6 · /);
      await p.press(page.getByRole('button', { name: 'Go to page 4' }));
      await expect(pill).toHaveText(/^4 \/ 6 · /);
    });
    await job.act('come back from the link', 2, async (p) => {
      // There is no "back" command yet: the way back is the previous-page key, one press per
      // page. The act is walked as built and its count says what that costs.
      await p.key('[');
      await p.key('[');
      await expect(pill).toHaveText(/^2 \/ 6 · /);
    });
    const field = page.locator('[data-region="top"]').getByRole('searchbox', {
      name: 'Find in document',
    });
    const count = page.getByTestId('find-count');
    await job.act('Find: type, first hit', 2, async (p) => {
      await p.key('ControlOrMeta+f');
      await expect(field).toBeFocused();
      await p.gesture(() => field.fill('outline-named-dests'));
      // A search starts from the reader's page, so the first hit is not always the first.
      await expect(count).toContainText(/\d of 6/);
    });
    await job.act('Find: next hit', 2, async (p) => {
      await p.key('Enter');
      await expect(count).toContainText(/\d of 6/);
    });
    await job.act('Find: previous hit', 2, async (p) => {
      const before = await count.textContent();
      await p.key('Shift+Enter');
      await expect(count).not.toHaveText(before ?? '');
    });
    job.finish();
  });

  test('V1-F3 Annotate: pen, highlight, note, shape, text box, undo and redo', async ({
    page,
    isMobile,
  }, info) => {
    test.skip(isMobile, FINE);
    test.setTimeout(120_000);
    await startJob(page);
    await stageAsBesideInspector(page);
    const job = new Job('V1-F3', 'Annotate', page, info);
    const layer = page.locator('[data-annotation-layer="0"]');
    const marks = layer.locator('[data-annotation-kind]');
    await job.act(
      'open the document and enter Markup',
      null,
      async () => {
        await openFixtures(page, ['simple-text.pdf']);
        await expect(rendered(page)).toBeAttached({ timeout: 20_000 });
        await enterEdit(page);
      },
      { gate: true },
    );

    /** Runs a mark's act and checks that the page holds one more annotation. */
    const mark = async (
      name: string,
      run: (p: Presses) => Promise<void>,
      budget = 3,
    ): Promise<void> => {
      let before = 0;
      await job.act(name, budget, async (p) => {
        before = await marks.count();
        await run(p);
        await expect(marks).toHaveCount(before + 1, { timeout: 10_000 });
        await page.keyboard.press('Escape');
      });
    };
    await mark('pen: P and a stroke', async (p) => {
      await p.key('p');
      await p.gesture(() => strokeOnPage(page, [0.2, 0.3], [0.45, 0.32]));
    });
    await mark('highlight: H and a stroke along the text', async (p) => {
      await p.key('h');
      await p.gesture(() => strokeOnPage(page, [0.15, 0.2], [0.5, 0.2]));
    });
    await mark('note: N, a click, the words, Save', async (p) => {
      await p.key('n');
      await p.gesture(() => strokeOnPage(page, [0.7, 0.4], [0.7, 0.4]));
      const sheet = page.getByRole('dialog', { name: 'New note' });
      await p.gesture(() => sheet.getByRole('textbox').fill('Check this'));
      await p.press(sheet.getByRole('button', { name: 'Save' }));
    });
    await mark('shape: R and a drag', async (p) => {
      await p.key('r');
      await p.gesture(() => strokeOnPage(page, [0.2, 0.5], [0.5, 0.6]));
    });
    await mark('text box: T, a click, the words, Esc', async (p) => {
      await p.key('t');
      await p.gesture(() => strokeOnPage(page, [0.6, 0.55], [0.6, 0.55]));
      const editor = page.getByRole('textbox', { name: 'Text box text' });
      await expect(editor).toBeFocused();
      await p.gesture(() => editor.fill('Reviewed'));
      await p.key('Escape');
    });
    await job.act('undo', 1, async (p) => {
      const before = await marks.count();
      await p.key('ControlOrMeta+z');
      await expect(marks).toHaveCount(before - 1);
    });
    await job.act('redo', 1, async (p) => {
      const before = await marks.count();
      await p.key('ControlOrMeta+Shift+z');
      await expect(marks).toHaveCount(before + 1);
    });
    job.finish();
  });

  test('V1-F4 Fill and sign: fill the fields, sign, save a copy', async ({
    page,
    isMobile,
  }, info) => {
    test.skip(isMobile, FINE);
    test.setTimeout(180_000);
    await startJob(page);
    const job = new Job('V1-F4', 'Fill and sign', page, info);
    const palette = page.getByRole('toolbar', { name: 'Markup', exact: true });
    const layer = page.locator('[data-annotation-layer="0"]');
    const stamps = layer.locator('[data-annotation-kind="stamp"]');
    await job.act(
      'open forms-a.pdf',
      null,
      async () => {
        await openFixtures(page, ['forms-a.pdf']);
        await expect(rendered(page)).toBeAttached({ timeout: 20_000 });
      },
      { gate: true },
    );
    await job.act('first signature: Fill & sign, Sign, draw, Use, place', 5, async (p) => {
      await p.press(page.locator('[data-dock-item="sign"]'));
      await p.press(palette.getByRole('button', { name: 'Sign', exact: true }));
      const sheet = page.getByRole('dialog', { name: 'New signature' });
      await expect(sheet).toBeVisible();
      const pad = sheet.getByRole('img', {
        name: 'Signature pad: draw with the mouse, pen or finger',
      });
      await p.gesture(async () => {
        const box = await pad.boundingBox();
        if (!box) throw new Error('no pad');
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 6 });
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6, { steps: 6 });
        await page.mouse.up();
      });
      await p.press(sheet.getByRole('button', { name: 'Use signature' }));
      await expect(sheet).toBeHidden();
      await expect(layer).toHaveAttribute('data-tool', 'signature');
      // The form widgets under the first click take it while the sheet's exit settles.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      await p.gesture(async () => {
        const box = await layer.boundingBox();
        if (!box) throw new Error('no page');
        await page.mouse.click(box.x + box.width * 0.1, box.y + 200);
      });
      await expect(stamps).toHaveCount(1, { timeout: 10_000 });
    });
    await job.act('a saved signature: Fill & sign, the chip, place', 3, async (p) => {
      await palette.getByRole('button', { name: 'Done' }).click();
      await expect(palette).toHaveCount(0);
      await p.press(page.locator('[data-dock-item="sign"]'));
      await p.press(page.locator('[data-saved-signature]').first());
      await p.gesture(async () => {
        const box = await layer.boundingBox();
        if (!box) throw new Error('no page');
        await page.mouse.click(box.x + box.width * 0.1, box.y + 400);
      });
      await expect(stamps).toHaveCount(2, { timeout: 10_000 });
      await page.keyboard.press('Escape');
    });
    let typed = false;
    await job.act('fill every text field on both pages', null, async (p) => {
      await enterEdit(page);
      for (const [name, value] of [
        ['name', 'Grace Hopper'],
        ['address.city', 'Arlington'],
        ['only_in_a', 'Filled in'],
      ] as const) {
        const target = page.locator(`[data-form-layer] [data-field-name="${name}"]`);
        await target.scrollIntoViewIfNeeded();
        await p.press(target);
        const editor = page.locator(`[data-form-editor="${name}"]`);
        await expect(editor).toBeFocused();
        await p.gesture(() => editor.fill(value));
        await p.key('Enter');
        await expect(editor).toBeHidden();
      }
      typed = true;
    });
    await job.act('fill the checkbox, radio and dropdown', null, async (p) => {
      const agree = page.locator('[data-form-layer="0"] [data-field-name="agree"]');
      await agree.scrollIntoViewIfNeeded();
      await p.press(agree);
      const choice = page.locator('[data-form-layer="0"] [data-field-name="choice"]').first();
      await p.press(choice);
      const country = page.locator('[data-form-layer="0"] [data-field-name="country"]');
      await p.press(country);
      const editor = page.locator('[data-form-editor="country"]');
      await expect(editor).toBeVisible();
      await p.gesture(async () => {
        await editor.selectOption({ label: 'Japan' });
      });
    });
    await job.act('save a copy: menu, Save a copy…, Download copy', 3, async (p) => {
      await page.keyboard.press('Escape');
      await p.press(page.getByTestId('document-menu'));
      await p.press(page.getByRole('menuitem', { name: 'Save a copy…' }));
      const sheet = page.getByTestId('save-copy-sheet');
      await expect(sheet).toBeVisible();
      const downloading = page.waitForEvent('download', { timeout: 60_000 });
      await p.press(sheet.getByRole('button', { name: 'Download copy' }));
      const bytes = await readFile(await (await downloading).path());
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      if (typed) expect(pdf.getForm().getTextField('name').getText()).toBe('Grace Hopper');
    });
    job.finish();
  });

  test('V1-F5 Edit text: a word, Turkish, save and reopen', async ({ page, isMobile }, info) => {
    test.skip(isMobile, FINE);
    test.setTimeout(180_000);
    await startJob(page);
    await stageAsBesideInspector(page);
    const job = new Job('V1-F5', 'Edit text', page, info);
    const FOX = 'The quick brown fox jumps over the lazy dog';
    const run = page.locator(`[data-text-edit-layer="0"] [data-text-run="${FOX}"]`).first();
    const editor = page.getByRole('textbox', { name: 'Paragraph on page 1' });
    await job.act(
      'open text-edit-fonts.pdf',
      null,
      async () => {
        await openFixtures(page, ['text-edit-fonts.pdf']);
        await expect(rendered(page)).toBeAttached({ timeout: 20_000 });
      },
      { gate: true },
    );

    /** E, a click on the word, its selection, the new text, Esc. */
    const change = async (p: Presses, word: string, text: string): Promise<void> => {
      await p.key('e');
      await expect(page.getByRole('button', { name: 'Edit text' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(run).toBeVisible({ timeout: 20_000 });
      const box = await run.boundingBox();
      if (!box) throw new Error('line not laid out');
      const at = (FOX.indexOf(word) + 1) / FOX.length;
      await p.gesture(() => page.mouse.click(box.x + box.width * at, box.y + box.height / 2));
      await expect(editor).toBeFocused({ timeout: 20_000 });
      await p.gesture(async () => {
        await page.keyboard.press('Home');
        for (let i = 0; i < FOX.indexOf(word); i++) await page.keyboard.press('ArrowRight');
        for (const _ of word) await page.keyboard.press('Shift+ArrowRight');
      });
      await p.gesture(() => page.keyboard.type(text));
      await p.key('Escape');
      await expect(editor).toHaveCount(0, { timeout: 20_000 });
    };
    await job.act('change a word: fox to cat', 4, (p) => change(p, 'fox', 'cat'));
    job.skip(
      'reflow a paragraph',
      4,
      'the fixture line is one line; reflow is covered by paragraph-edit.spec.ts',
    );
    await job.act('Turkish: dog to köpek ığş', 4, (p) => change(p, 'dog', 'köpek ığş'));
    await job.act('save a copy and reopen: the Turkish word is found', 3, async (p) => {
      await page.keyboard.press('Escape');
      await p.press(page.getByTestId('document-menu'));
      await p.press(page.getByRole('menuitem', { name: 'Save a copy…' }));
      const sheet = page.getByTestId('save-copy-sheet');
      await expect(sheet).toBeVisible();
      const downloading = page.waitForEvent('download', { timeout: 60_000 });
      await p.press(sheet.getByRole('button', { name: 'Download copy' }));
      const bytes = await readFile(await (await downloading).path());
      await page.keyboard.press('Escape');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Open files' }).first().click();
      await (await chooser).setFiles({
        name: 'edited.pdf',
        mimeType: 'application/pdf',
        buffer: bytes,
      });
      await expect(page.getByRole('tab', { name: 'edited', exact: true })).toBeVisible();
      await expect(rendered(page)).toBeAttached({ timeout: 20_000 });
      const find = await openFindPanel(page);
      await find.fill('köpek');
      await expect(page.getByTestId('search-hit').first()).toBeVisible({ timeout: 20_000 });
    });
    job.finish();
  });

  test('V1-F6 Arrange: reorder, rotate, delete, insert, extract, combine, split', async ({
    page,
    isMobile,
  }, info) => {
    test.setTimeout(180_000);
    await startJob(page);
    const job = new Job('V1-F6', 'Arrange pages', page, info);
    const grid = page.getByTestId('light-table');
    const cells = grid.locator('[role="gridcell"][data-page-id]');
    const bar = page.getByTestId('pages-bar');
    const ids = () =>
      cells.evaluateAll((all) => all.map((cell) => cell.getAttribute('data-page-id') ?? ''));
    const selectFirst = async (p: Presses) => {
      // Setup, not a press: the last act's selection is cleared first.
      if (/\d+ selected/.test((await bar.textContent()) ?? '')) await page.keyboard.press('Escape');
      await expect(grid).toBeVisible();
      await p.gesture(() => cells.first().click({ modifiers: ['ControlOrMeta'] }));
      await expect(bar).toContainText('1 selected');
    };
    await job.act(
      'open simple-text.pdf and the Pages grid',
      null,
      async () => {
        await openFixtures(page, ['simple-text.pdf']);
        await expect(rendered(page)).toBeAttached({ timeout: 20_000 });
        await page.keyboard.press('3');
        await expect(cells).toHaveCount(3);
      },
      { gate: true },
    );
    if (isMobile) {
      job.skip('reorder', 5, 'the touch drag is covered by pages-grid.spec.ts J4');
    } else {
      await job.act('reorder: drag page 1 after page 3', 5, async (p) => {
        const before = await ids();
        const from = await cells.first().boundingBox();
        const to = await cells.nth(2).boundingBox();
        if (!from || !to) throw new Error('cells not laid out');
        await p.gesture(async () => {
          await page.mouse.move(from.x + from.width / 2, from.y + from.height / 3);
          await page.mouse.down();
          await page.mouse.move(to.x + to.width - 4, to.y + to.height / 3, { steps: 12 });
          await page.mouse.up();
        });
        await expect.poll(ids).not.toEqual(before);
      });
    }
    await job.act('rotate: select, Shift+R', 5, async (p) => {
      await selectFirst(p);
      await p.key('Shift+R');
      await expect(bar).toContainText('1 selected');
    });
    await job.act('insert a blank page: select, More, Insert blank', 5, async (p) => {
      await selectFirst(p);
      await p.press(bar.getByRole('button', { name: 'More actions' }));
      await p.press(page.getByRole('menuitem', { name: 'Insert blank page after' }));
      await expect(cells).toHaveCount(4);
    });
    /** The Pages bar folds these into its More menu on the tablet; that walk is not written yet. */
    const barAct = async (name: string, budget: number, run: (p: Presses) => Promise<void>) => {
      if (isMobile) job.skip(name, budget, 'the bar folds this into More on the tablet');
      else await job.act(name, budget, run);
    };
    await barAct('extract: select, Extract', 5, async (p) => {
      await selectFirst(p);
      await p.press(bar.getByRole('button', { name: 'Extract' }));
      const sheet = page.getByRole('dialog', { name: 'Extract pages' });
      await p.press(sheet.getByRole('button', { name: /^Extract \d+ pages?$/ }));
      await expect(page.getByRole('tab')).toHaveCount(2, { timeout: 20_000 });
    });
    await barAct('delete: select, Delete', 5, async (p) => {
      await page.getByRole('tab', { name: /^simple-text(,|$)/ }).click();
      await expect(cells.first()).toBeVisible();
      const before = await cells.count();
      await selectFirst(p);
      await p.press(bar.getByRole('button', { name: 'Delete' }));
      await expect(cells).toHaveCount(before - 1);
    });
    await barAct('split: More, Split…, Split', 5, async (p) => {
      // Split is a document act: the bar's More menu offers it with nothing selected.
      if (/\d+ selected/.test((await bar.textContent()) ?? '')) await page.keyboard.press('Escape');
      await p.press(bar.getByRole('button', { name: 'More actions' }));
      await p.press(page.getByRole('menuitem', { name: /^Split/ }));
      const sheet = page.getByRole('dialog', { name: /^Split / });
      await expect(sheet).toBeVisible();
      await p.press(sheet.getByRole('button', { name: /^Split/ }).last());
      await expect(page.getByRole('tab')).not.toHaveCount(2, { timeout: 20_000 });
    });
    await job.act('combine: the command palette, Combine with open', 5, async (p) => {
      await p.key('ControlOrMeta+k');
      await p.gesture(() =>
        page.getByRole('combobox', { name: 'Search commands' }).fill('combine with open'),
      );
      await p.key('Enter');
      const sheet = page.getByTestId('combine-sheet');
      await expect(sheet).toBeVisible();
      await p.press(sheet.getByRole('button', { name: 'Combine', exact: true }));
      await expect(page.getByTestId('combined-toast')).toBeVisible({ timeout: 20_000 });
    });
    job.finish();
  });

  test('V1-F7 Redact and verify: mark, Find sensitive data, apply, save', async ({
    page,
    isMobile,
  }, info) => {
    test.skip(isMobile, FINE);
    test.setTimeout(240_000);
    await startJob(page);
    const job = new Job('V1-F7', 'Redact and verify', page, info);
    // The demo agreement holds an e-mail, a phone number and an IBAN (fixtures manifest).
    const TOKEN = 'elena.marsh@example.com';
    const marks = page.locator('[data-annotation-layer="0"] [data-annotation-kind="redact"]');
    await job.act(
      'open demo-agreement.pdf',
      null,
      async () => {
        const chooser = page.waitForEvent('filechooser');
        await page
          .getByRole('button', { name: /^(Open files|Open PDFs…)$/ })
          .first()
          .click();
        await (await chooser).setFiles(fixturePath('demo/demo-agreement.pdf'));
        await expect(page.getByRole('tab', { name: 'demo-agreement' })).toBeVisible();
        await expect(rendered(page)).toBeAttached({ timeout: 20_000 });
        await expect(page.getByTestId('text-layer').first()).toContainText(TOKEN, {
          timeout: 20_000,
        });
      },
      { gate: true },
    );
    await job.act('mark: select the token, X', 3, async (p) => {
      await p.gesture(() =>
        page
          .getByTestId('text-layer')
          .first()
          .evaluate((root, needle) => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const at = node.textContent?.indexOf(needle) ?? -1;
              if (at < 0) continue;
              const range = document.createRange();
              range.setStart(node, at);
              range.setEnd(node, at + needle.length);
              window.getSelection()?.removeAllRanges();
              window.getSelection()?.addRange(range);
              return;
            }
            throw new Error('no token');
          }, TOKEN),
      );
      await p.key('x');
      await expect(marks).toHaveCount(1, { timeout: 10_000 });
    });
    await job.act('Find sensitive data: the command, then Mark the matches', 4, async (p) => {
      await p.key('ControlOrMeta+k');
      await p.gesture(() =>
        page.getByRole('combobox', { name: 'Search commands' }).fill('find sensitive data'),
      );
      await p.key('Enter');
      const finder = page.getByRole('region', { name: 'Sensitive data' });
      await expect(finder.locator('[data-finder-match]').first()).toBeVisible({ timeout: 60_000 });
      await p.press(finder.getByRole('button', { name: /^Mark \d+ selected/ }));
      await expect(marks.first()).toBeAttached({ timeout: 20_000 });
    });
    await job.act('apply: Apply, confirm', 3, async (p) => {
      await p.press(page.getByTestId('redaction-apply'));
      const dialog = page.getByTestId('redaction-apply-dialog');
      await expect(dialog).toBeVisible();
      await p.press(dialog.getByTestId('redaction-apply-confirm'));
      await expect(dialog.getByTestId('redaction-result')).toBeVisible({ timeout: 60_000 });
      await expect(dialog.getByTestId('redaction-checks-summary')).toContainText(
        /Self-check: \d+ of \d+ checks passed/,
      );
      await dialog.getByRole('button', { name: 'Close' }).last().click();
    });
    let saved: Buffer | undefined;
    await job.act('save a copy: menu, Save a copy…, Download copy', 3, async (p) => {
      await p.press(page.getByTestId('document-menu'));
      await p.press(page.getByRole('menuitem', { name: 'Save a copy…' }));
      const sheet = page.getByTestId('save-copy-sheet');
      await expect(sheet).toBeVisible();
      const downloading = page.waitForEvent('download', { timeout: 60_000 });
      await p.press(sheet.getByRole('button', { name: 'Download copy' }));
      saved = await readFile(await (await downloading).path());
    });
    await job.act('receipt: the copy holds no token (reopened, Find: 0 matches)', 0, async () => {
      if (!saved) throw new Error('no copy was saved');
      expect(saved.toString('latin1')).not.toContain(TOKEN);
      await page.keyboard.press('Escape');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Open files' }).first().click();
      await (await chooser).setFiles({
        name: 'redacted.pdf',
        mimeType: 'application/pdf',
        buffer: saved,
      });
      await expect(page.getByRole('tab', { name: 'redacted', selected: true })).toBeVisible();
      const field = await openFindPanel(page);
      await field.fill(TOKEN);
      await expect(page.getByTestId('search-status')).toHaveText('No matches', { timeout: 20_000 });
    });
    job.finish();
  });

  test('V1-F8 OCR: recognise a scan, then Find a word only in the image', async ({
    page,
    isMobile,
  }, info) => {
    test.skip(isMobile, FINE);
    test.setTimeout(300_000);
    await startJob(page);
    const job = new Job('V1-F8', 'OCR', page, info);
    await job.act(
      'open scan-text.pdf',
      null,
      async () => {
        await openFixtures(page, ['scan-text.pdf']);
        await expect(rendered(page)).toBeAttached({ timeout: 20_000 });
      },
      { gate: true },
    );
    await job.act('Find prompt, Recognize text…, Recognize 2 pages, Show results', 4, async (p) => {
      await p.press(page.locator('[data-find-entry] input[type="search"]').first());
      const prompt = page.getByTestId('find-textless');
      await expect(prompt).toBeVisible({ timeout: 20_000 });
      await p.press(prompt.getByRole('button', { name: 'Recognize text…' }));
      const dialog = page.getByTestId('ocr-dialog');
      await p.press(dialog.getByRole('button', { name: 'Recognize 2 pages' }));
      await expect(dialog.getByTestId('ocr-result')).toBeVisible({ timeout: 240_000 });
      await p.press(dialog.getByRole('button', { name: 'Show results' }));
      await expect(dialog).toHaveCount(0);
    });
    await job.act('Find a word that was only in the image', 2, async (p) => {
      // The scan's text is "The quick brown fox…" in Inter (fixtures manifest, M5 OCR truth).
      const field = page.locator('[data-find-entry] input[type="search"]').first();
      await p.press(field);
      await p.gesture(() => field.fill('quick'));
      await expect(page.getByTestId('find-count')).toContainText(/1 of \d+/, { timeout: 20_000 });
    });
    job.finish();
  });

  test('V1-F9 Save: in place, a copy, compress with honest numbers', async ({
    page,
    browserName,
    isMobile,
  }, info) => {
    test.skip(isMobile, FINE);
    test.setTimeout(240_000);
    const job = new Job('V1-F9', 'Save', page, info);
    const saveButton = page.getByTestId('save-button');
    if (browserName === 'chromium') {
      await stubFileSystemAccess(page);
      await page.goto('./?lang=en');
      await seedFile(page, 'simple-text.pdf');
      await job.act(
        'open with a writable handle',
        null,
        async () => {
          await page.getByRole('button', { name: 'Open files' }).first().click();
          await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
        },
        { gate: true },
      );
      const rotate = async () => {
        await page.keyboard.press('3');
        const cell = page.locator('[role="gridcell"][data-page-id]').first();
        await expect(cell).toBeVisible();
        await cell.click({ modifiers: ['ControlOrMeta'] });
        await page.keyboard.press('Shift+R');
        await page.keyboard.press('1');
        await expect(markupDoor(page)).toBeVisible();
      };
      await job.act(
        'save in place, the first time: Save, Replace, the browser prompt',
        3,
        async (p) => {
          await rotate();
          await p.press(saveButton);
          await p.press(
            page
              .getByTestId('replace-popover')
              .getByRole('button', { name: 'Replace', exact: true }),
          );
          await expect(page.getByRole('group', { name: 'Saved · verified' })).toBeVisible({
            timeout: 30_000,
          });
          for (let i = (await stub(page)).prompts; i > 0; i--) p.native();
        },
      );
      await job.act('save in place, again', 1, async (p) => {
        await page
          .getByRole('group', { name: 'Saved · verified' })
          .getByRole('button', { name: 'Dismiss' })
          .click();
        await rotate();
        await p.press(saveButton);
        await expect.poll(async () => (await stub(page)).writes, { timeout: 30_000 }).toBe(2);
      });
    } else {
      await useFileInputPicker(page);
      await page.goto('./?lang=en');
      job.skip('save in place', 3, 'File System Access exists only in Chromium');
      await openFixtures(page, ['simple-text.pdf']);
    }
    await useDownloadPathNow(page);
    await job.act(
      'compress: Save a copy…, Smaller, Download copy; the numbers are honest',
      4,
      async (p) => {
        if (browserName === 'chromium') {
          // The open picker is the stub's: it hands out the seeded file.
          await seedFile(page, 'images.pdf');
          await page.getByRole('button', { name: 'Open files' }).first().click();
          await expect(page.getByRole('tab', { name: 'images' })).toBeVisible();
        } else {
          await openFixtures(page, ['images.pdf']);
        }
        const original = (await readFile(fixturePath('images.pdf'))).length;
        await p.press(page.getByTestId('document-menu'));
        await p.press(page.getByRole('menuitem', { name: 'Save a copy…' }));
        const sheet = page.getByTestId('save-copy-sheet');
        await p.press(sheet.getByRole('radio', { name: /^Smaller/ }));
        const downloading = page.waitForEvent('download', { timeout: 60_000 });
        await p.press(sheet.getByRole('button', { name: 'Download copy' }));
        const bytes = await readFile(await (await downloading).path());
        const toast = page.getByTestId('save-copy-toast').last();
        await expect(toast).toContainText(
          /^Downloaded images-small\.pdf · [\d.]+ (B|KB|MB) · verified/,
          {
            timeout: 60_000,
          },
        );
        // Honest: the size the toast states is the size of the file the person got.
        const stated = /· ([\d.]+) (B|KB|MB) ·/.exec((await toast.textContent()) ?? '');
        const unit = { B: 1, KB: 1024, MB: 1024 * 1024 }[stated?.[2] as 'B' | 'KB' | 'MB'] ?? 1;
        const statedBytes = Number(stated?.[1]) * unit;
        expect(Math.abs(statedBytes - bytes.length) / bytes.length).toBeLessThan(0.1);
        info.annotations.push({
          type: 'V1-F9 compress numbers',
          description: `original ${original} B, copy ${bytes.length} B, toast says ${stated?.[0] ?? '?'}`,
        });
      },
    );
    job.finish();
  });

  test('V1-F10 Compare: two versions, as a place, step through the changes', async ({
    page,
    isMobile,
  }, info) => {
    test.skip(isMobile, FINE);
    test.setTimeout(180_000);
    await startJob(page);
    const job = new Job('V1-F10', 'Compare', page, info);
    await job.act(
      'open compare-a.pdf and compare-b.pdf',
      null,
      async () => {
        const chooser = page.waitForEvent('filechooser');
        await page
          .getByRole('button', { name: /^(Open files|Open PDFs…)$/ })
          .first()
          .click();
        await (await chooser).setFiles(['compare-a.pdf', 'compare-b.pdf'].map(fixturePath));
        // Two files opened together land on the Library with both as cards (J12).
        await expect(page.getByRole('listbox', { name: 'Files' }).getByRole('option')).toHaveCount(
          2,
          {
            timeout: 20_000,
          },
        );
        await page.getByRole('button', { name: 'Done' }).click();
      },
      { gate: true },
    );
    await job.act('from the Library: tick A, tick B, Compare', 3, async (p) => {
      const library = page.getByTestId('home');
      await expect(library).toBeVisible();
      const card = (title: string) =>
        page
          .getByRole('listbox', { name: 'Files' })
          .getByRole('option', { name: new RegExp(`^${title},`) });
      await card('compare-a').hover();
      await p.press(card('compare-a').getByTestId('library-card-check'));
      await p.press(card('compare-b').getByTestId('library-card-check'));
      await p.press(
        page.getByRole('toolbar', { name: 'Selected documents' }).getByRole('button', {
          name: 'Compare',
        }),
      );
      await expect(library).toHaveCount(0);
      await expect(page.getByTestId('compare-setup')).toBeVisible();
    });
    // The Library hands over to Compare's setup, with A and B chosen: one more press runs it.
    await job.act('run the comparison: Compare', 1, async (p) => {
      await p.press(
        page.getByTestId('compare-setup').getByRole('button', { name: 'Compare', exact: true }),
      );
      await expect(page.getByTestId('compare-view')).toHaveAttribute('data-status', 'done', {
        timeout: 60_000,
      });
    });
    await job.act('step through the changes: J, J', 3, async (p) => {
      await expect(page.getByTestId('changes-panel').locator('[data-change]')).not.toHaveCount(0);
      const current = page
        .getByTestId('changes-panel')
        .locator('[data-change][aria-current="true"]');
      await page.locator('[data-compare-viewport]').focus();
      await p.key('j');
      await expect(current.first()).toBeAttached();
      const first = await current.first().getAttribute('data-change');
      await p.key('j');
      await expect.poll(() => current.first().getAttribute('data-change')).not.toBe(first);
    });
    job.finish();
  });

  test('V1-F11 Recover: a reload restores the last change and its history, nothing pressed', async ({
    page,
    browserName,
  }, info) => {
    test.setTimeout(120_000);
    page.on('dialog', (dialog) => void dialog.accept());
    await useFileInputPicker(page);
    await page.goto('./?lang=en');
    await sessionSettled(page);
    const job = new Job('V1-F11', 'Recover', page, info);
    if ((await page.locator('html').getAttribute('data-session')) === 'off') {
      job.skip(
        'reload restores the change',
        0,
        `${browserName} keeps nothing in this test context`,
      );
      job.finish();
      return;
    }
    const cells = page.locator('[role="gridcell"][data-page-id]');
    await job.act(
      'a change: delete page 2 in Arrange, kept on this device',
      null,
      async () => {
        await openFixtures(page, ['simple-text.pdf']);
        await page.keyboard.press('3');
        await expect(cells).toHaveCount(3);
        await cells.nth(1).click({ modifiers: ['ControlOrMeta'] });
        await page.keyboard.press('Delete');
        await expect(cells).toHaveCount(2);
        await waitForSnapshot(page);
      },
      { gate: true },
    );
    await job.act('reload: the document and its change are back', 0, async () => {
      await page.reload();
      await sessionSettled(page);
      await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
      await expect(page.getByTestId('session-notice')).toContainText('Restored simple-text');
      await expect(cells).toHaveCount(2);
    });
    await job.act('the history tail: Undo brings page 2 back', 1, async (p) => {
      await p.key('ControlOrMeta+z');
      await expect(cells).toHaveCount(3);
    });
    job.finish();
  });

  test('V1-F12 Locked files: a signed file opens locked, no act changes its bytes, Unlock anyway', async ({
    page,
    isMobile,
  }, info) => {
    test.skip(isMobile, FINE);
    test.setTimeout(120_000);
    await startJob(page);
    const job = new Job('V1-F12', 'Locked files', page, info);
    const original = await readFile(fixturePath('signed-approval.pdf'));
    const toggle = page.getByTestId('lock-switch-row').getByRole('switch');
    await job.act(
      'open signed-approval.pdf',
      null,
      async () => {
        await openFixtures(page, ['signed-approval.pdf']);
        await expect(rendered(page)).toBeAttached({ timeout: 20_000 });
      },
      { gate: true },
    );
    await job.act('it opens locked, with the reason "Signed file"', 0, async () => {
      await page.getByTestId('document-menu').click();
      try {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
        await expect(page.getByTestId('lock-switch-row')).toContainText('Signed file');
      } finally {
        await page.keyboard.press('Escape');
      }
    });
    await job.act('lock it by hand (stands in until it opens locked, D1-4a)', null, async () => {
      await page.getByTestId('document-menu').click();
      try {
        if (!(await toggle.isChecked())) await toggle.click();
        await expect(toggle).toBeChecked();
      } finally {
        await page.keyboard.press('Escape');
      }
    });
    await job.act('a page act is refused: "Locked · unlock first"', 2, async (p) => {
      await page.keyboard.press('3');
      const cell = page.locator('[role="gridcell"][data-page-id]').first();
      await expect(cell).toBeVisible();
      await p.gesture(() => cell.click({ modifiers: ['ControlOrMeta'] }));
      await p.key('Shift+R');
      // The Pages bar keeps its locked form and nothing changed: the document still says Saved.
      await expect(
        page.getByTestId('pages-bar').getByRole('button', { name: 'Unlock' }),
      ).toBeVisible();
      await expect(page.getByTestId('save-button')).toHaveAccessibleName('Saved');
      await page.keyboard.press('Escape');
      await page.keyboard.press('1');
    });
    await job.act('a copy of the locked file has the same bytes', 3, async (p) => {
      await p.press(page.getByTestId('document-menu'));
      await p.press(page.getByRole('menuitem', { name: 'Save a copy…' }));
      const sheet = page.getByTestId('save-copy-sheet');
      await expect(sheet).toBeVisible();
      const downloading = page.waitForEvent('download', { timeout: 60_000 });
      await p.press(sheet.getByRole('button', { name: 'Download copy' }));
      const bytes = await readFile(await (await downloading).path());
      expect(bytes.equals(original)).toBe(true);
    });
    await job.act('Unlock anyway', 3, async (p) => {
      await p.press(page.getByTestId('document-menu'));
      try {
        await p.press(toggle);
        const warning = page.getByTestId('unlock-warning');
        // A signed or restricted lock asks first; a lock by hand does not.
        if (await warning.isVisible()) {
          await p.press(warning.getByRole('button', { name: 'Unlock anyway' }));
        }
        await expect(toggle).not.toBeChecked();
      } finally {
        await page.keyboard.press('Escape');
      }
    });
    job.finish();
  });
});

/** Hides the save picker on a page that is already open, so Save a copy downloads. */
async function useDownloadPathNow(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
}
