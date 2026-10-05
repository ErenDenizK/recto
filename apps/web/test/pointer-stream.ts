/**
 * Synthetic pointer streams for the gesture core's unit tests (motion/gesture/): plain objects
 * shaped like `PointerEvent` fed straight to an arena, on a clock that moves Vitest's fake
 * timers with it, so a long press's 450 ms and the events' `timeStamp`s agree.
 */
import { vi } from 'vitest';

import { type Arena, createArena } from '../src/motion/gesture/arena';

export interface Stream {
  readonly arena: Arena;
  /** The clock (ms); the events' `timeStamp`. */
  readonly now: number;
  /** Moves the clock and the fake timers by `ms`. */
  wait(ms: number): Stream;
  down(id: number, x: number, y: number, pointerType?: string, button?: number): Stream;
  move(id: number, x: number, y: number): Stream;
  up(id: number, x?: number, y?: number): Stream;
  cancel(id: number): Stream;
}

/** A fresh arena and stream; call `vi.useFakeTimers()` first. */
export function pointerStream(arena: Arena = createArena()): Stream {
  let now = 1000;
  const pointers = new Map<number, { pointerType: string; x: number; y: number }>();
  const send = (phase: 'down' | 'move' | 'up' | 'cancel', id: number, button = 0) => {
    const p = pointers.get(id);
    if (!p) throw new Error(`pointer ${id} is not down`);
    arena.dispatch(phase, {
      pointerId: id,
      pointerType: p.pointerType,
      clientX: p.x,
      clientY: p.y,
      timeStamp: now,
      button,
    });
  };
  const stream: Stream = {
    arena,
    get now() {
      return now;
    },
    wait(ms) {
      now += ms;
      vi.advanceTimersByTime(ms);
      return stream;
    },
    down(id, x, y, pointerType = 'touch', button = 0) {
      pointers.set(id, { pointerType, x, y });
      send('down', id, button);
      return stream;
    },
    move(id, x, y) {
      const p = pointers.get(id);
      if (p) Object.assign(p, { x, y });
      send('move', id);
      return stream;
    },
    up(id, x, y) {
      const p = pointers.get(id);
      if (p && x !== undefined && y !== undefined) Object.assign(p, { x, y });
      send('up', id);
      pointers.delete(id);
      return stream;
    },
    cancel(id) {
      send('cancel', id);
      pointers.delete(id);
      return stream;
    },
  };
  return stream;
}
