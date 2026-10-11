/**
 * The phone's tool registry (registry.ts): rows in order, a lane's registration replacing a
 * built-in by id and its disposer putting the built-in back; and the pure rules beside it, the
 * ink presets (ink-presets.ts) and the drawer's swipe (drawer-motion.ts).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_PEN_SETTINGS, type PenSettings } from '../../../annotations/pen/presets';
import { swipeCloses } from './drawer-motion';
import {
  HIGHLIGHTER_SIZES,
  highlighterSlot,
  nearestSize,
  PEN_SIZES,
  penToArm,
  writingSlots,
} from './ink-presets';
import {
  type CompactToolSpec,
  compactTool,
  registerCompactTool,
  resetCompactTools,
  toolsIn,
} from './registry';

const spec = (patch: Partial<CompactToolSpec> & Pick<CompactToolSpec, 'id'>): CompactToolSpec => ({
  glyph: 'pen',
  label: () => patch.id,
  place: 'tile',
  order: 0,
  ...patch,
});

describe('the tool registry', () => {
  afterEach(() => resetCompactTools());

  it('lists each row by order', () => {
    registerCompactTool(spec({ id: 'sign', order: 40 }));
    registerCompactTool(spec({ id: 'pen', order: 10 }));
    registerCompactTool(spec({ id: 'eraser', place: 'quiet', order: 10 }));
    registerCompactTool(spec({ id: 'text', order: 30 }));
    expect(toolsIn('tile').map((s) => s.id)).toEqual(['pen', 'text', 'sign']);
    expect(toolsIn('quiet').map((s) => s.id)).toEqual(['eraser']);
  });

  it('a lane replaces a built-in by id; its disposer puts the built-in back', () => {
    const stub = spec({ id: 'sign', order: 40 });
    registerCompactTool(stub);
    const lane = spec({ id: 'sign', order: 40, hint: () => 'saved signatures' });
    const dispose = registerCompactTool(lane);
    expect(compactTool('sign')).toBe(lane);
    expect(toolsIn('tile')).toHaveLength(1);
    dispose();
    expect(compactTool('sign')).toBe(stub);
    // A second dispose of a spec no longer registered changes nothing.
    dispose();
    expect(compactTool('sign')).toBe(stub);
  });

  it('the chip off has no spec', () => {
    registerCompactTool(spec({ id: 'pen' }));
    expect(compactTool(null)).toBeUndefined();
  });
});

describe('ink presets (README §3 row 2)', () => {
  const settings = (active: PenSettings['active']): PenSettings => ({
    ...DEFAULT_PEN_SETTINGS,
    active,
  });

  it('the three writing pens and the Highlighter', () => {
    expect(writingSlots(settings(0))).toEqual([0, 1, 2]);
    expect(highlighterSlot(settings(0))).toBe(3);
  });

  it('Pen arms the armed pen, else the last pen, never the Highlighter', () => {
    expect(penToArm(settings(1), 0)).toBe(1);
    expect(penToArm(settings(3), 2)).toBe(2);
    expect(penToArm(settings(3), 3)).toBe(0);
  });

  it('a width shows as its nearest size', () => {
    expect(nearestSize(1.5, PEN_SIZES)).toBe(0);
    expect(nearestSize(2.5, PEN_SIZES)).toBe(1);
    expect(nearestSize(12, HIGHLIGHTER_SIZES)).toBe(1);
    expect(nearestSize(24, HIGHLIGHTER_SIZES)).toBe(2);
  });
});

describe('the drawer’s swipe', () => {
  it('closes after 64 px down, or a quick flick past 16 px', () => {
    expect(swipeCloses(63, 0.1)).toBe(false);
    expect(swipeCloses(64, 0.1)).toBe(true);
    expect(swipeCloses(20, 0.8)).toBe(true);
    expect(swipeCloses(10, 2)).toBe(false);
    expect(swipeCloses(-40, 1)).toBe(false);
  });
});
