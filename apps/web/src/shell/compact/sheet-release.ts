/**
 * The compact sheet's release (motion-2026-10 forms-compact §7; language.md §7.3 *sheet*;
 * quality-bar Q-7): a swipe follows the finger 1:1 (Base UI's Drawer), and when it lets go the
 * spring that takes the sheet to its detent, or away, starts at the finger's speed instead of
 * from rest, so the sheet neither stalls nor jerks at the hand-off.
 *
 * CSS transitions cannot take a velocity, but a `linear()` curve can carry one: as the finger
 * lifts, `releaseCurves()` writes two curves for this one release, `springToLinear()` of the
 * sheet token with the release velocity in distances per second, one toward the detent and one
 * toward the closed position. The stylesheet picks the one whose end state Base UI then sets
 * (`[data-ending-style]` or not), and the attribute is cleared when that transition ends.
 * Releases faster than 300 px/s take `fling` (one small overshoot), slower ones `glide`.
 *
 * Under reduced motion nothing is written: the sheet's spring is instant (§7.5).
 */
import { FLING_SPEED } from '../../ui/sheet/presentation';
import { reducedMotion, springToLinear, velocityTracker, type VelocityTracker } from '../../motion';

/** The release's curves and durations, as the custom properties the stylesheet reads. */
export interface ReleaseCurves {
  readonly '--release-open-ease': string;
  readonly '--release-open-ms': string;
  readonly '--release-close-ease': string;
  readonly '--release-close-ms': string;
}

/**
 * The two curves of a release at `offset` px below the detent, moving at `velocity` px/s (down
 * positive), for a sheet `travel` px from the detent to closed.
 */
export function releaseCurves(offset: number, velocity: number, travel: number): ReleaseCurves {
  const token = Math.abs(velocity) > FLING_SPEED ? 'fling' : 'glide';
  // Toward the detent the sheet moves up (velocity < 0 is toward it); toward closed, down.
  const toOpen = offset > 1 ? -velocity / offset : 0;
  const rest = Math.max(1, travel - offset);
  const toClose = velocity / rest;
  // A velocity away from the target is still carried (the sheet turns), but capped, so a curve
  // never has to cover a huge overshoot in its first frames.
  const cap = (v: number) => Math.max(-20, Math.min(20, v));
  const open = springToLinear(token, cap(toOpen));
  const close = springToLinear(token, cap(toClose));
  return {
    '--release-open-ease': open.easing,
    '--release-open-ms': `${open.duration}ms`,
    '--release-close-ease': close.easing,
    '--release-close-ms': `${close.duration}ms`,
  };
}

/** The panel's vertical offset now, from its computed transform (px). */
function offsetOf(panel: HTMLElement): number {
  const transform = getComputedStyle(panel).transform;
  if (!transform || transform === 'none') return 0;
  try {
    return new DOMMatrixReadOnly(transform).m42;
  } catch {
    return 0;
  }
}

/**
 * Follows swipes on `panel` while it is open and writes the release's curves on it as the
 * finger lifts (`data-released`). Returns the stop.
 */
export function watchRelease(panel: HTMLElement, bleed: number): () => void {
  let tracker: VelocityTracker | null = null;
  const move = (event: PointerEvent) => {
    if (!panel.hasAttribute('data-swiping')) return;
    tracker ??= velocityTracker();
    tracker.add(event.timeStamp || performance.now(), event.clientX, event.clientY);
  };
  const up = () => {
    const t = tracker;
    tracker = null;
    if (!t || reducedMotion()) return;
    const velocity = t.velocity().y;
    const offset = offsetOf(panel);
    const travel = panel.offsetHeight - bleed;
    const curves = releaseCurves(offset, velocity, travel);
    for (const name of Object.keys(curves) as (keyof ReleaseCurves)[]) {
      panel.style.setProperty(name, curves[name]);
    }
    panel.setAttribute('data-released', '');
    // A release that moves nothing (a tap on the grabber) starts no transition: the curves go
    // once Base UI has had its frame, so a later Done never closes on this release's curve.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (panel.getAnimations().length === 0) panel.removeAttribute('data-released');
      }),
    );
  };
  const ended = (event: TransitionEvent) => {
    if (event.target !== panel || event.propertyName !== 'transform') return;
    panel.removeAttribute('data-released');
  };
  // Capture: the drawer may hold the pointer on an ancestor while it swipes.
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);
  panel.addEventListener('transitionend', ended);
  panel.addEventListener('transitioncancel', ended);
  return () => {
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', up, true);
    panel.removeEventListener('transitionend', ended);
    panel.removeEventListener('transitioncancel', ended);
  };
}
