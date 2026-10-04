/**
 * Rendered pixels of glass (research 22 §3.2; components/09-primitives.md §28; docs/specs/
 * redesign.md D0-1). The contrast model in `src/styles/tokens.test.ts` cannot see the
 * compositor: a blur that is large against a surface lets the unfiltered page leak in, and only
 * rendered pixels show it. This helper takes them the one way that shows backdrop filters.
 *
 * - **Full-viewport screenshots only.** A clipped Playwright screenshot (`clip:`) came back
 *   with the unfiltered colours, as if no backdrop filter ran (research 22 §3.2), so the whole
 *   viewport is captured and cropped here, at CSS pixel scale.
 * - **A 4 × 4 median** at a text-free point, which ignores a stray antialiased pixel.
 * - **The model**, from the surface's own computed style: its tint (`background-color`) laid
 *   over its backdrop filter's `saturate()`, `brightness()` and `contrast()` applied to a
 *   uniform backdrop, per sRGB channel and rounded to 8 bits as the compositor writes it. Over
 *   a uniform backdrop the blur changes nothing, so what renders differs from the model only by
 *   what leaks in (1 − c of the coverage rule).
 *
 * The PNG decoder handles what Playwright writes: 8-bit RGB or RGBA, not interlaced.
 */
import { inflateSync } from 'node:zlib';

import type { Locator, Page } from '@playwright/test';

export type Rgb = readonly [number, number, number];

export interface Image {
  readonly width: number;
  readonly height: number;
  /** RGBA, row by row. */
  readonly data: Uint8Array;
}

/** The PNG of a Playwright screenshot as RGBA pixels. */
export function decodePng(png: Buffer): Image {
  const signature = '89504e470d0a1a0a';
  if (png.subarray(0, 8).toString('hex') !== signature) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('latin1', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const colour = body[9];
      const interlace = body[12];
      if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) {
        throw new Error(`unsupported PNG (depth ${depth}, colour type ${colour})`);
      }
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? (row[i - channels] ?? 0) : 0;
      const up = previous[i] ?? 0;
      const upLeft = i >= channels ? (previous[i - channels] ?? 0) : 0;
      const value = line[i] ?? 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) {
        throw new Error(`bad PNG filter ${filter}`);
      }
      row[i] = (value + predicted) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        out[(y * width + x) * 4 + c] = c < channels ? (row[x * channels + c] ?? 0) : 255;
      }
    }
    previous = row;
  }
  return { width, height, data: out };
}

/**
 * A screenshot of the whole viewport (never clipped: clipped ones skip backdrop filters), at
 * CSS pixel scale, with animations finished and the caret hidden.
 */
export async function fullViewportPixels(page: Page): Promise<Image> {
  const png = await page.screenshot({
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
  return decodePng(png);
}

/** The per-channel median of the 4 × 4 pixels whose top-left corner is (`x`, `y`). */
export function median4x4(image: Image, x: number, y: number): Rgb {
  const left = Math.round(x);
  const top = Math.round(y);
  if (left < 0 || top < 0 || left + 4 > image.width || top + 4 > image.height) {
    throw new Error(
      `4 × 4 sample at ${left}, ${top} is outside the ${image.width} × ${image.height} image`,
    );
  }
  const channel = (c: number): number => {
    const values: number[] = [];
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        values.push(image.data[((top + dy) * image.width + left + dx) * 4 + c] ?? 0);
      }
    }
    values.sort((a, b) => a - b);
    // The median of sixteen: the mean of the middle two, rounded.
    return Math.round(((values[7] ?? 0) + (values[8] ?? 0)) / 2);
  };
  return [channel(0), channel(1), channel(2)];
}

/** What a glass surface paints: its tint and its backdrop filter, from the computed style. */
export interface GlassStyle {
  readonly background: string;
  readonly backdropFilter: string;
}

export async function glassStyle(surface: Locator): Promise<GlassStyle> {
  return surface.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      background: style.backgroundColor,
      backdropFilter:
        style.getPropertyValue('backdrop-filter') ||
        style.getPropertyValue('-webkit-backdrop-filter'),
    };
  });
}

const clamp = (v: number) => Math.min(255, Math.max(0, v));

/** Filter Effects `saturate()`, in sRGB as the engines apply CSS filters. */
function saturate([r, g, b]: Rgb, s: number): Rgb {
  return [
    clamp((0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b),
    clamp((0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b),
    clamp((0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b),
  ];
}

/**
 * The model of a glass surface over a uniform `backdrop`: its filter chain in order (the blur
 * changes nothing on a uniform backdrop), then its tint over the result, rounded to 8 bits.
 */
export function glassModel(style: GlassStyle, backdrop: Rgb): Rgb {
  const tint = /rgba?\(([^)]+)\)/
    .exec(style.background)?.[1]
    ?.split(/[\s,/]+/)
    .filter(Boolean);
  if (!tint || tint.length < 3) throw new Error(`no tint in ${style.background}`);
  const [tr, tg, tb] = tint.slice(0, 3).map(Number) as [number, number, number];
  const alpha = tint[3] === undefined ? 1 : Number(tint[3]);
  let filtered: Rgb = backdrop;
  for (const [, fn, amount] of style.backdropFilter.matchAll(
    /(saturate|brightness|contrast)\(([\d.]+)\)/g,
  )) {
    const k = Number(amount);
    if (fn === 'saturate') filtered = saturate(filtered, k);
    else if (fn === 'brightness') filtered = filtered.map((v) => clamp(v * k)) as unknown as Rgb;
    else filtered = filtered.map((v) => clamp((v - 127.5) * k + 127.5)) as unknown as Rgb;
  }
  return [
    Math.round(clamp(alpha * tr + (1 - alpha) * filtered[0])),
    Math.round(clamp(alpha * tg + (1 - alpha) * filtered[1])),
    Math.round(clamp(alpha * tb + (1 - alpha) * filtered[2])),
  ];
}

/** The largest per-channel difference between two colours, in 8-bit levels. */
export function channelDistance(a: Rgb, b: Rgb): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** WCAG 2.2 contrast ratio. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const luminance = (c: Rgb) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as unknown as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `#rrggbb` of a colour, for messages. */
export function hex(c: Rgb): string {
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
