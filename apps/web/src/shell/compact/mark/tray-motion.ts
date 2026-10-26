/**
 * The single capsule's tray motion (EDN-24, plan "Motion"; MOT-12, MOT-18). The tray grows out
 * of the armed tool: `translateY(12px) scale(.92)` to rest on `smooth`, from the tool's own
 * x (`--tray-origin-x`, else the armed tool's centre), and goes back on `quick`; `transform` and
 * `opacity` only, on the compositor. Like the tool drawer (`drawer-motion.ts`, whose spring
 * helpers it shares) it is solid while it moves and its glass clears where it rests
 * (`ui/glass-moving.ts`); opened, nothing stays inline (Q-2); closed, the last frame holds until
 * the tray unmounts.
 *
 * - **Interruptible.** A turn starts from the present progress and velocity.
 * - **Swipe down** moves the tray with the finger by its `translate` property. The close that
 *   follows carries the finger's speed (MOT-18, `handOff`) and leaves the tray where the finger
 *   put it, sliding on down as it fades; a swipe that springs back starts at the finger's speed.
 * - **Reduced motion:** opacity only, 150 ms in, 100 ms out (A-9).
 */
import { startOnThisFrame } from '../../../motion/animate';
import { reducedMotion } from '../../../motion/reduced-motion';
import { solve, springs } from '../../../motion/springs';
import { EASE, REDUCED_DURATION_MS } from '../../../motion/tokens';
import { glassMoving, glassSettle } from '../../../ui/glass-moving';
import { handOff, progressFrames } from './drawer-motion';

/** The tray rests this far below its place when closed, CSS px. */
export const TRAY_RISE_PX = 12;
/** And at this scale. */
export const TRAY_SCALE = 0.92;
/** The content of the tray fades out for a tool change this long, then in for `CONTENT_IN_MS`. */
export const CONTENT_OUT_MS = 90;
export const CONTENT_IN_MS = 160;
/** On opening, the content comes in after the tray has started to grow. */
export const CONTENT_DELAY_MS = 60;

/** The frame at progress `q`, growing from `origin` (a CSS `transform-origin` x). */
export function trayFrame(q: number, origin: string): Keyframe {
  const c = Math.min(1, Math.max(0, q));
  return {
    transform: `translateY(${((1 - q) * TRAY_RISE_PX).toFixed(2)}px) scale(${(TRAY_SCALE + (1 - TRAY_SCALE) * q).toFixed(4)})`,
    transformOrigin: `${origin} 100%`,
    opacity: String(c),
  };
}

/**
 * Where the tray grows from, a CSS length: the `--tray-origin-x` the capsule sets from the
 * pressed tool, else the centre of the armed tool (`[data-compact-tool-chip]`) in the tray's
 * own box, else its middle.
 */
export function originX(panel: HTMLElement): string {
  const set = getComputedStyle(panel).getPropertyValue('--tray-origin-x').trim();
  if (set) return set;
  const tool = document.querySelector('[data-compact-tool-chip]');
  if (!tool) return '50%';
  const at = tool.getBoundingClientRect();
  const box = panel.getBoundingClientRect();
  return `${Math.round(at.left + at.width / 2 - box.left)}px`;
}

/** Fades `el` for a tool change: out (`CONTENT_OUT_MS`) or in; reduced, both within 100 ms. */
export function fadeContent(el: HTMLElement, way: 'in' | 'out'): Animation {
  const reduced = reducedMotion();
  const ms = reduced ? REDUCED_DURATION_MS.fast : way === 'out' ? CONTENT_OUT_MS : CONTENT_IN_MS;
  // The fade out holds its last frame (`forwards`); coming in drops it, or it would take the
  // opacity back the moment the fade in ends.
  if (way === 'in') {
    for (const held of el.getAnimations())
      if (held.effect?.getTiming().fill === 'forwards') held.cancel();
  }
  return el.animate(
    way === 'out' ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
    {
      duration: ms,
      easing: way === 'out' ? EASE.exit : EASE.out,
      fill: way === 'out' ? 'forwards' : 'backwards',
    },
  );
}

export interface TrayMotion {
  /** Heads for open (1) or closed (0) from where it is. */
  to(target: 0 | 1): Promise<void>;
  /** The tray follows a drag by `dy` px (downward positive), with no animation. */
  drag(dy: number): void;
  /** The finger let go at `velocity` px/s (down): the next close starts at that speed. */
  thrown(velocity: number): void;
  /** The drag springs back to rest, from the finger's speed. */
  release(velocity?: number): void;
}

export function trayMotion(panel: HTMLElement): TrayMotion {
  let anim: Animation | null = null;
  let dragAnim: Animation | null = null;
  let seg = { s: springs.smooth, x0: 0, v0: 0, target: 0, reduced: false, from: 0 };
  let dragY = 0;
  let throwV = 0;

  /** Progress and its velocity now. */
  const state = (): [number, number] => {
    if (!anim) return [seg.target, 0];
    const ms = Number(anim.currentTime ?? 0);
    if (seg.reduced) {
      const total = Math.max(1, Number(anim.effect?.getTiming().duration ?? 1));
      return [seg.from + (seg.target - seg.from) * Math.min(1, Math.max(0, ms / total)), 0];
    }
    const [x, v] = solve(seg.s, seg.x0, seg.v0, ms / 1000);
    return [seg.target + x, v];
  };

  return {
    to(target) {
      const [p, v] = state();
      const last = anim;
      const turning = last !== null && !last.pending;
      let run: Animation;
      if (reducedMotion()) {
        throwV = 0;
        const from = Math.min(1, Math.max(0, p));
        const ms = target === 1 ? REDUCED_DURATION_MS.base : REDUCED_DURATION_MS.fast;
        seg = { s: springs.quick, x0: 0, v0: 0, target, reduced: true, from };
        panel.style.translate = '';
        dragY = 0;
        run = panel.animate([{ opacity: String(from) }, { opacity: String(target) }], {
          duration: Math.max(1, ms * Math.abs(target - from)),
          easing: target === 1 ? EASE.out : EASE.exit,
          fill: 'forwards',
        });
      } else {
        const s = target === 1 ? springs.smooth : springs.quick;
        // A throw: the tray is drawn `(1 − q) · RISE` below the finger's offset, so q moves at
        // −v / RISE (the finger moving down is q heading for 0).
        const thrownV = target === 0 && throwV ? handOff(throwV, -TRAY_RISE_PX, -1) : null;
        throwV = 0;
        const frames = progressFrames(s, p, thrownV ?? v, target);
        seg = { s, x0: p - target, v0: thrownV ?? v, target, reduced: false, from: p };
        const origin = originX(panel);
        glassMoving(panel);
        run = panel.animate(
          frames.values.map((q) => trayFrame(q, origin)),
          { duration: frames.ms, fill: 'forwards' },
        );
        if (turning) startOnThisFrame(run, panel);
        if (target === 1 && dragY !== 0) {
          // Opened again from a swipe: the finger's offset goes home with the growth.
          const from = dragY;
          dragAnim?.cancel();
          dragAnim = panel.animate(
            frames.values.map((q) => ({ translate: `0 ${(from * (1 - q)).toFixed(2)}px` })),
            { duration: frames.ms, fill: 'forwards', composite: 'replace' },
          );
          panel.style.translate = '';
          dragY = 0;
        }
      }
      anim = run;
      last?.cancel();
      return new Promise<void>((resolve) => {
        run.onfinish = () => {
          if (anim === run && target === 1) {
            // Open and at rest: nothing inline (Q-2), and the glass clears where it stands.
            anim = null;
            seg.target = 1;
            run.cancel();
            dragAnim?.cancel();
            dragAnim = null;
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
    thrown(velocity) {
      throwV = velocity;
    },
    release(velocity = 0) {
      throwV = 0;
      if (dragY === 0) return;
      const { values, ms } = progressFrames(springs.smooth, 1, handOff(velocity, dragY, -1), 0);
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
  };
}
