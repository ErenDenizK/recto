import { afterEach, describe, expect, it } from 'vitest';

import {
  canTakeSeed,
  dropSeed,
  dropSeeds,
  isSoft,
  paintSeed,
  SEED_LIMIT,
  seedOf,
  seedPage,
  SOFT_FRACTION,
} from './placeholder';

describe('placeholder choice (DSN-64)', () => {
  it('asks for a quarter of the scale first', () => {
    expect(SOFT_FRACTION).toBe(0.25);
  });

  it('veils a bitmap below half the asked scale, and only that', () => {
    expect(isSoft(0.5, 2)).toBe(true);
    expect(isSoft(0.99, 2)).toBe(true);
    expect(isSoft(1, 2)).toBe(false);
    expect(isSoft(1.9, 2)).toBe(false);
  });
});

describe('the seed rung (DSN-87)', () => {
  const sheet = (): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = 30;
    canvas.height = 40;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#c33';
      context.fillRect(0, 0, 30, 40);
    }
    return canvas;
  };
  const page = (state: string, revision?: string): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.dataset.state = state;
    if (revision !== undefined) canvas.dataset.revision = revision;
    return canvas;
  };

  afterEach(() => dropSeeds());

  it('registers a cover by source and page and drops it', () => {
    const image = sheet();
    seedPage('s1', 3, image);
    expect(seedOf('s1', 3)).toBe(image);
    expect(seedOf('s1', 2)).toBeUndefined();
    dropSeed('s1', 3);
    expect(seedOf('s1', 3)).toBeUndefined();
  });

  it('holds at most SEED_LIMIT seeds, the oldest going first', () => {
    for (let i = 0; i <= SEED_LIMIT; i++) seedPage('s', i, sheet());
    expect(seedOf('s', 0)).toBeUndefined();
    expect(seedOf('s', SEED_LIMIT)).toBeDefined();
  });

  it('draws onto a page canvas that is set up and still empty, as a preview', () => {
    const canvas = page('placeholder', 'p@0');
    expect(canTakeSeed(canvas)).toBe(true);
    expect(paintSeed(canvas, sheet())).toBe(true);
    expect(canvas.dataset.state).toBe('preview');
    expect(canvas.width).toBe(30);
    expect(canvas.height).toBe(40);
    // The pixels are the cover's.
    const [r = 0, , b = 0] = canvas.getContext('2d')?.getImageData(5, 5, 1, 1).data ?? [];
    expect(r).toBeGreaterThan(150);
    expect(b).toBeLessThan(100);
  });

  it('never takes the place of a bitmap the page already shows', () => {
    for (const state of ['preview', 'rendered']) {
      const canvas = page(state, 'p@0');
      expect(canTakeSeed(canvas)).toBe(false);
      expect(paintSeed(canvas, sheet())).toBe(false);
      expect(canvas.dataset.state).toBe(state);
    }
  });

  it('waits until the page component has set its canvas up', () => {
    // Before its first effect the canvas has no revision: drawing now would be wiped.
    const canvas = page('placeholder');
    expect(canTakeSeed(canvas)).toBe(false);
    expect(paintSeed(canvas, sheet())).toBe(false);
  });
});
