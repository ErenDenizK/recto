/**
 * The Sheet primitive end to end (spec redesign D0-4 and D0-QA; components/07-sheets.md §1.1,
 * §2.6, §2.9, §26; quality-bar Q-2 to Q-4, Q-7):
 *
 * - **Presentation per class**: each kind at 1440 × 900 (large), 1180 × 820 (expanded),
 *   820 × 1180 on the `tablet` project (medium, coarse) and 390 × 844 with a fine pointer (a
 *   narrow desktop window: phones run the compact edition, ADR-0033), photographed.
 * - **Swipe** on the bottom sheet: up to the 92 % detent, down past half of the 40 % one or
 *   fast, closes; what was typed stays.
 * - **Focus trap** in a modal sheet, the page live under a tool sheet; **drafts** kept on Esc,
 *   per document; the scrim closes a task sheet and never answers a confirmation.
 * - **Q-7 frame sampling**: every frame of an open and of a detent change, the panel's size is
 *   constant, only its transform moves, it stays the same node, and a `ResizeObserver` on its
 *   content fires no callback beyond the first. The glass walker runs mid-motion (one backdrop
 *   root, no glass in glass) and at rest.
 * - **The ports in the app**: the shortcuts overlay (S22) on `?`, and the password prompt (S6)
 *   for an encrypted file.
 *
 * The gallery `test/harness/sheets.html` holds one sheet of each kind (no consumer of tool,
 * task or Settings sheets ships before D0-9 and D0-10); it is served by a Vite dev server this
 * spec starts, never built. Set SHEETS_SHOT_DIR to keep the photographs.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Page, test, type TestInfo } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

import { fixturePath, useFileInputPicker } from './helpers';
import { expectGlassClean, walkGlass } from './support/glass-walker';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const TABLET = 'tablet';

/** Saves a photograph to the test's output, and to SHEETS_SHOT_DIR when set. */
async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  const dir = process.env.SHEETS_SHOT_DIR;
  const path = dir ? join(dir, `${name}.png`) : info.outputPath(`${name}.png`);
  if (dir) mkdirSync(dir, { recursive: true });
  await page.screenshot({ path, animations: 'disabled', caret: 'hide' });
}

const panel = (page: Page, kind: string) => page.getByTestId(`sheet-${kind}`);

/** What the gallery recorded (`test/harness/sheets.tsx`). */
interface GalleryLog {
  readonly __sheetCloses: readonly { id: string; reason: string }[];
  readonly __confirmAnswers: readonly boolean[];
}
const closeReasons = (page: Page) =>
  page.evaluate(() => (window as unknown as GalleryLog).__sheetCloses.map((c) => c.reason));

/** Waits until nothing animates in the document. */
async function rest(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running'),
  );
}

async function open(page: Page, kind: string): Promise<void> {
  await page.getByRole('button', { name: `Open ${kind}`, exact: true }).click();
  await expect(panel(page, kind)).toBeVisible();
  await rest(page);
}

async function closeWithEscape(page: Page, kind: string): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(panel(page, kind)).toHaveCount(0);
}

interface Frame {
  readonly w: number;
  readonly h: number;
  readonly ow: number;
  readonly oh: number;
  readonly transform: string;
  readonly same: boolean;
}

/**
 * Samples `selector` every frame until a motion has run and settled (Q-7): its layout size and
 * its box, its transform, whether it is the node first seen, and how many times a
 * ResizeObserver on its `[data-testid="sheet-content"]` fired after its first callback.
 */
function sample(page: Page, selector: string): Promise<{ frames: Frame[]; resizes: number }> {
  return page.evaluate(
    (sel) =>
      new Promise<{ frames: Frame[]; resizes: number }>((resolve, reject) => {
        const frames: Frame[] = [];
        let node: HTMLElement | null = null;
        let observer: ResizeObserver | null = null;
        let resizes = -1;
        let moved = false;
        const started = performance.now();
        const step = () => {
          const el = document.querySelector<HTMLElement>(sel);
          if (el && !node) {
            node = el;
            const content = el.querySelector('[data-testid="sheet-content"]');
            observer = new ResizeObserver(() => {
              resizes += 1;
            });
            if (content) observer.observe(content);
            else resizes = 0;
          }
          if (node) {
            const box = node.getBoundingClientRect();
            const running = node.getAnimations().length > 0 || node.dataset.swiping !== undefined;
            if (running) moved = true;
            frames.push({
              w: box.width,
              h: box.height,
              ow: node.offsetWidth,
              oh: node.offsetHeight,
              transform: getComputedStyle(node).transform,
              same: document.querySelector(sel) === node,
            });
            if (moved && !running) {
              observer?.disconnect();
              resolve({ frames, resizes: Math.max(0, resizes) });
              return;
            }
          }
          if (performance.now() - started > 6000) {
            observer?.disconnect();
            reject(new Error(`no motion settled on ${sel}`));
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    selector,
  );
}

/**
 * Throws a sheet down from `handle`: a press, six moves over `ms` milliseconds covering `dy`
 * px, and a release, dispatched in the page (the window takes the moves, as for a real swipe).
 */
async function throwDown(page: Page, handle: string, dy: number, ms: number): Promise<void> {
  await page.evaluate(
    async ({ handle, dy, ms }) => {
      const el = document.querySelector(handle);
      if (!el) throw new Error(`no ${handle}`);
      const box = el.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const init = {
        bubbles: true,
        pointerId: 7,
        pointerType: 'mouse',
        isPrimary: true,
        clientX: x,
      };
      el.dispatchEvent(
        new PointerEvent('pointerdown', { ...init, clientY: y, button: 0, buttons: 1 }),
      );
      for (let i = 1; i <= 6; i++) {
        await new Promise((r) => setTimeout(r, ms / 6));
        window.dispatchEvent(
          new PointerEvent('pointermove', { ...init, clientY: y + (dy * i) / 6, buttons: 1 }),
        );
      }
      window.dispatchEvent(new PointerEvent('pointerup', { ...init, clientY: y + dy, button: 0 }));
    },
    { handle, dy, ms },
  );
}

/** Q-7 on a sample: constant layout size, a moving transform, one node, no content resize. */
function expectTransformOnly(
  result: { frames: Frame[]; resizes: number },
  options: { boxConstant: boolean },
): void {
  const { frames, resizes } = result;
  expect(frames.length).toBeGreaterThan(4);
  expect(new Set(frames.map((f) => `${f.ow}×${f.oh}`)).size).toBe(1);
  if (options.boxConstant) {
    expect(
      new Set(frames.map((f) => `${Math.round(f.w * 100)}×${Math.round(f.h * 100)}`)).size,
    ).toBe(1);
  }
  expect(new Set(frames.map((f) => f.transform)).size).toBeGreaterThan(2);
  expect(frames.every((f) => f.same)).toBe(true);
  expect(resizes).toBe(0);
}

test.describe('the gallery', () => {
  // The dev server compiles the gallery on its first visit.
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  let server: ViteDevServer | undefined;
  let url = '';

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    server = await createServer({
      root: WEB,
      configFile: `${WEB}vite.config.ts`,
      logLevel: 'error',
      server: { port: 0, strictPort: false },
    });
    await server.listen();
    url = `${server.resolvedUrls?.local[0] ?? ''}test/harness/sheets.html`;
  });

  test.afterAll(async () => {
    await server?.close();
  });

  async function gallery(page: Page): Promise<void> {
    await page.goto(url);
    await expect(page.getByRole('button', { name: 'Open tool', exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
  }

  /** Where each kind lands per class (07 §1.1), and its width; null fills the window. */
  const CLASSES = [
    {
      name: 'large',
      size: { width: 1440, height: 900 },
      expect: {
        tool: ['side', 400],
        task: ['side', 400],
        settings: ['side', 480],
        overlay: ['dialog', 760],
      },
      confirmation: 'dialog',
    },
    {
      name: 'expanded',
      size: { width: 1180, height: 820 },
      expect: {
        tool: ['side', 400],
        task: ['side', 400],
        settings: ['side', 480],
        overlay: ['dialog', 760],
      },
      confirmation: 'dialog',
    },
    {
      name: 'compact',
      size: { width: 390, height: 844 },
      expect: {
        tool: ['bottom', 390],
        task: ['bottom', 390],
        settings: ['bottom', 390],
        overlay: ['full', 390],
      },
      confirmation: 'bottom',
    },
  ] as const;

  for (const cls of CLASSES) {
    test(`presentation per kind at ${cls.size.width} × ${cls.size.height} (${cls.name})`, async ({
      page,
    }, info) => {
      test.skip(info.project.name === TABLET, 'the tablet runs its own class below');
      await page.setViewportSize(cls.size);
      await gallery(page);
      const kinds = Object.entries(cls.expect) as [string, readonly [string, number]][];
      for (const [kind, [presentation, width]] of kinds) {
        await open(page, kind);
        const sheet = panel(page, kind);
        await expect(sheet).toHaveAttribute('data-presentation', presentation);
        const box = await sheet.boundingBox();
        expect(box?.width).toBe(width);
        if (presentation === 'side') {
          expect(cls.size.width - ((box?.x ?? 0) + (box?.width ?? 0))).toBe(8);
        }
        if (kind === 'tool' && presentation === 'bottom') {
          // Opens at the 40 % detent; the page stays live above it.
          expect(Math.round(cls.size.height - (box?.y ?? 0))).toBe(
            Math.round(0.4 * cls.size.height),
          );
        }
        await expectGlassClean(page, `${kind} at ${cls.name}`);
        await shot(page, info, `sheet-${kind}-${cls.size.width}x${cls.size.height}`);
        await closeWithEscape(page, kind);
      }
      await page.getByRole('button', { name: 'Open confirmation' }).click();
      const confirmation = page.getByRole('alertdialog', { name: 'Revert to the opened version?' });
      await expect(confirmation).toHaveAttribute('data-presentation', cls.confirmation);
      await rest(page);
      await expectGlassClean(page, `confirmation at ${cls.name}`);
      await shot(page, info, `sheet-confirmation-${cls.size.width}x${cls.size.height}`);
      await page.keyboard.press('Escape');
      await expect(confirmation).toHaveCount(0);
    });
  }

  test('presentation per kind on the tablet (820 × 1180, medium, coarse)', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== TABLET, 'runs on the tablet project');
    await gallery(page);
    const want = {
      tool: ['side', 360],
      task: ['form', 640],
      settings: ['form', 640],
      // 760 at most, and the window less 64 px (07 §23.2).
      overlay: ['dialog', 820 - 64],
    } as const;
    for (const [kind, [presentation, width]] of Object.entries(want)) {
      await open(page, kind);
      const sheet = panel(page, kind);
      await expect(sheet).toHaveAttribute('data-presentation', presentation);
      expect((await sheet.boundingBox())?.width).toBe(width);
      // Coarse: 44 px controls in the header and the footer (Q-9).
      const close = sheet.getByRole('button', { name: 'Close' });
      expect((await close.boundingBox())?.height).toBe(44);
      await expectGlassClean(page, `${kind} on the tablet`);
      await shot(page, info, `sheet-${kind}-820x1180-tablet`);
      await sheet.getByRole('button', { name: 'Close' }).click();
      await expect(sheet).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Open confirmation' }).click();
    await expect(page.getByRole('alertdialog')).toHaveAttribute('data-presentation', 'dialog');
    await rest(page);
    await shot(page, info, 'sheet-confirmation-820x1180-tablet');
  });

  test.describe('on a narrow fine-pointer window (390 × 844)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    // A fine pointer: the tablet project (touch) runs its own class.
    test.skip(({ isMobile }) => isMobile, 'a fine pointer');

    test('swipe: up to 92 %, down to close; the draft stays', async ({ page }, info) => {
      await gallery(page);
      await open(page, 'tool');
      const sheet = panel(page, 'tool');
      await sheet.getByRole('textbox', { name: 'Format' }).fill('Page 3');

      // Drag the grabber up 360 px and hold still: it snaps to the 92 % detent.
      const grabber = sheet.locator('[data-sheet-handle]').first();
      const g = await grabber.boundingBox();
      if (!g) throw new Error('no grabber');
      const x = g.x + g.width / 2;
      const y = g.y + g.height / 2;
      const motion = sample(page, '[data-testid="sheet-tool"]');
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(x, y - i * 30);
      await page.waitForTimeout(120);
      await page.mouse.up();
      // Q-7 for a detent change: the drag and the spring move only the transform.
      expectTransformOnly(await motion, { boxConstant: true });
      await rest(page);
      const top = (await sheet.boundingBox())?.y ?? 0;
      expect(Math.abs(top - 844 * 0.08)).toBeLessThanOrEqual(1);
      await shot(page, info, 'sheet-tool-390x844-92');

      // A fast throw down closes it, by swipe. Sent from inside the page, so its timing is the
      // throw's and not the test driver's round trips.
      await throwDown(page, '[data-testid="sheet-tool"] [data-sheet-handle]', 360, 60);
      await expect(sheet).toHaveCount(0);
      expect((await closeReasons(page)).at(-1)).toBe('swipe');

      // What was typed is back.
      await open(page, 'tool');
      await expect(panel(page, 'tool').getByRole('textbox', { name: 'Format' })).toHaveValue(
        'Page 3',
      );
    });

    test('a slow pull below half of the 40 % detent closes; above it snaps back', async ({
      page,
    }) => {
      await gallery(page);
      await open(page, 'tool');
      const sheet = panel(page, 'tool');
      const g = await sheet.locator('[data-sheet-handle]').first().boundingBox();
      if (!g) throw new Error('no grabber');
      const x = g.x + g.width / 2;
      const y = g.y + g.height / 2;
      const before = (await sheet.boundingBox())?.y ?? 0;
      // 100 px down, held: back to the 40 % detent.
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 5; i++) await page.mouse.move(x, y + i * 20);
      await page.waitForTimeout(120);
      await page.mouse.up();
      await rest(page);
      expect(Math.abs(((await sheet.boundingBox())?.y ?? 0) - before)).toBeLessThanOrEqual(1);
      // 220 px down (over half of the 338 px showing), held: closes.
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 11; i++) await page.mouse.move(x, y + i * 20);
      await page.waitForTimeout(120);
      await page.mouse.up();
      await expect(sheet).toHaveCount(0);
    });

    test('Q-7: the bottom sheet opens by transform only, and the glass holds mid-motion', async ({
      page,
    }) => {
      await gallery(page);
      const motion = sample(page, '[data-testid="sheet-task"]');
      await page.getByRole('button', { name: 'Open task', exact: true }).click();
      await page.waitForTimeout(60);
      const mid = await walkGlass(page, { atRest: false });
      expect(mid.violations.filter((v) => v.rule === 'Q-3' || v.rule === 'Q-4')).toEqual([]);
      expectTransformOnly(await motion, { boxConstant: true });
    });
  });

  test.describe('at 1440 × 900', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.skip(({ isMobile }) => isMobile, 'desktop');

    test('Q-7: a side sheet and a centred dialog open by transform only', async ({ page }) => {
      await gallery(page);
      let motion = sample(page, '[data-testid="sheet-task"]');
      await page.getByRole('button', { name: 'Open task', exact: true }).click();
      await page.waitForTimeout(40);
      const mid = await walkGlass(page, { atRest: false });
      expect(mid.violations.filter((v) => v.rule === 'Q-3' || v.rule === 'Q-4')).toEqual([]);
      expectTransformOnly(await motion, { boxConstant: true });
      await closeWithEscape(page, 'task');

      // The centred dialog scales from 0.96: its layout size holds, its box follows the scale.
      motion = sample(page, '[data-testid="sheet-overlay"]');
      await page.getByRole('button', { name: 'Open overlay', exact: true }).click();
      expectTransformOnly(await motion, { boxConstant: false });
      await closeWithEscape(page, 'overlay');
    });

    test('focus: trapped in a modal sheet, back to the opener on close', async ({ page }) => {
      await gallery(page);
      const opener = page.getByRole('button', { name: 'Open task', exact: true });
      await opener.click();
      const sheet = panel(page, 'task');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('textbox', { name: 'Format' })).toBeFocused();
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        // At the wrap Tab lands on the trap's focus guard, which hands focus back inside a
        // moment later (Base UI queues that focus), so the check waits for it to settle.
        await expect
          .poll(() => sheet.evaluate((el) => el.contains(document.activeElement)))
          .toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
    });

    test('a tool sheet keeps the page live: no scrim, no trap, a press outside leaves it open', async ({
      page,
    }) => {
      await gallery(page);
      await open(page, 'tool');
      await expect(page.locator('[class*="scrim"]')).toHaveCount(0);
      await page.getByRole('button', { name: /^Document:/ }).click();
      await expect(panel(page, 'tool')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Document: agreement' })).toBeVisible();
    });

    test('drafts are kept on Esc, ✕ and the scrim, per document', async ({ page }) => {
      await gallery(page);
      await open(page, 'task');
      const field = () => panel(page, 'task').getByRole('textbox', { name: 'Format' });
      await field().fill('Page 9 of 12');
      await closeWithEscape(page, 'task');
      await open(page, 'task');
      await expect(field()).toHaveValue('Page 9 of 12');
      await panel(page, 'task').getByRole('button', { name: 'Close' }).click();
      await expect(panel(page, 'task')).toHaveCount(0);
      await open(page, 'task');
      await expect(field()).toHaveValue('Page 9 of 12');
      // The scrim closes a task sheet (and keeps the draft).
      await page.mouse.click(200, 450);
      await expect(panel(page, 'task')).toHaveCount(0);
      expect(await closeReasons(page)).toEqual(['escape', 'close', 'scrim']);

      // Another document has its own draft; the first keeps its own.
      await page.getByRole('button', { name: 'Document: report' }).click();
      await open(page, 'task');
      await expect(field()).toHaveValue('Page 1 of N');
      await closeWithEscape(page, 'task');
      await page.getByRole('button', { name: 'Document: agreement' }).click();
      await open(page, 'task');
      await expect(field()).toHaveValue('Page 9 of 12');
    });

    test('a confirmation ignores the scrim and focuses its undoable action', async ({ page }) => {
      await gallery(page);
      await page.getByRole('button', { name: 'Open confirmation' }).click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog.getByRole('button', { name: 'Revert' })).toBeFocused();
      await rest(page);
      await page.mouse.click(40, 450);
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Revert' }).click();
      await expect(dialog).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as GalleryLog).__confirmAnswers)).toEqual(
        [true],
      );
    });

    test('the result page replaces the body and Done closes', async ({ page }, info) => {
      await gallery(page);
      await open(page, 'task');
      await panel(page, 'task').getByRole('button', { name: 'Save copy' }).click();
      await expect(page.getByTestId('sheet-result')).toContainText('Saved a copy');
      await shot(page, info, 'sheet-result-1440x900');
      await panel(page, 'task').getByRole('button', { name: 'Done' }).click();
      await expect(panel(page, 'task')).toHaveCount(0);
    });
  });
});

test.describe('the ports in the app', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === TABLET, 'desktop');
    await useFileInputPicker(page);
  });

  test('the shortcuts overlay on ?: centred 760, typing filters, the search kept on Esc', async ({
    page,
  }, info) => {
    await page.goto('./?lang=en');
    await expect(page.getByRole('button', { name: /^Open files/ }).first()).toBeVisible();
    await page.locator('body').press('?');
    const overlay = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('data-presentation', 'dialog');
    await rest(page);
    expect((await overlay.boundingBox())?.width).toBe(760);
    await expectGlassClean(page, 'the shortcuts overlay');
    await shot(page, info, 'app-shortcuts-1440x900');
    const search = overlay.getByRole('searchbox', { name: 'Find a shortcut' });
    await expect(search).toBeFocused();
    await search.fill('zoom');
    await expect(overlay.getByRole('rowheader').first()).toContainText(/zoom/i);
    await shot(page, info, 'app-shortcuts-filtered-1440x900');
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    await page.locator('body').press('?');
    await expect(page.getByRole('searchbox', { name: 'Find a shortcut' })).toHaveValue('zoom');
  });

  test('the password prompt: a wrong password in place, then the file opens', async ({
    page,
  }, info) => {
    await page.goto('./?lang=en');
    const chooser = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /^Open files/ })
      .first()
      .click();
    await (await chooser).setFiles(fixturePath('encrypted-aes-128.pdf'));
    const prompt = page.getByRole('alertdialog', { name: 'Password required' });
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveAttribute('data-presentation', 'dialog');
    const field = prompt.getByLabel('Password', { exact: true });
    await expect(field).toBeFocused();
    await rest(page);
    await expectGlassClean(page, 'the password prompt');
    await shot(page, info, 'app-password-1440x900');
    await field.fill('wrong');
    await field.press('Enter');
    await expect(prompt.getByText('That password did not open the file. Try again.')).toBeVisible();
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
    await rest(page);
    await shot(page, info, 'app-password-wrong-1440x900');
    await field.fill('user');
    await field.press('Enter');
    await expect(prompt).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'encrypted-aes-128' })).toBeVisible();
  });
});
