/**
 * The materials' start states and cost ladder (docs/specs/redesign.md D3-3, X36; ADR-0024
 * §2.4, §2.5; ADR-0028 §2.1; language.md §2.8), against the build Playwright serves.
 *
 * - **Without the render override** (the one spec that runs without it): a software
 *   rasteriser starts at Glass Tinted, any other at Clear, and `hardwareConcurrency ≤ 4` starts
 *   the cost ladder at step 2; eight cores start it at 0. The expected Glass comes from the
 *   page's own WebGL renderer string, so the assertion holds on a GPU machine as on CI's
 *   software one.
 * - **A throttled run** (Chromium: CDP's CPU throttle): while the page is scrolled, more than a
 *   quarter of the frames in 2 s take over 20 ms, so the ladder steps, and holds the step once
 *   the input stops.
 * - **The settings the root carries**: Tinted lays the tint at 0.90 and keeps the blur; Solid
 *   paints the solid token with no filter; the person's choice wins over the start state.
 */
import { expect, type Page, test } from '@playwright/test';

import { fixturePath, useFileInputPicker } from './helpers';
import { emulateCores, useRenderOverride, withoutRenderOverride } from './support/render-override';

/** language.md §2.8, G-32 (`state/render-quality.ts`, kept in step by hand). */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|basic render driver/i;

/** The page's WebGL renderer, as the app's start-state probe reads it. */
const rendererOf = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return String(
      info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
  });

async function openManyPages(page: Page): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
    .first()
    .click();
  await (await chooser).setFiles(fixturePath('many-pages.pdf'));
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 30_000,
  });
}

test.describe('start states, without the render override (X36)', () => {
  test('a software rasteriser starts at Tinted, four cores at ladder step 2', async ({ page }) => {
    await withoutRenderOverride(page);
    await emulateCores(page, 4);
    await page.goto('./?lang=en');
    await expect(page.getByTestId('app-shell')).toBeVisible();
    const renderer = await rendererOf(page);
    const expected = SOFTWARE_RENDERER.test(renderer) ? 'tinted' : 'clear';
    test.info().annotations.push({ type: 'renderer', description: `${renderer} → ${expected}` });
    await expect(page.locator('html')).toHaveAttribute('data-glass', expected);
    await expect(page.locator('html')).toHaveAttribute('data-degrade', '2');
    // The Settings row shows the start state as the setting in force, with nothing stored.
    expect(
      await page.evaluate(() => localStorage.getItem('pdf-editor:appearance:v1') ?? 'null'),
    ).not.toContain('"glass":"');
  });

  test('eight cores start the ladder at 0, and a picked Glass wins over the start state', async ({
    page,
  }) => {
    await withoutRenderOverride(page);
    await emulateCores(page, 8);
    await page.addInitScript(() => {
      localStorage.setItem('pdf-editor:appearance:v1', JSON.stringify({ glass: 'clear' }));
    });
    await page.goto('./?lang=en');
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'clear');
    await expect(page.locator('html')).not.toHaveAttribute('data-degrade', /.*/);
  });

  test('with the override, Clear and no ladder step whatever the device', async ({ page }) => {
    await useRenderOverride(page);
    await emulateCores(page, 2);
    await page.goto('./?lang=en');
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'clear');
    await expect(page.locator('html')).not.toHaveAttribute('data-degrade', /.*/);
  });
});

test.describe('the cost ladder (language.md §2.8, ADR-0024 §2.5)', () => {
  test('steps down in a throttled run while the page scrolls, and holds the step', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'CPU throttling is a Chromium DevTools protocol call');
    test.setTimeout(120_000);
    await useRenderOverride(page, { degrade: 'auto', glass: 'clear', light: 'auto' });
    await emulateCores(page, 8);
    await openManyPages(page);
    await expect(page.locator('html')).not.toHaveAttribute('data-degrade', /.*/);
    await page.mouse.move(700, 450);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    try {
      // Scroll until a step is taken: one wheel a frame's worth apart, for at most 20 s.
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        await page.mouse.wheel(0, 120);
        const step = await page.locator('html').getAttribute('data-degrade');
        if (step !== null) break;
      }
    } finally {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    const step = Number(await page.locator('html').getAttribute('data-degrade'));
    expect(step, 'the ladder took a step').toBeGreaterThanOrEqual(1);
    // Held for the session: at rest, unthrottled, the step stays.
    await page.waitForTimeout(1_000);
    expect(Number(await page.locator('html').getAttribute('data-degrade'))).toBeGreaterThanOrEqual(
      step,
    );
  });
});

test.describe('the Glass setting on the root (language.md §2.8, A-17)', () => {
  const styleOf = (page: Page, selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          background: style.backgroundColor,
          filter:
            style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter') || 'none',
        };
      });

  for (const glass of ['tinted', 'solid'] as const) {
    test(`Glass ${glass} on the capsule and the top strip`, async ({ page }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('pdf-editor:appearance:v1', JSON.stringify({ glass: value }));
      }, glass);
      await openManyPages(page);
      await expect(page.locator('html')).toHaveAttribute('data-glass', glass);
      const capsule = await styleOf(page, '[data-capsule]');
      // The strip is two floating pieces of the capsule's material (owner feedback F1).
      const strip = await styleOf(page, '[data-testid="app-shell"] > header [data-top-piece]');
      if (glass === 'tinted') {
        expect(capsule.background).toMatch(/, 0\.9\)$/);
        expect(capsule.filter).toMatch(/^blur\(9px\)/);
        expect(strip.background).toMatch(/, 0\.9\)$/);
        expect(strip.filter).toMatch(/^blur\(9px\)/);
      } else {
        expect(capsule.background).toMatch(/^rgb\(/);
        expect(capsule.filter).toBe('none');
        expect(strip.background).toBe(capsule.background);
        expect(strip.filter).toBe('none');
      }
      // No lens anywhere but an M1 chip (language.md §2.7, X20).
      const lensed = await page.evaluate(() =>
        [...document.querySelectorAll('.lens')].map((el) => el.className),
      );
      for (const name of lensed) expect(name).toMatch(/\bmat-chip\b/);
    });
  }
});
