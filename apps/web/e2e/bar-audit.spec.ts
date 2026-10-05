/**
 * One control system (quality-bar.md Q-9; spec redesign D0-3): every bar, menu and popover in
 * today's main states, audited by e2e/support/bar-audit.ts. Within each, the controls are one
 * height (32 px on a fine pointer, 44 px on a coarse one), share a centre line per row, take a
 * radius from the set and hold 16 or 20 px icons.
 *
 * Runs at 1440 × 900 on the desktop projects (fine), on the `tablet` project (coarse, the full
 * edition at 820 × 1180) and, for the compact edition, on `phone`. States: Home, Read, the
 * text selection bar, Edit with each of the bar's five groups, an options tier, a tool menu,
 * the Document menu, the page context menu, Arrange with its contextual bar, the History
 * scrubber under ↶ (D0-6), the toast stack (an Undo toast and a failure toast, hovered so ✕
 * shows), an annotation's bar, a dialog with its footer, the sheets of D0-4 (the shortcuts
 * overlay's header, the password prompt's footer) and the Settings sheet of D0-10 (its header
 * and control rows, and the About Recto page).
 */
import { expect, type Page, test } from '@playwright/test';

import { enterEdit, fixturePath, openFixtures, useFileInputPicker } from './helpers';
import { auditBars, type BarFinding, type ControlKind } from './support/bar-audit';

const COMPACT = 'phone';
const FULL_EDITION_ONLY = new Set(['phone', 'phone-land']);

/**
 * Containers left out, with why. Each must still be seen, so the list cannot go stale silently.
 */
const SKIP: Readonly<Record<string, string>> = {};

/**
 * Kinds of control another part of D0-3 replaces (spec redesign §11.1 D0-3; the fields, menus
 * and ink ports): findings about them are held, not failed, until that port lands. A kind that
 * no longer turns up anywhere fails the test, so the entry is taken off when its port arrives.
 */
const PENDING: Readonly<Partial<Record<ControlKind, string>>> = {};

async function density(page: Page): Promise<32 | 44> {
  const coarse = await page.evaluate(
    () => matchMedia('(pointer: coarse), (any-pointer: coarse)').matches,
  );
  return coarse ? 44 : 32;
}

/** Collects every state's findings; the test fails once, at the end, with all of them. */
function collector(page: Page) {
  const findings: BarFinding[] = [];
  const seen = new Set<string>();
  return {
    async audit(state: string) {
      // Let entrances settle so boxes are at rest.
      await page.waitForTimeout(350);
      const result = await auditBars(page, state, { height: await density(page), skip: SKIP });
      findings.push(...result.findings);
      for (const name of result.containers) seen.add(name);
      return result;
    },
    report() {
      const held = findings.filter((f) => PENDING[f.kind] !== undefined);
      expect(
        findings
          .filter((f) => PENDING[f.kind] === undefined)
          .map((f) => `${f.state} · ${f.container}: ${f.problem}`),
      ).toEqual([]);
      return held;
    },
    seen,
  };
}

async function openFull(page: Page, name: string): Promise<void> {
  await page.goto('./?lang=en');
  await openFixtures(page, [name]);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await page.mouse.move(2, 450);
}

test.describe('the full edition', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }, info) => {
    test.skip(FULL_EDITION_ONLY.has(info.project.name), 'the compact edition is audited below');
    await useFileInputPicker(page);
  });

  test('Home, Read, Edit with each group and a tier, menus, Arrange, a dialog', async ({
    page,
  }) => {
    // Some twenty states in one walk: more than the default 30 s on a loaded machine.
    test.setTimeout(60_000);
    const run = collector(page);
    await page.goto('./?lang=en');
    await expect(page.getByRole('button', { name: /^Open files/ }).first()).toBeVisible();
    await run.audit('Home');

    await openFixtures(page, ['simple-text.pdf']);
    await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
      timeout: 20_000,
    });
    await page.mouse.move(2, 450);
    await run.audit('Read');

    // The text selection bar.
    const rows = page.getByTestId('text-layer').first().locator('span[data-row]');
    const word = await rows.first().boundingBox();
    if (!word) throw new Error('no text');
    await page.mouse.dblclick(word.x + 12, word.y + word.height / 2);
    await expect(page.getByRole('toolbar', { name: 'Selected text' })).toBeVisible();
    await run.audit('Read, text selection bar');
    await page.keyboard.press('Escape');

    await enterEdit(page);
    const bar = page.getByRole('toolbar', { name: 'Tools', exact: true });
    for (const group of ['select', 'write', 'text', 'fill', 'redact']) {
      const button = bar.locator(`[data-bar-group="${group}"]`);
      if ((await button.count()) === 0) continue;
      await button.first().click();
      await page.mouse.move(2, 450);
      await run.audit(`Edit, ${group}`);
      // Back to the group row.
      const chip = bar.locator('[data-bar-chip]');
      if ((await chip.count()) > 0) await chip.first().click();
    }

    // A tool menu on the bar.
    await bar.locator('[data-bar-group="write"]').click();
    await bar.locator('[aria-haspopup="menu"]').first().click();
    await expect(page.getByRole('menu')).toBeVisible();
    await run.audit('Edit, a tool menu');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // An armed tool's options tier (T, the Text box, twice).
    await page.locator('body').press('t');
    await page.locator('body').press('t');
    await expect(page.getByTestId('options-tier')).toBeVisible();
    await page.mouse.move(2, 450);
    await run.audit('Edit, options tier');
    await page.keyboard.press('Escape');

    // The Document menu.
    await page
      .getByRole('button', { name: /^Document/ })
      .first()
      .click();
    await expect(page.getByRole('menu')).toBeVisible();
    await run.audit('the Document menu');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // The page context menu.
    const first = await page.locator('[data-page-index="0"]').boundingBox();
    if (!first) throw new Error('page 1 not laid out');
    await page.mouse.click(first.x + 40, first.y + 40, { button: 'right' });
    await expect(page.getByTestId('page-context-menu')).toBeVisible();
    await run.audit('the page context menu');
    await page.keyboard.press('Escape');

    // A dialog and its footer.
    await page
      .getByRole('button', { name: /^Export/ })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await run.audit('the Export dialog');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The shortcuts overlay, a Sheet (D0-4): its header bar.
    await page.locator('body').press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await run.audit('the shortcuts overlay');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The Settings sheet (D0-10): its header, the rows that hold controls (the language
    // segments, Recent files with Clear, Show tips again), then About Recto.
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox').first().fill('Settings');
    await page
      .getByRole('option', { name: /^Settings…/ })
      .first()
      .click();
    const settings = page.getByTestId('settings-sheet');
    await expect(settings).toBeVisible();
    await run.audit('the Settings sheet');
    await settings.getByRole('button', { name: /About Recto/ }).click();
    await expect(settings.getByTestId('settings-about')).toBeVisible();
    await run.audit('the Settings sheet, About Recto');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Arrange and its contextual bar.
    await page.keyboard.press('3');
    await expect(page.getByTestId('light-table')).toBeVisible();
    await run.audit('Arrange');
    await page.getByTestId('light-table').getByRole('gridcell').nth(1).click();
    await expect(page.getByTestId('contextual-bar')).toBeVisible();
    await page.mouse.move(2, 450);
    await run.audit('Arrange, a page selected');

    // ↶ ↷ sit in the title bar (audited with it above); the History scrubber under ↶, after a
    // step to scrub (D0-6): its list on a fine pointer, its slider and Cancel on a coarse one.
    await page.keyboard.press('r');
    await expect(page.getByTestId('undo-button')).not.toHaveAttribute('aria-disabled');
    await page.getByTestId('undo-button').click({ button: 'right' });
    await expect(page.getByTestId('history-scrubber')).toBeVisible();
    await run.audit('the History scrubber');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('history-scrubber')).toHaveCount(0);
    // The rotation undone, so the states below see the document as opened.
    await page.getByTestId('undo-button').click();
    await expect(page.getByTestId('redo-button')).not.toHaveAttribute('aria-disabled');

    // The privacy indicator's popover in the status bar.
    await page.keyboard.press('Escape');
    await page.getByTestId('privacy-indicator').click();
    await expect(page.locator('[role="dialog"][data-side]')).toBeVisible();
    await run.audit('the privacy popover');
    await page.keyboard.press('Escape');

    // The toast stack (D0-5): "Deleted page 2 · Undo" under a failure toast, each a
    // `[data-bar="toast"]`, the Undo toast hovered so its ✕ shows too. Last, so every state
    // above sees the document unchanged.
    await page.locator('[role="gridcell"][data-page-id]').nth(1).click();
    await page.keyboard.press('Delete');
    const chooser = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /^Open files/ })
      .first()
      .click();
    await (await chooser).setFiles({
      name: 'scan.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nnot a pdf\n%%EOF\n'),
    });
    const toasts = page.getByRole('region', { name: 'Notifications' });
    await expect(toasts.getByRole('group')).toHaveCount(2);
    await toasts.getByRole('group').first().hover();
    await run.audit('the toast stack');
    await page.mouse.move(2, 450);

    for (const name of Object.keys(SKIP)) expect(run.seen, `skipped ${name}`).toContain(name);
    const held = run.report();
    // Every pending kind still turns up here; once its port lands, take it off PENDING.
    for (const kind of Object.keys(PENDING)) {
      expect(
        held.some((f) => f.kind === kind),
        `nothing is pending as "${kind}" any more: take it off PENDING`,
      ).toBe(true);
    }
  });

  test('the password prompt, a Sheet: its footer', async ({ page }) => {
    const run = collector(page);
    await page.goto('./?lang=en');
    const chooser = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /^Open files/ })
      .first()
      .click();
    await (await chooser).setFiles(fixturePath('encrypted-aes-128.pdf'));
    await expect(page.getByRole('alertdialog', { name: 'Password required' })).toBeVisible();
    await run.audit('the password prompt');
    run.report();
  });

  test('an annotation’s bar', async ({ page }) => {
    const run = collector(page);
    await openFull(page, 'annotations.pdf');
    await enterEdit(page);
    await page
      .locator('[data-annotation-layer="0"] [data-annotation-kind]')
      .first()
      .click({ force: true });
    await expect(page.getByTestId('annotation-bar')).toBeVisible();
    await page.mouse.move(2, 450);
    await run.audit('Edit, an annotation selected');
    run.report();
  });
});

/**
 * The compact edition (ADR-0033), on the `phone` project: the reader's top bar and capsule, the
 * ⋯ menu and the Pages sheet. Every control there is 44 px (a coarse pointer).
 */
test.describe('the compact edition', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== COMPACT, 'runs on the phone project');
    await useFileInputPicker(page);
  });

  test('the reader, the ⋯ menu and the Pages sheet', async ({ page }) => {
    const run = collector(page);
    await page.goto('./?lang=en');
    await expect(page.getByTestId('compact-library')).toBeVisible();
    await run.audit('compact Library');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
    await (await chooser).setFiles(fixturePath('outline-named-dests.pdf'));
    await expect(page.locator('[data-page-index="0"] canvas')).toHaveAttribute(
      'data-state',
      'rendered',
    );
    await run.audit('compact reader');

    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByTestId('compact-menu')).toBeVisible();
    await run.audit('compact ⋯ menu');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('compact-menu')).toHaveCount(0);

    await page.getByTestId('compact-capsule').getByRole('button', { name: 'Pages' }).click();
    await expect(page.getByTestId('compact-pages-sheet')).toBeVisible();
    await run.audit('compact Pages sheet');
    run.report();
  });
});
