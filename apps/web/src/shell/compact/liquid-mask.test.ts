/**
 * The liquid shapes' geometry (`liquid-mask.ts`, GLS-3, GLS-4): the rounded-rect distance, the
 * smooth union's neck, the traced outline and the mask it becomes, and the springs.
 */
import { describe, expect, it } from 'vitest';

import {
  contourPath,
  cubicBezier,
  type LiquidRect,
  outlineMask,
  outlineRim,
  RIM_STROKE,
  sdRoundRect,
  smin,
  springProgress,
  unionDistance,
  unionMask,
  unionOutline,
} from './liquid-mask';

const circle: LiquidRect = { x: 0, y: 0, width: 44, height: 44, radius: 22 };
const blob: LiquidRect = { x: 60, y: 0, width: 44, height: 44, radius: 22 };

describe('liquid shapes', () => {
  it('measures a rounded rectangle: inside negative, on the edge 0, outside its distance', () => {
    expect(sdRoundRect(22, 22, circle)).toBeCloseTo(-22);
    expect(sdRoundRect(44, 22, circle)).toBeCloseTo(0);
    expect(sdRoundRect(54, 22, circle)).toBeCloseTo(10);
    // A capsule's radius is clamped to half its height.
    expect(sdRoundRect(50, 0, { x: 0, y: 0, width: 100, height: 20, radius: 999 })).toBeCloseTo(0);
  });

  it('fuses two shapes nearer than the neck, and only them', () => {
    expect(smin(3, 5, 0)).toBe(3);
    expect(smin(3, 5, 8)).toBeLessThan(3);
    // Midway between the two circles (16 px apart): outside the hard union, inside a 40 px neck
    // (a gap closes below half the neck).
    expect(unionDistance(52, 22, [circle, blob], 0)).toBeGreaterThan(0);
    expect(unionDistance(52, 22, [circle, blob], 40)).toBeLessThan(0);
    // Far away the neck changes nothing.
    expect(unionDistance(-100, 22, [circle, blob], 24)).toBe(sdRoundRect(-100, 22, circle));
  });

  it('traces one closed outline for a fused pair and two for a split one', () => {
    const fused = contourPath((x, y) => unionDistance(x, y, [circle, blob], 40), -4, -4, 112, 52);
    const apart = contourPath((x, y) => unionDistance(x, y, [circle, blob], 0), -4, -4, 112, 52);
    expect(fused.match(/Z/g)).toHaveLength(1);
    expect(apart.match(/Z/g)).toHaveLength(2);
  });

  it('closes an outline that meets the box’s edge along it', () => {
    // A button in the menu box's top-right corner, half outside it.
    const mask = unionMask(
      { x: 0, y: 0, width: 100, height: 100 },
      [{ x: 78, y: -10, width: 44, height: 44, radius: 22 }],
      0,
    );
    const svg = decodeURIComponent(mask.slice('url("data:image/svg+xml,'.length, -2));
    const points = [...svg.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((match) => [
      Number(match[1]) - 5,
      Number(match[2]) - 5,
    ]);
    // One loop, cut along the box's top and right edges.
    expect(svg.match(/Z/g)).toHaveLength(1);
    expect(Math.max(...points.map(([x = 0]) => x))).toBeCloseTo(100, 0);
    expect(Math.min(...points.map(([, y = 0]) => y))).toBeCloseTo(0, 0);
  });

  it('hands the outline over as a CSS mask in the box’s own coordinates', () => {
    const mask = unionMask(
      { x: 100, y: 50, width: 60, height: 60 },
      [{ x: 108, y: 58, width: 44, height: 44, radius: 22 }],
      0,
    );
    const head = 'url("data:image/svg+xml,';
    expect(mask.startsWith(head)).toBe(true);
    const svg = decodeURIComponent(mask.slice(head.length, -2));
    expect(svg).toContain('width="60" height="60"');
    // The path is traced on a grid padded by two cells (5 px) and translated back.
    expect(svg).toContain('translate(-5 -5)');
    const xs = [...svg.matchAll(/[ML]([\d.]+) /g)].map((match) => Number(match[1]) - 5);
    expect(Math.min(...xs)).toBeCloseTo(8, 0);
    expect(Math.max(...xs)).toBeCloseTo(52, 0);
    expect(unionMask({ x: 0, y: 0, width: 10, height: 10 }, [blob], 0)).toBe('none');
  });

  it('strokes the same outline as the rim, in the rim’s top-lit gradient (DSN-42)', () => {
    const box = { x: 0, y: 0, width: 120, height: 60 };
    const shapes = [circle, blob];
    const outline = unionOutline(box, shapes, 24);
    if (!outline) throw new Error('no outline');
    // The mask and the rim draw one path.
    const decode = (url: string) =>
      decodeURIComponent(url.slice('url("data:image/svg+xml,'.length, -2));
    expect(outlineMask(outline)).toBe(unionMask(box, shapes, 24));
    const rim = decode(
      outlineRim(outline, {
        top: 'rgba(255, 255, 255, 0.42)',
        bottom: 'rgba(255, 255, 255, 0.16)',
      }),
    );
    expect(rim).toContain(`d="${outline.d}"`);
    expect(rim).toContain('fill="none"');
    expect(rim).toContain(`stroke-width="${RIM_STROKE}"`);
    // Lit at the top, the foot's weaker lobe at the bottom, 60 % of the top on the way down.
    const stops = [
      ...rim.matchAll(/offset="([\d.]+)" style="stop-color:([^;]+);stop-opacity:([\d.]+)"/g),
    ];
    expect(stops.map((s) => s[2])).toEqual([
      'rgba(255, 255, 255, 0.42)',
      'rgba(255, 255, 255, 0.42)',
      'rgba(255, 255, 255, 0.16)',
      'rgba(255, 255, 255, 0.16)',
    ]);
    expect(Number(stops[1]?.[1])).toBeCloseTo(8 / 60, 3);
    expect(stops[1]?.[3]).toBe('0.6');
    expect(outlineRim(null, { top: '#fff', bottom: '#fff' })).toBe('none');
    expect(unionOutline({ x: 0, y: 0, width: 10, height: 10 }, [blob], 0)).toBeNull();
  });

  it('springs from 0 to 1, overshooting when underdamped, and eases on a Bézier', () => {
    expect(springProgress(144, 14, 0)).toBe(0);
    const samples = Array.from({ length: 60 }, (_, i) => springProgress(144, 14, i / 60));
    expect(Math.max(...samples)).toBeGreaterThan(1);
    expect(springProgress(144, 14, 0.8)).toBeCloseTo(1, 2);
    const ease = cubicBezier(0.8, 0.3, 0.5, 0.8);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    // Slow at the start: the blob leaves the button before it grows.
    expect(ease(0.3)).toBeLessThan(0.3);
  });
});
