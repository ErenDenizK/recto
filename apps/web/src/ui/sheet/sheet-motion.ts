/**
 * How a sheet moves (components/07-sheets.md §2.7; language.md §7.3 *dialog*, *sheet*;
 * quality-bar.md Q-2, Q-3, Q-7, Q-10), on the motion core (`motion/`):
 *
 * - The panel has its final size before it moves: it is laid out at rest, then translated (and
 *   for centred dialogs scaled) from where it enters. Open, close and detent changes write only
 *   `transform` (and `opacity` where the catalogue fades), so its content never reflows.
 * - Centred dialog and form sheet: *dialog* centre, `scale(0.96)` and opacity on `quick`. Side
 *   sheet: *dialog* side, 24 px and opacity on `smooth`. Bottom and full sheets: *sheet*, from
 *   below on `glide`, or `fling` when a release is faster than 300 px/s.
 * - From a control (motion-2026-10/platform.md §1): a side or bottom sheet opened by a press on
 *   a control comes out of it (the panel laid over the control at a uniform scale, centres
 *   met, fading in) and settles into its edge on `smooth`; it closes back into that control
 *   (a menu item's menu trigger) while it is on screen, whole for 120 ms and then fading,
 *   and the control takes it in with the *receive* pulse. Otherwise, or when a swipe throws
 *   it, it leaves by its edge as above.
 * - A swipe (bottom sheets down, a compact-height side sheet right) follows the pointer 1:1,
 *   with the rubber band past the tallest detent; the release hands its velocity to the spring
 *   (Q-7), projects with r 0.998 and snaps to a detent or closes (`releaseTarget`).
 * - Every move retargets from where the panel is, with its velocity, so a sheet can be grabbed
 *   or reversed mid-flight (Q-10). At rest no transform or `will-change` is left inline: the
 *   resting offset is the stylesheet's `--sheet-y`, a whole pixel (Q-2).
 * - The exit keeps its last frame inline (`keep`), so the panel stays off screen until Base UI,
 *   which waits for the panel's animations, unmounts it.
 * - Reduced motion (§7.5): the motion core makes every spatial move instant and keeps the fade
 *   at 150 ms; the bottom and full sheets then fade too. A drag stays 1:1, with no projection
 *   and no rubber band.
 *
 * Only the panel moves: the glass is the moving element itself, never a wrapper, so no
 * ancestor starts a backdrop root mid-animation (Q-3); `backdrop-filter` never animates.
 */
import {
  animateStyle,
  type Motion,
  project,
  receivePulse,
  reducedMotion,
  rubberBand,
  type SpringName,
  velocityTracker,
  type VelocityTracker,
} from '../../motion';
import { onScreen, type PressOrigin } from '../press-origin';
import { detentOffsets, FLING_SPEED, releaseTarget, type SheetLayout } from './presentation';

/** How far below the window a bottom sheet's panel reaches, so an upward pull shows no gap. */
export const SHEET_BLEED = 48;
/** A side sheet enters from 24 px out (language.md §7.3 *dialog* side). */
const SIDE_SHIFT = 24;
/** A centred dialog enters from 0.96 (§7.3 *dialog* centre). */
const DIALOG_SCALE = 0.96;
/** A press that moves this far along the swipe axis becomes a drag. */
const DRAG_SLOP = 6;
/** A panel coming out of a control starts at least this big (a whole sheet in a 32 px dot
 * would be a speck). */
const ORIGIN_MIN_SCALE = 0.08;
/** Going back into its control, the panel stays whole this long, then fades on `quick`. */
const RETURN_FADE_DELAY_MS = 120;

type Vec = readonly [x: number, y: number, scale: number];

/** The control a sheet came out of: its rect at the press, and where the sheet returns. */
export type SheetOrigin = Pick<PressOrigin, 'rect' | 'returnTo'>;

export interface SheetMotion {
  /** The panel to move; null when it unmounts. */
  attach(el: HTMLElement | null): void;
  /**
   * The control that opened the sheet, if any (platform.md §1): a side or bottom sheet comes
   * out of it, settling into its edge on `smooth`, and goes back into it while it is on screen.
   */
  setOrigin(origin: SheetOrigin | null): void;
  /** The layout it presents now (a size-class change re-presents at once, 07 §2.6). */
  setLayout(layout: SheetLayout): void;
  /** Opens from the entering position, or retargets from wherever an exit had got to. */
  enter(): void;
  /** Closes towards the exit position, with a release's velocity when a swipe closed it. */
  exit(): void;
  /** Re-reads the rest position after a resize, when nothing moves. */
  relayout(): void;
  /**
   * Pointer handlers for the swipe. `onPointerDown` is the panel's and answers whether a swipe
   * may start; the caller then sends that pointer's moves, release and cancel from the window,
   * since the pointer leaves the panel before the drag takes it over.
   */
  readonly pointer: {
    onPointerDown(event: PointerEvent): boolean;
    onPointerMove(event: PointerEvent): void;
    onPointerUp(event: PointerEvent): void;
    onPointerCancel(event: PointerEvent): void;
    onClickCapture(event: MouseEvent): void;
  };
}

interface Drag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  /** Started on the grabber or header (either direction) or the content scrolled to top. */
  readonly zone: 'handle' | 'content';
  readonly tracker: VelocityTracker;
  /** Set once the press has moved past the slop. */
  active: boolean;
  /** The panel's offset along the axis when the drag took over. */
  base: number;
  /** Where the panel is now along the axis. */
  at: number;
}

/**
 * The motion of one sheet's panel. `onSwipeClose` is called when a release closes it; the
 * caller closes the sheet, and `exit()` then carries the release's velocity.
 */
export function createSheetMotion(onSwipeClose: () => void): SheetMotion {
  let el: HTMLElement | null = null;
  let layout: SheetLayout | null = null;
  let transform: Motion<readonly number[]> | null = null;
  let opacity: Motion | null = null;
  /** Index of the detent the bottom sheet rests at. */
  let detent = 0;
  /** The rest offset along the swipe axis (bottom: y; side: x), written as `--sheet-y`/`-x`. */
  let rest = 0;
  let drag: Drag | null = null;
  /** The release velocity (px/s towards closed) a swipe-close hands to the exit. */
  let releaseVelocity = 0;
  /** Where that release let go, along the axis: the exit starts there. */
  let releaseAt: number | null = null;
  /** Swallow the click that ends a drag. */
  let swallowClick = false;
  let open = false;
  /** The control that opened the sheet (platform.md §1), for a side or bottom sheet. */
  let origin: SheetOrigin | null = null;
  /** The return's fade waits for the panel to shrink part of the way. */
  let fadeLater: ReturnType<typeof setTimeout> | undefined;
  /** Whether the panel is on its way into the control (it pulses when it gets there). */
  let returning: HTMLElement | null = null;

  /** Does the panel come out of (and go back into) a control? */
  const fromControl = (): SheetOrigin | null =>
    presentation() === 'side' || presentation() === 'bottom' ? origin : null;

  /**
   * The transform that lays the panel's box over `rect`: the centres meet, and a uniform scale
   * (never a squash) makes the panel just cover the control. The panel scales about its centre.
   */
  const over = (rect: DOMRect): Vec | null => {
    if (!el || rect.width === 0) return null;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w === 0 || h === 0) return null;
    const s = Math.min(1, Math.max(ORIGIN_MIN_SCALE, rect.width / w, rect.height / h));
    return [
      rect.left + rect.width / 2 - (el.offsetLeft + w / 2),
      rect.top + rect.height / 2 - (el.offsetTop + h / 2),
      s,
    ];
  };

  const presentation = () => layout?.presentation ?? 'dialog';
  const axis = (): 'x' | 'y' => (layout?.swipe === 'right' ? 'x' : 'y');

  /** The panel's visible height at its tallest (bottom sheets reach past the window). */
  const visibleHeight = () =>
    el ? el.offsetHeight - (presentation() === 'bottom' ? SHEET_BLEED : 0) : 0;

  const offsets = () =>
    layout && presentation() === 'bottom'
      ? detentOffsets(layout.detents, visibleHeight(), window.innerHeight)
      : [0];

  /** The offset along the axis at which the panel is wholly off screen. */
  const closedOffset = () => {
    if (!el) return 0;
    if (axis() === 'x') return el.offsetWidth + 16;
    if (presentation() === 'bottom') return visibleHeight() + 2;
    // A full sheet: its top inset as well.
    return el.offsetHeight + el.offsetTop + 2;
  };

  const writeRest = () => {
    if (!el) return;
    const rounded = Math.round(rest);
    el.style.setProperty('--sheet-x', axis() === 'x' ? `${rounded}px` : '0px');
    el.style.setProperty('--sheet-y', axis() === 'y' ? `${rounded}px` : '0px');
  };

  const restVec = (): Vec => (axis() === 'x' ? [rest, 0, 1] : [0, rest, 1]);

  /** Where the panel enters from and exits to. */
  const outside = (): Vec => {
    switch (presentation()) {
      case 'side':
        return [axis() === 'x' ? closedOffset() : SIDE_SHIFT, 0, 1];
      case 'bottom':
      case 'full':
        return [0, closedOffset(), 1];
      default:
        return [0, 0, DIALOG_SCALE];
    }
  };

  /** Does this presentation fade as it enters and leaves? */
  const fades = () => {
    const p = presentation();
    if (p === 'side' && axis() === 'x') return reducedMotion();
    return p === 'side' || p === 'dialog' || p === 'form' || reducedMotion();
  };

  const springOf = (velocity: number): SpringName => {
    const p = presentation();
    if (p === 'bottom' || p === 'full' || axis() === 'x') {
      return Math.abs(velocity) > FLING_SPEED ? 'fling' : 'glide';
    }
    return p === 'side' ? 'smooth' : 'quick';
  };

  /** Stops what moves, returning where the transform was (or undefined when at rest). */
  const stopTransform = ():
    | { value: readonly number[]; velocity: readonly number[] }
    | undefined => {
    const run = transform;
    transform = null;
    return run ? run.stop() : undefined;
  };

  const along = (v: readonly number[]) => (axis() === 'x' ? (v[0] ?? 0) : (v[1] ?? 0));
  const vecAlong = (value: number, base: Vec): Vec =>
    axis() === 'x' ? [value, base[1], base[2]] : [base[0], value, base[2]];

  /**
   * Moves the transform to `to` from where it is (or `from` when at rest), carrying the running
   * velocity or `velocity` (px/s along the axis). `keep` leaves the target inline (the exit).
   */
  const moveTo = (
    to: Vec,
    from: Vec,
    velocity: number | undefined,
    keep: boolean,
    spring?: SpringName,
  ) => {
    if (!el) return;
    const stopped = stopTransform();
    const start = stopped?.value ?? from;
    const v =
      velocity === undefined
        ? (stopped?.velocity ?? [0, 0, 0])
        : axis() === 'x'
          ? [velocity, 0, 0]
          : [0, velocity, 0];
    const run = animateStyle(el, 'transform', start, to, {
      spring: spring ?? springOf(velocity ?? along(v)),
      velocity: v,
      keep,
    });
    transform = run;
    void run.finished.then(() => {
      if (transform === run) transform = null;
    });
  };

  const fadeTo = (to: number, keep: boolean) => {
    if (!el) return;
    clearTimeout(fadeLater);
    const stopped = opacity?.stop();
    opacity = null;
    const from = stopped?.value ?? (to === 1 ? 0 : 1);
    if (from === to && !keep) {
      el.style.removeProperty('opacity');
      return;
    }
    const run = animateStyle(el, 'opacity', from, to, { spring: 'quick', keep });
    opacity = run;
    void run.finished.then(() => {
      if (opacity === run) opacity = null;
    });
  };

  const settleRest = () => {
    if (presentation() === 'bottom') {
      const all = offsets();
      detent = Math.min(detent, all.length - 1);
      rest = all[detent] ?? 0;
    } else {
      rest = 0;
    }
    writeRest();
  };

  const motion: SheetMotion = {
    attach(next) {
      if (next === el) return;
      el = next;
      if (!el) {
        transform = null;
        opacity = null;
        drag = null;
      }
    },
    setLayout(next) {
      const changed =
        layout?.presentation !== next.presentation ||
        layout.swipe !== next.swipe ||
        layout.detents.join() !== next.detents.join();
      layout = next;
      if (!changed || !el || !open) return;
      // Crossing a size class re-presents at once: stop where it is and rest in the new place.
      stopTransform();
      opacity?.stop();
      opacity = null;
      el.style.removeProperty('transform');
      el.style.removeProperty('opacity');
      detent = 0;
      settleRest();
    },
    setOrigin(next) {
      origin = next;
    },
    enter() {
      if (!el) return;
      open = true;
      returning = null;
      const resting = !transform && !opacity;
      detent = 0;
      settleRest();
      // Out of the control that opened it (platform.md §1), else from its edge.
      const control = fromControl();
      const emerge = resting && control && !reducedMotion() ? over(control.rect) : null;
      const from = emerge ?? outside();
      // A sheet reopened mid-exit turns back from where it is, with its speed.
      moveTo(
        restVec(),
        resting ? from : restVec(),
        undefined,
        false,
        emerge ? 'smooth' : undefined,
      );
      if (fades() || emerge) fadeTo(1, false);
      else if (opacity) fadeTo(1, false);
    },
    exit() {
      if (!el) return;
      open = false;
      drag = null;
      delete el.dataset.swiping;
      const velocity = releaseVelocity;
      const from = releaseAt === null ? restVec() : vecAlong(releaseAt, restVec());
      releaseVelocity = 0;
      releaseAt = null;
      // Back into the control while it is on screen, unless a swipe threw it to its edge.
      const back = fromControl()?.returnTo ?? null;
      const home = !velocity && onScreen(back) ? back : null;
      const into = home && !reducedMotion() ? over(home.getBoundingClientRect()) : null;
      if (into && home) {
        returning = home;
        moveTo(into, from, undefined, true, 'smooth');
        const run = transform;
        void run?.finished.then(() => {
          if (returning === home && transform === null && !open) {
            returning = null;
            receivePulse(home);
          }
        });
        // The glass stays whole while it shrinks, and fades over the last of the way.
        clearTimeout(fadeLater);
        fadeLater = setTimeout(() => fadeTo(0, true), RETURN_FADE_DELAY_MS);
        return;
      }
      moveTo(outside(), from, velocity || undefined, true);
      if (fades() || opacity) fadeTo(0, true);
    },
    relayout() {
      if (!el || !open || transform || drag) return;
      settleRest();
    },
    pointer: {
      onPointerDown(event) {
        swallowClick = false;
        if (!el || !open || !layout?.swipe || event.button !== 0) return false;
        const target = event.target as Element | null;
        if (!target) return false;
        const handle = target.closest('[data-sheet-handle]');
        let zone: Drag['zone'] | null = null;
        if (handle) zone = 'handle';
        else {
          const body = target.closest<HTMLElement>('[data-sheet-body]');
          // From the content only when it is scrolled to its top (07 §2.6), and never from a
          // field, where a drag selects text, or from a surface that owns the drag (New
          // signature's pad, `data-sheet-no-swipe`, 07 §9 item 2).
          if (
            body &&
            body.scrollTop <= 0 &&
            !target.closest('input, textarea, select, [contenteditable], [data-sheet-no-swipe]')
          ) {
            zone = 'content';
          }
        }
        if (!zone) return false;
        const tracker = velocityTracker();
        tracker.add(event.timeStamp, event.clientX, event.clientY);
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          zone,
          tracker,
          active: false,
          base: rest,
          at: rest,
        };
        return true;
      },
      onPointerMove(event) {
        const d = drag;
        if (!el || d?.pointerId !== event.pointerId) return;
        d.tracker.add(event.timeStamp, event.clientX, event.clientY);
        const dx = event.clientX - d.startX;
        const dy = event.clientY - d.startY;
        const delta = axis() === 'x' ? dx : dy;
        if (!d.active) {
          const across = axis() === 'x' ? dy : dx;
          if (Math.abs(delta) < DRAG_SLOP) return;
          // Across more than along, or the content pulled up (it scrolls): not a swipe.
          if (Math.abs(across) > Math.abs(delta) || (d.zone === 'content' && delta < 0)) {
            drag = null;
            return;
          }
          d.active = true;
          // The drag takes over from any motion, where it is (a sheet grabbed mid-flight).
          const stopped = stopTransform();
          d.base = stopped ? along(stopped.value) : rest;
          // The pointer may already be gone (released between the events); the window still
          // sends its moves.
          try {
            el.setPointerCapture(event.pointerId);
          } catch {
            // Nothing to capture.
          }
          el.dataset.swiping = '';
        }
        // 1:1, with the rubber band above the tallest detent (07 §2.6, §2.7).
        const top = Math.min(...offsets());
        let at = d.base + delta;
        if (at < top) at = top - rubberBand(top - at, visibleHeight());
        d.at = at;
        const v = vecAlong(at, restVec());
        el.style.transform = `translate(${v[0]}px, ${v[1]}px)`;
        event.preventDefault();
      },
      onPointerUp(event) {
        const d = drag;
        if (d?.pointerId !== event.pointerId) return;
        drag = null;
        if (!d.active || !el) return;
        swallowClick = true;
        delete el.dataset.swiping;
        if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
        const speed = d.tracker.velocity(event.timeStamp);
        const velocity = axis() === 'x' ? speed.x : speed.y;
        const projected = d.at + project(velocity);
        const all = offsets();
        const target = releaseTarget(projected, velocity, all, closedOffset());
        if (target.close) {
          releaseVelocity = velocity;
          releaseAt = d.at;
          // The exit starts from the drag's last frame, written inline.
          onSwipeClose();
          return;
        }
        detent = Math.max(0, all.indexOf(target.offset));
        rest = target.offset;
        writeRest();
        moveTo(restVec(), vecAlong(d.at, restVec()), velocity, false);
      },
      onPointerCancel(event) {
        const d = drag;
        if (d?.pointerId !== event.pointerId) return;
        drag = null;
        if (!d.active || !el) return;
        delete el.dataset.swiping;
        moveTo(restVec(), vecAlong(d.at, restVec()), 0, false);
      },
      onClickCapture(event) {
        if (!swallowClick) return;
        swallowClick = false;
        event.preventDefault();
        event.stopPropagation();
      },
    },
  };
  return motion;
}
