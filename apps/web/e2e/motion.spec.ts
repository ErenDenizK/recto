/**
 * Motion is calm, interruptible and idle at rest (quality-bar.md Q-10, Q-2; spec redesign
 * D0-12 and D0-QA, §8 A-23, §9.1 "At rest: zero animation frames in a document view").
 *
 * - **Idle.** Two seconds with no input after the app has settled: no requestAnimationFrame
 *   callback runs and `document.getAnimations()` is empty, on Home and an open document in the
 *   full edition (1440 × 900) and on the compact reader (the `phone` project). The counter is a
 *   wrapper installed before the app loads, so every loop is seen, the motion core's included;
 *   a frame requested in the window records its caller, so a failure names the loop. A text
 *   caret's blink is the browser's own painting, neither a frame callback nor an animation,
 *   and so is never counted.
 * - **Interruptible.** The D0 catalogue animations that exist now, each interrupted mid-way: a
 *   side sheet closed while it opens and reopened while it closes, a centred dialog closed
 *   while it scales in, a toast dismissed while it enters, and the History scrubber (a CSS
 *   transition) closed while it opens. Each turns from where it was (the frame after the
 *   interrupt is no jump) and settles where it was last sent, with no inline transform or
 *   `will-change` left (Q-2) and nothing stuck on screen. A bottom sheet's detent change
 *   grabbed mid-flight needs a tool sheet, which only the sheet gallery has before D2, so it
 *   is in `sheets.spec.ts` ("Q-10: a detent change grabbed mid-flight …").
 *
 * The motion core's own `retarget()` is proved frame by frame in `src/motion/animate.test.ts`;
 * here it is proved through what uses it. A-7 to A-10 (pauses, flashes, reduced motion per
 * token, transition limits) join this spec with the motion tokens of D3-4.
 */
import { expect, type Page, test } from '@playwright/test';

import { fixturePath, openFixtures, sessionSettled, useFileInputPicker } from './helpers';
import { expectGlassClean, settleAnimations } from './support/glass-walker';

const COMPACT = new Set(['phone', 'phone-land']);
/** The measured window of A-23: two seconds with no input. */
const IDLE_MS = 2_000;

/**
 * Before the app loads: wraps `requestAnimationFrame` so each callback that runs is counted,
 * and the caller of each request made while counting is kept (the first lines of its stack).
 */
async function countFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = { counting: false, ran: 0, callers: [] as string[] };
    (window as unknown as { __frames: typeof probe }).__frames = probe;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      if (probe.counting && probe.callers.length < 8) {
        probe.callers.push(
          (new Error().stack ?? '')
            .split('\n')
            .slice(2, 6)
            .map((line) => line.trim())
            .join(' < '),
        );
      }
      return raf((time) => {
        if (probe.counting) probe.ran += 1;
        callback(time);
      });
    };
  });
}

interface IdleReport {
  readonly frames: number;
  readonly animations: readonly string[];
  readonly callers: readonly string[];
}

/**
 * Waits for the page to settle (fonts, finite animations, one quiet frame), then counts frame
 * callbacks for `IDLE_MS` with no input and lists what animates at the end.
 */
async function idleFor(page: Page): Promise<IdleReport> {
  await page.evaluate(() => document.fonts.ready);
  await settleAnimations(page);
  // The counter is live: a frame requested now is counted (so a 0 below means something).
  const live = await page.evaluate(async () => {
    const probe = (window as unknown as { __frames: { counting: boolean; ran: number } }).__frames;
    probe.counting = true;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    probe.counting = false;
    return probe.ran;
  });
  expect(live, 'the frame counter sees a requested frame').toBeGreaterThanOrEqual(2);
  await page.evaluate(() => {
    const probe = (
      window as unknown as { __frames: { counting: boolean; ran: number; callers: string[] } }
    ).__frames;
    probe.ran = 0;
    probe.callers = [];
    probe.counting = true;
  });
  // The measurement itself: A-23's two seconds of no input.
  await page.waitForTimeout(IDLE_MS);
  return page.evaluate(() => {
    const probe = (
      window as unknown as {
        __frames: { counting: boolean; ran: number; callers: string[] };
      }
    ).__frames;
    probe.counting = false;
    return {
      frames: probe.ran,
      callers: probe.callers,
      animations: document.getAnimations().map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        const name = a instanceof CSSAnimation ? a.animationName : a.constructor.name;
        return `${name} on ${target?.tagName.toLowerCase() ?? '?'}.${[...(target?.classList ?? [])].join('.')}`;
      }),
    };
  });
}

function expectIdle(report: IdleReport, state: string): void {
  expect(report.callers, `frames requested at rest in ${state}`).toEqual([]);
  expect(report.frames, `frame callbacks in ${IDLE_MS} ms of idle in ${state}`).toBe(0);
  expect(report.animations, `animations at rest in ${state}`).toEqual([]);
}

test.describe('idle: no frames at rest (A-23, Q-10)', () => {
  test.describe('the full edition at 1440 × 900', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ page }, info) => {
      test.skip(COMPACT.has(info.project.name), 'the compact reader is measured below');
      await useFileInputPicker(page);
      await countFrames(page);
    });

    test('Home', async ({ page }) => {
      await page.goto('./?lang=en');
      await sessionSettled(page);
      await expect(page.getByRole('button', { name: /^Open files/ }).first()).toBeVisible();
      await page.mouse.move(2, 450);
      expectIdle(await idleFor(page), 'Home');
    });

    test('an open document', async ({ page }) => {
      await page.goto('./?lang=en');
      await sessionSettled(page);
      await openFixtures(page, ['simple-text.pdf']);
      await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
        timeout: 20_000,
      });
      await page.mouse.move(2, 450);
      expectIdle(await idleFor(page), 'an open document');
    });
  });

  test('the compact reader', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'runs on the phone project');
    await useFileInputPicker(page);
    await countFrames(page);
    await page.goto('./?lang=en');
    await expect(page.getByTestId('compact-library')).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /^(Open PDF|PDF aç)$/ }).click();
    await (await chooser).setFiles(fixturePath('simple-text.pdf'));
    await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
      'data-state',
      'rendered',
    );
    expectIdle(await idleFor(page), 'the compact reader');
  });
});

// ---------------------------------------------------------------------------
// Interruptible
// ---------------------------------------------------------------------------

/** What interrupts a motion, done in the page at the chosen frame. */
type Interrupt =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'click'; readonly selector: string }
  | { readonly kind: 'contextmenu'; readonly selector: string };

interface Look {
  readonly transform: string;
  readonly opacity: number;
}

interface Midway {
  /** How far the running animation was when it was interrupted, 0–1. */
  readonly progress: number;
  /** The target as it looked the frame it was interrupted, and a frame later. */
  readonly before: Look;
  readonly after: Look | null;
}

/**
 * Arms an interrupt in the page: once `target` (a selector) is moving, at least `minMs` into
 * one of its own animations and short of 85 % of it, `interrupt` happens in that same frame.
 * Call it, then start the motion, then await what it returns: the progress it caught and how
 * the target looked then and a frame after (a retarget turns from there, never jumps).
 */
function interruptMidway(
  page: Page,
  target: string,
  interrupt: Interrupt,
  minMs = 30,
): Promise<Midway> {
  return page.evaluate(
    ({ target, interrupt, minMs }) =>
      new Promise<Midway>((resolve, reject) => {
        const look = (el: Element): Look => {
          const style = getComputedStyle(el);
          return { transform: style.transform, opacity: Number(style.opacity) };
        };
        const frame = () => new Promise((r) => requestAnimationFrame(r));
        const started = performance.now();
        const step = async () => {
          const el = document.querySelector(target);
          const running = el
            ?.getAnimations()
            .find((a) => a.playState === 'running' && Number(a.currentTime ?? 0) >= minMs);
          const progress = running?.effect?.getComputedTiming().progress ?? null;
          if (el && running && progress !== null && progress < 0.85) {
            const before = look(el);
            if (interrupt.kind === 'key') {
              const at = document.activeElement ?? document.body;
              const init = { key: interrupt.key, bubbles: true, cancelable: true };
              at.dispatchEvent(new KeyboardEvent('keydown', init));
              at.dispatchEvent(new KeyboardEvent('keyup', init));
            } else {
              const button = document.querySelector<HTMLElement>(interrupt.selector);
              if (!button) {
                reject(new Error(`no ${interrupt.selector} to interrupt with`));
                return;
              }
              if (interrupt.kind === 'click') button.click();
              else {
                const box = button.getBoundingClientRect();
                button.dispatchEvent(
                  new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    button: 2,
                    clientX: box.left + box.width / 2,
                    clientY: box.top + box.height / 2,
                  }),
                );
              }
            }
            await frame();
            resolve({ progress, before, after: el.isConnected ? look(el) : null });
            return;
          }
          if (performance.now() - started > 8_000) {
            reject(new Error(`${target} never moved mid-way`));
            return;
          }
          requestAnimationFrame(() => void step());
        };
        void step();
      }),
    { target, interrupt, minMs },
  );
}

/** The translation and scale of a computed transform (`none` is 0, 0 and 1). */
function parts(transform: string): { x: number; y: number; scale: number } {
  const m = /^matrix\(([^)]+)\)$/.exec(transform);
  if (!m?.[1]) return { x: 0, y: 0, scale: 1 };
  const [a = 1, , , , x = 0, y = 0] = m[1].split(',').map(Number);
  return { x, y, scale: a };
}

/**
 * Nothing left behind once everything has settled (Q-2, Q-10): no animation in the document,
 * no `will-change` written inline anywhere, nothing in an ending or starting style.
 */
async function expectSettledClean(page: Page, state: string): Promise<void> {
  await settleAnimations(page);
  const left = await page.evaluate(() => ({
    animations: document.getAnimations().length,
    willChange: [...document.querySelectorAll<HTMLElement>('[style]')]
      .filter((el) => el.style.willChange !== '' && el.style.willChange !== 'auto')
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`),
    transitional: document.querySelectorAll('[data-ending-style], [data-starting-style]').length,
  }));
  expect(left, `left behind after ${state}`).toEqual({
    animations: 0,
    willChange: [],
    transitional: 0,
  });
}

/** A resting element: no inline transform or `will-change` and full opacity (Q-2). */
async function expectAtRest(page: Page, selector: string, state: string): Promise<void> {
  const look = await page.locator(selector).evaluate((el: HTMLElement) => ({
    inlineTransform: el.style.transform,
    inlineWillChange: el.style.willChange,
    willChange: getComputedStyle(el).willChange,
    opacity: getComputedStyle(el).opacity,
  }));
  expect(look, `${selector} at rest after ${state}`).toEqual({
    inlineTransform: '',
    inlineWillChange: '',
    willChange: 'auto',
    opacity: '1',
  });
}

test.describe('interruptible: every D0 animation turns from where it is (Q-10, Q-2)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }, info) => {
    test.skip(COMPACT.has(info.project.name), 'the full edition');
    await useFileInputPicker(page);
  });

  async function openDocument(page: Page): Promise<void> {
    await page.goto('./?lang=en');
    await sessionSettled(page);
    await openFixtures(page, ['simple-text.pdf']);
    await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
      timeout: 20_000,
    });
    await page.mouse.move(2, 450);
  }

  test('a side sheet closed while it opens, and reopened while it closes', async ({ page }) => {
    await openDocument(page);
    const panel = '[data-testid="save-copy-sheet"]';
    const opener = page.getByRole('button', { name: 'Save a copy', exact: true });

    // Esc mid-entrance: the exit starts where the entrance was, and the sheet goes.
    const closing = interruptMidway(page, panel, { kind: 'key', key: 'Escape' });
    await opener.click();
    const close = await closing;
    expect(close.progress).toBeGreaterThan(0);
    if (close.after) {
      // 24 px of travel (language.md §7.3 *dialog* side): it turns, it does not jump.
      const moved = parts(close.after.transform).x - parts(close.before.transform).x;
      expect(Math.abs(moved)).toBeLessThan(12);
      expect(close.after.opacity).toBeLessThanOrEqual(close.before.opacity + 0.05);
    }
    await expect(page.locator(panel)).toHaveCount(0);
    await expectSettledClean(page, 'a sheet closed mid-entrance');
    await expect(opener).toBeFocused();

    // Open to rest, Esc, and the opener again mid-exit: the sheet turns back and rests open.
    await opener.click();
    await expect(page.locator(panel)).toBeVisible();
    await settleAnimations(page);
    const reopening = interruptMidway(page, panel, {
      kind: 'click',
      selector: '[aria-label="Save a copy"]',
    });
    await page.keyboard.press('Escape');
    const reopen = await reopening;
    expect(reopen.progress).toBeGreaterThan(0);
    expect(reopen.after).not.toBeNull();
    await settleAnimations(page);
    await expect(page.locator(panel)).toBeVisible();
    await expectAtRest(page, panel, 'a sheet reopened mid-exit');
    await expectSettledClean(page, 'a sheet reopened mid-exit');
    await expectGlassClean(page, 'a sheet reopened mid-exit');
    await page.keyboard.press('Escape');
    await expect(page.locator(panel)).toHaveCount(0);
  });

  test('a centred dialog closed while it scales in', async ({ page }) => {
    await page.goto('./?lang=en');
    await sessionSettled(page);
    await expect(page.getByRole('button', { name: /^Open files/ }).first()).toBeVisible();
    const overlay = '[role="dialog"][data-presentation="dialog"]';
    const closing = interruptMidway(page, overlay, { kind: 'key', key: 'Escape' });
    await page.locator('body').press('?');
    const close = await closing;
    expect(close.progress).toBeGreaterThan(0);
    if (close.after) {
      // From 0.96 (§7.3 *dialog* centre): the exit leaves from the scale it had reached.
      const scaled = parts(close.after.transform).scale - parts(close.before.transform).scale;
      expect(Math.abs(scaled)).toBeLessThan(0.02);
    }
    await expect(page.locator(overlay)).toHaveCount(0);
    await expectSettledClean(page, 'the shortcuts overlay closed mid-entrance');
    // And it still opens to rest afterwards.
    await page.locator('body').press('?');
    await expect(page.locator(overlay)).toBeVisible();
    await settleAnimations(page);
    await expectAtRest(page, overlay, 'the shortcuts overlay reopened');
    await expectGlassClean(page, 'the shortcuts overlay reopened');
  });

  test('a toast dismissed while it enters', async ({ page }) => {
    await openDocument(page);
    await page.keyboard.press('3');
    const cells = page.locator('[role="gridcell"][data-page-id]');
    await expect(cells).toHaveCount(3);
    await cells.nth(1).click();
    await settleAnimations(page);
    const toast = '[data-region="toasts"] [data-toast-id]';
    const dismissing = interruptMidway(page, toast, {
      kind: 'click',
      selector: `${toast} button[aria-label="Dismiss"]`,
    });
    await page.keyboard.press('Delete');
    const dismissed = await dismissing;
    expect(dismissed.progress).toBeGreaterThan(0);
    // The fade out starts from the opacity the entrance had reached, never from 1.
    if (dismissed.after) {
      expect(dismissed.after.opacity).toBeLessThanOrEqual(dismissed.before.opacity + 0.05);
    }
    await expect(page.locator(toast)).toHaveCount(0);
    await expectSettledClean(page, 'a toast dismissed mid-entrance');
    // The page stays deleted: dismissing is not Undo.
    await expect(cells).toHaveCount(2);
  });

  test('toasts never meet while they enter, replace one another and leave', async ({ page }) => {
    // XD-3: a toast entering under another touched it within 30 ms, a replaced toast slid
    // over the newcomer, and a fading one left an empty dark pill; a neighbour leaving tweened
    // the other's width. Every frame of the sequence below is checked in the page.
    test.setTimeout(60_000);
    await openDocument(page);
    await page.evaluate(() => {
      const seen = { problems: [] as string[], most: 0, frames: 0, on: true };
      (window as unknown as { __stack: typeof seen }).__stack = seen;
      const widths = new Map<string, { width: number; text: string }>();
      const note = (problem: string) => {
        if (seen.problems.length < 12) seen.problems.push(problem);
      };
      const frame = () => {
        if (!seen.on) return;
        seen.frames += 1;
        const toasts = [
          ...document.querySelectorAll<HTMLElement>('[data-region="toasts"] [data-toast-id]'),
        ];
        const painted = toasts.filter(
          (el) =>
            Number(getComputedStyle(el).opacity) > 0.01 &&
            getComputedStyle(el).visibility !== 'hidden',
        );
        seen.most = Math.max(seen.most, painted.length);
        for (const [i, a] of painted.entries()) {
          const style = getComputedStyle(a);
          const name = a.getAttribute('aria-label') ?? '';
          // No glass at a few per cent: it draws darker than the page, an empty pill.
          if (Number(style.opacity) < 0.049 && style.backdropFilter !== 'none') {
            note(`"${name}" fades out with its backdrop filter`);
          }
          const p = a.getBoundingClientRect();
          for (const b of painted.slice(i + 1)) {
            const q = b.getBoundingClientRect();
            const v = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
            const h = Math.min(p.right, q.right) - Math.max(p.left, q.left);
            if (v > 0.5 && h > 0.5) {
              note(`"${name}" meets "${b.getAttribute('aria-label')}" by ${v.toFixed(1)} px`);
            }
          }
        }
        // Q-10: a width changes only with the toast's own text, and then it snaps.
        for (const el of toasts) {
          const id = el.dataset.toastId ?? '';
          const width = el.getBoundingClientRect().width;
          const text = el.getAttribute('aria-label') ?? '';
          const was = widths.get(id);
          if (was?.text === text && was && Math.abs(was.width - width) > 0.5) {
            note(`"${text}" changed width ${was.width.toFixed(1)} → ${width.toFixed(1)}`);
          }
          widths.set(id, { width, text });
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const region = page.getByRole('region', { name: 'Notifications' });
    const openDamaged = async () => {
      const chooser = page.waitForEvent('filechooser');
      await page
        .getByRole('button', { name: /^Open files/ })
        .first()
        .click();
      await (await chooser).setFiles({
        name: 'scan.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(`%PDF-1.7\n${'damaged '.repeat(64)}\n%%EOF\n`),
      });
    };
    // A failure toast, then two Undo toasts entering under it (enter, with the stack re-flowing).
    await openDamaged();
    await expect(region.getByRole('group')).toHaveCount(1);
    await page.keyboard.press('3');
    const cells = page.locator('[role="gridcell"][data-page-id]');
    await expect(cells).toHaveCount(3);
    await cells.nth(1).click();
    await page.mouse.move(2, 450);
    await page.keyboard.press('Delete');
    await expect(region.getByRole('group')).toHaveCount(2);
    await page.waitForTimeout(150);
    await cells.nth(0).click();
    await page.mouse.move(2, 450);
    await page.keyboard.press('Delete');
    await expect(region.getByRole('group')).toHaveCount(3);
    await settleAnimations(page);
    // A fourth evicts the oldest timed toast while it comes in (replace).
    await openDamaged();
    await expect(region.getByRole('group', { name: /^Deleted page 1/ })).toBeVisible();
    await settleAnimations(page);
    await expect(region.getByRole('group')).toHaveCount(3);
    // The middle one leaves; the one above closes up after it (leave).
    await region
      .getByRole('group', { name: /^Deleted page 1/ })
      .getByRole('button', { name: 'Dismiss' })
      .click();
    await expect(region.getByRole('group')).toHaveCount(2);
    await settleAnimations(page);
    const seen = await page.evaluate(() => {
      const stack = (window as unknown as { __stack: { on: boolean } }).__stack;
      stack.on = false;
      return stack as unknown as { problems: string[]; most: number; frames: number };
    });
    expect(seen.frames, 'frames watched').toBeGreaterThan(30);
    expect(seen.most, 'toasts on screen together').toBeGreaterThanOrEqual(3);
    expect(seen.problems).toEqual([]);
    await expectSettledClean(page, 'the toast stack');
  });

  test('the History scrubber closed while it opens', async ({ page }) => {
    await openDocument(page);
    await page.keyboard.press('r');
    const undo = page.getByTestId('undo-button');
    await expect(undo).not.toHaveAttribute('aria-disabled');
    const scrubber = '[data-testid="history-scrubber"]';

    // ✕ mid-entrance: the *popup* transition (scale 0.96 → 1 and a fade) reverses from where
    // it is, so the next frame is no further open and no less scaled than it was.
    const closing = interruptMidway(
      page,
      scrubber,
      { kind: 'click', selector: `${scrubber} button[aria-label="Close"]` },
      10,
    );
    await undo.click({ button: 'right' });
    const close = await closing;
    expect(close.progress).toBeGreaterThan(0);
    if (close.after) {
      expect(close.after.opacity).toBeLessThanOrEqual(close.before.opacity + 0.05);
      expect(parts(close.after.transform).scale).toBeLessThanOrEqual(
        parts(close.before.transform).scale + 0.005,
      );
    }
    await expect(page.locator(scrubber)).toHaveCount(0);
    await expectSettledClean(page, 'the scrubber closed by ✕ mid-entrance');

    // Esc mid-entrance: a dismissal closes a popover at once (`data-instant`, ui/Popover), so
    // it is gone in a frame, with nothing left behind.
    const dismissing = interruptMidway(page, scrubber, { kind: 'key', key: 'Escape' }, 10);
    await undo.click({ button: 'right' });
    expect((await dismissing).progress).toBeGreaterThan(0);
    await expect(page.locator(scrubber)).toHaveCount(0);
    await expectSettledClean(page, 'the scrubber dismissed mid-entrance');

    // Opened again, it rests crisp.
    await undo.click({ button: 'right' });
    await expect(page.locator(scrubber)).toBeVisible();
    await settleAnimations(page);
    await expectAtRest(page, scrubber, 'the scrubber reopened');
    await expectGlassClean(page, 'the scrubber reopened');
    await page.keyboard.press('Escape');
    await expect(page.locator(scrubber)).toHaveCount(0);
  });
});
