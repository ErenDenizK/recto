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
 * the change is a cross-fade of opacity only, within 150 ms. Each runs on today's row and on the
 * grouped palette (`?palette=groups`, epic R25-7), whose group names open their tools in place
 * through the same morph.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import { expect, type Page, test, type TestInfo } from '@playwright/test';

import { atRest, PALETTES, useFileInputPicker, usePalette } from './helpers';
import { decodePng, type Image, screenshotsShowBackdropFilters } from './support/pixels';

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
    for (let i = 0; i < 60 && !document.getAnimations().some(isSize); i++) {
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

/**
 * Hides or shows the capsule's contents (not glass), or the capsule itself. The page pill is
 * always hidden: a palette wide enough to reach it raises it (spec 01.6), and its glass moving
 * beside the capsule's end is not the capsule's edge.
 */
async function hide(page: Page, what: 'contents' | 'capsule' | 'none'): Promise<void> {
  await page.evaluate((w) => {
    const pill = document.querySelector<HTMLElement>('[data-testid="page-pill"]');
    if (pill) pill.style.visibility = 'hidden';
    const capsule = document.querySelector<HTMLElement>('[data-capsule]');
    if (!capsule) return;
    capsule.style.visibility = w === 'capsule' ? 'hidden' : '';
    for (const layer of capsule.querySelectorAll<HTMLElement>('[data-capsule-layer]')) {
      layer.style.visibility = w === 'contents' ? 'hidden' : '';
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

/** The properties a morph's motion animates (a change of size or place). */
const GEOMETRY = /width|height|transform|translate|scale|clip|inset|left|top/i;

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

/**
 * Whether this engine's screenshots show backdrop filters (`support/pixels.ts`), probed once per
 * worker on a blank white page. Firefox's and WebKit's capture paths can paint without the
 * compositor's backdrop pass, so the stripes under the capsule come out sharp in the screenshot
 * whatever the screen shows: there the blur half of "inside is blurred" cannot be read, and it
 * is left out with an annotation. Everything else the morph test reads is box shadow, rim and
 * tint, which every capture paints.
 */
let blurVisible: boolean | undefined;
async function captureShowsBlur(page: Page, info: TestInfo): Promise<boolean> {
  if (blurVisible === undefined) {
    await page.setContent('<body style="margin: 0; background: #fff"></body>');
    blurVisible = (await screenshotsShowBackdropFilters(page)).shown;
  }
  if (!blurVisible) {
    info.annotations.push({
      type: 'blur not judged',
      description: `${info.project.name}: screenshots here do not show backdrop filters (a backdrop-filter probe captured as the bare page), so the stripes' spread inside the capsule is not read`,
    });
  }
  return blurVisible;
}

for (const palette of PALETTES) {
  test.describe(`the capsule morph (Q-6), the ${palette} palette`, () => {
    test.beforeEach(async ({ page }) => {
      await usePalette(page, palette);
    });

    for (const fraction of [0.25, 0.5, 0.75]) {
      test(`dock → palette at ${fraction * 100} %: one node, a pill's edge, the page outside, glass inside, the shadow all round`, async ({
        page,
      }, info) => {
        const blurred = await captureShowsBlur(page, info);
        await openStripes(page, info);
        // A white canvas, like the page: on the tablet the palette is wider than the page at fit
        // width, so its end caps lie over the canvas, near black (luma 9), where no shadow can darken
        // the frame by the 10 the shadow check reads. Every frame below is taken over it.
        await page.evaluate(() =>
          document.documentElement.style.setProperty('--canvas', 'rgb(255 255 255)'),
        );
        // The shadow is read in the 2–6 px under the capsule's edge, so the stripes' phase there
        // matters: a black stripe cannot darken. The strip's floating pieces (owner feedback F1)
        // start the page 16 px lower than the docked band did; scroll it back by as much, so the
        // white band the check was calibrated over lies under the edge again.
        await page.evaluate(() => {
          const reader = document.querySelector<HTMLElement>('[data-read-viewport]');
          if (reader) reader.scrollTop += 16;
        });
        await settled(page);
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
          check(
            d <= 4,
            `outside +8 px at ${x.toFixed(1)}, ${y.toFixed(1)}: ${d}/255 from the page`,
          );
        }
        // Inside: the stripes are gone (blurred), and it is glass in the theme's tone (GLS-20):
        // light in the light theme, else darkened.
        const light = (await page.locator('html').getAttribute('data-theme')) === 'light';
        const r = box.height / 2;
        for (const x of [box.x + r, box.x + box.width / 2, box.x + box.width - r]) {
          const ys: number[] = [];
          for (let y = box.y + 6; y <= box.y + box.height - 6; y += 1) ys.push(y);
          const glass = ys.map((y) => luma(pixel(mid, x, y)));
          const page0 = ys.map((y) => luma(pixel(bare, x, y)));
          check(
            !blurred || spread(glass) < Math.max(4, spread(page0) / 10),
            `inside at x ${x.toFixed(1)}: spread ${spread(glass).toFixed(1)} against the page's ${spread(page0).toFixed(1)}`,
          );
          const mean = glass.reduce((s, v) => s + v, 0) / glass.length;
          check(
            light ? mean > 160 : mean < 160,
            `inside at x ${x.toFixed(1)}: mean ${mean.toFixed(0)}, not ${light ? 'light' : 'dark'} glass`,
          );
        }
        // The shadow along the whole lower edge and both lower arcs.
        for (const [x] of [...edgePoints(box, 0, 'bottom'), ...curvePoints(box, 0, 'lower')]) {
          const below = (image: Image) => {
            let sum = 0;
            for (let dy = 2; dy <= 6; dy++) sum += luma(pixel(image, x, box.y + box.height + dy));
            return sum / 5;
          };
          // A light look wears the light theme's shadow, ink at 40 % of the dark one's (§6.3).
          check(
            below(mid) < below(bare) - (light ? 4 : 10),
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
      const capsuleWidth = () =>
        page.locator('[data-capsule]').evaluate((el) => el.getBoundingClientRect().width);
      const dockWidth = await capsuleWidth();
      const before = await rects();
      await page.keyboard.press('2');
      await pauseMorphAt(page, 0.5);
      expect(await rects()).toEqual(before);
      await release(page);
      await settled(page);

      // Reverse mid-morph: the width continues from where it is drawn. Driven and read inside the
      // page: a key's round trip from the test lets frames pass, and the short morph back to the
      // dock can end before a later read. The turn is read on the Web Animations clock, not on
      // frame timing: in a slow frame (CI WebKit draws one every 100–200 ms) the spring, which
      // keeps its speed through the turn, rightly carries the width most of the way back, so how
      // far one frame moves says nothing about a jump; where the new motion starts does.
      const reversal = await page.evaluate(async () => {
        const capsule = document.querySelector('[data-capsule]') as HTMLElement;
        const width = () => capsule.getBoundingClientRect().width;
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const press = (key: string) => {
          const target = document.activeElement ?? document.body;
          for (const type of ['keydown', 'keyup']) {
            target.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
          }
        };
        const widthMotion = () =>
          capsule.getAnimations().find((a) => {
            const first = (a.effect as KeyframeEffect | null)?.getKeyframes()[0] ?? {};
            return 'width' in first;
          });
        /** The width the motion `a` draws at `t` ms: its keyframes, evenly spaced, interpolated. */
        const widthAt = (a: Animation, t: number) => {
          const effect = a.effect as KeyframeEffect;
          const widths = effect.getKeyframes().map((k) => Number.parseFloat(String(k.width)));
          const end = Number(effect.getComputedTiming().duration);
          const at = (Math.min(Math.max(t, 0), end) / end) * (widths.length - 1);
          const i = Math.min(Math.floor(at), widths.length - 2);
          return (widths[i] ?? 0) + ((widths[i + 1] ?? 0) - (widths[i] ?? 0)) * (at - i);
        };
        const start = width();
        press('1');
        // Under way back to the dock: the first frame drawn 16 px or more narrower.
        let going = width();
        for (let i = 0; i < 60 && start - going < 16; i++) {
          await frame();
          going = width();
        }
        const before = widthMotion();
        const pressed = performance.now();
        press('2');
        // The morph is written in React's commit, a microtask away: no frame passes meanwhile, so
        // the document's clock still reads the moment `going` was drawn at.
        let turning = widthMotion();
        for (let i = 0; i < 100 && (!turning || turning === before); i++) {
          await Promise.resolve();
          turning = widthMotion();
        }
        if (!turning || turning === before) return null;
        const widths = (turning.effect as KeyframeEffect)
          .getKeyframes()
          .map((k) => Number.parseFloat(String(k.width)));
        const at = width();
        await frame();
        return {
          start,
          going,
          from: widths[0] ?? 0,
          to: widths.at(-1) ?? 0,
          at,
          turned: width(),
          // A motion that has already come to rest (a frame longer than the whole spring) has
          // handed the capsule back to its resting size, the palette's.
          drawn:
            turning.currentTime === null
              ? (widths.at(-1) ?? 0)
              : widthAt(turning, Number(turning.currentTime)),
          elapsed: performance.now() - pressed,
        };
      });
      if (!reversal) throw new Error('the reversal started no width motion');
      // The turn happened mid-morph, neither at the palette's width nor at the dock's.
      expect(reversal.going).toBeLessThan(reversal.start - 1);
      expect(reversal.going).toBeGreaterThan(dockWidth + 1);
      // The new motion starts at the width drawn, and heads for the palette's: never restarting
      // from either end. At the turn the capsule is drawn where it was.
      expect(Math.abs(reversal.from - reversal.going)).toBeLessThan(1);
      expect(Math.abs(reversal.at - reversal.going)).toBeLessThan(1);
      expect(Math.abs(reversal.to - reversal.start)).toBeLessThan(1);
      // The next frame drawn is that motion at its own time (so it continues from the turn rather
      // than jumping), and, when that frame is short, a short way on: what the spring travels in a
      // frame grows with the frame's length (Chromium: 36 px in one 60 Hz frame).
      expect(Math.abs(reversal.turned - reversal.drawn)).toBeLessThan(1);
      if (reversal.elapsed <= 34) {
        expect(Math.abs(reversal.turned - reversal.going)).toBeLessThan(40);
      }
      await settled(page);
      await expect(page.locator('[data-capsule]')).toHaveAttribute('data-capsule', 'palette');
    });

    for (const reduced of [false, true]) {
      test(`a group's name opens its tools in place through the morph${reduced ? ', a cross-fade under reduced motion' : ''}`, async ({
        page,
      }, info) => {
        test.skip(palette !== 'groups', 'the grouped palette only (epic R25-7)');
        if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
        await openStripes(page, info);
        await page.keyboard.press('2');
        const bar = page.getByRole('toolbar', { name: 'Markup', exact: true });
        await expect(bar.locator('[data-task-group="draw"]')).toHaveAttribute(
          'aria-expanded',
          'true',
        );
        await settled(page);
        // Pressed inside the page, the animations read on the next frame (as below).
        const seen = await page.evaluate(async () => {
          const capsule = document.querySelector('[data-capsule]') as HTMLElement;
          (capsule.querySelector('[data-task-group="comment"]') as HTMLElement).click();
          await new Promise((resolve) => requestAnimationFrame(resolve));
          return capsule.getAnimations({ subtree: true }).map((a) => {
            const effect = a.effect as KeyframeEffect;
            const props = new Set(effect.getKeyframes().flatMap((f) => Object.keys(f)));
            for (const meta of ['offset', 'computedOffset', 'easing', 'composite'])
              props.delete(meta);
            return [...props];
          });
        });
        expect(seen.length).toBeGreaterThan(0);
        // Motion is a change of size or place; a name's colour may still ease under reduced
        // motion, which keeps fades and colour (A-9).
        const moving = seen.flat().filter((prop) => GEOMETRY.test(prop));
        if (reduced) expect(moving).toEqual([]);
        else expect(moving.length).toBeGreaterThan(0);
        await expect(bar.locator('[data-task-group="comment"]')).toHaveAttribute(
          'aria-expanded',
          'true',
        );
        await expect(bar.locator('[data-item="note"]')).toBeVisible();
        await expect(bar.locator('[data-item="eraser"]')).toHaveCount(0);
      });
    }

    test('under reduced motion the morph is a cross-fade: opacity only, within 150 ms', async ({
      page,
    }, info) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openStripes(page, info);
      const restWidth = await page
        .locator('[data-capsule]')
        .evaluate((el) => el.getBoundingClientRect().width);
      // The key is pressed inside the page and the animations read on the next frame: the whole
      // change lasts 150 ms, which a round trip from the test can outlast on a loaded runner.
      const seen = await page.evaluate(async () => {
        const capsule = document.querySelector('[data-capsule]') as HTMLElement;
        const target = document.activeElement ?? document.body;
        for (const type of ['keydown', 'keyup']) {
          target.dispatchEvent(
            new KeyboardEvent(type, { key: '2', bubbles: true, cancelable: true }),
          );
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
        return capsule.getAnimations({ subtree: true }).map((a) => {
          const effect = a.effect as KeyframeEffect;
          const props = new Set(effect.getKeyframes().flatMap((f) => Object.keys(f)));
          for (const meta of ['offset', 'computedOffset', 'easing', 'composite'])
            props.delete(meta);
          const timing = effect.getComputedTiming();
          return {
            props: [...props],
            end: Number(timing.endTime),
            duration: Number(timing.duration),
          };
        });
      });
      expect(seen.length).toBeGreaterThan(0);
      // A fade through within A-9's 150 ms: out, then in, each fade and the whole change no longer.
      for (const { props, end, duration } of seen) {
        expect(props).toEqual(['opacity']);
        expect(duration).toBeLessThanOrEqual(150);
        expect(Math.round(end)).toBeLessThanOrEqual(150);
      }
      const width = await page
        .locator('[data-capsule]')
        .evaluate((el) => el.getBoundingClientRect().width);
      expect(width).not.toBeCloseTo(restWidth, 0);
    });
  });
}

/**
 * Drives `steps` inside the page (a key, or a number of frames to wait) and reads every frame
 * drawn until the steps are done, `ms` have passed and the capsule's morph has come to rest
 * (within `limit` ms): each capsule piece's ink (its box less padding, where its icon and label
 * are drawn, clipped to the capsule's box) and its opacity as drawn (its own times its
 * ancestors' up to the capsule). Returns each pair of pieces both above trace opacity whose ink
 * overlaps in some frame (leaving over arriving, or a slide over a new piece), how many frames
 * were read while the morph was under way (a capsule animation running), and whether it ended
 * inside the read. The read follows the morph rather than a frame count: an engine that draws
 * slowly (CI WebKit: a frame every 90–200 ms) draws fewer frames of the same morph.
 */
async function overlapsDuring(
  page: Page,
  steps: readonly (string | number)[],
  ms = 900,
  limit = 5000,
): Promise<{
  readonly moving: number;
  readonly rested: boolean;
  readonly overlaps: readonly string[];
}> {
  return page.evaluate(
    async ({ steps, ms, limit, trace }) => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const capsule = document.querySelector('[data-capsule]') as HTMLElement;
      const n = (v: string) => Number.parseFloat(v) || 0;
      const opacityOf = (el: Element) => {
        let o = 1;
        for (let e: Element | null = el; e && e !== capsule.parentElement; e = e.parentElement) {
          const s = getComputedStyle(e);
          if (s.visibility === 'hidden' || s.display === 'none') return 0;
          o *= Number(s.opacity);
        }
        return o;
      };
      const read = () => {
        const cb = capsule.getBoundingClientRect();
        const out: { name: string; o: number; box: readonly number[] }[] = [];
        for (const el of capsule.querySelectorAll('[data-capsule-layer] [data-capsule-item]')) {
          if (el.querySelector('[data-capsule-item]')) continue;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          let [left, top, right, bottom] = [
            r.left + n(s.paddingLeft) + n(s.borderLeftWidth),
            r.top + n(s.paddingTop) + n(s.borderTopWidth),
            r.right - n(s.paddingRight) - n(s.borderRightWidth),
            r.bottom - n(s.paddingBottom) - n(s.borderBottomWidth),
          ];
          if (right - left < 2 || bottom - top < 2) {
            [left, top, right, bottom] = [r.left, r.top, r.right, r.bottom];
          }
          const box = [
            Math.max(left, cb.left),
            Math.max(top, cb.top),
            Math.min(right, cb.right),
            Math.min(bottom, cb.bottom),
          ] as const;
          const o = opacityOf(el);
          if (o <= trace || box[2] - box[0] < 1 || box[3] - box[1] < 1) continue;
          const layer = el.closest('[data-capsule-layer]');
          const leaving = layer?.hasAttribute('data-leaving') ? ' (leaving)' : '';
          const name = `${layer?.getAttribute('data-capsule-layer')}${leaving}: ${el.getAttribute('data-capsule-item')}`;
          out.push({ name, o, box });
        }
        return out;
      };
      const morphing = () =>
        capsule
          .getAnimations({ subtree: true })
          .some(
            (a) =>
              a.playState === 'running' &&
              Number.isFinite(Number(a.effect?.getComputedTiming().endTime)),
          );
      const overlaps = new Set<string>();
      let moving = 0;
      const start = performance.now();
      const since = () => performance.now() - start;
      let pending = [...steps];
      while (pending.length > 0 || since() < ms || (morphing() && since() < limit)) {
        const step = pending[0];
        if (typeof step === 'string') {
          const target = document.activeElement ?? document.body;
          for (const type of ['keydown', 'keyup']) {
            target.dispatchEvent(
              new KeyboardEvent(type, { key: step, bubbles: true, cancelable: true }),
            );
          }
          pending = pending.slice(1);
        } else if (typeof step === 'number') {
          pending = step > 1 ? [step - 1, ...pending.slice(1)] : pending.slice(1);
        }
        await frame();
        if (morphing()) moving++;
        const pieces = read();
        for (const [i, a] of pieces.entries()) {
          for (const b of pieces.slice(i + 1)) {
            const ix =
              Math.min(a.box[2] ?? 0, b.box[2] ?? 0) - Math.max(a.box[0] ?? 0, b.box[0] ?? 0);
            const iy =
              Math.min(a.box[3] ?? 0, b.box[3] ?? 0) - Math.max(a.box[1] ?? 0, b.box[1] ?? 0);
            if (ix > 1 && iy > 1) {
              overlaps.add(`${a.name} (${a.o.toFixed(2)}) × ${b.name} (${b.o.toFixed(2)})`);
            }
          }
        }
      }
      return { moving, rested: !morphing(), overlaps: [...overlaps] };
    },
    { steps, ms, limit, trace: 0.1 },
  );
}

/**
 * The V2 review found the morph printing two contents at once for its first 150–250 ms
 * ("Pages" and the highlighter as one word, swatches under Done, a "Pages" ghost over the
 * shapes after a reversal) and the Pages grid's View Transition showing the old palette, full
 * width, behind the narrowing capsule. Every frame is read here: no piece above trace opacity
 * (0.1) is drawn over another, whatever the transition, and the capsule is never cloned.
 */
for (const palette of PALETTES) {
  test.describe(`the capsule morph never prints two contents at once, the ${palette} palette`, () => {
    test.beforeEach(async ({ page }) => {
      await usePalette(page, palette);
    });

    // Titles in ASCII: the stripes PDF is written under the test's output directory, named from
    // the title, and Chromium's file chooser silently drops a file whose path holds an arrow.
    const cases: readonly {
      readonly name: string;
      readonly before?: readonly string[];
      readonly steps: readonly (string | number)[];
    }[] = [
      { name: 'dock to palette', steps: ['2'] },
      { name: 'palette to dock', before: ['2'], steps: ['1'] },
      { name: 'dock to palette to dock, turned back after 4 frames', steps: ['2', 4, '1'] },
      {
        name: 'palette to dock to palette, turned back after 3 frames',
        before: ['2'],
        steps: ['1', 3, '2'],
      },
      {
        name: 'dock to palette, turned back at 10 frames and again at 14',
        steps: ['2', 10, '1', 4, '2'],
      },
    ];
    for (const { name, before = [], steps } of cases) {
      test(name, async ({ page }, info) => {
        await openStripes(page, info);
        for (const key of before) {
          await page.keyboard.press(key);
          await settled(page);
        }
        const { moving, rested, overlaps } = await overlapsDuring(page, steps);
        // The read saw the morph under way, frame after frame, and saw it end.
        expect(moving).toBeGreaterThanOrEqual(3);
        expect(rested).toBe(true);
        expect(overlaps).toEqual([]);
      });
    }

    test('dock to Locked to dock: Pages and More slide, and never over Markup or Fill & sign', async ({
      page,
    }, info) => {
      await openStripes(page, info);
      await page.getByRole('tab', { name: 'stripes' }).click();
      const lock = page.getByRole('switch', { name: 'Lock' });
      await expect(lock).toBeVisible();
      // The switch is pressed inside the page while the frames are read, so the morph is in them.
      const press = () => lock.evaluate((el) => (el as HTMLElement).click());
      const locking = overlapsDuring(page, [6]);
      await press();
      expect((await locking).overlaps).toEqual([]);
      await expect(page.locator('[data-capsule]')).toHaveAttribute('data-capsule', 'locked');
      await settled(page);
      const unlocking = overlapsDuring(page, [6]);
      await press();
      expect((await unlocking).overlaps).toEqual([]);
      await expect(page.locator('[data-capsule]')).toHaveAttribute('data-capsule', 'dock');
    });

    test('into the Pages grid: no clone of the capsule, and no old palette beside it', async ({
      page,
    }, info) => {
      await openStripes(page, info);
      test.skip(
        !(await page.evaluate(() => typeof document.startViewTransition === 'function')),
        'This engine has no View Transitions: the grid opens without one, so nothing is captured',
      );
      await page.keyboard.press('2');
      await settled(page);
      const palette = await page.locator('[data-capsule]').boundingBox();
      if (!palette) throw new Error('no capsule');
      // The grid's own floating pieces at the band's corners (GridPieces.tsx, owner feedback F1)
      // arrive with the new view's cross-fade where the palette's ends were: they are not the old
      // palette, so they are kept out of both frames compared below.
      await page.addStyleTag({ content: '[data-grid-piece] { visibility: hidden !important; }' });
      // Hold the view change (it is cut at 240 ms) and pause every animation 80 ms into it: the
      // capsule is narrowing from the palette's box then.
      const mid = await page.evaluate(async () => {
        const proto = ViewTransition.prototype;
        Reflect.set(window, '__skip', Reflect.get(proto, 'skipTransition'));
        proto.skipTransition = () => undefined;
        const target = document.activeElement ?? document.body;
        for (const type of ['keydown', 'keyup']) {
          target.dispatchEvent(
            new KeyboardEvent(type, { key: '3', bubbles: true, cancelable: true }),
          );
        }
        const pseudo = (a: Animation) => String((a.effect as KeyframeEffect | null)?.pseudoElement);
        const isVt = (a: Animation) => pseudo(a).includes('view-transition');
        // The root group's start is the view change's: wait until it has one (an animation is
        // pending, with no start time, on the frame it is created), and read every animation's
        // place from it, so each is paused where it is 80 ms into the view change.
        const rootGroup = () =>
          document
            .getAnimations()
            .find((a) => pseudo(a) === '::view-transition-group(root)' && a.startTime !== null);
        for (let i = 0; i < 120 && !rootGroup(); i++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        const t0 = Number(rootGroup()?.startTime ?? Number.NaN);
        const all = document.getAnimations();
        const vt = all.filter(isVt);
        for (const a of all) {
          a.pause();
          const started = a.startTime === null ? t0 : Number(a.startTime);
          a.currentTime = Math.max(0, t0 + 80 - started);
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const capsule = document.querySelector('[data-capsule]') as HTMLElement;
        const box = capsule.getBoundingClientRect();
        return {
          groups: [...new Set(vt.map(pseudo))].filter((p) =>
            p.startsWith('::view-transition-group'),
          ),
          name: getComputedStyle(capsule).viewTransitionName,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        };
      });
      // No clone: the capsule is not captured on its own (only the root and the shared page are
      // named), so it is drawn once, live, in the new view.
      expect(['', 'none']).toContain(mid.name);
      expect([...mid.groups].sort()).toEqual([
        '::view-transition-group(page-current)',
        '::view-transition-group(root)',
      ]);
      expect(mid.box.width).toBeLessThan(palette.width - 40);
      const during = await frame(page);
      await info.attach('80 ms into the view change', {
        body: await page.screenshot({ animations: 'allow', scale: 'css' }),
        contentType: 'image/png',
      });
      await page.evaluate(() => {
        for (const a of document.getAnimations()) if (a.playState === 'paused') a.play();
        Reflect.set(ViewTransition.prototype, 'skipTransition', Reflect.get(window, '__skip'));
      });
      await settled(page);
      await atRest(page.locator('[data-capsule]'));
      const rest = await page.locator('[data-capsule]').boundingBox();
      if (!rest) throw new Error('no capsule');
      const after = await frame(page);
      // Beside the narrowing capsule, inside the old palette's box (and beside the Pages bar at
      // rest): the new view as it rests, never the old palette faded over it.
      const y = mid.box.y + mid.box.height / 2;
      const xs: number[] = [];
      for (let x = palette.x + 12; x < palette.x + palette.width - 12; x += 8) {
        const beside = (left: number, width: number) => x < left - 12 || x > left + width + 12;
        if (beside(mid.box.x, mid.box.width) && beside(rest.x, rest.width)) xs.push(x);
      }
      expect(xs.length).toBeGreaterThan(4);
      const ghosts = xs
        .map((x) => ({ x, d: distance(pixel(during, x, y), pixel(after, x, y)) }))
        .filter(({ d }) => d > 6);
      expect(ghosts, JSON.stringify(ghosts.slice(0, 8))).toEqual([]);
    });
  });
}
