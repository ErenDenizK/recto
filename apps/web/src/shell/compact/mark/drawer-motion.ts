/**
 * The tool drawer's motion (DSN-53, MOT-12; `design/phone-2026-10/README.md` §3 "How it moves").
 * The drawer is the phone sheet's stays-open form, so it moves as every phone sheet does: it
 * rises from below the screen's edge to its place over the island, behind which it passes, and
 * goes back down; `transform` alone, on the compositor (MOT-12: nothing clipped, masked or laid
 * out per frame; the container transform's clip out of the chip, MOT-5, is gone). This drives
 * one progress number on the brief's spring and draws each frame as a `translateY`:
 *
 * - **Open on `smooth`** (zero bounce, README §3 "Feel"), **close on `quick`**, a little
 *   quicker, as every popup's close (MC-16). A turn starts from the present progress and
 *   velocity, so a close during the rise goes back from where it is (interruptible).
 * - **Glass.** While it moves the panel draws its tier's solid twin with an unblurred rim, and
 *   once it is open and still its glass clears where it stands (`ui/glass-moving.ts`): no frame
 *   re-blurs the page under a moving layer or repaints a soft shadow (WebKit).
 * - **Swipe down** moves the panel with the finger by its `translate` property (composed with
 *   the frames' `transform`); the close that follows takes that offset back to 0 on the same
 *   clock, so nothing jumps at the release.
 * - Opened, nothing stays inline (Q-2); closed, the last frame holds until the panel unmounts.
 * - **Reduced motion:** opacity only, 150 ms in, 100 ms out (A-9).
 * - **What it covers** (`covers`, the list variant's island, EDN-16): a panel that rises over
 *   the island fades it out over the first `COVER_SPAN` of the progress, on the same clock, so
 *   there is never glass over glass at rest; closed, the island's fade is cancelled and nothing
 *   stays inline on it.
 */
import { glassMoving, glassSettle } from '../../../ui/glass-moving';
import { reducedMotion } from '../../../motion/reduced-motion';
import { energy, solve, type Spring, springs } from '../../../motion/springs';
import { EASE, REDUCED_DURATION_MS } from '../../../motion/tokens';

/** A swipe down this far closes the drawer, CSS px. */
export const SWIPE_CLOSE_PX = 64;
/** Or one this fast at the release, CSS px per ms, once past the drag's start. */
export const SWIPE_CLOSE_SPEED = 0.5;

/** Whether a swipe that went `dy` px down, at `speed` px/ms on average, closes the drawer. */
export function swipeCloses(dy: number, speed: number): boolean {
  return dy >= SWIPE_CLOSE_PX || (dy >= 16 && speed >= SWIPE_CLOSE_SPEED);
}

/** The share of the progress over which a covered island fades. */
export const COVER_SPAN = 0.3;
/** Keyframe rate. */
const FPS = 120;
/** A segment ends when its energy has fallen to this fraction. */
const PRECISION = 1e-6;
/** Past the screen's edge by this much when closed, so its rim never shows, CSS px. */
const BELOW = 8;

export interface DrawerMotion {
  /** Heads for open (1) or closed (0) from where it is. */
  to(target: 0 | 1): Promise<void>;
  /** The panel follows a drag by `dy` px (downward positive), with no animation. */
  drag(dy: number): void;
  /** The drag springs back to rest (a swipe that did not close). */
  release(): void;
  /** Stops at once where it is headed. */
  finish(): void;
  /** The panel is going away: whatever it covered is whole again. */
  dispose(): void;
}

/** Frames of one spring segment of the progress, from `p` with velocity `v` to `target`. */
export function progressFrames(
  s: Spring,
  p: number,
  v: number,
  target: number,
): { readonly values: number[]; readonly ms: number } {
  const x0 = p - target;
  const settle = energy(s, x0, v) * PRECISION;
  const values: number[] = [];
  for (let i = 0; i < FPS * 2; i++) {
    const [x, vx] = solve(s, x0, v, i / FPS);
    if (i > 0 && energy(s, x, vx) <= settle) break;
    values.push(target + x);
  }
  values.push(target);
  return { values, ms: Math.max(1, ((values.length - 1) * 1000) / FPS) };
}

/** The frame at progress `q` for a panel `travel` px above its closed place. */
export function riseFrame(travel: number, q: number): Keyframe {
  return { transform: `translateY(${((1 - q) * travel).toFixed(2)}px)` };
}

/** Drives `panel` up from below the screen's edge and back (measured at each `to()`). */
export function drawerMotion(panel: HTMLElement, covers?: () => HTMLElement | null): DrawerMotion {
  let anim: Animation | null = null;
  let coverAnim: Animation | null = null;
  let dragAnim: Animation | null = null;
  let seg = { s: springs.smooth, x0: 0, v0: 0, target: 0, reduced: false, from: 0 };
  let dragY = 0;

  // From its layout box (a fixed element's offsets are the viewport's), free of the frames'
  // transform and the drag's translate: the way down past the screen's edge.
  const travel = () => Math.max(1, window.innerHeight - panel.offsetTop + BELOW);

  const state = (): [number, number] => {
    if (!anim) return [seg.target, 0];
    const ms = Number(anim.currentTime ?? 0);
    if (seg.reduced) {
      const total = Math.max(1, Number(anim.effect?.getTiming().duration ?? 1));
      const k = Math.min(1, Math.max(0, ms / total));
      return [seg.from + (seg.target - seg.from) * k, 0];
    }
    const [x, v] = solve(seg.s, seg.x0, seg.v0, ms / 1000);
    return [seg.target + x, v];
  };

  return {
    to(target) {
      const [p, v] = state();
      const last = anim;
      let run: Animation;
      let values: number[] = [p, target];
      if (reducedMotion()) {
        const from = Math.min(1, Math.max(0, p));
        const ms = target === 1 ? REDUCED_DURATION_MS.base : REDUCED_DURATION_MS.fast;
        seg = { s: springs.quick, x0: 0, v0: 0, target, reduced: true, from };
        run = panel.animate([{ opacity: String(from) }, { opacity: String(target) }], {
          duration: Math.max(1, ms * Math.abs(target - from)),
          easing: target === 1 ? EASE.out : EASE.exit,
          fill: 'forwards',
        });
      } else {
        const s = target === 1 ? springs.smooth : springs.quick;
        const frames = progressFrames(s, p, v, target);
        values = frames.values;
        seg = { s, x0: p - target, v0: v, target, reduced: false, from: p };
        const way = travel();
        glassMoving(panel);
        run = panel.animate(
          values.map((q) => riseFrame(way, q)),
          { duration: frames.ms, fill: 'forwards' },
        );
        if (target === 0 && dragY !== 0) {
          // The swipe's offset goes home with the panel, on the same clock.
          const from = dragY;
          dragAnim?.cancel();
          dragAnim = panel.animate(
            values.map((q) => ({ translate: `0 ${(from * q).toFixed(2)}px` })),
            { duration: frames.ms, fill: 'forwards', composite: 'replace' },
          );
          panel.style.translate = '';
          dragY = 0;
        }
      }
      anim = run;
      last?.cancel();
      const covered = covers?.();
      if (covered) {
        // The covered island fades out over the first part of the rise, from where it is now.
        const now = covered.getAnimations().includes(coverAnim as Animation)
          ? getComputedStyle(covered).opacity
          : '1';
        const timing = run.effect?.getTiming();
        coverAnim?.cancel();
        coverAnim = covered.animate(
          values.map((q, i) => ({
            opacity: i === 0 ? now : String(1 - Math.min(1, Math.max(0, q / COVER_SPAN))),
          })),
          {
            duration: Number(timing?.duration ?? 1),
            easing: timing?.easing ?? 'linear',
            fill: 'forwards',
          },
        );
      }
      return new Promise<void>((resolve) => {
        run.onfinish = () => {
          if (anim === run && target === 0 && coverAnim) {
            // Closed: the island is whole again, with nothing left on it.
            coverAnim.cancel();
            coverAnim = null;
          }
          if (anim === run && target === 1) {
            // Open and at rest: nothing inline (Q-2), and the glass clears where it stands.
            anim = null;
            seg.target = 1;
            run.cancel();
            glassSettle(panel);
          }
          resolve();
        };
        run.oncancel = () => {
          if (anim === run) anim = null;
          resolve();
        };
      });
    },
    drag(dy) {
      dragAnim?.cancel();
      dragAnim = null;
      dragY = Math.max(0, dy);
      if (!reducedMotion()) glassMoving(panel);
      panel.style.translate = dragY === 0 ? '' : `0 ${dragY}px`;
    },
    release() {
      if (dragY === 0) return;
      const { values, ms } = progressFrames(springs.smooth, 1, 0, 0);
      const from = dragY;
      dragY = 0;
      panel.style.translate = '';
      dragAnim?.cancel();
      if (reducedMotion()) return;
      const back = panel.animate(
        values.map((q) => ({ translate: `0 ${(from * q).toFixed(2)}px` })),
        { duration: ms },
      );
      dragAnim = back;
      back.onfinish = () => {
        if (dragAnim === back && !anim) glassSettle(panel);
      };
    },
    finish() {
      anim?.finish();
      coverAnim?.finish();
    },
    dispose() {
      coverAnim?.cancel();
      coverAnim = null;
    },
  };
}
