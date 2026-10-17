/**
 * The phone sheet in motion (DSN-53; motion-2026-10 forms-compact §7; language.md §7.3 *sheet*;
 * quality-bar Q-7; MOT-12).
 *
 * **The release.** A swipe follows the finger 1:1 (Base UI's Drawer), and when it lets go the
 * spring that takes the sheet to a detent (medium or large), or away, starts at the finger's
 * speed instead of from rest, so the sheet neither stalls nor jerks at the hand-off. CSS
 * transitions cannot take a velocity, but a `linear()` curve can carry one: as the finger lifts,
 * `releaseCurves()` writes two curves for this one release, `springToLinear()` of the sheet
 * token with the release velocity in distances per second, one toward the detent the release
 * heads for (`releaseTarget()`, Base UI's own choice restated, since the curves must be on the
 * panel before its next style) and one toward the closed position. The stylesheet picks the one
 * whose end state Base UI then sets (`[data-ending-style]` or not), and the attribute is cleared
 * when that transition ends. Releases faster than 300 px/s take `fling` (one small overshoot),
 * slower ones `glide`. Under reduced motion nothing is written: the sheet fades (§7.5).
 *
 * **The glass.** While the sheet moves (it rises, follows a finger, changes detent or leaves)
 * it draws its tier's solid twin, and once it rests its glass clears where it stands
 * (`data-glass-moving`, `ui/glass-moving.ts`, MOT-12): no frame re-blurs the page under a
 * moving layer or repaints a soft shadow, which WebKit does on every frame.
 */
import { FLING_SPEED } from '../../ui/sheet/presentation';
import { glassMoving, glassSettle } from '../../ui/glass-moving';
import { reducedMotion, springToLinear, velocityTracker, type VelocityTracker } from '../../motion';

/** The release velocity carried toward the end state, and away from it, in distances per second. */
export const TOWARD_MAX = 20;
export const AWAY_MAX = 3;

/** The release's curves and durations, as the custom properties the stylesheet reads. */
export interface ReleaseCurves {
  readonly '--release-open-ease': string;
  readonly '--release-open-ms': string;
  readonly '--release-close-ease': string;
  readonly '--release-close-ms': string;
}

/**
 * The two curves of a release `toTarget` px from the detent it heads for (positive: the detent
 * is above), `toClosed` px above the closed position, moving at `velocity` px/s (down positive).
 */
export function releaseCurves(toTarget: number, velocity: number, toClosed: number): ReleaseCurves {
  const token = Math.abs(velocity) > FLING_SPEED ? 'fling' : 'glide';
  const toOpen = Math.abs(toTarget) > 1 ? -velocity / toTarget : 0;
  const toClose = velocity / Math.max(1, toClosed);
  // Toward the target the speed is carried up to 20 distances a second. A velocity away from it
  // (a downward flick that Base UI still snaps back) turns the sheet, but only up to 3: at 20
  // the turn would first carry it almost half the way further down before it came back.
  const cap = (v: number) => Math.max(-AWAY_MAX, Math.min(TOWARD_MAX, v));
  const open = springToLinear(token, cap(toOpen));
  const close = springToLinear(token, cap(toClose));
  return {
    '--release-open-ease': open.easing,
    '--release-open-ms': `${open.duration}ms`,
    '--release-close-ease': close.easing,
    '--release-close-ms': `${close.duration}ms`,
  };
}

/** Base UI's release thresholds (`DrawerViewport`): px/ms, and the projection's reach. */
const FAST = 0.5;
const MAX_PROJECTED = 4;
const PROJECTION_MS = 300;

/**
 * The detent offset a release at `y` px below large, moving at `velocity` px/s, settles on, or
 * null when it closes the sheet: `offsets` are the detents' offsets, `height` the panel's. As
 * Base UI decides it: the position projected by the speed, its nearest detent, unless closing
 * is nearer or a fast downward release closes.
 */
export function releaseTarget(
  y: number,
  velocity: number,
  offsets: readonly number[],
  height: number,
): number | null {
  const v = velocity / 1000;
  const projected =
    Math.abs(v) >= FAST ? Math.max(-MAX_PROJECTED, Math.min(MAX_PROJECTED, v)) * PROJECTION_MS : 0;
  const target = Math.max(0, Math.min(height, y + projected));
  let nearest = offsets[0] ?? 0;
  for (const offset of offsets) {
    if (Math.abs(offset - target) < Math.abs(nearest - target)) nearest = offset;
  }
  if (v >= FAST) return null;
  return Math.abs(target - height) < Math.abs(target - nearest) ? null : nearest;
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
 * Follows `panel` while it is mounted: its swipes, whose release curves it writes as the finger
 * lifts (`data-released`), and its moves, during which it draws its solid twin. `detents()`
 * gives the detents' offsets below large, `gap` the room under the sheet. Returns the stop.
 */
export function watchSheet(
  panel: HTMLElement,
  detents: () => readonly number[],
  gap: number,
): () => void {
  let tracker: VelocityTracker | null = null;
  const moving = () => {
    if (!reducedMotion()) glassMoving(panel);
  };
  const move = (event: PointerEvent) => {
    if (!panel.hasAttribute('data-swiping')) return;
    moving();
    tracker ??= velocityTracker();
    tracker.add(event.timeStamp || performance.now(), event.clientX, event.clientY);
  };
  const up = () => {
    const t = tracker;
    tracker = null;
    if (!t || reducedMotion()) return;
    const velocity = t.velocity().y;
    const y = offsetOf(panel);
    const height = panel.offsetHeight;
    const target = releaseTarget(y, velocity, detents(), height);
    const curves = releaseCurves(target === null ? 0 : y - target, velocity, height + gap - y);
    for (const name of Object.keys(curves) as (keyof ReleaseCurves)[]) {
      panel.style.setProperty(name, curves[name]);
    }
    panel.setAttribute('data-released', '');
    // A release that moves nothing (a tap on the grabber) starts no transition: the curves go
    // once Base UI has had its frame, so a later close never runs on this release's curve.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (panel.getAnimations().length === 0) {
          panel.removeAttribute('data-released');
          glassSettle(panel);
        }
      }),
    );
  };
  const started = (event: TransitionEvent) => {
    if (event.target === panel && event.propertyName === 'transform') moving();
  };
  const ended = (event: TransitionEvent) => {
    if (event.target !== panel || event.propertyName !== 'transform') return;
    panel.removeAttribute('data-released');
    // A turn (a new detent mid-way) cancels one transition as it starts the next: still moving.
    const still = panel
      .getAnimations()
      .some((a) => (a as Partial<CSSTransition>).transitionProperty === 'transform');
    if (!still && !panel.hasAttribute('data-swiping') && panel.hasAttribute('data-glass-moving')) {
      glassSettle(panel);
    }
  };
  // Capture: the drawer may hold the pointer on an ancestor while it swipes.
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);
  panel.addEventListener('transitionrun', started);
  panel.addEventListener('transitionend', ended);
  panel.addEventListener('transitioncancel', ended);
  return () => {
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', up, true);
    panel.removeEventListener('transitionrun', started);
    panel.removeEventListener('transitionend', ended);
    panel.removeEventListener('transitioncancel', ended);
  };
}
