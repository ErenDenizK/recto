/**
 * GPU glass on the phone reader (GLS-7, GLS-12…GLS-15; `src/glass-gpu/`), on the `phone` and
 * `phone-land` projects. A software renderer is never eligible, so every other spec runs CSS+;
 * here `window.__rectoGpuGlass = 'force'` (test builds only) turns GPU glass on under
 * SwiftShader. Checked: the shared canvas draws only at the pieces (a screenshot with and
 * without it differs nowhere else), the DOM pieces keep their hit areas, nothing is drawn at
 * rest, a scroll redraws, a lost context falls back to CSS+ for the session, and without the
 * force the canvas never appears.
 */
import { expect, type Page, test } from '@playwright/test';

import { decodePng } from './support/pixels';

interface Stats {
  readonly state: string;
  readonly reason: string;
  readonly draws: number;
  readonly uploads: number;
  readonly pieces: number;
}

const stats = (page: Page) =>
  page.evaluate(() => {
    const s = (window as { __gpuGlass?: Stats }).__gpuGlass;
    return s
      ? { state: s.state, reason: s.reason, draws: s.draws, uploads: s.uploads, pieces: s.pieces }
      : null;
  });

async function forceGpu(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as { __rectoGpuGlass?: string }).__rectoGpuGlass = 'force';
  });
}

async function openSample(page: Page, query = ''): Promise<void> {
  await page.goto(`./?sample${query}&lang=en`);
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

/** Every finite animation has finished and GPU glass has drawn and gone still. */
async function glassSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== 'running' ||
            !Number.isFinite(Number(a.effect?.getComputedTiming().endTime)),
        ),
    undefined,
    { timeout: 10_000 },
  );
  await expect.poll(async () => (await stats(page))?.draws ?? 0).toBeGreaterThan(0);
  // Still: the draw count holds over a few frames.
  await expect
    .poll(async () => {
      const before = (await stats(page))?.draws;
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 150))),
          ),
      );
      return (await stats(page))?.draws === before;
    })
    .toBe(true);
}

/** The pieces on screen, CSS px boxes. */
const pieceBoxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-gpu-glass]')]
      .filter((el) => Number(getComputedStyle(el).opacity) > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          shape: el.dataset.gpuGlass,
          gpu: el.classList.contains('gpu-glass'),
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        };
      }),
  );

for (const variant of ['capsule', 'split'] as const) {
  test.describe(`GPU glass, ${variant} top`, () => {
    test.beforeEach(async ({ page }) => {
      await forceGpu(page);
      await openSample(page, `&top=${variant}`);
      await glassSettled(page);
    });

    test('draws only at the pieces, which keep their hit areas; nothing at rest', async ({
      page,
    }) => {
      const s = await stats(page);
      expect(s?.state).toBe('on');
      expect(s?.reason).toBe('');
      const boxes = await pieceBoxes(page);
      // The capsule, ✎ and the top (one capsule, or ‹ ⋯ and the edge).
      expect(boxes.length).toBe(variant === 'split' ? 5 : 3);
      expect(boxes.every((box) => box.gpu)).toBe(true);
      expect(s?.pieces).toBe(boxes.length);

      const canvas = page.getByTestId('gpu-glass-canvas');
      await expect(canvas).toHaveCSS('pointer-events', 'none');
      await expect(canvas).toHaveCSS('position', 'fixed');

      // Each control is still what a tap at its centre hits.
      for (const id of [
        'compact-capsule',
        'compact-edit',
        variant === 'split' ? 'compact-back' : 'compact-top-bar',
      ]) {
        const hit = await page.getByTestId(id).evaluate((el) => {
          const r = el.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return at !== null && el.contains(at);
        });
        expect(hit, id).toBe(true);
      }

      // The canvas's pixels lie inside the pieces: with it hidden, nothing else changes.
      const view = page.viewportSize() ?? { width: 390, height: 844 };
      const withGlass = decodePng(await page.screenshot({ scale: 'css' }));
      await page.getByTestId('gpu-glass-canvas').evaluate((el) => {
        el.style.opacity = '0';
      });
      const without = decodePng(await page.screenshot({ scale: 'css' }));
      const inPiece = (x: number, y: number) =>
        boxes.some(
          (b) =>
            x >= b.left - 2 &&
            x <= b.left + b.width + 2 &&
            y >= b.top - 2 &&
            y <= b.top + b.height + 2,
        );
      let inside = 0;
      let outside = 0;
      for (let y = 0; y < view.height; y++) {
        for (let x = 0; x < view.width; x++) {
          const i = (y * withGlass.width + x) * 4;
          const diff =
            Math.abs((withGlass.data[i] ?? 0) - (without.data[i] ?? 0)) +
            Math.abs((withGlass.data[i + 1] ?? 0) - (without.data[i + 1] ?? 0)) +
            Math.abs((withGlass.data[i + 2] ?? 0) - (without.data[i + 2] ?? 0));
          if (diff <= 12) continue;
          if (inPiece(x, y)) inside++;
          else outside++;
        }
      }
      expect(inside).toBeGreaterThan(500);
      expect(outside).toBe(0);
      await page.getByTestId('gpu-glass-canvas').evaluate((el) => {
        el.style.opacity = '';
      });

      // At rest: no draw over a second.
      const before = (await stats(page))?.draws ?? 0;
      await page.waitForTimeout(1000);
      expect((await stats(page))?.draws).toBe(before);

      // A scroll redraws under the moving pages.
      await page.getByTestId('compact-pages').evaluate(async (el) => {
        for (let i = 0; i < 6; i++) {
          el.scrollTop += 20;
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      });
      await expect.poll(async () => (await stats(page))?.draws ?? 0).toBeGreaterThan(before);
    });

    test('falls back to CSS+ for the session on a lost context', async ({ page }) => {
      await page.evaluate(() =>
        (window as { __gpuGlass?: { loseContext(): void } }).__gpuGlass?.loseContext(),
      );
      await expect.poll(async () => (await stats(page))?.state).toBe('failed');
      expect((await stats(page))?.reason).toBe('context lost');
      await expect(page.getByTestId('gpu-glass-canvas')).toHaveCount(0);
      await expect(page.locator('.gpu-glass')).toHaveCount(0);
      // The capsule has its own CSS glass back.
      const filter = await page
        .getByTestId('compact-capsule')
        .evaluate((el) => getComputedStyle(el).backdropFilter);
      expect(filter).toContain('blur(');
    });
  });
}

test('a software renderer gets CSS+ without the test force', async ({ page }) => {
  await openSample(page, '&top=split');
  await page.waitForTimeout(3500);
  await expect(page.getByTestId('gpu-glass-canvas')).toHaveCount(0);
  await expect(page.locator('.gpu-glass')).toHaveCount(0);
});

test('editing hands the capsule back to CSS+', async ({ page }) => {
  await forceGpu(page);
  await openSample(page, '&top=split');
  await glassSettled(page);
  await expect(page.getByTestId('compact-capsule')).toHaveClass(/gpu-glass/);
  await page.getByTestId('compact-edit').click();
  await expect(page.getByTestId('compact-capsule')).toHaveAttribute('data-editing', 'true');
  await expect(page.locator('.gpu-glass')).toHaveCount(0);
  expect((await stats(page))?.state).toBe('paused');
});
