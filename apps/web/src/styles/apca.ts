/**
 * APCA lightness contrast (language.md §1.2, ADR-0028; components/09-primitives.md §27): the
 * 0.0.98G-4g constants of apca-w3 0.1.9, as the second check beside WCAG 2.2. `tokens.test.ts`
 * gates primary text at |Lc| ≥ 75 and reports secondary text under 60 as a warning (A-4).
 *
 * Inputs are 8-bit sRGB triplets; the result is signed like apca-w3's `APCAcontrast`: positive
 * for dark text on a light background, negative for light text on a dark one. Callers compare
 * `Math.abs(lc)`.
 */

export type Rgb8 = readonly [number, number, number];

const MAIN_TRC = 2.4;
const R_CO = 0.2126729;
const G_CO = 0.7151522;
const B_CO = 0.072175;
const NORM_BG = 0.56;
const NORM_TXT = 0.57;
const REV_TXT = 0.62;
const REV_BG = 0.65;
const BLK_THRS = 0.022;
const BLK_CLMP = 1.414;
const SCALE_BOW = 1.14;
const SCALE_WOB = 1.14;
const LO_BOW_OFFSET = 0.027;
const LO_WOB_OFFSET = 0.027;
const DELTA_Y_MIN = 0.0005;
const LO_CLIP = 0.1;

/** APCA's screen luminance: a simple 2.4 power per channel, no linear toe (unlike WCAG). */
export function apcaY(rgb: Rgb8): number {
  const [r, g, b] = rgb.map((v) => (v / 255) ** MAIN_TRC) as [number, number, number];
  return R_CO * r + G_CO * g + B_CO * b;
}

/** The soft clamp near black that APCA applies to both luminances. */
function softClamp(y: number): number {
  return y > BLK_THRS ? y : y + (BLK_THRS - y) ** BLK_CLMP;
}

/** Lc of `text` on `background`, ×100 as apca-w3 reports it. */
export function apcaContrast(text: Rgb8, background: Rgb8): number {
  const yText = softClamp(apcaY(text));
  const yBg = softClamp(apcaY(background));
  if (Math.abs(yBg - yText) < DELTA_Y_MIN) return 0;
  if (yBg > yText) {
    const sapc = (yBg ** NORM_BG - yText ** NORM_TXT) * SCALE_BOW;
    return sapc < LO_CLIP ? 0 : (sapc - LO_BOW_OFFSET) * 100;
  }
  const sapc = (yBg ** REV_BG - yText ** REV_TXT) * SCALE_WOB;
  return sapc > -LO_CLIP ? 0 : (sapc + LO_WOB_OFFSET) * 100;
}
