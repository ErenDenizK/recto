/**
 * Colour maths for the colour panel (`10-ink.md` §4), pure.
 *
 * - **Stored form.** Colours stay sRGB `#RRGGBB`, upper case: the PDF stores DeviceRGB, and
 *   the stores normalise to that form (`annotations/palette.ts`). Everything else here is a
 *   view of that value.
 * - **HSB** (hue, saturation, brightness; also called HSV) drives the Sliders view, like
 *   Apple's. **HSL** at full saturation is the Spectrum plane: hue across, lightness down,
 *   which is exactly what three stacked sRGB gradients draw (a hue ramp, white fading to
 *   clear over the top half, clear to black over the bottom half), so a point's colour is
 *   the colour under it on every engine.
 * - **OKLCH** (Björn Ottosson's OKLab in polar form) computes the Grid: twelve hue columns,
 *   shades above each hue's most saturated colour and tints below it, plus twelve greys at
 *   even perceptual steps down to a deep grey, then black. A colour outside sRGB keeps its lightness and hue and loses chroma
 *   until it fits (`oklchToHex`). The table is computed with IEEE doubles and rounded to
 *   8 bits, so it is the same on every engine (the unit test pins it).
 * - **Hex input** accepts 3 or 6 digits, with or without `#`, in any case.
 * - **Names** come from a table of 30 named colours (`COLOUR_NAMES`), the nearest in OKLab,
 *   in the active language, so a colour is never announced by its hex alone (§4.3).
 * - **Contrast** (WCAG 2.2) decides whether a swatch needs its thin contrast ring on the
 *   glass behind it (§5).
 */
import { m } from '../../i18n';

/** sRGB channels, 0–255 (unrounded while computing). */
export type Rgb = readonly [number, number, number];

export interface Hsb {
  /** Degrees, 0–360. */
  readonly h: number;
  /** 0–1. */
  readonly s: number;
  /** 0–1. */
  readonly b: number;
}

export interface Hsl {
  /** Degrees, 0–360. */
  readonly h: number;
  /** 0–1. */
  readonly s: number;
  /** 0–1. */
  readonly l: number;
}

export interface Oklch {
  /** Lightness, 0–1. */
  readonly l: number;
  /** Chroma, 0 to about 0.37 in sRGB. */
  readonly c: number;
  /** Hue, degrees. */
  readonly h: number;
}

// --- Hex ---------------------------------------------------------------------------------

/**
 * A typed colour as `#RRGGBB`, or null when it is not one: 3 or 6 hex digits, with or
 * without `#`, any case, surrounding spaces ignored (`1a1`, `#1A1A1A`, ` 1a1a1a `).
 */
export function parseHex(input: string): string | null {
  const text = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(text)) {
    const [r = '', g = '', b = ''] = text.toUpperCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text.toUpperCase()}`;
  return null;
}

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace(/^#/, '').slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function byte(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

/** Rounded, clamped `#RRGGBB`. */
export function rgbToHex(rgb: Rgb): string {
  const [r, g, b] = rgb.map(byte) as [number, number, number];
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

/** `#RRGGBB` at `alpha` as a CSS `rgb()` colour. */
export function cssRgba(hex: string, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex);
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${Math.max(0, alpha)})`;
}

// --- HSB and HSL --------------------------------------------------------------------------

function wrapHue(h: number): number {
  const w = h % 360;
  return w < 0 ? w + 360 : w;
}

/** Hue (degrees), chroma and the max channel of an sRGB colour (channels 0–1). */
function hueOf(r: number, g: number, b: number): { h: number; max: number; min: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: wrapHue(h * 60), max, min };
}

/** HSB of an sRGB colour. A grey has hue 0 and saturation 0. */
export function rgbToHsb(rgb: Rgb): Hsb {
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const { h, max, min } = hueOf(r, g, b);
  return { h, s: max === 0 ? 0 : (max - min) / max, b: max };
}

/** sRGB (0–255, unrounded) of an HSB colour. */
export function hsbToRgb({ h, s, b }: Hsb): Rgb {
  const f = (k: number) => {
    const x = (k + wrapHue(h) / 60) % 6;
    return b - b * s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

export function hsbToHex(hsb: Hsb): string {
  return rgbToHex(hsbToRgb(hsb));
}

/** HSL of an sRGB colour. */
export function rgbToHsl(rgb: Rgb): Hsl {
  const [r, g, b] = rgb.map((v) => v / 255) as [number, number, number];
  const { h, max, min } = hueOf(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

/** sRGB (0–255, unrounded) of an HSL colour. */
export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const a = s * Math.min(l, 1 - l);
  const f = (k: number) => {
    const x = (k + wrapHue(h) / 30) % 12;
    return l - a * Math.max(-1, Math.min(x - 3, 9 - x, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// --- The Spectrum plane -------------------------------------------------------------------

/** The hue ramp's stops at full saturation: the sRGB primaries and secondaries. */
export const HUE_STOPS: readonly string[] = [
  '#FF0000',
  '#FFFF00',
  '#00FF00',
  '#00FFFF',
  '#0000FF',
  '#FF00FF',
  '#FF0000',
];

/**
 * The colour drawn at a point of the Spectrum plane: `x` and `y` from 0 to 1 (hue across,
 * lightness from white at the top to black at the bottom), at full saturation.
 */
export function spectrumColour(x: number, y: number): string {
  const h = Math.min(1, Math.max(0, x)) * 360;
  const l = 1 - Math.min(1, Math.max(0, y));
  return rgbToHex(hslToRgb({ h, s: 1, l }));
}

/** Where a colour sits on the Spectrum plane (`x`, `y` 0–1); a grey keeps `fallbackX`. */
export function spectrumPoint(hex: string, fallbackX = 0): { x: number; y: number } {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return { x: s === 0 ? fallbackX : h / 360, y: 1 - l };
}

/** CSS stops (`#hex p%`) of a hue ramp at saturation `s` and brightness `b` (Sliders view). */
export function hueRamp(s: number, b: number): string {
  return [0, 60, 120, 180, 240, 300, 360]
    .map((h) => `${hsbToHex({ h, s, b })} ${Math.round((h / 360) * 10000) / 100}%`)
    .join(', ');
}

// --- OKLab and OKLCH ------------------------------------------------------------------------

function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return c * 255;
}

/** OKLab of an sRGB colour (Ottosson's matrices, D65). */
export function rgbToOklab(rgb: Rgb): readonly [number, number, number] {
  const [r, g, b] = rgb.map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s,
  ];
}

/** Linear sRGB (0–1, unclamped) of an OKLab colour. */
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const [l, a, b] = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  return { l, c, h: c < 1e-6 ? 0 : wrapHue((Math.atan2(b, a) * 180) / Math.PI) };
}

function oklchLinear({ l, c, h }: Oklch): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  return oklabToLinear(l, c * Math.cos(rad), c * Math.sin(rad));
}

const GAMUT_EPSILON = 1e-7;
/** How far outside sRGB (linear) a converted colour may land and still count as inside. */
const ROUND_TRIP_TOLERANCE = 1e-4;

function inGamut(linear: readonly number[], epsilon = GAMUT_EPSILON): boolean {
  return linear.every((v) => v >= -epsilon && v <= 1 + epsilon);
}

/** Whether an OKLCH colour is inside sRGB. */
export function oklchInGamut(colour: Oklch): boolean {
  return inGamut(oklchLinear(colour));
}

/** The most chroma sRGB holds at this lightness and hue (bisection to 1e-6). */
export function maxChroma(l: number, h: number): number {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchLinear({ l, c: mid, h }))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * `#RRGGBB` of an OKLCH colour, clamped to sRGB by reducing chroma at the same lightness
 * and hue (never by clipping channels, which shifts the hue).
 */
export function oklchToHex(colour: Oklch): string {
  const l = Math.min(1, Math.max(0, colour.l));
  let linear = oklchLinear({ l, c: Math.max(0, colour.c), h: colour.h });
  // The published matrices are inverses only to about 1e-7, so a colour on the gamut's
  // edge (a channel at 0 or 255) comes back a hair outside it: that is clipped, not mapped.
  if (!inGamut(linear, ROUND_TRIP_TOLERANCE)) {
    linear = oklchLinear({ l, c: maxChroma(l, colour.h), h: colour.h });
  }
  const channel = (v: number) => fromLinear(Math.min(1, Math.max(0, v)));
  return rgbToHex([channel(linear[0]), channel(linear[1]), channel(linear[2])]);
}

// --- The Grid -------------------------------------------------------------------------------

/**
 * The Grid's hue columns in OKLCH degrees, left to right, after Apple's: cyan-blue, blue,
 * violet, purple, magenta, red, orange, amber, gold, yellow, yellow-green, green. Warm hues
 * sit closer together, as people tell them apart more finely.
 */
export const GRID_HUES: readonly number[] = [
  232, 262, 292, 322, 356, 28, 48, 68, 86, 104, 124, 144,
];
/** Rows of the Grid below the greys: four shades, the hue's richest colour, four tints. */
export const GRID_ROWS = 9;
const SHADE_L = 0.24;
/** The darkest grey before black. */
const GREY_FLOOR = 0.24;
const TINT_L = 0.955;
/** The middle row's chroma against the cusp: the sRGB edge itself reads as neon. */
const VIVID = 0.86;

/** Lightness and chroma of a hue's most saturated sRGB colour (its cusp). */
export function cusp(h: number): { l: number; c: number } {
  let best = { l: 0.5, c: 0 };
  for (let i = 1; i < 200; i++) {
    const l = i / 200;
    const c = maxChroma(l, h);
    if (c > best.c) best = { l, c };
  }
  // Refine around the coarse peak.
  const from = best.l - 0.005;
  for (let i = 0; i <= 50; i++) {
    const l = from + i * 0.0002;
    const c = maxChroma(l, h);
    if (c > best.c) best = { l, c };
  }
  return best;
}

/** One column of the Grid, top (darkest shade) to bottom (lightest tint). */
function gridColumn(h: number): string[] {
  const top = cusp(h);
  const column: string[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    if (row < 4) {
      // Shades: from a deep shade up to the cusp, chroma rising with lightness.
      const k = (row + 1) / 5;
      const l = SHADE_L + (top.l - SHADE_L) * k;
      const c = top.c * VIVID * (0.5 + 0.5 * k);
      column.push(oklchToHex({ l, c, h }));
    } else if (row === 4) {
      column.push(oklchToHex({ l: top.l, c: top.c * VIVID, h }));
    } else {
      // Tints: towards paper white, chroma falling faster than lightness rises.
      const k = (row - 4) / 5;
      const eased = 1 - (1 - k) ** 1.5;
      const l = top.l + (TINT_L - top.l) * eased;
      const c = top.c * VIVID * (1 - k) ** 1.1;
      column.push(oklchToHex({ l, c, h }));
    }
  }
  return column;
}

export interface ColourGridTable {
  /** Twelve greys, white to black: eleven even OKLab lightness steps, then black. */
  readonly greys: readonly string[];
  /** `GRID_ROWS` rows of twelve colours, darkest row first. */
  readonly rows: readonly (readonly string[])[];
}

function buildGrid(): ColourGridTable {
  // Eleven even steps from white to a deep grey, then black: even steps all the way down
  // would leave the last two greys indistinguishable from black.
  const greys = Array.from({ length: 12 }, (_, i) =>
    oklchToHex({ l: i === 11 ? 0 : 1 - (i * (1 - GREY_FLOOR)) / 10, c: 0, h: 0 }),
  );
  const columns = GRID_HUES.map(gridColumn);
  const rows = Array.from({ length: GRID_ROWS }, (_, row) => columns.map((col) => col[row] ?? ''));
  return { greys, rows };
}

let grid: ColourGridTable | undefined;

/** The Grid's colours (computed once). */
export function colourGrid(): ColourGridTable {
  grid ??= buildGrid();
  return grid;
}

// --- Names ------------------------------------------------------------------------------------

export interface NamedColour {
  readonly hex: string;
  readonly name: () => string;
}

/**
 * Thirty named colours for announcements ("Dark blue" / "Koyu mavi"). The references sit
 * where people put the names, not at even steps, so the nearest name is the one a person
 * would say.
 */
export const COLOUR_NAMES: readonly NamedColour[] = [
  { hex: '#141414', name: m.colour_name_black },
  { hex: '#454545', name: m.colour_name_dark_grey },
  { hex: '#808080', name: m.colour_name_grey },
  { hex: '#C8C8C8', name: m.colour_name_light_grey },
  { hex: '#FFFFFF', name: m.colour_name_white },
  { hex: '#7A1414', name: m.colour_name_dark_red },
  { hex: '#E0201E', name: m.colour_name_red },
  { hex: '#F07890', name: m.colour_name_pink },
  { hex: '#FBD0DA', name: m.colour_name_light_pink },
  { hex: '#D81B7A', name: m.colour_name_magenta },
  { hex: '#6B3D1E', name: m.colour_name_brown },
  { hex: '#C89A6A', name: m.colour_name_tan },
  { hex: '#F07010', name: m.colour_name_orange },
  { hex: '#FFC896', name: m.colour_name_peach },
  { hex: '#F2B705', name: m.colour_name_gold },
  { hex: '#FFE81A', name: m.colour_name_yellow },
  { hex: '#FFF6B4', name: m.colour_name_light_yellow },
  { hex: '#6E6A1C', name: m.colour_name_olive },
  { hex: '#A8D020', name: m.colour_name_yellow_green },
  { hex: '#1E8A32', name: m.colour_name_green },
  { hex: '#0E4A22', name: m.colour_name_dark_green },
  { hex: '#A6E6A0', name: m.colour_name_light_green },
  { hex: '#0E8080', name: m.colour_name_teal },
  { hex: '#18C0E0', name: m.colour_name_cyan },
  { hex: '#A8DCFA', name: m.colour_name_light_blue },
  { hex: '#1A62E8', name: m.colour_name_blue },
  { hex: '#123C9A', name: m.colour_name_dark_blue },
  { hex: '#0C1A4E', name: m.colour_name_navy },
  { hex: '#7A34C8', name: m.colour_name_purple },
  { hex: '#C8B4F0', name: m.colour_name_lavender },
];

type Lab = readonly [number, number, number];

/** OKLab distance with chroma counted twice, so a near-grey keeps a grey's name. */
function distance2(a: Lab, b: Lab): number {
  return (a[0] - b[0]) ** 2 + 2 * ((a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

let nameLabs: Lab[] | undefined;

/** The named colour nearest to `hex` in OKLab. */
export function nearestNamed(hex: string): NamedColour {
  nameLabs ??= COLOUR_NAMES.map((n) => rgbToOklab(hexToRgb(n.hex)));
  const lab = rgbToOklab(hexToRgb(hex));
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  nameLabs.forEach((ref, i) => {
    const d = distance2(lab, ref);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return COLOUR_NAMES[best] ?? (COLOUR_NAMES[0] as NamedColour);
}

/** The colour's name in the active language ("Dark blue"). */
export function colourName(hex: string): string {
  return nearestNamed(hex).name();
}

// --- Contrast ---------------------------------------------------------------------------------

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.2 contrast ratio of two opaque colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The glass a swatch usually sits on (`language.md` §2.2): the bar (M2) and menu (M4) tiers
 * over the dark canvas in the dark theme, over white in the light theme. Over a white page
 * the dark glass composites to a mid grey that no saturated ink clears at 3:1, so ringing
 * against it would ring every ink; the ring is for the colours that vanish into the glass
 * itself, black on dark and white or pale tints on light (§5).
 */
export const SWATCH_BACKDROPS = {
  dark: ['#131418', '#1B1D22'],
  light: ['#FBFBFD', '#F8F9FB'],
} as const;

/** Least contrast of a swatch's edge against the glass (WCAG 1.4.11). */
export const SWATCH_EDGE_MIN = 3;

/**
 * Whether a swatch of this colour needs its contrast ring (§5): below 3:1 against the
 * theme's glass, as black is on dark glass and white on light glass.
 */
export function needsContrastRing(hex: string, theme: 'dark' | 'light'): boolean {
  return SWATCH_BACKDROPS[theme].some((under) => contrast(hex, under) < SWATCH_EDGE_MIN);
}
