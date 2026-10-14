import { describe, expect, it } from 'vitest';

import {
  ARM_PROGRESS,
  canOpenOverview,
  COLUMN_STEP,
  DIVE_PAST,
  OVERVIEW_ARM,
  OVERVIEW_FULL,
  overviewArmed,
  overviewCommits,
  overviewPinch,
  overviewProgress,
  settleVelocity,
} from './overview-gesture';

describe('the reader pinch below fit (MOB-2)', () => {
  it('opens the overview only from fit width', () => {
    expect(canOpenOverview(1)).toBe(true);
    expect(canOpenOverview(1.005)).toBe(true);
    expect(canOpenOverview(1.5)).toBe(false);
    expect(canOpenOverview(2.5)).toBe(false);
  });

  it('maps the finger ratio to progress: 0 at fit, 1 at the full ratio, clamped', () => {
    expect(overviewProgress(1)).toBe(0);
    expect(overviewProgress(1.4)).toBe(0);
    expect(overviewProgress(OVERVIEW_FULL)).toBeCloseTo(1, 9);
    expect(overviewProgress(0.1)).toBe(1);
    expect(overviewProgress((1 + OVERVIEW_FULL) / 2)).toBeCloseTo(0.5, 9);
    expect(overviewProgress(Number.NaN)).toBe(0);
  });

  it('arms 15 % below fit, the tablet’s threshold', () => {
    expect(OVERVIEW_ARM).toBe(0.15);
    expect(overviewArmed(0.86)).toBe(false);
    expect(overviewArmed(0.84)).toBe(true);
    expect(overviewProgress(1 - OVERVIEW_ARM)).toBeCloseTo(ARM_PROGRESS, 9);
  });

  it('commits short of the threshold when the pinch is thrown, never when it opens again', () => {
    // At rest the threshold decides.
    expect(overviewCommits(0.9, 0)).toBe(false);
    expect(overviewCommits(0.8, 0)).toBe(true);
    // Closing fast: momentum carries it past (0.99 projection: 0.099 s of velocity).
    expect(overviewCommits(0.9, -1)).toBe(true);
    expect(overviewCommits(0.95, -0.2)).toBe(false);
    // Spreading again: back to the page even from below the threshold's band edge.
    expect(overviewCommits(0.86, 2)).toBe(false);
  });

  it('hands the settle a velocity toward its end, capped as the sheet’s release', () => {
    // Closing at 1 ratio/s at progress 0.5: progress speed 1/0.55, distance 0.5.
    expect(settleVelocity(-1, 0.5, 1)).toBeCloseTo(1 / 0.55 / 0.5, 6);
    // The same toward the page is away from it.
    expect(settleVelocity(-1, 0.5, 0)).toBeCloseTo(-3, 6);
    expect(settleVelocity(-100, 0.5, 1)).toBe(20);
    expect(settleVelocity(-1, 1, 1)).toBe(0);
  });
});

describe('the overview’s own pinch: 2 · 3 · 4 columns', () => {
  it('steps one column per ×1.4, spreading toward fewer and larger tiles', () => {
    expect(overviewPinch(3, 1).columns).toBe(3);
    expect(overviewPinch(3, COLUMN_STEP * 0.99).columns).toBe(3);
    expect(overviewPinch(3, COLUMN_STEP).columns).toBe(2);
    expect(overviewPinch(3, 1 / COLUMN_STEP).columns).toBe(4);
    expect(overviewPinch(3, 1 / COLUMN_STEP ** 3).columns).toBe(4);
    expect(overviewPinch(2, COLUMN_STEP ** 3).columns).toBe(2);
    expect(overviewPinch(4, COLUMN_STEP ** 2).columns).toBe(2);
  });

  it('dives past the largest tiles by a further 15 %', () => {
    expect(overviewPinch(2, DIVE_PAST * 0.99).dives).toBe(false);
    expect(overviewPinch(2, DIVE_PAST).dives).toBe(true);
    expect(overviewPinch(3, COLUMN_STEP).dives).toBe(false);
    expect(overviewPinch(3, COLUMN_STEP * DIVE_PAST).dives).toBe(true);
    expect(overviewPinch(3, 0.5).dives).toBe(false);
    expect(overviewPinch(3, Number.NaN)).toEqual({ columns: 3, dives: false });
  });
});
