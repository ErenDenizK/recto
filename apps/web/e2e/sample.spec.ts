// page.evaluate callbacks run in the browser.
/**
 * The teaching sample (MOB-11, MOB-12; redesign D4-2; components/02-library.md §11, L10;
 * flows.md §9.2): `?sample` and `?sample=tr` open the full cut once after launch and leave the
 * address, so a reload opens no second copy; with a restored session it opens as one more tab;
 * the cover's lines open their pages; and the service worker's precache holds all four files
 * and opens the sample offline after one visit. The pages come from the manifest
 * (`sample-manifest.ts`), so the specs follow the sample.
 */
import { expect, type Page, test } from '@playwright/test';

import {
  openFixtures,
  quiet,
  sessionSettled,
  trackEngine,
  useFileInputPicker,
  waitForSnapshot,
  openDocumentTitles,
} from './helpers';
import { SAMPLE_FILES, sampleEntry } from './sample-manifest';

const FULL = sampleEntry('en', 'full');

const sampleTabs = (page: Page) => page.getByRole('tab', { name: /^Recto (sample|örnek belge)/ });

/** The address has no `sample` parameter left. */
async function expectCleanAddress(page: Page): Promise<void> {
  await expect.poll(() => new URL(page.url()).searchParams.has('sample')).toBe(false);
}

/** A page of the active document rendered through PDFium. */
async function expectRendered(page: Page): Promise<void> {
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
}

test('?sample opens the sample once and leaves the address; a reload opens no second copy', async ({
  page,
}) => {
  await page.goto('./?sample');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await expectCleanAddress(page);
  await expect(sampleTabs(page)).toHaveCount(1);
  await expectRendered(page);

  // The session keeps the open sample (where storage is kept), but nothing opens it again.
  const keeping = (await page.locator('html').getAttribute('data-session')) === 'ready';
  if (keeping) await waitForSnapshot(page);
  await page.reload();
  await sessionSettled(page);
  await expectCleanAddress(page);
  await expect(sampleTabs(page)).toHaveCount(keeping ? 1 : 0);
  await expect(page.getByRole('tab', { name: /^Recto sample \(2\)/ })).toHaveCount(0);
});

test('?sample=tr opens the Turkish sample in an English UI', async ({ page }) => {
  await page.goto('./?sample=tr');
  await expect(page.getByRole('tab', { name: 'Recto örnek belge', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await expectCleanAddress(page);
  await expect(sampleTabs(page)).toHaveCount(1);
  await expectRendered(page);
});

test('Fill & sign on the cover brings the sample’s form into view', async ({ page }) => {
  // V2 review item 23: the door opened the Sign set and nothing on page 1 changed.
  await page.goto('./?sample');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await expectRendered(page);
  await expect(page.getByTestId('page-pill')).toHaveText(new RegExp(`^1 / ${FULL.pageCount} · `));
  const formPage = page.locator(`[data-page-index="${FULL.formPage - 1}"]`);
  await expect(formPage).not.toBeInViewport({ ratio: 0.3 });
  await page
    .locator('[data-capsule]')
    .getByRole('button', { name: /^Fill & sign/ })
    .click();
  // The pill hides while Markup is open on medium (03-markup decision 3): the page tells.
  await expect(formPage).toBeInViewport({ ratio: 0.3 });
  const field = page.locator('[data-form-layer] [data-field-name]').first();
  await expect(field).toBeInViewport();
  // The door focuses the palette, not the field: typing does not fill it yet.
  await expect(field).not.toBeFocused();
});

test('the cover’s lines open their pages (links)', async ({ page }) => {
  await page.goto('./?sample');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await expectRendered(page);
  const pill = page.getByTestId('page-pill');
  await expect(pill).toHaveText(new RegExp(`^1 / ${FULL.pageCount} · `));
  const cover = page.locator('[data-page-index="0"] [data-testid="link-layer"]');
  await expect(cover.locator('[data-link="internal"]')).toHaveCount(FULL.coverLinks.length);
  const target = FULL.coverLinks[0] as number;
  await cover.locator(`[data-link="internal"][aria-label="Go to page ${target}"]`).click();
  await expect(page.locator(`[data-page-index="${target - 1}"]`)).toBeInViewport({ ratio: 0.3 });
  await expect(pill).toHaveText(new RegExp(`^${target} / ${FULL.pageCount} · `));
});

/**
 * Opens the sample's feature page, arms Edit text (E with a keyboard, the dock's More with a
 * finger) and opens the paragraph that starts `start` at the start of its first line. Returns
 * the paragraph editor's textbox, focused.
 */
async function openFeatureParagraph(page: Page, start: string, touch: boolean) {
  await trackEngine(page);
  await page.goto('./?sample');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await expectRendered(page);
  await page
    .locator(
      `[data-page-index="0"] [data-link="internal"][aria-label="Go to page ${FULL.featurePage}"]`,
    )
    .click();
  const feature = page.locator(`[data-page-index="${FULL.featurePage - 1}"]`);
  await expect(feature).toBeInViewport({ ratio: 0.3 });
  const slip = feature.getByTestId('text-layer');
  await expect(slip).toContainText('Choose Edit text (E), then any paragraph', { timeout: 20_000 });
  await expect(slip).not.toContainText(/double-click/i);

  if (touch) {
    await page.locator('[data-dock-item="more"]').tap();
    await page.getByRole('menuitem', { name: 'Edit text' }).tap();
  } else {
    await page.locator('[data-read-viewport]').focus();
    await page.keyboard.press('e');
  }
  await expect(page.getByRole('button', { name: 'Edit text' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // At the start of its first line, so the caret lands before its first word.
  const run = feature.locator(`[data-text-edit-layer] [data-text-run^="${start}"]`).first();
  await expect(run).toBeVisible({ timeout: 20_000 });
  const box = await run.boundingBox();
  if (!box) throw new Error('paragraph not laid out');
  if (touch) await page.touchscreen.tap(box.x + 1, box.y + box.height / 2);
  else await page.mouse.click(box.x + 1, box.y + box.height / 2);
  const editor = page.getByRole('textbox', { name: `Paragraph on page ${FULL.featurePage}` });
  await expect(editor).toBeFocused({ timeout: 20_000 });
  // Typed once the page has handled the press's lift, as a person types after it
  // (`paragraph-mirror.spec.ts`).
  await quiet(page);
  return { editor, feature };
}

test('the feature page’s try slip is true: Edit text, then a paragraph, opens it at the point', async ({
  page,
}, testInfo) => {
  // TXT-20: the slip promised a double-click, which in viewing selects a word (ADR-0029 §2.3),
  // so the reader's next letters ran as tool keys. It names the door that works.
  const start = FULL.edit.p1?.start;
  if (!start) throw new Error('no first paragraph in the manifest');
  const { editor } = await openFeatureParagraph(
    page,
    start,
    testInfo.project.use.hasTouch === true,
  );
  await page.keyboard.type('So ');
  await expect(editor).toHaveText(new RegExp(`^So ${start}`));
});

test('the feature page’s try slip is true: a sentence at the end of column 1 reflows', async ({
  page,
}, testInfo) => {
  // The slip's reflow demo (sample design §4 page 3, P4): free lines under the last paragraph
  // of column 1, so an added sentence grows into them, with no overflow line or choice. The
  // paragraphs above it are set solid and run over by design (P2), which the slips no longer
  // leave open (the phone's named no place).
  const start = FULL.edit.p4?.start;
  if (!start) throw new Error('no fourth paragraph in the manifest');
  const { editor, feature } = await openFeatureParagraph(
    page,
    start,
    testInfo.project.use.hasTouch === true,
  );
  const before = (await editor.boundingBox())?.height ?? 0;
  const sentence = ' She has not missed an evening since the box arrived in March.';
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(sentence);
  await expect(editor).toHaveText(new RegExp(`${sentence.trim()}$`));
  // It grows by a line at least, and nothing says it runs into what is below.
  await expect
    .poll(async () => (await editor.boundingBox())?.height ?? 0)
    .toBeGreaterThan(before + 8);
  await expect(
    page.locator('[data-testid="paragraph-overflow"][data-kind="overflow"]'),
  ).toHaveCount(0);
  // Leaving commits it at once: no overlap choice, the page reads the sentence.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('paragraph-choice')).toHaveCount(0);
  await expect(editor).toHaveCount(0, { timeout: 20_000 });
  await expect(feature.getByTestId('text-layer')).toContainText('since the box arrived in March', {
    timeout: 20_000,
  });
});

test('the palette’s Try the sample opens a fresh copy each time', async ({ page }) => {
  await page.goto('./');
  await sessionSettled(page);
  for (const title of ['Recto sample', 'Recto sample (2)']) {
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox', { name: 'Search commands' }).fill('sample');
    await expect(
      page.getByRole('option', { name: /Try the sample/, selected: true }),
    ).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: title, selected: true })).toBeVisible({
      timeout: 20_000,
    });
  }
  // The second copy may sit in the strip's "N more" menu on a narrow strip (01-frame F4).
  await expect
    .poll(async () =>
      (await openDocumentTitles(page)).filter((title) => /^Recto (sample|örnek belge)/.test(title)),
    )
    .toHaveLength(2);
});

test('with a restored session the sample opens as one more tab', async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./');
  await sessionSettled(page);
  test.skip(
    (await page.locator('html').getAttribute('data-session')) !== 'ready',
    'This engine keeps no session (no OPFS), so there is nothing to restore',
  );
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  await waitForSnapshot(page);

  await page.goto('./?sample=en');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  expect(await openDocumentTitles(page)).toContain('simple-text');
  await expectCleanAddress(page);
});

test.describe('offline', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Service worker + offline emulation is verified on Chromium (as in offline.spec.ts)',
  );

  test('the sample opens offline after one visit', async ({ page, context }) => {
    await page.goto('./');
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
        timeout: 30_000,
      })
      .toBe(true);
    // All four files, both cuts in both languages, are in the precache (MOB-12).
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        urls.push(...(await cache.keys()).map((request) => request.url));
      }
      return urls.filter((url) => /\/sample\/recto-sample-(phone-)?(en|tr)\.pdf/.test(url)).length;
    });
    expect(cached).toBe(SAMPLE_FILES.length);
    expect(cached).toBe(4);
    // The engine wasm is warmed into its runtime cache once the shell is offline-ready.
    await expect
      .poll(
        () =>
          page.evaluate(async () => (await (await caches.open('pdf-editor-wasm')).keys()).length),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    await context.setOffline(true);
    await page.goto('./?sample=tr');
    await expect(page.getByRole('tab', { name: 'Recto örnek belge', selected: true })).toBeVisible({
      timeout: 20_000,
    });
    await expectCleanAddress(page);
    await expectRendered(page);
    await context.setOffline(false);
  });
});
