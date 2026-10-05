/**
 * Two- and three-finger taps: Undo and Redo in Markup (research 19 §6, M-17; flows.md §7.1 and
 * S12: nothing while viewing, so the consumer passes `enabled`; 09-primitives §31).
 *
 * A group starts with the first finger. It counts when every finger landed within
 * `GESTURE.multiTapMs` (150 ms) of the first, all lifted within `GESTURE.multiTapUpMs` (300 ms)
 * of it, none moved `GESTURE.multiTapPx` (12 px) or more, no pen was in contact and none lifted
 * in the previous `GESTURE.penQuietMs` (500 ms: a palm beside the pen is no gesture). The most
 * fingers down at once decide: two calls `onTwo`, three `onThree`; one or four call nothing.
 * Research 19 §12 picks the single tap (Procreate, Notability, Freeform) over GoodNotes' double;
 * the naming toast is the consumer's safety net.
 *
 * A pinch claims the arena as soon as its fingers move, which also ends a group here.
 */
import { type Arena, distance, type PointerLike, type Recogniser } from './arena';
import { GESTURE } from './constants';

export interface MultiFingerTapOptions {
  /** Whether the gesture acts now (Markup only, flows.md S12); read at the tap. */
  enabled?: boolean | (() => boolean);
  /** Two fingers tapped: Undo. */
  onTwo?(): void;
  /** Three fingers tapped: Redo. */
  onThree?(): void;
}

export function multiFingerTap<E extends PointerLike = PointerLike>(
  options: MultiFingerTapOptions,
): Recogniser<E> {
  let group: {
    readonly start: number;
    readonly fingers: Map<number, { x: number; y: number }>;
    most: number;
    valid: boolean;
  } | null = null;

  const enabled = () =>
    typeof options.enabled === 'function' ? options.enabled() : options.enabled !== false;

  const finish = (arena: Arena<E>) => {
    // The group ends when its last finger lifts.
    if (!group || arena.touches() > 1) return;
    const { valid, most } = group;
    group = null;
    if (!valid || !enabled()) return;
    if (most === 2) options.onTwo?.();
    else if (most === 3) options.onThree?.();
  };

  return {
    down(e, arena) {
      if (e.pointerType === 'pen') {
        if (group) group.valid = false;
        return;
      }
      if (e.pointerType !== 'touch') return;
      if (!group) {
        // A finger joining one already down (held, scrolling) starts no group.
        if (arena.touches() !== 1) return;
        group = { start: e.timeStamp, fingers: new Map(), most: 0, valid: true };
        if (arena.penDown || e.timeStamp - arena.lastPenUpAt < GESTURE.penQuietMs) {
          group.valid = false;
        }
      }
      group.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      group.most = Math.max(group.most, arena.touches());
      if (e.timeStamp - group.start > GESTURE.multiTapMs || group.most > 3) group.valid = false;
    },
    move(e) {
      const finger = group?.fingers.get(e.pointerId);
      if (!group || !finger) return;
      if (distance(finger.x, finger.y, e.clientX, e.clientY) >= GESTURE.multiTapPx) {
        group.valid = false;
      }
    },
    up(e, arena) {
      if (!group?.fingers.has(e.pointerId)) return;
      if (e.timeStamp - group.start > GESTURE.multiTapUpMs) group.valid = false;
      finish(arena);
    },
    cancel(e, arena) {
      if (!group?.fingers.has(e.pointerId)) return;
      group.valid = false;
      finish(arena);
    },
    reset() {
      group = null;
    },
  };
}
