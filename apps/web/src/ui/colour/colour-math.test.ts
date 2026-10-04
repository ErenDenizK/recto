import { afterEach, describe, expect, it } from 'vitest';

import { setLocale } from '../../i18n';
import {
  COLOUR_NAMES,
  colourGrid,
  colourName,
  contrast,
  cusp,
  hexToRgb,
  hsbToHex,
  hslToRgb,
  hueRamp,
  maxChroma,
  needsContrastRing,
  oklchInGamut,
  oklchToHex,
  parseHex,
  rgbToHex,
  rgbToHsb,
  rgbToHsl,
  rgbToOklch,
  spectrumColour,
  spectrumPoint,
} from './colour-math';

afterEach(() => {
  setLocale('en');
});

/** A deterministic sample of sRGB colours: a 9-level cube plus the ink palette. */
function sample(): string[] {
  const levels = [0, 1, 31, 64, 127, 128, 200, 254, 255];
  const out: string[] = ['#1A1A1A', '#1760EE', '#DB1C22', '#02853C', '#8036D3', '#FFEA00'];
  for (const r of levels)
    for (const g of levels) for (const b of levels) out.push(rgbToHex([r, g, b]));
  return out;
}

describe('hex', () => {
  it('parses 3 or 6 digits, with or without #, in any case', () => {
    expect(parseHex('#1a1a1a')).toBe('#1A1A1A');
    expect(parseHex('1A1A1A')).toBe('#1A1A1A');
    expect(parseHex('abc')).toBe('#AABBCC');
    expect(parseHex('#FfF')).toBe('#FFFFFF');
    expect(parseHex('  #0a0B0c ')).toBe('#0A0B0C');
  });

  it('rejects anything else', () => {
    for (const bad of ['', '#', '12', '1234', '12345', '1234567', '#ggg', 'red', '##123']) {
      expect(parseHex(bad)).toBeNull();
    }
  });

  it('writes upper case and clamps', () => {
    expect(rgbToHex([26, 26, 26])).toBe('#1A1A1A');
    expect(rgbToHex([300, -4, 127.6])).toBe('#FF0080');
    expect(hexToRgb('#1760EE')).toEqual([23, 96, 238]);
  });
});

describe('conversions round-trip', () => {
  it('sRGB ⇄ HSB is exact after rounding', () => {
    for (const hex of sample()) expect(hsbToHex(rgbToHsb(hexToRgb(hex)))).toBe(hex);
  });

  it('sRGB ⇄ HSL is exact after rounding', () => {
    for (const hex of sample()) expect(rgbToHex(hslToRgb(rgbToHsl(hexToRgb(hex))))).toBe(hex);
  });

  it('sRGB ⇄ OKLCH is exact after rounding', () => {
    for (const hex of sample()) expect(oklchToHex(rgbToOklch(hexToRgb(hex)))).toBe(hex);
  });

  it('gives known HSB values', () => {
    expect(rgbToHsb([255, 0, 0])).toEqual({ h: 0, s: 1, b: 1 });
    const blue = rgbToHsb(hexToRgb('#0000FF'));
    expect(blue.h).toBe(240);
    expect(rgbToHsb([128, 128, 128]).s).toBe(0);
  });
});

describe('OKLCH gamut', () => {
  it('reduces chroma, never lightness or hue, to fit sRGB', () => {
    const hex = oklchToHex({ l: 0.7, c: 0.4, h: 150 });
    const back = rgbToOklch(hexToRgb(hex));
    expect(back.l).toBeCloseTo(0.7, 2);
    expect(Math.abs(back.h - 150)).toBeLessThan(2);
    expect(back.c).toBeLessThan(0.4);
    expect(oklchInGamut({ l: 0.7, c: maxChroma(0.7, 150), h: 150 })).toBe(true);
    expect(oklchInGamut({ l: 0.7, c: maxChroma(0.7, 150) + 0.01, h: 150 })).toBe(false);
  });

  it('finds the cusp of yellow high and of blue low', () => {
    expect(cusp(110).l).toBeGreaterThan(0.9);
    expect(cusp(264).l).toBeLessThan(0.5);
  });
});

describe('the Grid', () => {
  it('has twelve greys from white to black and nine rows of twelve', () => {
    const { greys, rows } = colourGrid();
    expect(greys).toHaveLength(12);
    expect(greys[0]).toBe('#FFFFFF');
    expect(greys[11]).toBe('#000000');
    expect(rows).toHaveLength(9);
    for (const row of rows) expect(row).toHaveLength(12);
  });

  it('runs dark to light down each column', () => {
    const { rows } = colourGrid();
    for (let col = 0; col < 12; col++) {
      const ls = rows.map((row) => rgbToOklch(hexToRgb(row[col] ?? '#000000')).l);
      for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeGreaterThan(ls[i - 1] ?? 0);
    }
  });

  it('is the same table on every engine', () => {
    const { greys, rows } = colourGrid();
    expect([greys, ...rows].map((row) => row.join(' ')).join('\n')).toBe(GRID_SNAPSHOT);
  });
});

describe('the Spectrum plane', () => {
  it('is hue across and lightness down at full saturation', () => {
    expect(spectrumColour(0, 0.5)).toBe('#FF0000');
    expect(spectrumColour(1 / 3, 0.5)).toBe('#00FF00');
    expect(spectrumColour(0.5, 0)).toBe('#FFFFFF');
    expect(spectrumColour(0.2, 1)).toBe('#000000');
    expect(spectrumColour(2 / 3, 0.75)).toBe('#000080');
  });

  it('places a colour back on the plane, a grey at the given hue', () => {
    expect(spectrumPoint('#000080')).toEqual({ x: 2 / 3, y: 0.7490196078431373 });
    expect(spectrumPoint('#808080', 0.4).x).toBe(0.4);
  });

  it('writes a hue ramp for the Sliders view', () => {
    expect(hueRamp(1, 1)).toBe(
      '#FF0000 0%, #FFFF00 16.67%, #00FF00 33.33%, #00FFFF 50%, #0000FF 66.67%, #FF00FF 83.33%, #FF0000 100%',
    );
  });
});

describe('names', () => {
  it('has thirty entries with distinct references', () => {
    expect(COLOUR_NAMES).toHaveLength(30);
    expect(new Set(COLOUR_NAMES.map((n) => n.hex)).size).toBe(30);
  });

  it('names colours by the nearest reference, in English and Turkish', () => {
    expect(colourName('#123C9A')).toBe('Dark blue');
    expect(colourName('#1760EE')).toBe('Blue');
    expect(colourName('#1A1A1A')).toBe('Black');
    expect(colourName('#FFEA00')).toBe('Yellow');
    expect(colourName('#02853C')).toBe('Green');
    expect(colourName('#FAFAFA')).toBe('White');
    setLocale('tr');
    expect(colourName('#123C9A')).toBe('Koyu mavi');
    expect(colourName('#8036D3')).toBe('Mor');
    expect(colourName('#0C1A4E')).toBe('Lacivert');
  });
});

describe('contrast rings (§5)', () => {
  it('rings black on dark glass and white on light glass, not the other way round', () => {
    expect(needsContrastRing('#1A1A1A', 'dark')).toBe(true);
    expect(needsContrastRing('#FFFFFF', 'dark')).toBe(false);
    expect(needsContrastRing('#FFFFFF', 'light')).toBe(true);
    expect(needsContrastRing('#000000', 'light')).toBe(false);
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 6);
  });
});

const GRID_SNAPSHOT = [
  '#FFFFFF #E6E6E6 #CDCDCD #B5B5B5 #9D9D9D #868686 #707070 #5A5A5A #454545 #323232 #1F1F1F #000000',
  '#003E56 #03266E #330C70 #550061 #620036 #650003 #5A2400 #543100 #4F3A00 #494300 #374900 #004D0A',
  '#005C7D #08358B #43158D #750784 #85074C #860A0B #813700 #7B4B00 #775900 #736A00 #587300 #007615',
  '#167BA4 #0F44AA #531EAB #951BA7 #A81963 #A91B18 #A54D13 #A36712 #A17B11 #9F940E #7C9F0E #14A127',
  '#2C9BCB #1653CA #6427CA #B62CCB #CC2A7B #CC2A24 #CC6425 #CC8529 #CC9F2E #CCBF33 #A3CD34 #36CC42',
  '#42BDF4 #1E63EB #7631EB #D93DF0 #F23A94 #F13931 #F47D36 #F6A43F #F8C547 #FBED52 #CCFC52 #53FA5D',
  '#77CDF9 #578EF9 #9470FA #E776F9 #FF73AE #FF7365 #FC9D6B #FABA72 #F9D279 #F9EF81 #D4FB81 #85FB86',
  '#9FDBFB #88B2FF #B29EFF #F1A0FE #FFA2C5 #FFA296 #FFB995 #FCCC9A #F9DC9E #F7F0A4 #DCF9A4 #A9FBA7',
  '#C0E6FA #B4CFFF #CDC3FF #F7C2FE #FFC4D8 #FFC5BC #FFD1BA #FBDCBC #F7E5BE #F4F1C1 #E4F7C2 #C6F9C4',
  '#DCEDF7 #D7E5FD #E3DFFE #F7DEFA #FEDDE8 #FFDED9 #FAE4D9 #F7E8DA #F5ECDA #F2F1DB #EAF4DB #DEF5DD',
].join('\n');
