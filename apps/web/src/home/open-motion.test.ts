/**
 * The desk's opening as a state machine (`open-motion.ts`; DSN-87, `masa.md` §2.7): the busy ring
 * waits 400 ms, the hold ends with the open, a cancel settles back, a 15 s hold fails, and a
 * second press does not start a second opening.
 */
import { describe, expect, it } from 'vitest';

import {
  BUSY_MS,
  canLift,
  HOLD_CAP_MS,
  LIFT_SCALE,
  lifted,
  type OpenEvent,
  type OpenState,
  step,
} from './open-motion';

/** Runs `events` from the lifted state, collecting every effect in order. */
function run(events: readonly OpenEvent[]): { state: OpenState; effects: string[] } {
  let state: OpenState = lifted;
  const effects: string[] = [];
  for (const event of events) {
    const next = step(state, event);
    state = next.state;
    effects.push(...next.effects);
  }
  return { state, effects };
}

describe('the opening from the desk (DSN-87)', () => {
  it('lifts by 2 % and shows the busy ring only after 400 ms', () => {
    expect(LIFT_SCALE).toBe(1.02);
    expect(BUSY_MS).toBe(400);
    expect(run([{ type: 'time', ms: BUSY_MS - 1 }]).effects).toEqual([]);
    const late = run([
      { type: 'time', ms: BUSY_MS },
      { type: 'time', ms: BUSY_MS + 200 },
    ]);
    // The ring and the announcement come once, not every frame.
    expect(late.effects).toEqual(['ring', 'announce']);
    expect(late.state.busy).toBe(true);
  });

  it('holds while the document is not ready, then flies when it is laid out', () => {
    const early = run([{ type: 'left' }, { type: 'ready' }]);
    // Home is gone but the open has not finished (a reopen, a resume): still holding.
    expect(early.state.phase).toBe('left');
    expect(early.effects).toEqual(['veil']);
    const done = run([{ type: 'left' }, { type: 'worked' }, { type: 'ready' }, { type: 'landed' }]);
    expect(done.effects).toEqual(['veil', 'fly', 'finish']);
    expect(done.state.phase).toBe('done');
  });

  it('an action that ends before Home left was a cancel', () => {
    const result = run([{ type: 'worked' }, { type: 'left' }]);
    // An action that resolved with Home still showing was a cancel: it settles, not flies.
    expect(result.effects).toEqual(['settle']);
    expect(result.state.phase).toBe('settling');
  });

  it('settles back into its tile when the open ends with Home still showing', () => {
    const result = run([{ type: 'worked' }, { type: 'landed' }]);
    expect(result.effects).toEqual(['settle', 'finish']);
    expect(result.state.phase).toBe('done');
  });

  it('a hold past 15 s fails: it settles while Home shows, dissolves once Home left', () => {
    expect(run([{ type: 'time', ms: HOLD_CAP_MS }]).effects).toEqual(['settle']);
    expect(run([{ type: 'left' }, { type: 'time', ms: HOLD_CAP_MS }]).effects).toEqual([
      'veil',
      'dissolve',
    ]);
  });

  it('Home coming back removes the still copy and settles, or ends a flight at once', () => {
    expect(run([{ type: 'left' }, { type: 'returned' }]).effects).toEqual([
      'veil',
      'unveil',
      'settle',
    ]);
    const flying = run([{ type: 'left' }, { type: 'worked' }, { type: 'ready' }]);
    expect(step(flying.state, { type: 'returned' }).effects).toEqual(['finish']);
  });

  it('an open that lands where there is no page dissolves instead of flying', () => {
    expect(run([{ type: 'left' }, { type: 'nowhere' }]).effects).toEqual(['veil', 'dissolve']);
    expect(run([{ type: 'nowhere' }]).state.phase).toBe('lifted');
  });

  it('is finished for good once done', () => {
    const done = run([{ type: 'worked' }, { type: 'landed' }]).state;
    for (const event of [
      { type: 'left' },
      { type: 'ready' },
      { type: 'time', ms: HOLD_CAP_MS },
    ] as const) {
      const next = step(done, event);
      expect(next.state).toBe(done);
      expect(next.effects).toEqual([]);
    }
  });

  it('one opening runs at a time', () => {
    expect(canLift(null)).toBe(true);
    expect(canLift(lifted)).toBe(false);
    expect(canLift(run([{ type: 'left' }]).state)).toBe(false);
    expect(canLift(run([{ type: 'worked' }, { type: 'landed' }]).state)).toBe(true);
  });
});
