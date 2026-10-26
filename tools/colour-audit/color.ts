/**
 * Colour math for the audit, written from the published formulas (no dependency):
 * - WCAG 2.x relative luminance and contrast ratio (sRGB piecewise transfer, 0.04045 knee).
 * - APCA / SAPC 0.0.98G-4g (apca-w3 0.1.9 constants), signed Lc.
 * - APCA font lookup (apca-w3 0.1.x `fontLookupAPCA`, rows Lc 15-90; see apcaRequired()).
 * - OKLab / OKLCH (Bjorn Ottosson 2020, the CSS Color 4 matrices).
 * - CIELAB D65 and CIEDE2000 (Sharma, Wu, Dalal 2005).
 * - Machado, Oliveira, Fernandes 2009 CVD simulation, severity 1.0, applied in linear sRGB.
 */
export type RGB = [number, number, number]; // 0..255
export type RGBA = [number, number, number, number]; // alpha 0..1

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function hex(c: RGB): string {
  return (
    '#' +
    c
      .map((v) =>
        Math.round(clamp(v, 0, 255))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

export function parseHex(h: string): RGB {
  let s = h.replace('#', '').trim();
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

// ── sRGB transfer ────────────────────────────────────────────────────────────────────────
export const toLin = (v8: number) => {
  const v = v8 / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const fromLin = (l: number) => {
  const v = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;
  return clamp(v) * 255;
};

// ── WCAG 2.x ─────────────────────────────────────────────────────────────────────────────
export function relLum(c: RGB): number {
  return 0.2126 * toLin(c[0]) + 0.7152 * toLin(c[1]) + 0.0722 * toLin(c[2]);
}
export function contrast(a: RGB, b: RGB): number {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** WCAG large text: 18pt (24 px) regular, or 14pt (18.66 px) at weight 700 or more. */
export const isLarge = (px: number, weight: number) => px >= 24 || (px >= 18.66 && weight >= 700);

// ── APCA 0.0.98G ─────────────────────────────────────────────────────────────────────────
const A = {
  trc: 2.4,
  r: 0.2126729,
  g: 0.7151522,
  b: 0.072175,
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scaleBoW: 1.14,
  scaleWoB: 1.14,
  loBoWoffset: 0.027,
  loWoBoffset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1,
};
export function apcaY(c: RGB): number {
  return A.r * (c[0] / 255) ** A.trc + A.g * (c[1] / 255) ** A.trc + A.b * (c[2] / 255) ** A.trc;
}
const soft = (y: number) => (y > A.blkThrs ? y : y + (A.blkThrs - y) ** A.blkClmp);
/** Signed Lc of `txt` on `bg` (positive: dark on light). */
export function apcaLc(txt: RGB, bg: RGB): number {
  const yt = soft(apcaY(txt));
  const yb = soft(apcaY(bg));
  if (Math.abs(yb - yt) < A.deltaYmin) return 0;
  if (yb > yt) {
    const s = (yb ** A.normBG - yt ** A.normTXT) * A.scaleBoW;
    return s < A.loClip ? 0 : (s - A.loBoWoffset) * 100;
  }
  const s = (yb ** A.revBG - yt ** A.revTXT) * A.scaleWoB;
  return s > -A.loClip ? 0 : (s + A.loWoBoffset) * 100;
}

/**
 * apca-w3 0.1.x font lookup: for each Lc row, the minimum font size (CSS px) per weight
 * 100…900. 999 = prohibited, 777 = non-text only. Rows above 90 are not used: the table's
 * own Lc 90 row is the strictest one this audit trusts; a size below the Lc 90 row's
 * minimum is reported as "needs > Lc 90" (requirement 100, which only near-black on
 * near-white reaches).
 */
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const LOOKUP: [number, ...number[]][] = [
  [15, 777, 777, 777, 777, 777, 777, 777, 777, 777],
  [20, 777, 777, 777, 777, 777, 777, 777, 777, 777],
  [25, 777, 777, 777, 120, 120, 108, 96, 96, 96],
  [30, 777, 777, 120, 108, 108, 96, 72, 72, 72],
  [35, 777, 120, 108, 96, 72, 60, 48, 48, 48],
  [40, 120, 108, 96, 60, 48, 42, 32, 32, 32],
  [45, 108, 96, 72, 42, 32, 28, 24, 24, 24],
  [50, 96, 72, 60, 32, 28, 24, 21, 21, 21],
  [55, 80, 60, 48, 28, 24, 21, 18, 18, 18],
  [60, 72, 48, 42, 24, 21, 18, 16, 16, 18],
  [65, 68, 46, 32, 21.75, 19, 17, 15, 16, 18],
  [70, 64, 44, 28, 19.5, 18, 16, 14.5, 16, 18],
  [75, 60, 42, 24, 18, 16, 15, 14, 16, 18],
  [80, 56, 38.25, 23, 17.25, 15.81, 14, 13, 16, 18],
  [85, 52, 34.5, 22, 16.5, 15.625, 13, 12, 16, 18],
  [90, 48, 32, 21, 16, 15.5, 12, 12, 16, 18],
];
/** The minimum |Lc| the lookup asks for `px` at `weight` (nearest lower weight column). */
export function apcaRequired(px: number, weight: number): number {
  let col = 0;
  for (let i = 0; i < WEIGHTS.length; i++) if (weight >= WEIGHTS[i] - 50) col = i;
  for (const row of LOOKUP) {
    const min = row[col + 1];
    if (min < 777 && px >= min) return row[0];
  }
  return 100;
}
/** For non-text (icons, rings): APCA's guidance is Lc 15 minimum for non-text, Lc 30 for
 * "solid" icons and 45 for fine-line (thin stroke) icons; this audit uses 45 for 16-20 px
 * line icons (stroke 1.5-2 px), 30 above 24 px. */
export function apcaIconRequired(px: number): number {
  return px >= 24 ? 30 : 45;
}

// ── OKLab / OKLCH ────────────────────────────────────────────────────────────────────────
export function oklab(c: RGB): [number, number, number] {
  const r = toLin(c[0]);
  const g = toLin(c[1]);
  const b = toLin(c[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function oklch(c: RGB): { L: number; C: number; H: number } {
  const [L, a, b] = oklab(c);
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H: C < 1e-4 ? 0 : H };
}
export function oklabToRgb(L: number, a: number, b: number): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
export function oklchToRgb(L: number, C: number, H: number): RGB {
  const h = (H * Math.PI) / 180;
  return oklabToRgb(L, C * Math.cos(h), C * Math.sin(h));
}
/** The largest in-gamut sRGB chroma at L, H (bisection). */
export function maxChroma(L: number, H: number): number {
  let lo = 0;
  let hi = 0.5;
  const inGamut = (C: number) => {
    const h = (H * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    return rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);
  };
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ── CIELAB and ΔE2000 ────────────────────────────────────────────────────────────────────
export function lab(c: RGB): [number, number, number] {
  const r = toLin(c[0]);
  const g = toLin(c[1]);
  const b = toLin(c[2]);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function deltaE2000(c1: RGB, c2: RGB): number {
  const [L1, a1, b1] = lab(c1);
  const [L2, a2, b2] = lab(c2);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hp = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(b1, a1p);
  const h2p = hp(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180)
      hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hbp = (h1p + h2p) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

// ── CVD (Machado 2009, severity 1.0) ─────────────────────────────────────────────────────
const MACHADO: Record<string, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
export const CVD = Object.keys(MACHADO) as ('protanopia' | 'deuteranopia' | 'tritanopia')[];
export function simulate(c: RGB, kind: string): RGB {
  const M = MACHADO[kind];
  const v = c.map(toLin);
  return M.map((row) => fromLin(clamp(row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))) as RGB;
}

// ── compositing and CSS parsing ──────────────────────────────────────────────────────────
/** Source-over in gamma space, as browsers composite. */
export function over(fg: RGBA, bg: RGB): RGB {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)) as RGB;
}
/** Parses Chromium computed colours: rgb(), rgba(), color(srgb …), oklch(), oklab(), #hex. */
export function parseCss(s: string): RGBA | null {
  s = s.trim();
  let m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(parseFloat);
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  m = /^color\(srgb ([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1]
      .split(/[\s/]+/)
      .filter(Boolean)
      .map(parseFloat);
    return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1];
  }
  m = /^oklch\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean);
    const L = p[0].endsWith('%') ? parseFloat(p[0]) / 100 : parseFloat(p[0]);
    const rgb = oklchToRgb(L, parseFloat(p[1]), parseFloat(p[2]) || 0);
    return [...rgb, p[3] ? parseFloat(p[3]) : 1];
  }
  m = /^oklab\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean);
    const L = p[0].endsWith('%') ? parseFloat(p[0]) / 100 : parseFloat(p[0]);
    const rgb = oklabToRgb(L, parseFloat(p[1]), parseFloat(p[2]));
    return [...rgb, p[3] ? parseFloat(p[3]) : 1];
  }
  if (s.startsWith('#')) {
    const rgb = parseHex(s);
    const a = s.length === 9 ? parseInt(s.slice(7, 9), 16) / 255 : 1;
    return [...rgb, a];
  }
  if (s === 'transparent') return [0, 0, 0, 0];
  return null;
}

export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
