/**
 * Where the inspector's parts live since it left (spec D2-9; inventory family 6), at 1440 × 900
 * on a fine pointer and on the tablet, in English and Turkish:
 *
 * - **Properties** (6.3): the annotation bar's ⋯ opens the selection's type, author, modified,
 *   page and its comment, which commits as one undo step (04-context §5).
 * - **Info** (6.7): S4 Document info from the title menu, with the file facts and the badges'
 *   explanations written out (07-sheets §6).
 * - **Signatures** (6.5): the title menu's facts row and its Signatures… row open S9.
 * - **OCR** (6.4): S10 is a tool sheet from the title menu; its results are Review's Words to
 *   check (`ocr.spec.ts` runs the recognition).
 * - **Batch**: S21 from ⌘K, a centred 720 dialog from expanded up, a 640 form on the tablet.
 * - **History** (6.6): the History scrubber from ↶ (FB7).
 * - The strip has no inspector toggle and Mod+Alt+B opens nothing.
 *
 * Each home is captured to `SHOTS_DIR` (else the test's output folder) for the design review.
 */
import { expect, type Locator, type Page, test, type TestInfo } from '@playwright/test';

import { enterEdit, historyStep, inHistory, openFixtures, useFileInputPicker } from './helpers';

const isTablet = (info: TestInfo) => info.project.name === 'tablet';

async function shot(page: Page, info: TestInfo, name: string, target?: Locator): Promise<void> {
  const file = `${name}-${isTablet(info) ? 'tablet' : '1440'}-${langOf(page)}.png`;
  const path = process.env.SHOTS_DIR ? `${process.env.SHOTS_DIR}/${file}` : info.outputPath(file);
  // Motion settles first (sheets and popovers enter on springs).
  await page.waitForTimeout(450);
  await (target ?? page).screenshot({ path });
}

const langOf = (page: Page) =>
  new URL(page.url()).searchParams.get('lang') === 'tr' ? 'tr' : 'en';

async function start(page: Page, info: TestInfo, lang: 'en' | 'tr', files: string[]) {
  if (!isTablet(info)) await page.setViewportSize({ width: 1440, height: 900 });
  await useFileInputPicker(page);
  await page.goto(`./?lang=${lang}`);
  await openFixtures(page, files);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
}

/** A row of the title menu by its command. */
async function titleMenuRow(page: Page, command: string): Promise<Locator> {
  await page.getByTestId('document-menu').click();
  const menu = page.getByTestId('title-menu');
  await expect(menu).toBeVisible();
  // The menu at rest before a row is pressed: a press during its entrance can land on a row
  // that is still moving into place.
  await menu.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))),
  );
  return menu.locator(`[data-command="${command}"]`);
}

/** Runs the command ⌘K lists first for `query`, which must be the one named `name`. */
async function runPalette(page: Page, query: string, name: RegExp): Promise<void> {
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill(query);
  await expect(page.getByRole('option', { selected: true, name })).toBeVisible();
  await page.keyboard.press('Enter');
}

for (const lang of ['en', 'tr'] as const) {
  test.describe(`the inspector's homes (${lang})`, () => {
    test('no inspector: no toggle in the strip, and Mod+Alt+B opens nothing', async ({
      page,
    }, info) => {
      await start(page, info, lang, ['simple-text.pdf']);
      await expect(page.locator('#right-panel')).toHaveCount(0);
      await expect(page.locator('[aria-controls="right-panel"]')).toHaveCount(0);
      await page.keyboard.press('ControlOrMeta+Alt+b');
      await expect(page.locator('#right-panel')).toHaveCount(0);
    });

    test('Properties: the annotation bar’s ⋯', async ({ page }, info) => {
      await start(page, info, lang, ['annotations.pdf']);
      if (isTablet(info)) {
        // The tablet lays the sidebar over the page: select the note on the page, in Markup
        // with Select (a tap selects there).
        await enterEdit(page);
        await page.keyboard.press(']');
        const note = page.locator('[data-annotation-layer="1"] [data-annotation-kind="text"]');
        await expect(note).toBeVisible({ timeout: 20_000 });
        await note.click();
      } else {
        // A Review row selects its annotation (06-navigation N5).
        await page.getByTestId('sidebar-toggle').click();
        const sidebar = page.getByRole('navigation').filter({ has: page.getByRole('tablist') });
        await sidebar.getByRole('tab').nth(2).click();
        await page.getByText('Sticky note text on page 2').click();
      }
      // Its bar carries ⋯.
      const bar = page.getByTestId('annotation-bar');
      await expect(bar).toBeVisible({ timeout: 20_000 });
      await bar.getByTestId('annotation-more').click();
      const popover = page.getByTestId('annotation-properties');
      await expect(popover).toBeVisible();
      await expect(popover.locator('dl')).toContainText(lang === 'tr' ? 'Yazar' : 'Author');
      const comment = popover.getByRole('textbox');
      await expect(comment).toHaveValue('Sticky note text on page 2');
      await shot(page, info, 'properties');
      // The comment commits on blur as one undo step.
      await comment.fill('Checked by the reviewer');
      await comment.press('Tab');
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
      if (!isTablet(info)) {
        await inHistory(page, (list) =>
          expect(historyStep(list, lang === 'tr' ? /yorum/i : /comment/)).toHaveAttribute(
            'data-state',
            'present',
          ),
        );
      }
    });

    test('Info: S4 from the title menu', async ({ page }, info) => {
      await start(page, info, lang, ['forms-a.pdf']);
      await (await titleMenuRow(page, 'document.info')).click();
      const sheet = page.locator('[data-sheet="document-info"]');
      await expect(sheet).toBeVisible();
      const facts = sheet.getByTestId('document-facts');
      await expect(facts).toContainText('forms-a.pdf');
      await expect(facts.getByRole('listitem')).not.toHaveCount(0);
      await shot(page, info, 'info');
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
    });

    test('Signatures: the title menu’s facts row and S9', async ({ page }, info) => {
      await start(page, info, lang, ['signed-then-modified.pdf']);
      await page.getByTestId('document-menu').click();
      const menu = page.getByTestId('title-menu');
      const fact = menu.getByTestId('title-menu-signatures');
      await expect(fact).toContainText(lang === 'tr' ? 'Bozulmamış' : 'Intact', {
        timeout: 20_000,
      });
      await expect(menu.locator('[data-command="document.signatures"]')).toBeVisible();
      await shot(page, info, 'signatures-title-menu');
      await fact.click();
      const sheet = page.getByTestId('signatures-sheet');
      await expect(sheet.getByTestId('signature-card')).toHaveCount(1);
      await shot(page, info, 'signatures');
    });

    test('OCR: S10 from the title menu, a tool sheet beside the page', async ({ page }, info) => {
      await start(page, info, lang, ['scan-text.pdf']);
      await (await titleMenuRow(page, 'document.ocr')).click();
      const sheet = page.getByTestId('ocr-dialog');
      // S10's code loads on its first opening (`OcrSheetHost`, a lazy chunk with the engine
      // helpers it uses), which on a loaded CI runner can outlast the default 5 s (a flaky
      // WebKit run found no sheet after 5 s and passed on its retry).
      await expect(sheet).toBeVisible({ timeout: 15_000 });
      await expect(sheet).toHaveAttribute('data-kind', 'tool');
      await expect(sheet.locator('[data-sheet-primary]')).toBeVisible();
      await expect(sheet.locator('[data-sheet-primary]')).not.toHaveAttribute(
        'aria-disabled',
        'true',
        { timeout: 20_000 },
      );
      await shot(page, info, 'ocr');
    });

    test('Batch: S21 from ⌘K', async ({ page }, info) => {
      await start(page, info, lang, ['simple-text.pdf']);
      await runPalette(page, 'batch', lang === 'tr' ? /^Toplu/ : /^Batch/);
      const sheet = page.getByTestId('batch-dialog');
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute('data-presentation', isTablet(info) ? 'form' : 'dialog');
      await expect(sheet.getByTestId('batch-run')).toBeVisible();
      await shot(page, info, 'batch');
    });

    test('History: the scrubber from ↶', async ({ page }, info) => {
      await start(page, info, lang, ['simple-text.pdf']);
      // Two steps to show: the title menu's Rotate all ▸ turns every page, twice.
      for (let i = 0; i < 2; i++) {
        await (await titleMenuRow(page, 'rotate')).click();
        await page.getByRole('menu').last().getByRole('menuitem').first().click();
        await expect(page.getByTestId('title-menu')).toHaveCount(0);
      }
      if (isTablet(info)) {
        await runPalette(
          page,
          lang === 'tr' ? 'Geçmişi göster' : 'Show history',
          lang === 'tr' ? /^Geçmişi göster/ : /^Show history/,
        );
      } else {
        await page.getByTestId('undo-button').click({ button: 'right' });
      }
      const scrubber = page.getByTestId('history-scrubber');
      await expect(scrubber).toBeVisible();
      await shot(page, info, 'history');
      await page.keyboard.press('Escape');
      await expect(scrubber).toHaveCount(0);
    });
  });
}
