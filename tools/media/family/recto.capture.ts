/**
 * Recto's family captures (docs/family/README.md §5; the family kit's `presentation.md` §3–§5):
 * the Library, the document with the dock, the Markup palette, the capsule half-way through its
 * morph and the light table with the sample's pages, at 1440 × 900 and at 1180 × 820 (touch),
 * both at 2 device pixels per CSS pixel; and on the desktop the signature clip, the capsule
 * morphing dock → Markup palette → dock → Pages bar → dock, 6–10 s, starting and ending on the
 * dock at rest so its poster is its first frame and a loop never jumps.
 *
 * Shot from the production build with the teaching sample (`?sample`), as a first visit sees
 * it: nothing is mocked, the glass is Glass Clear through the test-only render override as in
 * the media scenes (lib/stage.ts), and every still waits until no animation runs. The one
 * exception is `capsule-morph`, held at half of the morph on purpose (the same pause
 * `apps/web/e2e/capsule.spec.ts` uses to read the morph's pixels).
 *
 * The clip follows the kit: frames, not a screen recorder. Every animation of the page runs at
 * 1 / SLOW of its speed (CDP `Animation.setPlaybackRate`), the pointer and the holds are slowed
 * by the same factor, full 2x screenshots are taken as fast as the browser gives them, each
 * stamped with its time, and ffmpeg plays them back at the real rate, resampled to 60 fps.
 *
 * Output (gitignored, `tools/media/out/family/`), named as the kit's `presentation.md` §4:
 * `recto-<view>-<w>x<h>@2x.png` (lossless masters; the portfolio derives AVIF and WebP),
 * `recto-signature-1440x900@2x-poster.png`, `.av1.mp4`, `.hevc.mp4`, `.h264.mp4`, a VP9
 * `.webm`, and `manifest-<project>.json` listing them.
 * Run: `pnpm --filter @pdf-editor/media-tool family`.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type CDPSession,
  expect,
  type Locator,
  type Page,
  test,
  type TestInfo,
} from '@playwright/test';

import { Cursor } from '../lib/cursor.ts';

const OUT = fileURLToPath(new URL('../out/family/', import.meta.url));
const SAMPLE_TAB = 'Recto sample';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ffmpeg(args: readonly string[]): void {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

/** `recto-library-1440x900@2x`: the kit's name for a view at the page's CSS size and 2x. */
function stem(page: Page, view: string): string {
  const size = page.viewportSize();
  if (!size) throw new Error('no viewport');
  return `recto-${view}-${String(size.width)}x${String(size.height)}@2x`;
}

/** Sets the page up as the media stage does (lib/stage.ts): Glass Clear, a fixed clock, English. */
async function prepare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as { __rectoRender?: unknown }).__rectoRender = {
      degrade: 'off',
      glass: 'clear',
      light: 'auto',
    };
  });
  await page.clock.setFixedTime(new Date('2026-05-12T09:30:00Z'));
}

/** Opens `path` and waits for the shell, every font face and the service worker. */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.locator('html'), 'build with RECTO_RENDER_OVERRIDE=1').toHaveAttribute(
    'data-glass',
    'clear',
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.fonts].map((face) => face.load().catch(() => undefined)));
  });
}

/** Opens the teaching sample and waits for its first page to render. */
async function openSample(page: Page): Promise<void> {
  await open(page, './?sample&lang=en');
  await expect(page.getByRole('tab', { name: SAMPLE_TAB, selected: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('[data-capsule="dock"]')).toBeVisible();
}

/** Waits until no finite animation runs (the capsule's morph, fades, the grid's view change). */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      !document.documentElement.hasAttribute('data-vt-grid') &&
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== 'running' ||
            !Number.isFinite(Number(a.effect?.getComputedTiming().endTime)),
        ),
    undefined,
    { timeout: 15_000 },
  );
  // Two frames, so what settled is also painted.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/** A press as the device makes it: a tap on the tablet, a click with the mouse moved away. */
async function press(page: Page, target: Locator, info: TestInfo): Promise<void> {
  if (info.project.use.hasTouch) {
    await target.tap();
    return;
  }
  await target.click();
  // No hover in a still: the pointer rests over the canvas's empty right edge.
  const size = page.viewportSize();
  if (size) await page.mouse.move(size.width - 8, size.height / 2);
}

const capsule = (page: Page) => page.locator('[data-capsule]');
const inCapsule = (page: Page, name: string | RegExp) =>
  capsule(page).getByRole('button', { name, exact: typeof name === 'string' });

const written: string[] = [];

/** The viewport at 2x as a lossless PNG master. */
async function still(page: Page, view: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const name = `${stem(page, view)}.png`;
  // Blur the focus, so no ring sits in the picture where the person did not put one.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.screenshot({ path: join(OUT, name), animations: 'allow', caret: 'hide' });
  written.push(name);
}

/**
 * Pauses every animation at `fraction` of the capsule's size morph, once it has started; the
 * same reading `apps/web/e2e/capsule.spec.ts` makes (`pauseMorphAt`).
 */
async function pauseMorphAt(page: Page, fraction: number): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((f) => {
        const element = document.querySelector('[data-capsule]');
        const morph = document.getAnimations().find((a) => {
          const effect = a.effect as KeyframeEffect | null;
          if (effect?.target !== element) return false;
          const first = effect.getKeyframes()[0] ?? {};
          return 'width' in first || 'height' in first;
        });
        if (!morph) return false;
        const end = Number(morph.effect?.getComputedTiming().endTime);
        const at = Number(morph.startTime ?? 0) + end * f;
        for (const a of document.getAnimations()) {
          a.pause();
          // Every animation at the same moment of the timeline as the morph.
          a.currentTime = Math.max(0, at - Number(a.startTime ?? 0));
        }
        return true;
      }, fraction),
    )
    .toBe(true);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  written.length = 0;
});

test.afterAll(() => {
  const project = test.info().project.name;
  const file = join(OUT, `manifest-${project}.json`);
  writeFileSync(file, `${JSON.stringify({ project, files: written }, null, 2)}\n`);
});

test('stills: library, document, Markup palette, the morph half-way, light table', async ({
  page,
}, info) => {
  await prepare(page);

  // The Library as a first visit sees it: the welcome card on the lime light.
  await open(page, './?lang=en');
  await settled(page);
  await still(page, 'library');

  // The sample open, the dock at rest.
  await openSample(page);
  await settled(page);
  await still(page, 'document');

  // Markup: the dock has become the palette.
  await press(page, inCapsule(page, 'Markup'), info);
  await expect(capsule(page)).toHaveAttribute('data-capsule', 'palette');
  await settled(page);
  await still(page, 'markup-palette');

  // Back to the dock, then the morph to the palette held at its middle.
  await press(page, inCapsule(page, 'Done'), info);
  await expect(capsule(page)).toHaveAttribute('data-capsule', 'dock');
  await settled(page);
  await press(page, inCapsule(page, 'Markup'), info);
  await pauseMorphAt(page, 0.5);
  await still(page, 'capsule-morph');
  await page.evaluate(() => {
    for (const a of document.getAnimations()) a.play();
  });
  await settled(page);
  await press(page, inCapsule(page, 'Done'), info);
  await expect(capsule(page)).toHaveAttribute('data-capsule', 'dock');
  await settled(page);

  // The light table: the sample's four pages, the capsule as the Pages bar.
  await press(page, inCapsule(page, /^Pages/), info);
  await expect(capsule(page)).toHaveAttribute('data-capsule', 'pages');
  const grid = page.getByTestId('light-table');
  await expect(grid).toBeVisible();
  await expect
    .poll(() => grid.locator('canvas').count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(4);
  await settled(page);
  await still(page, 'light-table');
});

/**
 * Frames under slowed animations, as the kit's `presentation.md` §5 asks: `capture()` keeps
 * taking 2x screenshots, each stamped with the wall time it was asked for, until `stop()`.
 * CDP's `Page.captureScreenshot` with `optimizeForSpeed` and a clip at scale 2 (without the clip
 * it returns CSS pixels) takes about 340 ms a frame at 2x on a runner without a GPU, where
 * `page.screenshot` takes about 900 ms; at SLOW = 20 that is
 * about 32 frames per clip second there (more on a faster machine), resampled to 60 fps.
 */
class FrameLoop {
  private readonly frames: { file: string; at: number }[] = [];
  private running = true;
  private readonly done: Promise<void>;

  // Plain fields, not parameter properties, as lib/recorder.ts keeps them.
  private readonly cdp: CDPSession;
  private readonly dir: string;
  private readonly size: { readonly width: number; readonly height: number };

  constructor(
    cdp: CDPSession,
    dir: string,
    size: { readonly width: number; readonly height: number },
  ) {
    this.cdp = cdp;
    this.dir = dir;
    this.size = size;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    this.done = this.capture();
  }

  private async capture(): Promise<void> {
    while (this.running) {
      const at = Date.now();
      const file = `${String(this.frames.length).padStart(5, '0')}.png`;
      const { data } = await this.cdp.send('Page.captureScreenshot', {
        format: 'png',
        optimizeForSpeed: true,
        clip: { x: 0, y: 0, ...this.size, scale: 2 },
      });
      writeFileSync(join(this.dir, file), Buffer.from(data, 'base64'));
      this.frames.push({ file, at });
    }
  }

  /** Stops and writes an ffconcat list that plays the frames back at `1 / slow` of wall time. */
  async stop(slow: number): Promise<{ list: string; seconds: number; frames: number }> {
    this.running = false;
    await this.done;
    const end = Date.now();
    const lines = ['ffconcat version 1.0'];
    this.frames.forEach((frame, i) => {
      const next = this.frames[i + 1]?.at ?? end;
      lines.push(
        `file '${frame.file}'`,
        `duration ${((next - frame.at) / slow / 1000).toFixed(6)}`,
      );
    });
    const last = this.frames.at(-1);
    if (!last) throw new Error('no frames');
    lines.push(`file '${last.file}'`);
    const list = join(this.dir, 'frames.ffconcat');
    writeFileSync(list, `${lines.join('\n')}\n`);
    const first = this.frames[0];
    return {
      list,
      seconds: first ? (end - first.at) / slow / 1000 : 0,
      frames: this.frames.length,
    };
  }

  get firstFrame(): string {
    const first = this.frames[0];
    if (!first) throw new Error('no frames');
    return join(this.dir, first.file);
  }
}

/** Animations, pointer and holds run this many times slower while the clip is shot. */
const SLOW = 20;

test('clip: the capsule morph, dock → Markup palette → dock → Pages bar → dock', async ({
  page,
}, info) => {
  test.skip(Boolean(info.project.use.hasTouch), 'one clip, on the desktop');
  test.setTimeout(1_800_000);
  await prepare(page);
  const cursor = await Cursor.install(page, true);
  await openSample(page);
  await settled(page);
  await cursor.place(1180, 560);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
  const wait = (ms: number) => sleep(ms * SLOW);
  const click = (target: Locator) => cursor.click(target, 420 * SLOW);

  const loop = new FrameLoop(
    cdp,
    join(OUT, 'clip-frames'),
    page.viewportSize() ?? { width: 1440, height: 900 },
  );
  await wait(700);
  await click(inCapsule(page, 'Markup'));
  await expect(capsule(page)).toHaveAttribute('data-capsule', 'palette');
  await wait(1300);
  await click(inCapsule(page, 'Done'));
  await expect(capsule(page)).toHaveAttribute('data-capsule', 'dock');
  await wait(800);
  await click(inCapsule(page, /^Pages/));
  await expect(capsule(page)).toHaveAttribute('data-capsule', 'pages', { timeout: 30_000 });
  await wait(1300);
  await click(inCapsule(page, 'Done'));
  await expect(capsule(page)).toHaveAttribute('data-capsule', 'dock', { timeout: 30_000 });
  await cursor.move(1180, 560, 420 * SLOW);
  await wait(1000);
  const clip = await loop.stop(SLOW);
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  writeFileSync(
    join(OUT, 'recto-signature.json'),
    `${JSON.stringify({ ...clip, slow: SLOW }, null, 2)}\n`,
  );
  expect(clip.seconds).toBeGreaterThan(6);
  expect(clip.seconds).toBeLessThan(10);

  // The kit's encodings (presentation.md §3): AV1 10-bit, HEVC Main 10 tagged hvc1, H.264,
  // BT.709 limited range, no audio, faststart, 60 fps; and a VP9 WebM besides.
  const name = 'recto-signature-1440x900@2x';
  const input = ['-f', 'concat', '-safe', '0', '-i', clip.list, '-vf', 'fps=60'];
  const color = [
    ...['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'],
    ...['-color_range', 'tv', '-an'],
  ];
  const mp4 = ['-movflags', '+faststart'];
  ffmpeg([
    ...input,
    ...['-c:v', 'libsvtav1', '-preset', '4', '-crf', '30', '-pix_fmt', 'yuv420p10le'],
    ...['-svtav1-params', 'tune=0', ...color, ...mp4, join(OUT, `${name}.av1.mp4`)],
  ]);
  ffmpeg([
    ...input,
    ...['-c:v', 'libx265', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p10le'],
    ...['-tag:v', 'hvc1', '-x265-params', 'log-level=error', ...color, ...mp4],
    join(OUT, `${name}.hevc.mp4`),
  ]);
  ffmpeg([
    ...input,
    ...['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'high'],
    ...['-pix_fmt', 'yuv420p', ...color, ...mp4, join(OUT, `${name}.h264.mp4`)],
  ]);
  ffmpeg([
    ...input,
    ...['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1', '-deadline', 'good'],
    ...['-cpu-used', '2', '-pix_fmt', 'yuv420p', ...color, join(OUT, `${name}.webm`)],
  ]);
  // The poster is the first frame: the dock at rest, where the clip also ends.
  copyFileSync(loop.firstFrame, join(OUT, `${name}-poster.png`));
  written.push(
    `${name}-poster.png`,
    `${name}.av1.mp4`,
    `${name}.hevc.mp4`,
    `${name}.h264.mp4`,
    `${name}.webm`,
  );
});
