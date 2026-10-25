/** Node-side metrics for one sample or control, from the decoded screenshots. */
import * as C from './color.ts';
import type { RGB } from './color.ts';
import { boxPixels, type Img } from './png.ts';
import type { Box, RawControl, RawSample } from './collect.ts';

const byLum = (px: RGB[]) => px.map((p) => [C.relLum(p), p] as const).sort((a, b) => a[0] - b[0]);

function medianRgb(px: RGB[]): RGB {
  if (!px.length) return [0, 0, 0];
  const ch = [0, 1, 2].map((i) => px.map((p) => p[i]).sort((a, b) => a - b)[px.length >> 1]);
  return ch as RGB;
}

export interface SampleMetrics {
  fg: string | null;
  fgEffective: string | null;
  bgMedian: string;
  bgP10Dark: string;
  bgBright: string;
  bgSpreadL: number; // OKLCH L range p05..p95 behind the text
  wcagMedian: number | null;
  wcagWorst: number | null;
  wcagP10: number | null;
  apcaMedian: number | null;
  apcaWorst: number | null;
  apcaRequired: number | null;
  large: boolean;
  passAA: boolean | null;
  passAAA: boolean | null;
  passAPCA: boolean | null;
  apcaUse: string;
  apcaBronzeRequired: number | null;
  passAPCABronze: boolean | null;
  apcaPreferred90: boolean | null;
  passAAWorst: boolean | null;
  renderedInk: string | null;
  renderedInkContrast: number | null;
  exempt: string | null;
}

export function analyseSample(s: RawSample, A: Img, B: Img, dpr: number): SampleMetrics {
  const px = boxPixels(B, s.box, dpr);
  const sorted = byLum(px);
  const n = sorted.length;
  const med = n ? sorted[n >> 1][1] : ([0, 0, 0] as RGB);
  const p10 = n ? sorted[Math.floor(n * 0.1)][1] : med;
  const bright = n ? sorted[n - 1][1] : med;
  const ls = px.map((p) => C.oklch(p).L).sort((a, b) => a - b);
  const spread = n ? ls[Math.floor(n * 0.95)] - ls[Math.floor(n * 0.05)] : 0;
  // Ink as rendered: the pixel in A that departs most from B at the same place.
  const pa = boxPixels(A, s.box, dpr);
  let ink: RGB | null = null;
  let best = 0;
  for (let i = 0; i < Math.min(pa.length, px.length); i++) {
    const d = Math.abs(C.relLum(pa[i]) - C.relLum(px[i]));
    if (d > best) {
      best = d;
      ink = pa[i];
    }
  }
  const parsed = s.color ? C.parseCss(s.color) : null;
  const exempt = s.disabled ? 'disabled (WCAG 1.4.3 exception)' : null;
  const large = s.kind === 'icon' ? false : C.isLarge(s.fontSize, s.weight);
  if (!parsed || parsed[3] * s.opacity < 0.02) {
    return {
      fg: s.color,
      fgEffective: null,
      bgMedian: C.hex(med),
      bgP10Dark: C.hex(p10),
      bgBright: C.hex(bright),
      bgSpreadL: C.round(spread, 3),
      wcagMedian: null,
      wcagWorst: null,
      wcagP10: null,
      apcaMedian: null,
      apcaWorst: null,
      apcaRequired: null,
      large,
      passAA: null,
      passAAA: null,
      passAPCA: null,
      apcaUse: '',
      apcaBronzeRequired: null,
      passAPCABronze: null,
      apcaPreferred90: null,
      passAAWorst: null,
      renderedInk: ink ? C.hex(ink) : null,
      renderedInkContrast: ink ? C.round(C.contrast(ink, med)) : null,
      exempt: parsed ? 'transparent' : 'gradient or unparsed fill',
    };
  }
  const alpha = parsed[3] * s.opacity;
  const fgOn = (bg: RGB) => C.over([parsed[0], parsed[1], parsed[2], alpha], bg);
  const fgMed = fgOn(med);
  const crs = px.map((p) => [C.contrast(fgOn(p), p), p] as const).sort((a, b) => a[0] - b[0]);
  const worst = crs.length ? crs[0] : ([C.contrast(fgMed, med), med] as const);
  const p10cr = crs.length ? crs[Math.floor(crs.length * 0.1)][0] : worst[0];
  const crMed = C.contrast(fgMed, med);
  const lcMed = C.apcaLc(fgMed, med);
  const lcWorst = C.apcaLc(fgOn(worst[1]), worst[1]);
  let aa: number;
  let aaa: number | null;
  let req: number;
  if (s.kind === 'icon') {
    aa = 3;
    aaa = null;
    req = C.apcaIconRequired(s.fontSize);
  } else {
    aa = large ? 3 : 4.5;
    aaa = large ? 4.5 : 7;
    req = C.apcaRequired(s.fontSize, s.weight);
  }
  // APCA Bronze use-case levels (readme "Bronze simple mode"): body/fluent text Lc 75, other
  // content and UI text Lc 60, large or bold display Lc 45, placeholder Lc 30 (disabled exempt),
  // icons 45 (fine line, under 24 px) or 30.
  const body = (s.role === 'p' || s.role === 'paragraph') && s.text.length >= 40 && s.fontSize < 24;
  let use = 'ui';
  let bronze = 60;
  if (s.kind === 'icon') {
    use = 'icon';
    bronze = req;
  } else if (s.kind === 'placeholder') {
    use = 'placeholder';
    bronze = 30;
  } else if (s.fontSize >= 36 || (s.fontSize >= 24 && s.weight >= 600)) {
    use = 'display';
    bronze = 45;
  } else if (body) {
    use = 'body';
    bronze = 75;
  }
  return {
    apcaUse: use,
    apcaBronzeRequired: bronze,
    passAPCABronze: Math.abs(lcMed) >= bronze,
    apcaPreferred90: Math.abs(lcMed) >= 90,
    fg: C.hex([parsed[0], parsed[1], parsed[2]]) + (alpha < 0.999 ? `@${C.round(alpha, 2)}` : ''),
    fgEffective: C.hex(fgMed),
    bgMedian: C.hex(med),
    bgP10Dark: C.hex(p10),
    bgBright: C.hex(bright),
    bgSpreadL: C.round(spread, 3),
    wcagMedian: C.round(crMed),
    wcagWorst: C.round(worst[0]),
    wcagP10: C.round(p10cr),
    apcaMedian: C.round(lcMed, 1),
    apcaWorst: C.round(lcWorst, 1),
    apcaRequired: req,
    large,
    passAA: crMed >= aa,
    passAAA: aaa === null ? null : crMed >= aaa,
    passAPCA: Math.abs(lcMed) >= req,
    passAAWorst: worst[0] >= aa,
    renderedInk: ink ? C.hex(ink) : null,
    renderedInkContrast: ink ? C.round(C.contrast(ink, med)) : null,
    exempt,
  };
}

/** Median colours of rows at offset d (css px, + inward) along the top and bottom edges. */
function edgeProfile(img: Img, b: Box, dpr: number, radius: number, from: number, to: number) {
  const prof = new Map<number, RGB>();
  const inset = Math.min(b.w / 2 - 1, Math.max(radius, b.w * 0.25));
  const x0 = Math.round((b.x + inset) * dpr);
  const x1 = Math.round((b.x + b.w - inset) * dpr);
  for (let d = from; d <= to; d += 1 / dpr) {
    if (d > b.h / 2) break;
    const px: RGB[] = [];
    for (const yCss of [b.y + d, b.y + b.h - d - 1 / dpr]) {
      const y = Math.round(yCss * dpr);
      if (y < 0 || y >= img.height) continue;
      for (
        let x = Math.max(0, x0);
        x < Math.min(img.width, x1);
        x += Math.max(1, Math.floor((x1 - x0) / 60))
      ) {
        const o = (y * img.width + x) * 4;
        px.push([img.data[o], img.data[o + 1], img.data[o + 2]]);
      }
    }
    if (px.length) prof.set(Math.round(d * 100) / 100, medianRgb(px));
  }
  return prof;
}

export interface ControlMetrics {
  surround: string;
  interior: string;
  edgeBest: string;
  edgeBestOffset: number;
  edgeContrast: number; // best edge row vs surround (1.4.11 boundary)
  fillContrast: number; // interior vs surround
  pass3: boolean;
}

export function analyseControl(c: RawControl, B: Img, dpr: number): ControlMetrics | null {
  const glass = c.kind === 'glass';
  const outer = glass ? -6 : -3;
  const prof = edgeProfile(B, c.box, dpr, c.radius, outer, glass ? 3 : 3);
  const sur = [...prof.entries()].filter(([d]) => d <= outer + 0.6).map(([, v]) => v);
  if (!sur.length) return null;
  const surround = medianRgb(sur);
  const ins = Math.max(3, Math.min(c.box.h, c.box.w) * 0.3);
  const interior = medianRgb(
    boxPixels(
      B,
      {
        x: c.box.x + ins,
        y: c.box.y + ins,
        w: Math.max(1, c.box.w - 2 * ins),
        h: Math.max(1, c.box.h - 2 * ins),
      },
      dpr,
    ),
  );
  let best: RGB = surround;
  let bestD = 0;
  let bestCr = 1;
  for (const [d, v] of prof) {
    if (d <= outer + 0.6) continue;
    const cr = C.contrast(v, surround);
    if (cr > bestCr) {
      bestCr = cr;
      best = v;
      bestD = d;
    }
  }
  const fill = C.contrast(interior, surround);
  return {
    surround: C.hex(surround),
    interior: C.hex(interior),
    edgeBest: C.hex(best),
    edgeBestOffset: bestD,
    edgeContrast: C.round(bestCr),
    fillContrast: C.round(fill),
    pass3: Math.max(bestCr, fill) >= 3,
  };
}

/** Share of the screenshot within ΔE2000 8 of lime (#c8fb3d), sampled on a 2 px grid. */
export function limeArea(img: Img): { share: number; pixels: number } {
  const lime: RGB = [200, 251, 61];
  let hit = 0;
  let total = 0;
  for (let y = 0; y < img.height; y += 2)
    for (let x = 0; x < img.width; x += 2) {
      const o = (y * img.width + x) * 4;
      total++;
      const r = img.data[o];
      const g = img.data[o + 1];
      const b = img.data[o + 2];
      if (g < 170 || b > 150 || r < 120) continue;
      if (C.deltaE2000([r, g, b], lime) < 8) hit++;
    }
  return { share: C.round((hit / total) * 100, 3), pixels: hit };
}
