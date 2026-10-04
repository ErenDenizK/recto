import { describe, expect, it } from 'vitest';

import {
  bubbleShift,
  DETENT_SNAP_PX,
  detentsIn,
  keyStep,
  knobDiameter,
  positionToValue,
  roundSignificant,
  roundToStep,
  roundValue,
  rubberBand,
  type SliderRange,
  snapToDetent,
  STRETCH_MAX_PX,
  stretchFor,
  taperPath,
  valueToPosition,
} from './slider-math';

const PEN: SliderRange = { min: 0.25, max: 24, scale: 'log' };
const OPACITY: SliderRange = { min: 0, max: 100, scale: 'linear' };
const PEN_DETENTS = [0.5, 1, 1.5, 2, 3, 5, 8, 12];

describe('scales', () => {
  it('maps a linear range both ways', () => {
    expect(valueToPosition(25, OPACITY)).toBe(0.25);
    expect(positionToValue(0.6, OPACITY)).toBeCloseTo(60, 9);
    expect(valueToPosition(-5, OPACITY)).toBe(0);
    expect(valueToPosition(140, OPACITY)).toBe(1);
  });

  it('gives 0.25–2 pt the first 45 % of the logarithmic pen travel (§3.3)', () => {
    const t2 = valueToPosition(2, PEN);
    expect(t2).toBeGreaterThan(0.44);
    expect(t2).toBeLessThan(0.46);
    expect(valueToPosition(0.25, PEN)).toBe(0);
    expect(valueToPosition(24, PEN)).toBeCloseTo(1, 12);
  });

  it('round-trips logarithmic widths within 0.01 pt across the whole range', () => {
    for (let w = 0.25; w <= 24; w += 0.05) {
      expect(Math.abs(positionToValue(valueToPosition(w, PEN), PEN) - w)).toBeLessThan(0.01);
    }
    for (let t = 0; t <= 1; t += 0.001) {
      const w = positionToValue(t, PEN);
      expect(Math.abs(valueToPosition(w, PEN) - t)).toBeLessThan(1e-9);
    }
  });

  it('survives a degenerate range', () => {
    expect(valueToPosition(1, { min: 2, max: 2, scale: 'linear' })).toBe(0);
    expect(valueToPosition(1, { min: 0, max: 2, scale: 'log' })).toBe(0);
    expect(positionToValue(Number.NaN, OPACITY)).toBe(0);
  });
});

describe('rounding', () => {
  it('rounds to a step without float noise', () => {
    expect(roundToStep(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundToStep(13.37, 0.25, 0.25)).toBe(13.25);
    expect(roundToStep(7, 5, 1)).toBe(6);
  });

  it('rounds log values to two significant digits', () => {
    expect(roundSignificant(0.3741)).toBe(0.37);
    expect(roundSignificant(1.46)).toBe(1.5);
    expect(roundSignificant(13.4)).toBe(13);
    expect(roundValue(23.99, PEN)).toBe(24);
    expect(roundValue(0.2, PEN)).toBe(0.25);
  });

  it('rounds linear values to the step from the minimum', () => {
    expect(roundValue(59.6, OPACITY)).toBe(60);
    expect(roundValue(12.2, OPACITY, 5)).toBe(10);
  });

  it('keeps only detents inside the range, sorted once', () => {
    expect(detentsIn([12, 1, 1, 40, 0.1, 5], PEN)).toEqual([1, 5, 12]);
    expect(detentsIn(undefined, PEN)).toEqual([]);
  });
});

describe('detents', () => {
  const travel = 160 - 22; // a 160 px fine track less the knob

  it('snaps within the pixel threshold and keeps the position outside it', () => {
    const at15 = valueToPosition(1.5, PEN);
    const near = at15 - 3 / travel;
    expect(snapToDetent(near, PEN_DETENTS, PEN, travel, DETENT_SNAP_PX.fine)).toEqual({
      position: at15,
      detent: 1.5,
    });
    const far = at15 - 5 / travel;
    expect(snapToDetent(far, PEN_DETENTS, PEN, travel, DETENT_SNAP_PX.fine)).toEqual({
      position: far,
      detent: undefined,
    });
    // A finger gets a wider catch (6 px).
    expect(snapToDetent(far, PEN_DETENTS, PEN, travel, DETENT_SNAP_PX.coarse).detent).toBe(1.5);
  });

  it('picks the nearest of two detents in reach', () => {
    const range: SliderRange = { min: 0, max: 10, scale: 'linear' };
    const snap = snapToDetent(0.52, [5, 6], range, 100, 6);
    expect(snap.detent).toBe(5);
  });
});

describe('keys (§3.4)', () => {
  it('moves a width to the next detent, and ten stops with Shift', () => {
    const o = { ...PEN, detents: PEN_DETENTS };
    expect(keyStep(1.5, 1, 1, o)).toBe(2);
    expect(keyStep(1.5, -1, 1, o)).toBe(1);
    expect(keyStep(1.7, -1, 1, o)).toBe(1.5);
    expect(keyStep(12, 1, 1, o)).toBe(24);
    expect(keyStep(0.25, -1, 1, o)).toBe(0.25);
    expect(keyStep(0.25, 1, 10, o)).toBe(24);
  });

  it('steps a linear slider by its step, ×10 with Shift, clamped', () => {
    const o = { ...OPACITY, step: 1 };
    expect(keyStep(60, 1, 1, o)).toBe(61);
    expect(keyStep(60, -1, 10, o)).toBe(50);
    expect(keyStep(95, 1, 10, o)).toBe(100);
  });

  it('always moves a logarithmic slider without detents', () => {
    const range = { min: 6, max: 18, scale: 'log' as const };
    const up = keyStep(6, 1, 1, range);
    expect(up).toBeGreaterThan(6);
    expect(keyStep(up, -1, 1, range)).toBe(6);
  });
});

describe('rubber band', () => {
  it('follows the pull less and less and never passes 6 px', () => {
    expect(rubberBand(0, 6)).toBe(0);
    const a = stretchFor(10);
    const b = stretchFor(40);
    const c = stretchFor(4000);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThan(STRETCH_MAX_PX);
    expect(c).toBeGreaterThan(STRETCH_MAX_PX - 0.1);
    expect(stretchFor(-40)).toBeCloseTo(-b, 12);
  });
});

describe('knob diameter (§3.3)', () => {
  it('is the stroke at the zoom, in CSS px', () => {
    expect(knobDiameter(12, 1, false)).toEqual({ diameter: 16, notch: undefined });
  });

  it('clamps with a notch that says which way the stroke differs', () => {
    expect(knobDiameter(0.5, 1, false)).toEqual({ diameter: 8, notch: '-' });
    expect(knobDiameter(24, 1, false)).toEqual({ diameter: 28, notch: '+' });
    expect(knobDiameter(0.5, 1, true)).toEqual({ diameter: 10, notch: '-' });
    expect(knobDiameter(24, 2, true)).toEqual({ diameter: 32, notch: '+' });
  });
});

describe('taper path', () => {
  it('is one closed path between two round caps', () => {
    const d = taperPath(160, 32, 2, 12);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/A/g)).toHaveLength(2);
    // The start cap's top is 1 px above the centre line, the end cap's 6 px.
    expect(d).toMatch(/^M\d+(\.\d+)? 15(\.\d+)?/);
  });

  it('is empty when the track is too short for its caps', () => {
    expect(taperPath(4, 16, 2, 12)).toBe('');
  });
});

describe('bubble shift', () => {
  it('keeps a bubble inside the viewport with its margin', () => {
    expect(bubbleShift(500, 60, 1000)).toBe(0);
    expect(bubbleShift(10, 60, 1000)).toBe(28);
    expect(bubbleShift(995, 60, 1000)).toBe(-33);
    expect(bubbleShift(50, 400, 300)).toBe(100);
  });
});
