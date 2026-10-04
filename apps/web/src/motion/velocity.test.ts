/**
 * Release velocity, projection and the rubber band (research 18 §9; language.md §7.5;
 * 09-primitives §31; spec D0-12).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { project, rubberBand, velocityTracker } from './velocity';

afterEach(() => {
  delete document.documentElement.dataset.motion;
});

describe('velocityTracker', () => {
  it('measures a steady drag in px per second', () => {
    const tracker = velocityTracker();
    for (let t = 0; t <= 200; t += 8) tracker.add(1000 + t, 50 + 2 * t, 400 - 0.5 * t);
    const { x, y } = tracker.velocity(1200);
    expect(x).toBeCloseTo(2000, 6);
    expect(y).toBeCloseTo(-500, 6);
  });

  it('looks only at the last 100 ms', () => {
    const tracker = velocityTracker();
    let pos = 0;
    for (let t = 0; t <= 300; t += 10) {
      tracker.add(t, pos, 0);
      pos += t < 200 ? 50 : 10; // 5000 px/s, then 1000 px/s for the last 100 ms
    }
    expect(tracker.velocity(300).x).toBeCloseTo(1000, 6);
    expect(velocityTracker(300).velocity(0).x).toBe(0);
  });

  it('is zero once the pointer has been still for 50 ms, or with fewer than two samples', () => {
    const tracker = velocityTracker();
    expect(tracker.velocity(0)).toEqual({ x: 0, y: 0 });
    tracker.add(0, 0, 0);
    expect(tracker.velocity(0)).toEqual({ x: 0, y: 0 });
    tracker.add(16, 16, 0);
    expect(tracker.velocity(56).x).toBeCloseTo(1000, 6);
    expect(tracker.velocity(67)).toEqual({ x: 0, y: 0 });
  });

  it('is not thrown by one jittery sample, as the last two samples would be', () => {
    const tracker = velocityTracker();
    for (let t = 0; t <= 96; t += 8) tracker.add(t, t + (t === 88 ? 6 : 0), 0);
    // 1000 px/s; the last two samples alone say 250 px/s.
    expect(tracker.velocity(96).x).toBeGreaterThan(800);
    expect(tracker.velocity(96).x).toBeLessThan(1200);
  });

  it('uses the performance clock by default', () => {
    const tracker = velocityTracker();
    const now = performance.now();
    tracker.add(now - 20, 0, 0);
    tracker.add(now, 0, 40);
    expect(tracker.velocity().y).toBeGreaterThan(1500);
  });
});

describe('project', () => {
  it('projects momentum the way UIScrollView does (research 18 §9)', () => {
    expect(project(1000)).toBeCloseTo(499, 9);
    expect(project(1000, 0.99)).toBeCloseTo(99, 9);
    expect(project(-2000)).toBeCloseTo(-998, 9);
    expect(project(0)).toBe(0);
  });

  it('is off under reduced motion: a release stops where it is (§7.5)', () => {
    document.documentElement.dataset.motion = 'reduced';
    expect(project(1000)).toBe(0);
  });
});

describe('rubberBand', () => {
  it('resists past a limit with UIScrollView’s constant', () => {
    expect(rubberBand(100, 1000)).toBeCloseTo((1 - 1 / (0.055 + 1)) * 1000, 9);
    expect(rubberBand(-100, 1000)).toBeCloseTo(-rubberBand(100, 1000), 9);
    expect(rubberBand(0, 1000)).toBe(0);
    // About 0.55 × the overshoot at first, never as far as the dimension.
    expect(rubberBand(1, 1000)).toBeCloseTo(0.55, 3);
    expect(rubberBand(1e7, 600)).toBeLessThan(600);
    expect(rubberBand(200, 800)).toBeGreaterThan(rubberBand(100, 800));
    expect(rubberBand(100, 1000, 0.3)).toBeLessThan(rubberBand(100, 1000));
  });

  it('is off under reduced motion, and for an empty dimension', () => {
    expect(rubberBand(50, 0)).toBe(0);
    document.documentElement.dataset.motion = 'reduced';
    expect(rubberBand(100, 1000)).toBe(0);
  });
});
