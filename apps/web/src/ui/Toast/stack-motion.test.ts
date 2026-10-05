/**
 * The toast stack's motion helpers (`stack-motion.ts`; FB4 §7; Q-10): a new toast's entrance
 * is held exactly as long as the toast above it needs to move clear, and not at all when it is
 * clear already.
 */
import { describe, expect, it } from 'vitest';

import { solve } from '../../motion';
import { entranceDelay, type Move, RISE_PX, STACK_SPRING } from './stack-motion';

/** A neighbour that `reflow()` started `dy` px below its new place, its bottom at `bottom`. */
function above(dy: number, bottom = 100): Move {
  return { dx: 0, dy, vy: 0, last: new DOMRect(0, bottom - 48, 360, 48), animation: null };
}

/** The least gap between the neighbour's bottom and the entering toast's top over time. */
function leastGap(slotTop: number, move: Move, holdMs: number): number {
  let least = Number.POSITIVE_INFINITY;
  for (let t = holdMs / 1000; t < holdMs / 1000 + 0.8; t += 1 / 240) {
    const top = slotTop + solve(STACK_SPRING, RISE_PX, 0, t - holdMs / 1000)[0];
    const bottom = move.last.bottom + solve(STACK_SPRING, move.dy, 0, t)[0];
    least = Math.min(least, top - bottom);
  }
  return least;
}

describe('entranceDelay', () => {
  it('holds nothing when nothing above moves', () => {
    expect(entranceDelay(114, undefined)).toBe(0);
  });

  it('holds a toast entering under one pushed up a whole slot until that one is clear', () => {
    // The toast above starts where the newcomer will rest: 48 px + the 14 px gap below its place.
    const move = above(62);
    const hold = entranceDelay(114, move);
    expect(hold).toBeGreaterThan(0);
    // Short of the quick spring's settle: the stack makes room, it does not wait for rest.
    expect(hold).toBeLessThan(150);
    expect(leastGap(114, move, hold)).toBeGreaterThanOrEqual(1.9);
    // And no shorter hold would do.
    expect(leastGap(114, move, Math.max(0, hold - 10))).toBeLessThan(2);
  });

  it('holds nothing when the neighbour is already far enough up', () => {
    expect(entranceDelay(114, above(8))).toBe(0);
  });
});
