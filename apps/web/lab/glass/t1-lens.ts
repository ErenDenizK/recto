/**
 * T1, the backdrop lens for any rounded rectangle (Chromium only): an extension of the app's chip
 * lens (`src/styles/material-lens.ts`) from fixed-size chips to bars, capsules and menus.
 *
 * - **The map** is drawn per size: for every pixel, the SDF of the element's rounded rect gives
 *   the distance to the edge and the outward normal; the bezel profile's slope and Snell's law
 *   (`sdf.ts`) give how far the backdrop is pulled inward. Red and green carry x and y around
 *   128; the scale is twice the largest pull. The app's lens bends x and y separately with two
 *   linear gradients (exact on straight edges, approximate in corners); this map is exact in
 *   corners and on a capsule's round ends, at the price of a bitmap built in script (Q-12 asks
 *   "drawing is code": it is generated, never shipped).
 * - **Dispersion** (optional): three displacement passes, red pulled less and blue more, each
 *   kept to its channel and screened back together. The technique is liquid-glass-react's
 *   (Max Rovensky, MIT), itself after Shu Ding's liquid-glass (MIT).
 * - **Units**: `userSpaceOnUse`, the element's border box with its origin at the top left, as in
 *   Shu Ding's liquid-glass.js; the scale is in CSS px.
 * - Never in a base declaration: Safari and Firefox drop a whole `backdrop-filter` that holds a
 *   `url()` (research 16 §4.2), so the lab sets it inline only where `chromiumBackdropLens()`.
 */
import { bezelSlope, sdRoundRect, snellPull } from './sdf';

export interface LensParams {
  /** Bezel width, CSS px. */
  readonly bezel: number;
  /** Index of refraction (1 = no bend). */
  readonly ior: number;
  /** Glass depth the ray travels, CSS px: scales every pull. */
  readonly depth: number;
  /** Dispersion, 0–1: blue bends up to 15 % more than green, red 15 % less. */
  readonly chroma: number;
  /** Largest pull, CSS px (the rim's last pixel would otherwise reach very far). */
  readonly maxPull: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Whether this engine draws a backdrop `url()` filter (Chromium; the app also asks for GPU). */
export function chromiumBackdropLens(): boolean {
  const brands = (navigator as { userAgentData?: { brands?: { brand: string }[] } }).userAgentData
    ?.brands;
  return Array.isArray(brands) && brands.some((entry) => /chromium/i.test(entry.brand));
}

/** The displacement map of a `w` × `h` box with corner radius `r`, and the pull it encodes. */
export function snellMap(
  w: number,
  h: number,
  r: number,
  params: LensParams,
): { url: string; scale: number } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || w === 0 || h === 0) return { url: '', scale: 0 };
  const rect = { cx: w / 2, cy: h / 2, hw: w / 2, hh: h / 2, r };
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const pull = new Float32Array(w * h * 2);
  let largest = 0.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = sdRoundRect(px, py, rect);
      const inward = -d;
      if (inward <= 0 || inward >= params.bezel) continue;
      const gx = sdRoundRect(px + 0.5, py, rect) - sdRoundRect(px - 0.5, py, rect);
      const gy = sdRoundRect(px, py + 0.5, rect) - sdRoundRect(px, py - 0.5, rect);
      const len = Math.hypot(gx, gy) || 1;
      const amount = Math.min(
        snellPull(bezelSlope(inward, params.bezel), params.ior, params.depth),
        params.maxPull,
      );
      // Inward: against the outward gradient.
      const i = (y * w + x) * 2;
      const px2 = (-gx / len) * amount;
      const py2 = (-gy / len) * amount;
      pull[i] = px2;
      pull[i + 1] = py2;
      largest = Math.max(largest, Math.abs(px2), Math.abs(py2));
    }
  }
  for (let p = 0, i = 0; p < w * h; p++, i += 2) {
    const o = p * 4;
    data[o] = Math.round(128 + (127 * (pull[i] ?? 0)) / largest);
    data[o + 1] = Math.round(128 + (127 * (pull[i + 1] ?? 0)) / largest);
    data[o + 2] = 128;
    data[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  // feDisplacementMap moves by scale × (c / 255 − 0.5): ±largest at c = 128 ± 127.
  return { url: canvas.toDataURL(), scale: (2 * largest * 255) / 254 };
}

function defs(): SVGDefsElement {
  const existing = document.getElementById('lab-lenses');
  if (existing?.firstElementChild instanceof SVGDefsElement) return existing.firstElementChild;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = 'lab-lenses';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const d = document.createElementNS(SVG_NS, 'defs');
  svg.append(d);
  document.body.append(svg);
  return d;
}

function element<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

const CHANNELS = {
  r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
} as const;

let serial = 0;
const cache = new Map<string, string>();

/** The filter id for a box and its parameters, drawn once per key. */
export function lensFilter(w: number, h: number, r: number, params: LensParams): string {
  const key = `${w}x${h}r${r}b${params.bezel}i${params.ior}d${params.depth}c${params.chroma}m${params.maxPull}`;
  const hit = cache.get(key);
  if (hit && document.getElementById(hit)) return hit;
  const { url, scale } = snellMap(w, h, r, params);
  const id = `lab-lens-${++serial}`;
  const filter = element('filter', {
    id,
    x: 0,
    y: 0,
    width: w,
    height: h,
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  });
  filter.append(
    element('feImage', {
      href: url,
      x: 0,
      y: 0,
      width: w,
      height: h,
      preserveAspectRatio: 'none',
      result: 'map',
    }),
  );
  if (params.chroma <= 0) {
    filter.append(
      element('feDisplacementMap', {
        in: 'SourceGraphic',
        in2: 'map',
        scale: scale.toFixed(2),
        xChannelSelector: 'R',
        yChannelSelector: 'G',
      }),
    );
  } else {
    const spread = 0.15 * Math.min(1, params.chroma);
    const passes = [
      ['r', 1 - spread],
      ['g', 1],
      ['b', 1 + spread],
    ] as const;
    for (const [channel, factor] of passes) {
      filter.append(
        element('feDisplacementMap', {
          in: 'SourceGraphic',
          in2: 'map',
          scale: (scale * factor).toFixed(2),
          xChannelSelector: 'R',
          yChannelSelector: 'G',
          result: `d${channel}`,
        }),
        element('feColorMatrix', {
          in: `d${channel}`,
          type: 'matrix',
          values: CHANNELS[channel],
          result: channel,
        }),
      );
    }
    filter.append(
      element('feBlend', { in: 'r', in2: 'g', mode: 'screen', result: 'rg' }),
      element('feBlend', { in: 'rg', in2: 'b', mode: 'screen' }),
    );
  }
  defs().append(filter);
  cache.set(key, id);
  return id;
}

/**
 * The app's chip lens as it ships (`src/styles/material-lens.ts` `lensMap` and `lensFilter`,
 * restated here because the lab may not import app modules: a module shared with the app would
 * split a chunk out of its first-paint path): two linear gradients, neutral inside a 10 px bezel,
 * rising as t^2.2 towards each edge, a 6 px pull, in the box's objectBoundingBox units.
 */
export function currentChipLens(w: number, h: number): string {
  const id = `lab-current-${w}x${h}`;
  if (document.getElementById(id)) return id;
  const bezel = 10;
  const pullPx = 6;
  const stops = (length: number, channel: 'r' | 'g'): string => {
    const out: string[] = [];
    const colour = (value: number) => {
      const v = Math.round(128 + 127 * value);
      return channel === 'r' ? `rgb(${v},0,0)` : `rgb(0,${v},0)`;
    };
    const bend = (d: number) => (d >= bezel ? 0 : (1 - d / bezel) ** 2.2);
    for (let i = 0; i <= 6; i++) {
      const d = (bezel * i) / 6;
      out.push(`<stop offset="${(d / length).toFixed(4)}" stop-color="${colour(bend(d))}"/>`);
    }
    for (let i = 6; i >= 0; i--) {
      const d = (bezel * i) / 6;
      out.push(`<stop offset="${(1 - d / length).toFixed(4)}" stop-color="${colour(-bend(d))}"/>`);
    }
    return out.join('');
  };
  const svg =
    `<svg xmlns="${SVG_NS}" width="${w}" height="${h}">` +
    `<defs><linearGradient id="x" x2="1" y2="0">${stops(w, 'r')}</linearGradient>` +
    `<linearGradient id="y" x2="0" y2="1">${stops(h, 'g')}</linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="#000"/>` +
    `<rect width="${w}" height="${h}" fill="url(#x)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#y)" style="mix-blend-mode:screen"/></svg>`;
  const filter = element('filter', {
    id,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    primitiveUnits: 'objectBoundingBox',
    'color-interpolation-filters': 'sRGB',
  });
  filter.append(
    element('feImage', {
      href: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      preserveAspectRatio: 'none',
      result: 'map',
    }),
    element('feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'map',
      scale: String((2 * pullPx) / w),
      xChannelSelector: 'R',
      yChannelSelector: 'G',
    }),
  );
  defs().append(filter);
  return id;
}

/** Drops every drawn filter (after a parameter change). */
export function clearLenses(): void {
  cache.clear();
  document.getElementById('lab-lenses')?.remove();
}
