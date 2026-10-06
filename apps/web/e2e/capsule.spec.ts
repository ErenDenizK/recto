/**
 * The capsule's morph on rendered pixels (quality-bar Q-6; spec X1, D2-2; `03-markup.md` MK-1;
 * language.md §7.3 *bar morph*), in every engine CI runs and on the tablet.
 *
 * The owner saw the prototype's bottom menu break mid-animation: its glass was clipped by
 * `clip-path` while its shadow was a second element stretched by `scaleX`, so the ends squashed
 * and the rim vanished mid-shape. Here the dock becomes the Markup palette (and Locked) through
 * the one element's own width and height; each test pauses every animation at 25, 50 and 75 %
 * of that morph and reads the screen:
 *
 * - **The node stays the same**, and the capsule is `contain: layout style`.
 * - **The edge is a resting pill's.** Around both end caps and along the top and bottom edges,
 *   1–3 px outside the curve, the frame equals a still capsule given the same width and height,
 *   within ±4/255: the rim, its dark 1 px edge and the shadow are drawn at the pill's own
 *   geometry, never squashed or popped. (The pixel 1 px out is the rim's own `--rim-edge`
 *   ring, so it is compared with the still pill, not with the bare page.)
 * - **Outside, the page.** Above the pill, beyond the shadow's reach (8 px), the frame equals
 *   the unblurred page within ±4/255: no glass leaks past the curve.
 * - **Inside is blurred.** Over a page of fine stripes, a run of pixels across the capsule has
 *   lost the stripes (its spread under a tenth of the bare page's) and is darkened glass.
 * - **The shadow is present along the whole edge**: below the bottom edge and the lower arcs,
 *   the frame is darker than the page.
 *
 * The contents are hidden for the pixel reads (they are not glass and are not what is tested);
 * hiding them changes nothing the backdrop filter samples.
 *
 * Also: the layout a morph costs stays in the capsule (the page, the dock's anchor and the strip
 * keep their boxes), a reversal mid-morph turns from the width drawn, and under reduced motion
 * the change is a cross-fade of opacity only, within 150 ms.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import { expect, type Page, test, type TestInfo } from '@playwright/test';

import { useFileInputPicker } from './helpers';
import { decodePng, type Image } from './support/pixels';

test.use({
  viewport: async ({ viewport }, use, info) => {
    await use(info.project.name === 'tablet' ? viewport : { width: 1440, height: 900 });
  },
});

/**
 * A page of fine dark stripes (1.5 pt every 6 pt), what a blur visibly smooths; twice a Letter
 * page's height, so at fit width it lies under the dock on the desktop and the tablet alike.
 */
async function stripesPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([612, 1584]);
  for (let y = 0; y < 1584; y += 6) {
    sheet.drawRectangle({ x: 0, y, width: 612, height: 1.5, color: rgb(0.1, 0.1, 0.1) });
  }
  return pdf.save();
}

async function openStripes(page: Page, info: TestInfo): Promise<void> {
  const file = info.outputPath('stripes.pdf');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await stripesPdf());
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
    .first()
    .click();
  await (await chooser).setFiles(file);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 30_000,
  });
  await expect(page.locator('[data-capsule="dock"]')).toBeVisible();
  // Nothing hovered: the pointer rests over the page, away from the capsule.
  await page.mouse.move(300, 300);
  await settled(page);
}

/** Waits until nothing animates (the capsule's morph, the page's first render fades). */
async function settled(page: Page): Promise<void> {
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
}

/** The viewport as drawn, animations left where they are. */
async function frame(page: Page): Promise<Image> {
  return decodePng(await page.screenshot({ animations: 'allow', caret: 'hide', scale: 'css' }));
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Pauses every animation at `fraction` of the capsule's size morph, which must have started
 * (polled for a few frames); returns the capsule's drawn box then.
 */
async function pauseMorphAt(page: Page, fraction: number): Promise<Box> {
  const box = await page.evaluate(async (f) => {
    const capsule = document.querySelector<HTMLElement>('[data-capsule]');
    if (!capsule) return null;
    const isSize = (a: Animation) => {
      const effect = a.effect as KeyframeEffect | null;
      if (effect?.target !== capsule) return false;
      const first = effect.getKeyframes()[0] ?? {};
      return 'width' in first || 'height' in first;
    };
    for (let i = 0; i < 30 && !document.getAnimations().some(isSize); i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const all = document.getAnimations();
    const sizes = all.filter(isSize);
    if (sizes.length === 0) return null;
    const endOf = (a: Animation) => Number(a.effect?.getComputedTiming().endTime ?? 0);
    const at = f * Math.max(...sizes.map(endOf));
    for (const a of all) {
      if (!Number.isFinite(endOf(a))) continue;
      a.pause();
      a.currentTime = Math.min(endOf(a), at);
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const r = capsule.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, fraction);
  if (!box) throw new Error('the capsule did not morph');
  return box;
}

/** Hides or shows the capsule's contents (not glass), or the capsule itself. */
async function hide(page: Page, what: 'contents' | 'capsule' | 'none'): Promise<void> {
  await page.evaluate((w) => {
    const capsule = document.querySelector<HTMLElement>('[data-capsule]');
    if (!capsule) return;
    capsule.style.visibility = w === 'capsule' ? 'hidden' : '';
    for (const layer of capsule.querySelectorAll<HTMLElement>('[data-capsule-layer]')) {
      layer.style.visibility = w === 'contents' ? 'hidden' : '';
    }
    for (const tier of document.querySelectorAll<HTMLElement>('[data-testid="options-tier"]')) {
      tier.style.visibility = w === 'none' ? '' : 'hidden';
    }
  }, what);
}

/**
 * Ends every paused animation and holds the capsule still at `box`'s size: the pill a resting
 * capsule of that geometry draws.
 */
async function holdStill(page: Page, box: Box): Promise<void> {
  await page.evaluate(async (b) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    for (const a of document.getAnimations()) a.cancel();
    // The motion core clears its inline size when it hears the cancel: let that happen first.
    await frame();
    await frame();
    const capsule = document.querySelector<HTMLElement>('[data-capsule]');
    if (!capsule) return;
    capsule.style.width = `${b.width}px`;
    capsule.style.height = `${b.height}px`;
    await frame();
    await frame();
  }, box);
}

async function release(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) if (a.playState === 'paused') a.play();
    const capsule = document.querySelector<HTMLElement>('[data-capsule]');
    capsule?.style.removeProperty('width');
    capsule?.style.removeProperty('height');
  });
  await hide(page, 'none');
}

const pixel = (image: Image, x: number, y: number): [number, number, number] => {
  const i = (Math.round(y) * image.width + Math.round(x)) * 4;
  return [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0];
};
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.max(...a.map((v, i) => Math.abs(v - (b[i] ?? 0))));
const luma = ([r, g, b]: readonly number[]) =>
  0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
const spread = (values: readonly number[]) => {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
};

/** Points `k` px outside the pill's curve: around the outer half of each end cap. */
function curvePoints(box: Box, k: number, arc: 'outer' | 'upper' | 'lower'): [number, number][] {
  const r = box.height / 2;
  const cy = box.y + r;
  const ends = [
    { cx: box.x + r, from: 90, to: 270 },
    { cx: box.x + box.width - r, from: -90, to: 90 },
  ];
  const out: [number, number][] = [];
  for (const { cx, from, to } of ends) {
    for (let deg = from; deg <= to; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const y = Math.sin(a);
      if (arc === 'upper' && y < 0.35) continue;
      if (arc === 'lower' && y > -0.35) continue;
      out.push([cx + (r + k) * Math.cos(a), cy - (r + k) * y]);
    }
  }
  return out;
}

/** Points along the straight top or bottom edge, `k` px outside it. */
function edgePoints(box: Box, k: number, side: 'top' | 'bottom'): [number, number][] {
  const r = box.height / 2;
  const y = side === 'top' ? box.y - k : box.y + box.height + k;
  const out: [number, number][] = [];
  for (let x = box.x + r; x <= box.x + box.width - r; x += 16) out.push([x, y]);
  return out;
}

test.describe('the capsule morph (Q-6)', () => {
  for (const fraction of [0.25, 0.5, 0.75]) {
    test(`dock → palette at ${fraction * 100} %: one node, a pill's edge, the page outside, glass inside, the shadow all round`, async ({
      page,
    }, info) => {
      await openStripes(page, info);
      const node = await page.locator('[data-capsule]').elementHandle();
      expect(
        await page.locator('[data-capsule]').evaluate((el) => getComputedStyle(el).contain),
      ).toBe('layout style');
      const restBox = await page.locator('[data-capsule]').boundingBox();
      if (!restBox) throw new Error('no capsule');

      // The bare page, where the capsule will be.
      await hide(page, 'capsule');
      const bare = await frame(page);
      await hide(page, 'none');

      await page.keyboard.press('2');
      const box = await pauseMorphAt(page, fraction);
      // Mid-morph: wider than the dock, narrower than the palette, the same height and node.
      expect(box.width).toBeGreaterThan(restBox.width + 1);
      expect(Math.abs(box.height - restBox.height)).toBeLessThan(1);
      expect(await page.locator('[data-capsule]').evaluate((el, n) => el === n, node)).toBe(true);
      await expect(page.locator('[data-capsule]')).toHaveAttribute('data-capsule', 'palette');

      await hide(page, 'contents');
      const mid = await frame(page);
      await info.attach(`mid-morph ${fraction * 100} %`, {
        body: await page.screenshot({ animations: 'allow', scale: 'css' }),
        contentType: 'image/png',
      });
      await holdStill(page, box);
      const still = await frame(page);
      await release(page);

      const failures: string[] = [];
      const check = (ok: boolean, line: string) => {
        if (!ok) failures.push(line);
      };
      // The edge is a resting pill's: rim, edge ring, shadow and anti-aliasing at its geometry.
      for (const k of [1, 2, 3]) {
        for (const [x, y] of [
          ...curvePoints(box, k, 'outer'),
          ...edgePoints(box, k, 'top'),
          ...edgePoints(box, k, 'bottom'),
        ]) {
          const d = distance(pixel(mid, x, y), pixel(still, x, y));
          check(
            d <= 4,
            `edge +${k} px at ${x.toFixed(1)}, ${y.toFixed(1)}: ${d}/255 from a still pill`,
          );
        }
      }
      // Above the pill, past the shadow's reach (8 px), the bare page: no glass past the curve.
      for (const [x, y] of [...curvePoints(box, 8, 'upper'), ...edgePoints(box, 8, 'top')]) {
        const d = distance(pixel(mid, x, y), pixel(bare, x, y));
        check(d <= 4, `outside +8 px at ${x.toFixed(1)}, ${y.toFixed(1)}: ${d}/255 from the page`);
      }
      // Inside: the stripes are gone (blurred), and it is darkened glass.
      const r = box.height / 2;
      for (const x of [box.x + r, box.x + box.width / 2, box.x + box.width - r]) {
        const ys: number[] = [];
        for (let y = box.y + 6; y <= box.y + box.height - 6; y += 1) ys.push(y);
        const glass = ys.map((y) => luma(pixel(mid, x, y)));
        const page0 = ys.map((y) => luma(pixel(bare, x, y)));
        check(
          spread(glass) < Math.max(4, spread(page0) / 10),
          `inside at x ${x.toFixed(1)}: spread ${spread(glass).toFixed(1)} against the page's ${spread(page0).toFixed(1)}`,
        );
        const mean = glass.reduce((s, v) => s + v, 0) / glass.length;
        check(mean < 160, `inside at x ${x.toFixed(1)}: mean ${mean.toFixed(0)}, not glass`);
      }
      // The shadow along the whole lower edge and both lower arcs.
      for (const [x] of [...edgePoints(box, 0, 'bottom'), ...curvePoints(box, 0, 'lower')]) {
        const below = (image: Image) => {
          let sum = 0;
          for (let dy = 2; dy <= 6; dy++) sum += luma(pixel(image, x, box.y + box.height + dy));
          return sum / 5;
        };
        check(
          below(mid) < below(bare) - 10,
          `no shadow below x ${x.toFixed(1)}: ${below(mid).toFixed(0)} against the page's ${below(bare).toFixed(0)}`,
        );
      }
      expect(failures, failures.slice(0, 12).join('\n')).toEqual([]);
    });
  }

  test('dock → Locked: Locked replaces Markup and Fill & sign in the same node, mid-morph a pill', async ({
    page,
  }, info) => {
    await openStripes(page, info);
    const capsule = page.locator('[data-capsule]');
    const node = await capsule.elementHandle();
    const dock = page.getByRole('toolbar', { name: 'Document tools', exact: true });
    await expect(dock.getByRole('button', { name: 'Markup', exact: true })).toBeVisible();
    const restBox = await capsule.boundingBox();
    if (!restBox) throw new Error('no capsule');
    // Lock from the title menu's switch.
    await page.getByRole('tab', { name: 'stripes' }).click();
    await page.getByRole('switch', { name: 'Lock' }).click();
    const box = await pauseMorphAt(page, 0.5);
    expect(box.width).toBeLessThan(restBox.width - 1);
    await hide(page, 'contents');
    const mid = await frame(page);
    await holdStill(page, box);
    const still = await frame(page);
    await release(page);
    for (const [x, y] of curvePoints(box, 2, 'outer')) {
      expect(
        distance(pixel(mid, x, y), pixel(still, x, y)),
        `edge at ${x}, ${y}`,
      ).toBeLessThanOrEqual(4);
    }
    await page.keyboard.press('Escape');
    await settled(page);
    expect(await capsule.evaluate((el, n) => el === n, node)).toBe(true);
    await expect(capsule).toHaveAttribute('data-capsule', 'locked');
    await expect(dock.getByRole('button')).toHaveText(['Pages', 'Locked', 'More']);
    await expect(dock.getByRole('button', { name: /^Locked: stripes/ })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    // `2` opens nothing while locked: the capsule stays Locked.
    await page.locator('body').press('2');
    await expect(capsule).toHaveAttribute('data-capsule', 'locked');
  });

  test('the layout a morph costs stays in the capsule; a reversal turns from the width drawn', async ({
    page,
  }, info) => {
    await openStripes(page, info);
    const rects = () =>
      page.evaluate(() =>
        [
          '[data-dock]',
          '[data-page-index="0"]',
          '[data-frame-layer="top"]',
          '[data-read-viewport]',
        ].map((selector) => {
          const r = document.querySelector(selector)?.getBoundingClientRect();
          return r ? [selector, r.x, r.y, r.width, r.height].join(' ') : `${selector} missing`;
        }),
      );
    const before = await rects();
    await page.keyboard.press('2');
    await pauseMorphAt(page, 0.5);
    expect(await rects()).toEqual(before);
    await release(page);
    await settled(page);

    // Reverse mid-morph: the width continues from where it is drawn.
    await page.keyboard.press('1');
    await page.waitForTimeout(120);
    const going = await page
      .locator('[data-capsule]')
      .evaluate((el) => el.getBoundingClientRect().width);
    await page.keyboard.press('2');
    const turned = await page
      .locator('[data-capsule]')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(turned - going)).toBeLessThan(40);
    await settled(page);
    await expect(page.locator('[data-capsule]')).toHaveAttribute('data-capsule', 'palette');
  });

  test('under reduced motion the morph is a cross-fade: opacity only, within 150 ms', async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openStripes(page, info);
    const restWidth = await page
      .locator('[data-capsule]')
      .evaluate((el) => el.getBoundingClientRect().width);
    await page.keyboard.press('2');
    const seen = await page.evaluate(async () => {
      const capsule = document.querySelector('[data-capsule]') as HTMLElement;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return capsule.getAnimations({ subtree: true }).map((a) => {
        const effect = a.effect as KeyframeEffect;
        const props = new Set(effect.getKeyframes().flatMap((f) => Object.keys(f)));
        for (const meta of ['offset', 'computedOffset', 'easing', 'composite']) props.delete(meta);
        return { props: [...props], duration: Number(effect.getComputedTiming().duration) };
      });
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const { props, duration } of seen) {
      expect(props).toEqual(['opacity']);
      expect(duration).toBeLessThanOrEqual(150);
    }
    const width = await page
      .locator('[data-capsule]')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(width).not.toBeCloseTo(restWidth, 0);
  });
});
