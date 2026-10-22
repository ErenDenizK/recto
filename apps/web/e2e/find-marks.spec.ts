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

interface Sample {
  readonly fill: Rgb;
  readonly page: Rgb;
  readonly current: boolean;
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
    if (b.w < 6 || b.h < 6 || b.x < 14 || b.y < 14) continue;
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
    out.push({
      fill: modeColour(image, [[x0 + 1, y0 + 1, x1 - 1, y1 - 1]]),
      page: modeColour(image, ring),
      current: b.current,
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
  await search(page, 'the');
  await expect(page.locator('[data-testid="search-highlights"]').first()).toBeVisible();
  // Let the render settle under the hits.
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible();

  const dark: Sample[] = [];
  const light: Sample[] = [];
  // Walk the document a screen at a time, sampling every hit that shows.
  const viewport = page.locator('main [role="region"], main').first();
  for (let step = 0; step < 12; step++) {
    for (const s of await sampleHits(page)) (luminance(s.page) < 4 ? dark : light).push(s);
    await viewport.evaluate((el) => {
      const scroller = [...el.querySelectorAll('*')].find(
        (n) => n.scrollHeight > n.clientHeight + 50 && getComputedStyle(n).overflowY !== 'visible',
      );
      (scroller ?? el).scrollBy(0, (scroller ?? el).clientHeight * 0.8);
    });
    await page.waitForTimeout(250);
    if (dark.length > 2 && light.length > 2) break;
  }
  expect(dark.length, 'hits on a dark page').toBeGreaterThan(0);
  expect(light.length, 'hits on a white page').toBeGreaterThan(0);
  for (const s of [...dark, ...light]) {
    expect(
      contrastRatio(s.fill, s.page),
      `${hex(s.fill)} on ${hex(s.page)}`,
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
  const field = await search(page, 'the');
  await expect(ticks).toHaveCount(1);
  await field.press('Escape');
  await expect(ticks).toHaveCount(0);
});
