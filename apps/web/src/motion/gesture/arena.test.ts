/**
 * The gesture arena (09-primitives §31 rules; spec X5): contacts, pens, claims and resets.
 */
import { describe, expect, it, vi } from 'vitest';

import { pointerStream } from '../../../test/pointer-stream';
import { createArena, type Recogniser } from './arena';

function spy(): Recogniser & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    down: (e) => calls.push(`down ${e.pointerId}`),
    move: (e) => calls.push(`move ${e.pointerId}`),
    up: (e) => calls.push(`up ${e.pointerId}`),
    cancel: (e) => calls.push(`cancel ${e.pointerId}`),
    reset: () => calls.push('reset'),
    dispose: () => calls.push('dispose'),
  };
}

describe('createArena', () => {
  it('lists contacts, counting a press before and a release after the recognisers hear it', () => {
    const arena = createArena();
    const sizes: number[] = [];
    arena.add({
      down: (_e, a) => sizes.push(a.contacts.size),
      up: (_e, a) => sizes.push(a.contacts.size),
      reset: () => undefined,
    });
    const s = pointerStream(arena);
    s.down(1, 0, 0).down(2, 5, 5, 'pen').up(1).up(2);
    expect(sizes).toEqual([1, 2, 2, 1]);
    expect(arena.contacts.size).toBe(0);
  });

  it('ignores hover moves and releases of pointers pressed elsewhere', () => {
    const member = spy();
    const arena = createArena();
    arena.add(member);
    arena.dispatch('move', {
      pointerId: 7,
      pointerType: 'mouse',
      clientX: 0,
      clientY: 0,
      timeStamp: 0,
      button: -1,
    });
    arena.dispatch('up', {
      pointerId: 7,
      pointerType: 'mouse',
      clientX: 0,
      clientY: 0,
      timeStamp: 0,
      button: 0,
    });
    expect(member.calls).toEqual([]);
  });

  it('tracks pens in contact and the last pen lift', () => {
    const s = pointerStream();
    expect(s.arena.lastPenUpAt).toBe(Number.NEGATIVE_INFINITY);
    s.down(1, 0, 0, 'pen');
    expect(s.arena.penDown).toBe(true);
    s.up(1);
    expect(s.arena.penDown).toBe(false);
    expect(s.arena.lastPenUpAt).toBe(s.now);
  });

  it('a claim resets the others, who hear nothing until every pointer lifts', () => {
    const arena = createArena();
    const other = spy();
    const ownerReset = vi.fn();
    const owner: Recogniser = {
      move: (_e, a) => a.claim(owner),
      reset: ownerReset,
    };
    arena.add(owner);
    arena.add(other);
    const s = pointerStream(arena);
    s.down(1, 0, 0).move(1, 5, 5).move(1, 6, 6).up(1);
    expect(other.calls).toEqual(['down 1', 'reset']);
    expect(arena.owner).toBeNull();
    s.down(2, 0, 0);
    expect(other.calls.at(-1)).toBe('down 2');
    expect(ownerReset).not.toHaveBeenCalled();
  });

  it('drops a stale contact when its pointer presses again (a lost release)', () => {
    const member = spy();
    const arena = createArena();
    arena.add(member);
    const s = pointerStream(arena);
    s.down(1, 0, 0).down(1, 10, 10);
    expect(member.calls).toEqual(['down 1', 'cancel 1', 'down 1']);
    expect(arena.contacts.size).toBe(1);
  });

  it('reset forgets every pointer; removal resets and disposes', () => {
    const member = spy();
    const arena = createArena();
    const remove = arena.add(member);
    pointerStream(arena).down(1, 0, 0).down(2, 0, 0);
    arena.reset();
    expect(arena.contacts.size).toBe(0);
    remove();
    expect(member.calls.slice(-3)).toEqual(['reset', 'reset', 'dispose']);
    expect(arena.size).toBe(0);
  });
});
