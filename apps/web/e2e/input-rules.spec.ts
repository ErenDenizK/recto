/**
 * Protection without a mode (flows §3.1–§3.5, 05-canvas §6; spec D1-5): the stress test S1–S18
 * against the owner's M8 wish, "a pen or a stray click never edits page text by accident", in
 * both lock defaults: documents open unlocked (the default, owner question 1) and with "Open
 * documents locked" on, where every row equals the locked column and nothing reaches the file.
 *
 * "Nothing changed" is read from the Undo button's description, which names the step Undo would
 * take back (every change, engine edits included, is one history step): it still names the
 * opening of the file. The locked column ends with every attempt at once and a saved copy whose
 * pages (size, rotation, annotations, decoded content) equal a copy saved before them. The
 * router's state is on the annotation layer (`data-input`: viewing, markup-select, locked, …).
 *
 * Rows whose behaviour another D1 package builds are `fixme` with the package named: the
 * selection bar's H U S C X, E then Enter, the page menu's "Add … here", the pending-marks bar
 * and the Rotated toast (D1-6). Touch rows (S11–S13) use the DevTools protocol's touch input,
 * so they run in Chromium only.
 */
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib';
import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test';

import {
  openFixtures,
  saveCopyBytes,
  useDownloadPath,
  useFileInputPicker,
  showSidebar,
} from './helpers';

const FOX = 'The quick brown fox jumps over the lazy dog';
const EDITOR = /^(Line text|Paragraph on page 1)$/;

const layer = (page: Page) => page.locator('[data-annotation-layer="0"]');
const editor = (page: Page) => page.getByRole('textbox', { name: EDITOR });
const undo = (page: Page) => page.getByTestId('undo-button');
const selectionText = (page: Page) =>
  page.evaluate(() => window.getSelection()?.toString().trim() ?? '');

/** What Undo would undo, as the button describes it ("Undo …", "Nothing to undo"). */
const undoDescription = (page: Page) =>
  undo(page).evaluate(
    (el) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? '',
  );

/** The history as each test found it once its file was open. */
const baselines = new WeakMap<Page, string>();

/** Opens `name`, waits for its first page, and notes the history it starts with. */
async function openDoc(page: Page, name: string): Promise<void> {
  await openFixtures(page, [name]);
  await rendered(page);
  baselines.set(page, await undoDescription(page));
}

/** Nothing reached the document: Undo still undoes only the opening. */
async function nothingChanged(page: Page): Promise<void> {
  const base = baselines.get(page);
  if (base === undefined) throw new Error('no baseline: open the file with openDoc');
  await expect.poll(() => undoDescription(page)).toBe(base);
}

async function rendered(page: Page): Promise<void> {
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
}

/** Opens text-edit-fonts.pdf; the point on "fox" of its first line. */
async function openFox(page: Page): Promise<{ x: number; y: number; box: DOMRectLike }> {
  await openDoc(page, 'text-edit-fonts.pdf');
  const line = page
    .locator('[data-page-index="0"] [data-testid="text-layer"] span', { hasText: FOX })
    .first();
  await expect(line).toBeAttached({ timeout: 20_000 });
  const box = await line.boundingBox();
  if (!box) throw new Error('line not laid out');
  return { x: box.x + box.width * 0.4, y: box.y + box.height / 2, box };
}

interface DOMRectLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Synthetic pen events (Playwright has no pen in every engine): `taps` presses at (x, y), or a
 * stroke from `from` to `to`. Returns whether any press had its default prevented (a page layer
 * took it as ink).
 */
async function pen(
  page: Page,
  action:
    | { readonly kind: 'stroke'; readonly from: number; readonly to: number; readonly y: number }
    | { readonly kind: 'taps'; readonly x: number; readonly y: number; readonly count: number },
): Promise<boolean> {
  return page.evaluate(async (a) => {
    const make = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerType: 'pen',
        pointerId: 7,
        isPrimary: true,
        clientX: x,
        clientY: y,
        pressure: 0.5,
        button: 0,
        buttons: 1,
        ...init,
      });
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const under = (x: number, y: number) => document.elementFromPoint(x, y) ?? document.body;
    let prevented = false;
    const down = (x: number, y: number) => {
      const event = make('pointerdown', x, y);
      under(x, y).dispatchEvent(event);
      prevented ||= event.defaultPrevented;
    };
    const up = (x: number, y: number) =>
      window.dispatchEvent(make('pointerup', x, y, { buttons: 0, pressure: 0 }));
    if (a.kind === 'stroke') {
      const x0 = a.from;
      under(x0, a.y).dispatchEvent(make('pointermove', x0, a.y, { buttons: 0, pressure: 0 }));
      await pause(200);
      down(x0, a.y);
      for (let i = 1; i <= 12; i++) {
        window.dispatchEvent(make('pointermove', x0 + ((a.to - x0) * i) / 12, a.y));
        await pause(10);
      }
      up(a.to, a.y);
    } else {
      under(a.x, a.y).dispatchEvent(make('pointermove', a.x, a.y, { buttons: 0, pressure: 0 }));
      await pause(200);
      for (let i = 0; i < a.count; i++) {
        down(a.x, a.y);
        up(a.x, a.y);
      }
      if (a.count === 2) {
        under(a.x, a.y).dispatchEvent(
          new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            clientX: a.x,
            clientY: a.y,
            detail: 2,
          }),
        );
      }
    }
    return prevented;
  }, action);
}

/** A real pen drag through the DevTools protocol (Chromium): native selection runs. */
async function cdpPenDrag(
  cdp: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const send = (
    type: 'mousePressed' | 'mouseMoved' | 'mouseReleased',
    x: number,
    y: number,
    buttons: number,
  ) =>
    cdp.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      buttons,
      clickCount: 1,
      pointerType: 'pen',
      force: 0.5,
    });
  await send('mousePressed', from.x, from.y, 1);
  for (let i = 1; i <= 8; i++) {
    await send(
      'mouseMoved',
      from.x + ((to.x - from.x) * i) / 8,
      from.y + ((to.y - from.y) * i) / 8,
      1,
    );
  }
  await send('mouseReleased', to.x, to.y, 0);
}

/** Touch through the DevTools protocol (Chromium); `points` per step. */
async function touch(
  cdp: CDPSession,
  steps: readonly (readonly { x: number; y: number }[])[],
): Promise<void> {
  const [first, ...rest] = steps;
  if (!first) return;
  const points = (list: readonly { x: number; y: number }[]) =>
    list.map((p, id) => ({ x: p.x, y: p.y, id }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(first) });
  for (const step of rest) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(step) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/**
 * What a saved copy holds, page by page: size, rotation, annotations and the decoded content
 * streams. Save a copy stamps its own dates and ids into the metadata and recompresses, so
 * two copies of an unchanged document differ in bytes but never in these.
 */
async function pdfFacts(bytes: Buffer): Promise<unknown[]> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const decode = (object: unknown): string => {
    if (object instanceof PDFArray)
      return object
        .asArray()
        .map((o) => decode(pdf.context.lookup(o)))
        .join('\n');
    if (object instanceof PDFRawStream)
      return new TextDecoder('latin1').decode(decodePDFRawStream(object).decode());
    return '';
  };
  return pdf.getPages().map((p) => ({
    size: p.getSize(),
    rotation: p.getRotation().angle,
    annotations: p.node.Annots()?.size() ?? 0,
    content: decode(p.node.lookup(PDFName.of('Contents'))),
  }));
}

/** The navigator on its Pages tab (it may be open already: a second press would close it). */
/** The sidebar (closed by default, 06-navigation N1) on its thumbnails. */
async function showPages(page: Page): Promise<void> {
  await showSidebar(page, 'Pages', 'Thumbnails');
}

async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not laid out');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Opens Markup with `2` (the interim control's key) and waits for the router to see it. */
async function openMarkup(page: Page, locked: boolean): Promise<void> {
  await page.keyboard.press('2');
  await expect(layer(page)).toHaveAttribute('data-input', locked ? 'locked' : 'markup-select');
}

for (const locked of [false, true]) {
  const column = locked ? 'locked' : 'unlocked';

  test.describe(`input rules, documents open ${column} (flows §3.5)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((openLocked) => {
        localStorage.setItem(
          'pdf-editor:input-policy:v1',
          JSON.stringify({ openDocumentsLocked: openLocked }),
        );
      }, locked);
      await useFileInputPicker(page);
      await useDownloadPath(page);
      await page.goto('./?lang=en');
      await expect(page.getByTestId('app-shell')).toBeVisible();
    });

    test(`S1 a pen tip on the page while reading selects text and never marks (${column})`, async ({
      page,
      browserName,
    }) => {
      const at = await openFox(page);
      await expect(layer(page)).toHaveAttribute('data-input', locked ? 'locked' : 'viewing');
      // Every engine: the pen's presses reach the text, never a page layer as ink.
      const prevented = await pen(page, {
        kind: 'stroke',
        from: at.box.x + 4,
        to: at.box.x + at.box.width - 4,
        y: at.y,
      });
      expect(prevented).toBe(false);
      await page.waitForTimeout(300);
      await expect(layer(page).locator('[data-annotation-kind="ink"]')).toHaveCount(0);
      await expect(layer(page)).toHaveAttribute('data-input', locked ? 'locked' : 'viewing');
      // A real pen drags a selection, as a mouse does (DevTools protocol: Chromium only).
      if (browserName === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        await cdpPenDrag(cdp, { x: at.box.x + 2, y: at.y }, { x: at.x, y: at.y });
        await expect.poll(() => selectionText(page)).not.toBe('');
      }
      await nothingChanged(page);
    });

    test(`the first pen touch in viewing ${locked ? 'shows no hint when locked' : 'shows the pen hint once'}`, async ({
      page,
    }) => {
      // A device with a touch screen (M-24: a desktop drawing tablet never sees the hint).
      await page.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5 });
      });
      await page.reload();
      await expect(page.getByTestId('app-shell')).toBeVisible();
      const at = await openFox(page);
      await pen(page, { kind: 'taps', x: at.x, y: at.y, count: 1 });
      const hint = page.getByTestId('pen-hint');
      if (locked) {
        await page.waitForTimeout(300);
        await expect(hint).toHaveCount(0);
        return;
      }
      await expect(hint).toContainText('Writing? Tap Markup');
      await expect(hint.getByRole('button', { name: 'Settings' })).toBeVisible();
      // The pen still acted as a mouse: nothing opened, nothing changed.
      await expect(layer(page)).toHaveAttribute('data-input', 'viewing');
      await nothingChanged(page);
      // Once per device: the input policy remembers it.
      const stored = await page.evaluate(
        () => JSON.parse(localStorage.getItem('pdf-editor:input-policy:v1') ?? '{}') as unknown,
      );
      expect(stored).toMatchObject({ penHintShown: true });
      // It leaves when Markup opens.
      await openMarkup(page, false);
      await expect(hint).toHaveCount(0);
    });

    test(`S2 a stray click on body text changes nothing (${column})`, async ({ page }) => {
      const at = await openFox(page);
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(400);
      await expect(editor(page)).toHaveCount(0);
      expect(await selectionText(page)).toBe('');
      await expect(layer(page)).toHaveAttribute('data-input', locked ? 'locked' : 'viewing');
      await nothingChanged(page);
    });

    test(`S3 a double-click on a word selects it, never the editor (${column})`, async ({
      page,
    }) => {
      const at = await openFox(page);
      await page.mouse.dblclick(at.x, at.y);
      await expect.poll(() => selectionText(page)).toBe('fox');
      await page.waitForTimeout(400);
      await expect(editor(page)).toHaveCount(0);
      // No hover outline in viewing or locked (05-canvas §9).
      await page.mouse.move(at.x + 20, at.y);
      await page.waitForTimeout(600);
      await expect(page.getByTestId('text-hover-outline')).toHaveCount(0);
      await nothingChanged(page);
    });

    test(`S4 a pen double tap on text inside Markup ${locked ? 'draws nothing when locked' : 'draws, never the editor'}`, async ({
      page,
    }) => {
      const at = await openFox(page);
      await openMarkup(page, locked);
      // The pen hovers first (a pen is seen, so "Pen draws in Markup" turns on), then taps
      // twice on the word.
      await pen(page, { kind: 'taps', x: at.x, y: at.y, count: 2 });
      await page.waitForTimeout(400);
      await expect(editor(page)).toHaveCount(0);
      expect(await selectionText(page)).toBe('');
      if (locked) {
        await expect(layer(page).locator('[data-annotation-kind="ink"]')).toHaveCount(0);
        await nothingChanged(page);
        return;
      }
      await expect(layer(page).locator('[data-annotation-kind="ink"]')).not.toHaveCount(0, {
        timeout: 20_000,
      });
      await expect(layer(page)).toHaveAttribute('data-tool', 'select');
    });

    test(`S5 a mouse drag across text selects and changes nothing (${column})`, async ({
      page,
    }) => {
      const at = await openFox(page);
      await page.mouse.move(at.box.x + 2, at.y);
      await page.mouse.down();
      await page.mouse.move(at.x, at.y, { steps: 6 });
      await page.mouse.up();
      await expect.poll(() => selectionText(page)).not.toBe('');
      await expect(editor(page)).toHaveCount(0);
      await nothingChanged(page);
    });

    test(`S6 a click on a text field ${locked ? 'focuses it with the notice, nothing fills' : 'focuses it; Esc restores the value'}`, async ({
      page,
    }) => {
      await openDoc(page, 'forms-a.pdf');
      const target = page.locator('[data-form-layer="0"] [data-field-name="name"]');
      await expect(target).toBeVisible({ timeout: 20_000 });
      await target.click();
      const field = page.locator('[data-form-editor="name"]');
      if (locked) {
        await expect(target).toBeFocused();
        await expect(field).toHaveCount(0);
        await expect(page.locator('[data-form-layer="0"] [role="status"]')).toBeVisible();
        await page.keyboard.type('Mallory');
        await nothingChanged(page);
        return;
      }
      await expect(field).toBeFocused();
      await expect(field).toHaveValue('Alice Example');
      await field.pressSequentially(' Jr');
      await expect(field).toHaveValue('Alice Example Jr');
      await field.press('Escape');
      await expect(field).toHaveCount(0);
      await nothingChanged(page);
      await target.click();
      await expect(page.locator('[data-form-editor="name"]')).toHaveValue('Alice Example');
    });

    test(`S7 a click on a checkbox ${locked ? 'does not toggle' : 'toggles, one undo step'}`, async ({
      page,
    }) => {
      await openDoc(page, 'forms-a.pdf');
      const agree = page.locator('[data-form-layer="0"] [data-field-name="agree"]');
      await expect(agree).toBeVisible({ timeout: 20_000 });
      const before = (await agree.getAttribute('aria-checked')) ?? '';
      await agree.click();
      if (locked) {
        await expect(agree).toHaveAttribute('aria-checked', before);
        await expect(page.locator('[data-form-layer="0"] [role="status"]')).toBeVisible();
        await nothingChanged(page);
        return;
      }
      await expect(agree).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
      await expect.poll(() => undoDescription(page)).not.toBe(baselines.get(page));
      await undo(page).click();
      await expect(agree).toHaveAttribute('aria-checked', before);
      await nothingChanged(page);
    });

    test(`S8 right-click → Delete page ${locked ? 'is dimmed' : 'deletes, with Undo'}`, async ({
      page,
    }) => {
      await openDoc(page, 'simple-text.pdf');
      const first = page.locator('[data-page-index="0"]');
      await expect(first.locator('canvas[data-state="rendered"]')).toBeAttached({
        timeout: 20_000,
      });
      const pages = await page.locator('[data-read-viewport] [data-page-id]').count();
      const box = await first.boundingBox();
      if (!box) throw new Error('page 1 not laid out');
      await page.mouse.click(box.x + 40, box.y + 40, { button: 'right' });
      const menu = page.getByTestId('page-context-menu');
      const remove = menu.getByRole('menuitem', { name: 'Delete page 1' });
      await expect(remove).toBeVisible();
      if (locked) {
        await expect(remove).toHaveAttribute('aria-disabled', 'true');
        await remove.click({ force: true });
        await page.keyboard.press('Escape');
        await expect(page.locator('[data-read-viewport] [data-page-id]')).toHaveCount(pages);
        await nothingChanged(page);
        return;
      }
      await remove.click();
      await expect(page.locator('[data-read-viewport] [data-page-id]')).toHaveCount(pages - 1);
      const toast = page.getByRole('group', { name: 'Deleted page 1' });
      await expect(toast).toBeVisible();
      await toast.getByRole('button', { name: 'Undo' }).click();
      await expect(page.locator('[data-read-viewport] [data-page-id]')).toHaveCount(pages);
    });

    test(`S9 a tool key with no selection ${locked ? 'arms nothing' : 'opens Markup and arms, changing nothing'}`, async ({
      page,
    }) => {
      await openDoc(page, 'simple-text.pdf');
      await page.keyboard.press('r');
      if (locked) {
        await expect(layer(page)).toHaveAttribute('data-tool', 'select');
        await expect(layer(page)).toHaveAttribute('data-input', 'locked');
      } else {
        await expect(layer(page)).toHaveAttribute('data-tool', 'rectangle');
        await expect(layer(page)).toHaveAttribute('data-input', 'markup-draw');
      }
      await expect(layer(page).locator('[data-annotation-id]')).toHaveCount(0);
      await nothingChanged(page);
    });

    test(`S9 H on a text selection ${locked ? 'marks nothing' : 'highlights it, one undo step'}`, async ({
      page,
    }) => {
      test.fixme(!locked, 'D1-6 builds H U S C X on a selection in viewing (one undo step)');
      const at = await openFox(page);
      await page.mouse.dblclick(at.x, at.y);
      await expect.poll(() => selectionText(page)).toBe('fox');
      await page.keyboard.press('h');
      if (locked) {
        await page.waitForTimeout(400);
        await expect(layer(page).locator('[data-annotation-id]')).toHaveCount(0);
        await expect(layer(page)).toHaveAttribute('data-input', 'locked');
        await nothingChanged(page);
        return;
      }
      await expect(layer(page).locator('[data-annotation-kind="highlight"]')).toHaveCount(1);
      await expect(layer(page)).toHaveAttribute('data-input', 'viewing');
    });

    test(`S10 Delete after a navigating click on a thumbnail deletes nothing (${column})`, async ({
      page,
    }) => {
      await openDoc(page, 'simple-text.pdf');
      const count = await page.locator('[data-read-viewport] [data-page-id]').count();
      await showPages(page);
      const thumbnails = page.getByRole('listbox', { name: 'Pages of simple-text' });
      await expect(thumbnails).toBeVisible();
      await thumbnails.getByRole('option').last().click();
      await page.keyboard.press('Delete');
      await page.waitForTimeout(300);
      await expect(page.locator('[data-read-viewport] [data-page-id]')).toHaveCount(count);
      await nothingChanged(page);
    });

    test.describe('touch (DevTools protocol)', () => {
      test.use({ hasTouch: true });
      test.skip(
        ({ browserName }) => browserName !== 'chromium',
        'touch input needs the DevTools protocol',
      );

      test(`S11 a finger on the page scrolls and changes nothing (${column})`, async ({ page }) => {
        await openDoc(page, 'many-pages.pdf');
        const viewport = page.locator('[data-read-viewport]');
        const box = await viewport.boundingBox();
        if (!box) throw new Error('no viewport');
        const before = await viewport.evaluate((el) => el.scrollTop);
        const cdp = await page.context().newCDPSession(page);
        const x = box.x + box.width / 2;
        const y0 = box.y + box.height * 0.7;
        await touch(
          cdp,
          Array.from({ length: 8 }, (_, i) => [{ x, y: y0 - i * 30 }]),
        );
        await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
        await expect(layer(page).locator('[data-annotation-id]')).toHaveCount(0);
        await nothingChanged(page);
      });

      test(`S12 a two-finger tap while reading undoes nothing (${column})`, async ({ page }) => {
        await openDoc(page, 'forms-a.pdf');
        const agree = page.locator('[data-form-layer="0"] [data-field-name="agree"]');
        await expect(agree).toBeVisible({ timeout: 20_000 });
        const before = (await agree.getAttribute('aria-checked')) ?? '';
        await agree.click();
        const after = locked ? before : before === 'true' ? 'false' : 'true';
        await expect(agree).toHaveAttribute('aria-checked', after);
        const page1 = await centreOf(page.locator('[data-page-index="0"]'));
        const cdp = await page.context().newCDPSession(page);
        await touch(cdp, [
          [
            { x: page1.x - 40, y: page1.y + 120 },
            { x: page1.x + 40, y: page1.y + 120 },
          ],
        ]);
        await page.waitForTimeout(400);
        await expect(agree).toHaveAttribute('aria-checked', after);
        if (locked) await nothingChanged(page);
        else await expect.poll(() => undoDescription(page)).not.toBe(baselines.get(page));
      });

      test(`S13 a touch drag on the sidebar reorders nothing (${column})`, async ({ page }) => {
        await openDoc(page, 'many-pages.pdf');
        await showPages(page);
        const thumbnails = page.getByRole('listbox', { name: 'Pages of many-pages' });
        await expect(thumbnails).toBeVisible();
        const order = () =>
          page
            .locator('[data-read-viewport] [data-page-id]')
            .evaluateAll((els) => els.map((el) => el.getAttribute('data-page-id')));
        const before = await order();
        const start = await centreOf(thumbnails.getByRole('option').first());
        const cdp = await page.context().newCDPSession(page);
        await touch(
          cdp,
          Array.from({ length: 8 }, (_, i) => [{ x: start.x, y: start.y + i * 30 }]),
        );
        await page.waitForTimeout(400);
        expect(await order()).toEqual(before);
        await nothingChanged(page);
      });
    });

    test(`S14 a drag that starts on an unselected annotation moves nothing (${column})`, async ({
      page,
    }) => {
      await openDoc(page, 'annotations.pdf');
      const square = page.locator('[data-annotation-id="fixture-annot-square-1"]');
      await expect(square).toBeAttached({ timeout: 20_000 });
      const before = await square.boundingBox();
      if (!before) throw new Error('no square');
      const drag = async () => {
        await page.mouse.move(before.x + 4, before.y + 4);
        await page.mouse.down();
        await page.mouse.move(before.x + 64, before.y + 44, { steps: 6 });
        await page.mouse.up();
      };
      await drag();
      await page.waitForTimeout(300);
      expect(await square.boundingBox()).toEqual(before);
      await nothingChanged(page);
      if (locked) {
        await expect(page.getByTestId('annotation-bar')).toHaveCount(0);
        return;
      }
      // The first press selected it; a drag now moves it, one undo step.
      await expect(page.getByTestId('annotation-bar')).toBeVisible();
      await drag();
      await expect
        .poll(() => undoDescription(page), { timeout: 20_000 })
        .not.toBe(baselines.get(page));
    });

    test(`S15 E and more letters over a selection leave page text as it was (${column})`, async ({
      page,
    }) => {
      test.fixme(!locked, 'D1-6 builds E then Enter: E outlines, the next letters cancel and arm');
      const at = await openFox(page);
      const lines = page.locator('[data-page-index="0"] [data-testid="text-layer"] span', {
        hasText: FOX,
      });
      const count = await lines.count();
      await page.mouse.dblclick(at.x, at.y);
      await expect.poll(() => selectionText(page)).toBe('fox');
      await page.keyboard.type('every');
      await page.waitForTimeout(400);
      await expect(editor(page)).toHaveCount(0);
      await expect(lines).toHaveCount(count);
      if (locked) await expect(layer(page)).toHaveAttribute('data-input', 'locked');
      await nothingChanged(page);
    });

    test(`S16 redaction marks ${locked ? 'cannot be made when locked' : 'keep the pending-marks bar'}`, async ({
      page,
    }) => {
      test.fixme(!locked, 'D1-6 builds the pending-marks bar (S16)');
      const at = await openFox(page);
      await page.mouse.dblclick(at.x, at.y);
      await expect.poll(() => selectionText(page)).toBe('fox');
      await page.keyboard.press('x');
      await page.waitForTimeout(400);
      if (locked) {
        await expect(layer(page)).toHaveAttribute('data-input', 'locked');
        await nothingChanged(page);
        return;
      }
      await expect(page.getByTestId('pending-marks-bar')).toBeVisible();
    });

    test(`S17 page menu → "Add note here" ${locked ? 'is dimmed' : 'adds a note, one undo step'}`, async ({
      page,
    }) => {
      test.fixme(true, 'D1-6 builds the page menu\'s "Add … here" group (S17)');
      await openDoc(page, 'simple-text.pdf');
      const box = await page.locator('[data-page-index="0"]').boundingBox();
      if (!box) throw new Error('page 1 not laid out');
      await page.mouse.click(box.x + 60, box.y + 60, { button: 'right' });
      const item = page
        .getByTestId('page-context-menu')
        .getByRole('menuitem', { name: /^Add note here/ });
      if (locked) {
        await expect(item).toHaveAttribute('aria-disabled', 'true');
        await nothingChanged(page);
        return;
      }
      await item.click();
      await expect(layer(page).locator('[data-annotation-kind="text"]')).toHaveCount(1);
    });

    test(`S18 Shift+R while reading ${locked ? 'rotates nothing' : 'rotates the current page, with Undo'}`, async ({
      page,
    }) => {
      await openDoc(page, 'simple-text.pdf');
      const first = page.locator('[data-page-index="0"]');
      const before = await first.boundingBox();
      await page.locator('[data-read-viewport]').focus();
      await page.keyboard.press('Shift+R');
      await page.waitForTimeout(400);
      if (locked) {
        expect(await first.boundingBox()).toEqual(before);
        await nothingChanged(page);
        return;
      }
      await expect(page.getByRole('group', { name: /^Rotated page 1/ })).toBeVisible();
    });

    if (locked) {
      test('locked: every attempt above leaves the saved document as it was', async ({ page }) => {
        test.slow();
        const at = await openFox(page);
        const before = await saveCopyBytes(page);
        // A click, a double-click, a drag, a pen stroke, a tool key with a drag, H and X on a
        // selection, Delete, Shift+R and the page menu's Delete.
        await page.mouse.click(at.x, at.y);
        await page.mouse.dblclick(at.x, at.y);
        await page.keyboard.press('h');
        await page.keyboard.press('x');
        await page.keyboard.press('Delete');
        await page.keyboard.press('Shift+R');
        await pen(page, { kind: 'stroke', from: at.box.x, to: at.box.x + at.box.width, y: at.y });
        await page.keyboard.press('r');
        await page.mouse.move(at.x, at.y + 40);
        await page.mouse.down();
        await page.mouse.move(at.x + 80, at.y + 90, { steps: 4 });
        await page.mouse.up();
        await openMarkup(page, true);
        await pen(page, { kind: 'stroke', from: at.box.x, to: at.box.x + at.box.width, y: at.y });
        await page.keyboard.press('Escape');
        const box = await page.locator('[data-page-index="0"]').boundingBox();
        if (!box) throw new Error('page 1 not laid out');
        await page.mouse.click(box.x + 40, box.y + 40, { button: 'right' });
        await page
          .getByTestId('page-context-menu')
          .getByRole('menuitem', { name: 'Delete page 1' })
          .click({ force: true });
        await page.keyboard.press('Escape');
        await nothingChanged(page);
        const after = await saveCopyBytes(page);
        expect(await pdfFacts(after)).toEqual(await pdfFacts(before));
      });
    }
  });
}

test('a press on a link that travels past the slop selects text and does not follow (05.7)', async ({
  page,
}) => {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await openDoc(page, 'outline-named-dests.pdf');
  await page.keyboard.press(']');
  const link = page.getByRole('button', { name: 'Go to page 4' });
  await expect(link).toBeVisible({ timeout: 20_000 });
  const box = await link.boundingBox();
  if (!box) throw new Error('no link');
  const pageNumber = page.getByTestId('page-pill');
  const shown = await pageNumber.textContent();
  await page.mouse.move(box.x + 3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => selectionText(page)).not.toBe('');
  await page.waitForTimeout(300);
  await expect(pageNumber).toHaveText(shown ?? '');
  // The press is over: the hotspots take the pointer again (`LinkLayer`'s `data-selecting`
  // goes with the press), so the link is what a click at its middle hits. On CI WebKit the
  // click below did not follow; these say which half failed if it happens again.
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await expect(page.locator('[data-testid="link-layer"][data-selecting]')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label') ?? null,
        centre,
      ),
    )
    .toBe('Go to page 4');
  // A click within the slop follows it.
  await page.mouse.click(centre.x, centre.y);
  await expect(pageNumber).toHaveText(/^4 \/ 6 · /);
});
