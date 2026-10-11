/**
 * The tool drawer's motion (`design/phone-2026-10/README.md` §3 "How it moves"; MOT-5;
 * `motion-2026-10/platform.md` §1): the drawer rises out of the tool chip by the container
 * transform and closes back into it. The panel is laid out at its place and size and never
 * scaled: its visible region is a `clip-path: inset(… round r)` that starts as the chip's
 * rounded rect and opens to the panel's (plus the shadow's bleed), while a `translate` carries
 * the region from over the chip to the panel's place. `motion/container.ts` draws each frame;
 * this drives one progress number on the brief's spring:
 *
 * - **Open on `smooth`** (zero bounce, README §3 "Feel"), **close on `quick`**, a little
 *   quicker, as every popup's close (MC-16). A turn starts from the present progress and
 *   velocity, so a close during the rise goes back from where it is.
 * - **Swipe down** moves the panel with the finger by its `translate` property (composed with
 *   the frames' `transform`); the close that follows takes that offset back to 0 as the region
 *   shrinks into the chip, so nothing jumps at the release.
 * - Opened, nothing stays inline (Q-2); closed, the last frame holds until the panel unmounts.
 * - **Reduced motion:** opacity only, 150 ms in, 100 ms out (A-9).
 * - **What it covers** (`covers`, the list variant's island, EDN-16): a panel that grows over
 *   the island fades it out over the same first `FADE_SPAN` of the progress the panel fades in
 *   on, on the same clock, so there is never glass over glass at rest; closed, the island's fade
 *   is cancelled and nothing stays inline on it.
 */
import {
  type Box,
  containerFrame,
  type ContainerStart,
  containerStart,
  FADE_SPAN,
  radiusOf,
} from '../../../motion/container';
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

/** Keyframe rate (as `motion/container.ts`). */
const FPS = 120;
/** A segment ends when its energy has fallen to this fraction. */
const PRECISION = 1e-6;

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

const rectOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};

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

/**
 * Drives `panel`'s container transform out of `chip` (both measured at each `to()`, so a
 * rotation between open and close returns into the chip where it is now).
 */
export function drawerMotion(
  panel: HTMLElement,
  chip: () => Element | null,
  covers?: () => HTMLElement | null,
): DrawerMotion {
  let anim: Animation | null = null;
  let coverAnim: Animation | null = null;
  let dragAnim: Animation | null = null;
  let seg = { s: springs.smooth, x0: 0, v0: 0, target: 0, reduced: false, from: 0 };
  let dragY = 0;

  const geometry = (): { start: ContainerStart; radius: number } | null => {
    const from = chip();
    if (!from) return null;
    // The panel's layout box (a fixed element's offsets are the viewport's), free of the frames'
    // transform and the drag's translate, whichever is running.
    const box: Box = {
      x: panel.offsetLeft,
      y: panel.offsetTop,
      width: panel.offsetWidth,
      height: panel.offsetHeight,
    };
    const trigger = rectOf(from);
    return {
      start: containerStart(trigger, box, radiusOf(from, trigger.width, trigger.height)),
      radius: radiusOf(panel, box.width, box.height),
    };
  };

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
      const g = geometry();
      if (reducedMotion() || !g) {
        const from = Math.min(1, Math.max(0, p / FADE_SPAN));
        const ms = target === 1 ? REDUCED_DURATION_MS.base : REDUCED_DURATION_MS.fast;
        seg = { s: springs.quick, x0: 0, v0: 0, target, reduced: true, from: from * FADE_SPAN };
        if (target === 1) seg.target = FADE_SPAN;
        run = panel.animate([{ opacity: String(from) }, { opacity: String(target) }], {
          duration: Math.max(1, ms * Math.abs(target - from)),
          easing: target === 1 ? EASE.out : EASE.exit,
          fill: 'forwards',
        });
      } else {
        const s = target === 1 ? springs.smooth : springs.quick;
        const { values, ms } = progressFrames(s, p, v, target);
        seg = { s, x0: p - target, v0: v, target, reduced: false, from: p };
        run = panel.animate(
          values.map((q) => containerFrame(g.start, g.radius, q)),
          { duration: ms, fill: 'forwards' },
        );
        if (target === 0 && dragY !== 0) {
          // The swipe's offset goes home with the region, on the same clock.
          dragAnim?.cancel();
          dragAnim = panel.animate(
            values.map((q) => ({ translate: `0 ${(dragY * q).toFixed(2)}px` })),
            { duration: ms, fill: 'forwards', composite: 'replace' },
          );
          panel.style.translate = '';
          dragY = 0;
        }
      }
      anim = run;
      last?.cancel();
      const covered = covers?.();
      if (covered) {
        // The covered island's opacity is 1 − the panel's, from where it is now.
        const frames = (run.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
        const timing = run.effect?.getTiming();
        const now = covered.getAnimations().includes(coverAnim as Animation)
          ? getComputedStyle(covered).opacity
          : '1';
        coverAnim?.cancel();
        coverAnim = covered.animate(
          frames.length > 1
            ? frames.map((k, i) => ({
                opacity: i === 0 ? now : String(1 - Number(k.opacity ?? 1)),
              }))
            : [{ opacity: now }, { opacity: String(1 - target) }],
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
            // Open and at rest: nothing inline (Q-2).
            anim = null;
            seg.target = 1;
            run.cancel();
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
      panel.style.translate = dragY === 0 ? '' : `0 ${dragY}px`;
    },
    release() {
      if (dragY === 0) return;
      const { values, ms } = progressFrames(springs.smooth, 1, 0, 0);
      const from = dragY;
      dragY = 0;
      panel.style.translate = '';
      if (reducedMotion()) return;
      dragAnim?.cancel();
      dragAnim = panel.animate(
        values.map((q) => ({ translate: `0 ${(from * q).toFixed(2)}px` })),
        { duration: ms },
      );
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
