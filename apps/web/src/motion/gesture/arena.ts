/**
 * The gesture arena: one per element, it keeps the pointers that are down and arbitrates
 * between the recognisers listening there (09-primitives §31 rules; spec X5).
 *
 * Every recogniser sees every press, move and release in the order it joined. When one of them
 * recognises its gesture it `claim`s the arena: the others are `reset` (a pinch cancels a
 * pending long press and a two-finger tap; a fired long press means its release is not a tap)
 * and hear nothing more until every pointer has lifted. The rule "a second pointer cancels long
 * press and taps" needs no claim: those recognisers read `contacts` themselves.
 *
 * Pure logic on objects shaped like `PointerEvent`, so unit tests feed synthetic streams; the
 * DOM wiring (`dom.ts`) feeds real events. Nothing here calls `preventDefault`: a recogniser
 * never takes a scroll it did not claim.
 */

/** The fields of a `PointerEvent` the recognisers read; a real event satisfies it. */
export interface PointerLike {
  readonly pointerId: number;
  /** `mouse`, `touch` or `pen` (an empty or unknown type counts as a mouse). */
  readonly pointerType: string;
  readonly clientX: number;
  readonly clientY: number;
  /** Ms on the `performance.now()` clock. */
  readonly timeStamp: number;
  readonly button: number;
}

/** A pointer that is down. */
export interface Contact {
  readonly pointerType: string;
  readonly startX: number;
  readonly startY: number;
  readonly startT: number;
  x: number;
  y: number;
  t: number;
}

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel';

/** A recogniser: hears the arena's pointers and stops on `reset`. */
export interface Recogniser<E extends PointerLike = PointerLike> {
  /** A pointer went down; `arena.contacts` already includes it. */
  down?(e: E, arena: Arena<E>): void;
  /** A pointer that is down moved. */
  move?(e: E, arena: Arena<E>): void;
  /** A pointer lifted; `arena.contacts` still includes it. */
  up?(e: E, arena: Arena<E>): void;
  /** The browser took a pointer (`pointercancel`); `arena.contacts` still includes it. */
  cancel?(e: E, arena: Arena<E>): void;
  /** Another recogniser claimed the arena, or it was reset: drop the gesture in progress. */
  reset(): void;
  /** The recogniser leaves for good: clear its timers. */
  dispose?(): void;
}

export interface Arena<E extends PointerLike = PointerLike> {
  /** The pointers that are down, by id. */
  readonly contacts: ReadonlyMap<number, Contact>;
  /** How many touch pointers are down. */
  touches(): number;
  /** Whether a pen is in contact. */
  readonly penDown: boolean;
  /** When a pen last lifted (`timeStamp` clock), or −∞. */
  readonly lastPenUpAt: number;
  /** Who claimed the current gesture, if anyone. */
  readonly owner: Recogniser<E> | null;
  /** `by` recognised its gesture: every other recogniser resets and waits for all lifts. */
  claim(by: Recogniser<E>): void;
  /** Adds a recogniser; returns its removal (which disposes it). */
  add(recogniser: Recogniser<E>): () => void;
  /** Feeds one pointer event. */
  dispatch(phase: PointerPhase, e: E): void;
  /** Forgets every pointer and resets every recogniser (the window lost focus). */
  reset(): void;
  readonly size: number;
}

export function createArena<E extends PointerLike = PointerLike>(): Arena<E> {
  const contacts = new Map<number, Contact>();
  const members: Recogniser<E>[] = [];
  let owner: Recogniser<E> | null = null;
  let pensDown = 0;
  let lastPenUpAt = Number.NEGATIVE_INFINITY;

  const send = (phase: PointerPhase, e: E) => {
    for (const member of [...members]) {
      if (owner !== null && owner !== member) continue;
      member[phase]?.(e, arena);
    }
  };

  const arena: Arena<E> = {
    contacts,
    touches() {
      let n = 0;
      for (const contact of contacts.values()) if (contact.pointerType === 'touch') n++;
      return n;
    },
    get penDown() {
      return pensDown > 0;
    },
    get lastPenUpAt() {
      return lastPenUpAt;
    },
    get owner() {
      return owner;
    },
    get size() {
      return members.length;
    },
    claim(by) {
      if (owner === by) return;
      owner = by;
      for (const member of [...members]) if (member !== by) member.reset();
    },
    add(recogniser) {
      members.push(recogniser);
      return () => {
        const at = members.indexOf(recogniser);
        if (at < 0) return;
        members.splice(at, 1);
        if (owner === recogniser) owner = null;
        recogniser.reset();
        recogniser.dispose?.();
      };
    },
    dispatch(phase, e) {
      const known = contacts.get(e.pointerId);
      if (phase === 'down') {
        // A press for a pointer still listed means its release was lost (it left the window):
        // drop the stale contact first.
        if (known) arena.dispatch('cancel', e);
        if (e.pointerType === 'pen') pensDown++;
        contacts.set(e.pointerId, {
          pointerType: e.pointerType,
          startX: e.clientX,
          startY: e.clientY,
          startT: e.timeStamp,
          x: e.clientX,
          y: e.clientY,
          t: e.timeStamp,
        });
        send('down', e);
        return;
      }
      // Hover moves and releases of pointers pressed elsewhere are not ours.
      if (!known) return;
      if (phase === 'move') {
        known.x = e.clientX;
        known.y = e.clientY;
        known.t = e.timeStamp;
        send('move', e);
        return;
      }
      send(phase, e);
      contacts.delete(e.pointerId);
      if (known.pointerType === 'pen') {
        pensDown = Math.max(0, pensDown - 1);
        lastPenUpAt = e.timeStamp;
      }
      if (contacts.size === 0) owner = null;
    },
    reset() {
      contacts.clear();
      pensDown = 0;
      owner = null;
      for (const member of [...members]) member.reset();
    },
  };
  return arena;
}

/** Distance between two points, px. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}
