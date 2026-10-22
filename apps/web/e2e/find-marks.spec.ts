/**
 * Find shows where (R25 Epic 6; DSN-16, DSN-62, GLS-26): a hit reads at 3:1 or more against its
 * page on the dark sample cover and on a white page, the current hit stronger than the rest, and
 * the reader's scroll bar carries one canvas of hit ticks while Find has hits and none after.
 * The pixels are the rendered screenshot's: the mode colour inside a hit (its fill over the page)
 * against the mode colour in a ring just outside it (the page).
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { contrastRatio, fullViewportPixels, hex, type Image, type Rgb } from './support/pixels';

/** The most common colour among the pixels of the boxes, ignoring the thin text on them. */
function modeColour(image: Image, boxes: readonly (readonly [number, number, number, number])[]) {
  const counts = new Map<number, number>();
  for (const [x0, y0, x1, y1] of boxes) {
    for (let y = Math.max(0, y0); y < Math.min(image.height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x++) {
        const i = (y * image.width + x) * 4;
        const key = (image.data[i]! << 16) | (image.data[i + 1]! << 8) | image.data[i + 2]!;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const [key] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [0];
  return [(key >> 16) & 255, (key >> 8) & 255, key & 255] as unknown as Rgb;
}

/** The darkest (or lightest) pixel of the box. */
function extremeColour(
  image: Image,
  box: readonly [number, number, number, number],
  darkest: boolean,
) {
  let best: Rgb = [0, 0, 0];
  let at = darkest ? Infinity : -Infinity;
  for (let y = box[1]; y < box[3]; y++) {
    for (let x = box[0]; x < box[2]; x++) {
      const i = (y * image.width + x) * 4;
      const c = [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0] as const;
      const l = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      if (darkest ? l < at : l > at) [best, at] = [c, l];
    }
  }
  return best;
}

/** The pixel of the box farthest in contrast from the box's mode colour (the text on the fill). */
function glyphColour(image: Image, box: readonly [number, number, number, number]): Rgb {
  const fill = modeColour(image, [box]);
  let best: Rgb = fill;
  let most = 1;
  for (let y = box[1]; y < box[3]; y++) {
    for (let x = box[0]; x < box[2]; x++) {
      const i = (y * image.width + x) * 4;
      const c = [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0] as const;
      const ratio = contrastRatio(c, fill);
      if (ratio > most) [best, most] = [c, ratio];
    }
  }
  return best;
}

interface Sample {
  readonly fill: Rgb;
  readonly page: Rgb;
  readonly current: boolean;
  /** The pixel in the hit that differs most from its fill: the glyph's own colour. */
  readonly glyph: Rgb;
}

/** Every hit of the layers in view: its fill and the page colour right around it. */
async function sampleHits(page: Page): Promise<Sample[]> {
  const image = await fullViewportPixels(page);
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="search-highlights"] > div')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, current: el.hasAttribute('data-current') };
    }),
  );
  const out: Sample[] = [];
  for (const b of boxes) {
    if (b.w < 6 || b.h < 8 || b.x < 14 || b.y < 14) continue;
    if (b.x + b.w + 14 > image.width || b.y + b.h + 14 > image.height) continue;
    const [x0, y0, x1, y1] = [b.x, b.y, b.x + b.w, b.y + b.h].map(Math.round) as [
      number,
      number,
      number,
      number,
    ];
    // The ring: 5 to 10 px outside the box (clear of the current hit's own ring).
    const ring = [
      [x0 - 10, y0 - 10, x1 + 10, y0 - 5],
      [x0 - 10, y1 + 5, x1 + 10, y1 + 10],
    ] as const;
    const page = modeColour(image, ring);
    out.push({
      // The fill is the interior pixel the glyphs leave alone: the lightest on a light page
      // (text only darkens it), the darkest on a dark one (text only lifts it).
      fill: extremeColour(image, [x0 + 2, y0 + 2, x1 - 2, y1 - 2], luminance(page) < 4),
      page,
      current: b.current,
      glyph: glyphColour(image, [x0 + 1, y0 + 1, x1 - 1, y1 - 1]),
    });
  }
  return out;
}

const luminance = (c: Rgb) => contrastRatio(c, [0, 0, 0]);

async function search(page: Page, query: string): Promise<Locator> {
  await page.keyboard.press('ControlOrMeta+f');
  const field = page.locator('[data-find-entry] input[type="search"]').first();
  await expect(field).toBeFocused();
  await field.fill(query);
  await expect(page.getByTestId('find-count')).toContainText(/ of \d/);
  return field;
}

test('hits read at 3:1 on the dark cover and on a white page; the current one is stronger', async ({
  page,
}) => {
  await page.goto('./?sample');
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await search(page, 'margin');
  await expect(page.locator('[data-testid="search-highlights"]').first()).toBeVisible();
  // Let the render settle under the hits.
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible();

  const dark: Sample[] = [];
  const light: Sample[] = [];
  // Walk the document a screen at a time, sampling every hit that shows.
  // The cover's hit takes its tone once its bitmap has rendered.
  await expect(page.locator('[data-testid="search-highlights"] > div').first()).toHaveAttribute(
    'data-tone',
    'dark',
  );
  const scroller = page.locator('[data-read-viewport]');
  for (let step = 0; step < 12; step++) {
    for (const s of await sampleHits(page)) (luminance(s.page) < 4 ? dark : light).push(s);
    if (dark.length > 2 && light.length > 2) break;
    const before = await scroller.evaluate((el) => el.scrollTop);
    if (await scroller.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1))
      break;
    await scroller.evaluate((el) => el.scrollBy(0, el.clientHeight * 0.8));
    // Wait for the scroll to land and every page in view to finish rendering.
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).not.toBe(before);
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLCanvasElement>('main canvas[data-state]')]
            .filter((c) => {
              const r = c.getBoundingClientRect();
              return r.bottom > 0 && r.top < innerHeight;
            })
            .every((c) => c.dataset.state === 'rendered'),
        ),
      )
      .toBe(true);
    // The tone of a hit layer follows its bitmap's render by a mutation callback and a React
    // commit: two frames.
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
  }
  expect(dark.length, 'hits on a dark page').toBeGreaterThan(0);
  expect(light.length, 'hits on a white page').toBeGreaterThan(0);
  expect(
    dark.some((s) => s.current),
    'the current hit on the dark cover',
  ).toBe(true);
  for (const s of [...dark, ...light]) {
    expect(
      contrastRatio(s.fill, s.page),
      `${hex(s.fill)} on ${hex(s.page)}`,
    ).toBeGreaterThanOrEqual(3);
  }
  // The text keeps its legibility on the current hit's fill (3:1) on both tones.
  for (const s of [...dark, ...light].filter((h) => h.current)) {
    expect(
      contrastRatio(s.glyph, s.fill),
      `${hex(s.glyph)} on ${hex(s.fill)}`,
    ).toBeGreaterThanOrEqual(3);
  }
  for (const group of [dark, light]) {
    const rest = group.filter((s) => !s.current);
    const current = group.filter((s) => s.current);
    if (rest.length === 0 || current.length === 0) continue;
    expect(contrastRatio(current[0]!.fill, current[0]!.page)).toBeGreaterThan(
      contrastRatio(rest[0]!.fill, rest[0]!.page),
    );
  }
});

test('the scroll bar carries hit ticks on one canvas while Find has hits, and none after', async ({
  page,
}) => {
  await page.goto('./?sample');
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  const ticks = page.locator('canvas[data-scroll-ticks]:not([hidden])');
  await expect(ticks).toHaveCount(0);
  const field = await search(page, 'margin');
  await expect(ticks).toHaveCount(1);
  await field.press('Escape');
  await expect(ticks).toHaveCount(0);
});
