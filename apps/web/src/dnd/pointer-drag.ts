/**
 * The pointer path for dragging pages (`components/06-navigation.md` §2.4, PG5 §9; flows.md
 * S13; research 19 M-20): one recogniser for mouse, pen and touch on the gesture core's arena
 * (`motion/gesture/`, spec X5), so a drag, a long press and a scroll are told apart by the same
 * thresholds everywhere.
 *
 * | Pointer | Lift | Before the lift |
 * |---|---|---|
 * | Mouse, pen | `GESTURE.mouseDragPx` (4 px) of movement after the press | a click |
 * | Touch | `GESTURE.longPressMs` (450 ms) held within `GESTURE.slopPx` (10 px), then movement | moving first is the browser's scroll (S13): the press is dropped |
 *
 * - **Held, released without moving** (touch): `onHoldRelease`, the item's menu (06.3: a long
 *   press released without moving opens the thumbnail menu; moving after it drags).
 * - **Guard at the lift:** `onLift` returns false to refuse (a locked document): nothing lifts
 *   and the press ends there.
 * - **Cancel:** a second pointer (a pinch wins), `pointercancel`, Esc (the DOM wiring), or
 *   `cancel()`; `onCancel` runs only for a lifted drag.
 *
 * The recogniser is pure over the arena (unit tests feed synthetic streams with fake timers);
 * `attachPointerDrag` adds the platform parts: after a touch hold a non-passive `touchmove`
 * keeps the browser from scrolling under the drag, Android's `contextmenu` and the release's
 * `click` are swallowed, and Esc cancels.
 */
import { type Arena, distance, type PointerLike, type Recogniser } from '../motion/gesture/arena';
import { GESTURE } from '../motion/gesture/constants';
import { attachRecogniser, type GestureTarget } from '../motion/gesture/dom';

export type PointerDragPhase = 'idle' | 'pressed' | 'holding' | 'held' | 'lifted';

export interface PointerDragOptions<E extends PointerLike = PointerLike> {
  /** Whether this press may become a drag (the consumer hit-tests the press point). */
  shouldStart(e: E): boolean;
  /**
   * The drag lifts at `e` from the press `start`; false refuses it (the guard). Called once per
   * press.
   */
  onLift(e: E, start: E): boolean;
  /** The lifted pointer moved. */
  onMove(e: E): void;
  /** The lifted pointer was released over `e`. */
  onDrop(e: E): void;
  /** A lifted drag ended without a drop (Esc, a second pointer, `pointercancel`). */
  onCancel(): void;
  /** Touch: the hold fired (feedback: a haptic, the row's pressed look). */
  onHold?(e: E): void;
  /** Touch: the hold fired and the finger lifted without moving (the item's menu). */
  onHoldRelease?(e: E): void;
  /** The press ended in any way (tidy the pressed look). */
  onEnd?(): void;
}

export interface PointerDrag<E extends PointerLike = PointerLike> extends Recogniser<E> {
  readonly phase: PointerDragPhase;
  /** Ends the press; a lifted drag is cancelled (Esc). */
  cancel(): void;
}

/** Movement after a touch hold that turns it into a drag (a still finger wobbles a little). */
export const HELD_MOVE_PX = 4;

export function pointerDrag<E extends PointerLike = PointerLike>(
  options: PointerDragOptions<E>,
): PointerDrag<E> {
  let phase: PointerDragPhase = 'idle';
  let start: E | null = null;
  let arena: Arena<E> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Where the held finger rested when the hold fired. */
  let heldAt: { x: number; y: number } | null = null;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const end = (how: 'drop' | 'cancel' | 'quiet', e?: E) => {
    const was = phase;
    clear();
    phase = 'idle';
    start = null;
    heldAt = null;
    if (was === 'lifted') {
      if (how === 'drop' && e) options.onDrop(e);
      else options.onCancel();
    }
    if (was !== 'idle') options.onEnd?.();
  };

  const lift = (e: E) => {
    const from = start;
    if (!from) return;
    clear();
    if (!options.onLift(e, from)) {
      // Refused: the press is over; a held touch keeps its claim so nothing else fires.
      phase = 'idle';
      start = null;
      heldAt = null;
      options.onEnd?.();
      return;
    }
    phase = 'lifted';
    arena?.claim(recogniser);
    options.onMove(e);
  };

  const recogniser: PointerDrag<E> = {
    get phase() {
      return phase;
    },
    down(e, a) {
      // A second pointer: a pinch or a two-finger tap wins over any drag.
      if (a.contacts.size !== 1) {
        end('cancel');
        return;
      }
      if (e.button !== 0 || !options.shouldStart(e)) return;
      end('quiet');
      start = e;
      arena = a;
      if (e.pointerType === 'touch') {
        phase = 'holding';
        timer = setTimeout(() => {
          if (phase !== 'holding' || !start) return;
          timer = undefined;
          phase = 'held';
          heldAt = { x: start.clientX, y: start.clientY };
          // The hold is ours: a pending long press elsewhere on the arena must not fire too.
          arena?.claim(recogniser);
          options.onHold?.(start);
        }, GESTURE.longPressMs);
      } else {
        phase = 'pressed';
      }
    },
    move(e) {
      if (!start || e.pointerId !== start.pointerId) return;
      const moved = distance(start.clientX, start.clientY, e.clientX, e.clientY);
      switch (phase) {
        case 'pressed':
          if (moved > GESTURE.mouseDragPx) lift(e);
          return;
        case 'holding':
          // Moving before the hold is a scroll (S13): the browser keeps it.
          if (moved > GESTURE.slopPx) end('quiet');
          return;
        case 'held':
          if (heldAt && distance(heldAt.x, heldAt.y, e.clientX, e.clientY) > HELD_MOVE_PX) {
            lift(e);
          }
          return;
        case 'lifted':
          options.onMove(e);
          return;
        default:
      }
    },
    up(e) {
      if (!start || e.pointerId !== start.pointerId) return;
      if (phase === 'held') {
        const held = start;
        end('quiet');
        options.onHoldRelease?.(held);
        return;
      }
      end(phase === 'lifted' ? 'drop' : 'quiet', e);
    },
    cancel(e?: E) {
      if (e !== undefined && start && e.pointerId !== start.pointerId) return;
      end('cancel');
    },
    reset() {
      end('cancel');
    },
    dispose() {
      end('cancel');
    },
  };
  return recogniser;
}

/**
 * Wires `pointerDrag` on `target` (see the module comment for the platform parts). Returns the
 * removal.
 */
export function attachPointerDrag(
  target: GestureTarget,
  options: PointerDragOptions<PointerEvent>,
): () => void {
  const doc = target instanceof Document ? target : target.ownerDocument;
  const view = doc.defaultView ?? window;
  /** After a hold or a drag, the release's click (and Android's menu echo) are not taps. */
  let swallowUntil = Number.NEGATIVE_INFINITY;
  const swallowSoon = () => {
    swallowUntil = performance.now() + GESTURE.clickEchoMs;
  };

  const recogniser = pointerDrag<PointerEvent>({
    shouldStart: (e) => options.shouldStart(e),
    onLift: (e, start) => options.onLift(e, start),
    onMove: (e) => options.onMove(e),
    onDrop: (e) => {
      swallowSoon();
      options.onDrop(e);
    },
    onCancel: () => {
      swallowSoon();
      options.onCancel();
    },
    onHold: (e) => options.onHold?.(e),
    onHoldRelease: (e) => {
      swallowSoon();
      options.onHoldRelease?.(e);
    },
    onEnd: () => options.onEnd?.(),
  });

  // After a touch hold the finger's moves are the drag's, not a scroll.
  const onTouchMove = (event: TouchEvent) => {
    if (recogniser.phase === 'held' || recogniser.phase === 'lifted') {
      if (event.cancelable) event.preventDefault();
    }
  };
  const onContextMenu = (event: Event) => {
    if (recogniser.phase === 'holding' || recogniser.phase === 'held') {
      event.preventDefault();
    } else if (performance.now() < swallowUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const onClick = (event: Event) => {
    if (performance.now() >= swallowUntil) return;
    swallowUntil = Number.NEGATIVE_INFINITY;
    event.preventDefault();
    event.stopPropagation();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || recogniser.phase !== 'lifted') return;
    event.preventDefault();
    event.stopPropagation();
    recogniser.cancel();
  };
  const capture = { capture: true } as const;
  view.addEventListener('touchmove', onTouchMove, { passive: false });
  target.addEventListener('contextmenu', onContextMenu, capture);
  view.addEventListener('click', onClick, capture);
  view.addEventListener('keydown', onKeyDown, capture);
  const remove = attachRecogniser(target, recogniser);
  return () => {
    remove();
    view.removeEventListener('touchmove', onTouchMove);
    target.removeEventListener('contextmenu', onContextMenu, capture);
    view.removeEventListener('click', onClick, capture);
    view.removeEventListener('keydown', onKeyDown, capture);
  };
}
