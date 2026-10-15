/**
 * GPU glass, the pure parts (decisions GLS-7, GLS-12…GLS-15; research 23 §5.4): where a piece
 * is, which pixels of the shared canvas it may touch (the scissor), how a page's canvas maps to
 * texture coordinates, and the material read from the piece's own CSS (tint, the tier's filter,
 * the scroll-edge gradient). No DOM and no WebGL here, so all of it is unit-tested.
 *
 * Coordinates are CSS px of the viewport (`getBoundingClientRect`), y down. The canvas covers
 * the viewport at `dpr` canvas px per CSS px (capped at 2); WebGL's scissor counts y up.
 */

/** A box in CSS px of the viewport. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A piece as the shader reads it: centre, half size and corner radius, CSS px. */
export interface PieceShape {
  readonly cx: number;
  readonly cy: number;
  readonly hw: number;
  readonly hh: number;
  readonly radius: number;
}

/** The canvas's pixel ratio: the device's, never above 2 (GLS-12), never below 1. */
export const MAX_GLASS_DPR = 2;

export function glassDpr(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1;
  return Math.min(MAX_GLASS_DPR, Math.max(1, devicePixelRatio));
}

/**
 * The shape of a piece from its on-screen box and its CSS corner radius. `scale` is the box's
 * width over its layout width (a press `scale` or a transform scales the radius too); a
 * capsule's 999 px radius clamps to the shorter half side, as CSS does.
 */
export function pieceShape(box: Box, radius: number, scale = 1): PieceShape {
  const hw = box.width / 2;
  const hh = box.height / 2;
  return {
    cx: box.left + hw,
    cy: box.top + hh,
    hw,
    hh,
    radius: Math.max(0, Math.min(radius * scale, hw, hh)),
  };
}

/** WebGL's scissor box, canvas px, y up. */
export interface Scissor {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The scissor of one piece: its box grown by `margin` CSS px (antialiasing), in canvas pixels,
 * clipped to the canvas, rounded outwards; `null` when nothing of it is on the canvas. Only
 * these pixels are shaded (GLS-5): the rest of the canvas is cleared and stays clear.
 */
export function scissorFor(
  box: Box,
  margin: number,
  dpr: number,
  canvasWidth: number,
  canvasHeight: number,
): Scissor | null {
  const left = Math.max(0, Math.floor((box.left - margin) * dpr));
  const top = Math.max(0, Math.floor((box.top - margin) * dpr));
  const right = Math.min(canvasWidth, Math.ceil((box.left + box.width + margin) * dpr));
  const bottom = Math.min(canvasHeight, Math.ceil((box.top + box.height + margin) * dpr));
  if (right <= left || bottom <= top) return null;
  return { x: left, y: canvasHeight - bottom, width: right - left, height: bottom - top };
}

/** Whether two boxes overlap once `a` is grown by `margin` on every side. */
export function overlaps(a: Box, b: Box, margin = 0): boolean {
  return (
    a.left - margin < b.left + b.width &&
    b.left < a.left + a.width + margin &&
    a.top - margin < b.top + b.height &&
    b.top < a.top + a.height + margin
  );
}

/**
 * A page's canvas as the shader samples it: its on-screen box (scroll, zoom and a pinch's
 * transform are all in it, so nothing else needs mapping) and its texels per CSS px, which turn
 * the material's blur σ into a mip level. `uv = (p − box.xy) / box.wh`.
 */
export interface PageMap {
  readonly box: Box;
  /** Texels per CSS px across (the bitmap's own scale on screen). */
  readonly texelsPerPx: number;
}

export function pageMap(box: Box, textureWidth: number): PageMap {
  return { box, texelsPerPx: box.width > 0 ? textureWidth / box.width : 1 };
}

/** The texture coordinate of viewport point (x, y) on a page, unclamped. */
export function pageUv(map: PageMap, x: number, y: number): [number, number] {
  const { box } = map;
  return [(x - box.left) / box.width, (y - box.top) / box.height];
}

/**
 * The mip level that blurs by `sigma` CSS px: a level-L texel covers 2^L texels, and the
 * shader's four bilinear taps around it spread to σ ≈ 0.65 · 2^L texels.
 */
export function blurLevel(sigma: number, texelsPerPx: number): number {
  const texels = sigma * texelsPerPx;
  if (texels <= 0.65) return 0;
  return Math.log2(texels / 0.65);
}

/** The pages that can show under a piece: those overlapping its box grown by `reach`. */
export function pagesUnder<T extends { readonly box: Box }>(
  piece: Box,
  pages: readonly T[],
  reach: number,
  limit: number,
): T[] {
  const under: T[] = [];
  for (const page of pages) {
    if (under.length >= limit) break;
    if (overlaps(piece, page.box, reach)) under.push(page);
  }
  return under;
}

/** A colour, 0–1 per channel, alpha 0–1. */
export type Rgba = readonly [number, number, number, number];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * A computed CSS colour: `rgb()`/`rgba()` (comma or space syntax, with a slash alpha) or
 * `color(srgb r g b / a)`, which Chromium and WebKit serialise `color-mix()` results to;
 * `transparent` is clear. `null` for anything else.
 */
export function parseCssColor(value: string): Rgba | null {
  const text = value.trim().toLowerCase();
  if (text === 'transparent') return [0, 0, 0, 0];
  const rgb = /^rgba?\(([^)]*)\)$/.exec(text);
  const srgb = /^color\(srgb\s+([^)]*)\)$/.exec(text);
  const body = rgb?.[1] ?? srgb?.[1];
  if (body === undefined) return null;
  const parts = body
    .replace('/', ' ')
    .split(/[\s,]+/)
    .filter((part) => part !== '');
  if (parts.length < 3) return null;
  const channel = (part: string, scale: number) =>
    part.endsWith('%') ? Number.parseFloat(part) / 100 : Number.parseFloat(part) / scale;
  const scale = rgb ? 255 : 1;
  const [r, g, b] = parts.slice(0, 3).map((part) => channel(part, scale)) as [
    number,
    number,
    number,
  ];
  const alphaPart = parts[3];
  const a = alphaPart === undefined ? 1 : channel(alphaPart, 1);
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
}

/** The tier's backdrop filter: `blur() saturate() [contrast()] brightness()` (materials.css). */
export interface FilterRecipe {
  readonly blur: number;
  readonly saturate: number;
  readonly contrast: number;
  readonly brightness: number;
}

export const NEUTRAL_FILTER: FilterRecipe = { blur: 0, saturate: 1, contrast: 1, brightness: 1 };

/**
 * A computed `backdrop-filter` (`blur(10px) saturate(1.8) brightness(0.44)`), function by
 * function; what the shader does not model (`url()`, the lens) is skipped. `none` is neutral.
 */
export function parseFilter(value: string): FilterRecipe {
  let { blur, saturate, contrast, brightness } = NEUTRAL_FILTER;
  for (const [, name, arg] of value.matchAll(/([a-z-]+)\(([^)]*)\)/g)) {
    const amount = (arg ?? '').trim();
    const number = amount.endsWith('%')
      ? Number.parseFloat(amount) / 100
      : Number.parseFloat(amount);
    if (!Number.isFinite(number)) continue;
    if (name === 'blur') blur = number;
    else if (name === 'saturate') saturate = number;
    else if (name === 'contrast') contrast = number;
    else if (name === 'brightness') brightness = number;
  }
  return { blur, saturate, contrast, brightness };
}

/** One stop of a vertical gradient: its colour and its position from the top, CSS px. */
export interface GradientStop {
  readonly color: Rgba;
  readonly at: number;
}

/** A stop position: `12px`, `40%`, or `calc(100% - 40px)` as engines serialise it. */
function stopPosition(text: string | undefined, height: number): number | undefined {
  if (text === undefined || text === '') return undefined;
  const calc = /^calc\(\s*([\d.]+)%\s*([+-])\s*([\d.]+)px\s*\)$/.exec(text);
  if (calc) {
    const sign = calc[2] === '-' ? -1 : 1;
    return (Number(calc[1]) / 100) * height + sign * Number(calc[3]);
  }
  if (text.endsWith('%')) return (Number.parseFloat(text) / 100) * height;
  if (text.endsWith('px') || /^-?[\d.]+$/.test(text)) return Number.parseFloat(text);
  return undefined;
}

/**
 * A computed top-to-bottom `linear-gradient()` (the scroll edge's tint and its mask), as stops
 * in CSS px over a box `height` px tall; positions left out are spread evenly, as CSS does.
 * `null` when it is not one (another direction, a second layer, a colour not understood): the
 * caller then keeps the piece on CSS.
 */
export function parseVerticalGradient(value: string, height: number): GradientStop[] | null {
  const text = value.trim();
  const open = /^linear-gradient\(/i.exec(text);
  if (!open || !text.endsWith(')')) return null;
  const inner = text.slice(open[0].length, -1);
  // Split on top-level commas.
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      args.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(inner.slice(start).trim());
  if (args.length > 0 && /^(to bottom|180deg)$/i.test(args[0] ?? '')) args.shift();
  if (args.length < 2) return null;
  const parsed: { color: Rgba; at: number | undefined }[] = [];
  for (const arg of args) {
    const match = /^((?:rgba?|color)\([^)]*\)|transparent)\s*(.*)$/i.exec(arg);
    if (!match) return null;
    const color = parseCssColor(match[1] ?? '');
    if (!color) return null;
    parsed.push({ color, at: stopPosition(match[2]?.trim(), height) });
  }
  const first = parsed[0];
  const last = parsed.at(-1);
  if (first && first.at === undefined) first.at = 0;
  if (last && last.at === undefined) last.at = height;
  // Spread the missing positions between their known neighbours; never backwards.
  let known = 0;
  for (let i = 1; i < parsed.length; i++) {
    const stop = parsed[i];
    if (stop?.at === undefined) continue;
    const from = parsed[known]?.at ?? 0;
    for (let j = known + 1; j < i; j++) {
      const between = parsed[j];
      if (between) between.at = from + ((stop.at - from) * (j - known)) / (i - known);
    }
    known = i;
  }
  let floor = 0;
  return parsed.map(({ color, at }) => {
    floor = Math.max(floor, at ?? floor);
    return { color, at: floor };
  });
}

/** The gradient's colour at `y` px, linear between stops (straight alpha, as CSS interpolates
 * premultiplied; equal for stops of one colour, which is what the edge uses). */
export function gradientAt(stops: readonly GradientStop[], y: number): Rgba {
  const first = stops[0];
  if (!first) return [0, 0, 0, 0];
  if (y <= first.at) return first.color;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1] as GradientStop;
    const b = stops[i] as GradientStop;
    if (y <= b.at) {
      const t = b.at > a.at ? (y - a.at) / (b.at - a.at) : 1;
      return a.color.map((value, k) => value + ((b.color[k] ?? 0) - value) * t) as unknown as Rgba;
    }
  }
  return (stops.at(-1) as GradientStop).color;
}

/** Relative luminance (WCAG) of an sRGB colour, 0–1 per channel. */
export function luminance([r, g, b]: Rgba | readonly [number, number, number]): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * The legibility floor's bound on the glass's luminance (GLS-14): the darkest (for dark text)
 * or brightest (for light text) the glass may be for `ratio`:1 against text of luminance
 * `text`. Returns `[bound, textIsLight]`.
 */
export function legibilityBound(text: number, ratio: number): [number, boolean] {
  const light = text > 0.4;
  const bound = light ? (text + 0.05) / ratio - 0.05 : ratio * (text + 0.05) - 0.05;
  return [Math.min(1, Math.max(0, bound)), light];
}
