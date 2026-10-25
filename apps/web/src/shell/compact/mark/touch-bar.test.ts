/** DSN-77: the phone's Delete pill keeps off form fields. */
import { describe, expect, it } from 'vitest';

import type { Box } from '../../../viewer/geometry';
import { barSides, clearOfFields, labelStrip } from './TouchBar';

const field = { left: 40, top: 100, width: 200, height: 24 };

describe('clearOfFields', () => {
  it('keeps the first side when no field is under it', () => {
    expect(clearOfFields([300, 500], 140, [field])).toBe(300);
    expect(clearOfFields([300, 500], 140, [])).toBe(300);
  });

  it('flips to the other side when a field is under the first', () => {
    // The pill at y 80..136 covers the field at y 100..124; below it is clear.
    expect(clearOfFields([80, 300], 140, [field])).toBe(300);
  });

  it('takes the side that covers the least when both cover a field', () => {
    const wide = { left: 0, top: 290, width: 400, height: 40 };
    expect(clearOfFields([80, 300], 140, [field, wide])).toBe(80);
  });
});

describe('barSides', () => {
  it('offers above then below when both fit', () => {
    expect(barSides(300, 400, 800)).toEqual([204, 440]);
  });

  it('drops below near the bottom of the page, where the pill would leave it', () => {
    // Below would run from 780 to 836, past the page's 800: only above remains.
    expect(barSides(600, 740, 800)).toEqual([504]);
  });

  it('offers below only when the selection touches the top', () => {
    expect(barSides(20, 100, 800)).toEqual([140]);
  });

  it('clamps onto the page when neither side fits', () => {
    expect(barSides(20, 100, 150)).toEqual([0]);
    expect(barSides(60, 140, 150)).toEqual([0]);
  });
});

describe('labelStrip', () => {
  const box = { left: 40, top: 100, width: 44, height: 44 };

  it('runs a check box or radio label across the page to its right', () => {
    expect(labelStrip('checkbox', box, 400)).toEqual({ ...box, left: 84, width: 316 });
    expect(labelStrip('radio', box, 400)?.width).toBe(316);
  });

  it('has none for other fields', () => {
    expect(labelStrip('text', box, 400)).toBeNull();
  });

  it('keeps the bar off a label when a side without one exists', () => {
    const label = labelStrip('checkbox', box, 400) as Box;
    // Above (y 40..96) is clear; below (y 130..186) would cover the label.
    expect(clearOfFields([130, 40], 200, [], [label])).toBe(40);
  });

  it('hides a label before it hides a field', () => {
    const label = { left: 100, top: 300, width: 300, height: 44 };
    const text = { left: 120, top: 100, width: 100, height: 30 };
    expect(clearOfFields([80, 300], 200, [text], [label])).toBe(300);
  });
});
