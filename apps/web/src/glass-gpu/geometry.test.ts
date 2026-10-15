import { describe, expect, it } from 'vitest';

import {
  blurLevel,
  glassDpr,
  gradientAt,
  legibilityBound,
  luminance,
  overlaps,
  pageMap,
  pagesUnder,
  pageUv,
  parseCssColor,
  parseFilter,
  parseVerticalGradient,
  pieceShape,
  scissorFor,
} from './geometry';

describe('the canvas and the scissor (GLS-12)', () => {
  it('caps the pixel ratio at 2 and never goes below 1', () => {
    expect(glassDpr(3)).toBe(2);
    expect(glassDpr(1.5)).toBe(1.5);
    expect(glassDpr(0.5)).toBe(1);
    expect(glassDpr(Number.NaN)).toBe(1);
  });

  it('scissors a piece to its box plus the margin, in canvas px, y up', () => {
    // The 390 × 844 phone at 2: a 56 px capsule 12 px above the bottom.
    const capsule = { left: 95, top: 776, width: 200, height: 56 };
    const scissor = scissorFor(capsule, 1, 2, 780, 1688);
    expect(scissor).toEqual({ x: 188, y: 22, width: 404, height: 116 });
  });

  it('clips a scissor to the canvas and drops one entirely off it', () => {
    expect(scissorFor({ left: -20, top: -20, width: 44, height: 44 }, 0, 2, 780, 1688)).toEqual({
      x: 0,
      y: 1688 - 48,
      width: 48,
      height: 48,
    });
    expect(scissorFor({ left: 400, top: 10, width: 44, height: 44 }, 1, 2, 780, 1688)).toBeNull();
  });

  it('clamps a capsule radius to the shorter half side and scales it with a press', () => {
    expect(pieceShape({ left: 0, top: 0, width: 200, height: 56 }, 999)).toEqual({
      cx: 100,
      cy: 28,
      hw: 100,
      hh: 28,
      radius: 28,
    });
    expect(pieceShape({ left: 0, top: 0, width: 94, height: 94 }, 12, 0.94).radius).toBeCloseTo(
      11.28,
    );
  });
});

describe('the page raster as textures', () => {
  it('maps a viewport point to a page texture through the page box (scroll and zoom in it)', () => {
    const map = pageMap({ left: 0, top: -300, width: 390, height: 505 }, 1170);
    expect(map.texelsPerPx).toBe(3);
    expect(pageUv(map, 195, -300 + 505 / 2)).toEqual([0.5, 0.5]);
    // A pinch scales the box; the same texture covers it.
    const pinched = pageMap({ left: -195, top: -552.5, width: 780, height: 1010 }, 1170);
    expect(pinched.texelsPerPx).toBe(1.5);
    expect(pageUv(pinched, 195, -552.5 + 505)).toEqual([0.5, 0.5]);
  });

  it('turns a blur σ into a mip level', () => {
    expect(blurLevel(0, 3)).toBe(0);
    expect(blurLevel(0.2, 1)).toBe(0);
    expect(blurLevel(10, 3)).toBeCloseTo(Math.log2(30 / 0.65));
  });

  it('keeps the pages under a piece, up to the limit', () => {
    const pages = [
      { box: { left: 0, top: -600, width: 390, height: 505 } },
      { box: { left: 0, top: -83, width: 390, height: 505 } },
      { box: { left: 0, top: 434, width: 390, height: 505 } },
    ];
    const capsule = { left: 95, top: 776, width: 200, height: 56 };
    expect(pagesUnder(capsule, pages, 20, 4)).toEqual([pages[2]]);
    const top = { left: 12, top: 12, width: 44, height: 44 };
    expect(pagesUnder(top, pages, 0, 4)).toEqual([pages[1]]);
    expect(pagesUnder({ left: 0, top: 0, width: 390, height: 844 }, pages, 0, 2)).toHaveLength(2);
    expect(
      overlaps(
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 12, top: 0, width: 5, height: 5 },
        3,
      ),
    ).toBe(true);
  });
});

describe('the material from CSS', () => {
  it('reads computed colours, colour-mix results included', () => {
    expect(parseCssColor('rgba(32, 34, 39, 0.6)')).toEqual([32 / 255, 34 / 255, 39 / 255, 0.6]);
    expect(parseCssColor('rgb(250 250 252 / 0.88)')?.[3]).toBeCloseTo(0.88);
    expect(parseCssColor('color(srgb 0.1 0.2 0.3 / 0.72)')).toEqual([0.1, 0.2, 0.3, 0.72]);
    expect(parseCssColor('transparent')).toEqual([0, 0, 0, 0]);
    expect(parseCssColor('rgb(255, 255, 255)')).toEqual([1, 1, 1, 1]);
    expect(parseCssColor('Canvas')).toBeNull();
  });

  it('reads the tier backdrop filter, function by function', () => {
    expect(parseFilter('blur(10px) saturate(1.8) brightness(0.44)')).toEqual({
      blur: 10,
      saturate: 1.8,
      contrast: 1,
      brightness: 0.44,
    });
    expect(parseFilter('blur(7px) saturate(1.5) contrast(0.45) brightness(1.4)').contrast).toBe(
      0.45,
    );
    expect(parseFilter('none')).toEqual({ blur: 0, saturate: 1, contrast: 1, brightness: 1 });
  });

  it("reads the scroll edge's gradient and its mask as Chromium serialises them", () => {
    const tint = parseVerticalGradient(
      'linear-gradient(rgba(19, 20, 23, 0.92) 0px, rgba(19, 20, 23, 0.72) 36px, rgba(19, 20, 23, 0.4) 60px, rgba(0, 0, 0, 0) 100%)',
      88,
    );
    expect(tint?.map((stop) => stop.at)).toEqual([0, 36, 60, 88]);
    expect(gradientAt(tint ?? [], 48)[3]).toBeCloseTo(0.56);
    const mask = parseVerticalGradient(
      'linear-gradient(rgb(0, 0, 0) calc(100% - 40px), rgba(0, 0, 0, 0))',
      88,
    );
    expect(mask?.map((stop) => stop.at)).toEqual([48, 88]);
    expect(gradientAt(mask ?? [], 20)[3]).toBe(1);
    expect(gradientAt(mask ?? [], 68)[3]).toBeCloseTo(0.5);
    expect(parseVerticalGradient('linear-gradient(to right, red, blue)', 10)).toBeNull();
    expect(parseVerticalGradient('none', 10)).toBeNull();
  });

  it('spreads stops without positions, as CSS does', () => {
    const stops = parseVerticalGradient(
      'linear-gradient(to bottom, rgb(0, 0, 0), rgb(0, 0, 0), rgba(0, 0, 0, 0))',
      100,
    );
    expect(stops?.map((stop) => stop.at)).toEqual([0, 50, 100]);
  });

  it('bounds the glass luminance for legible text (GLS-14)', () => {
    // White text at 4.5:1: the glass may be at most (1.05 / 4.5) − 0.05 light.
    const [light, isLight] = legibilityBound(luminance([1, 1, 1]), 4.5);
    expect(isLight).toBe(true);
    expect(light).toBeCloseTo(1.05 / 4.5 - 0.05);
    // Near-black text at 3:1: the glass must be at least 3 × (L + 0.05) − 0.05 light.
    const text = luminance([0.1, 0.1, 0.1]);
    const [dark, darkIsLight] = legibilityBound(text, 3);
    expect(darkIsLight).toBe(false);
    expect(dark).toBeCloseTo(3 * (text + 0.05) - 0.05);
  });
});
