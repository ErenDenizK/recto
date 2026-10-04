/**
 * FLIP: first, last, invert, play (language.md §7.3 *reflow*, *panel*, *lift and settle*, *bar
 * morph* chips; research 18 §4.4, §4.7; quality-bar.md Q-2, Q-6; 09-primitives §31).
 *
 * `flip()` measures each element, runs `mutate`, measures again and plays the inverse transform
 * back to none on a spring through `animateStyle()`, so it runs on the compositor and leaves no
 * transform at rest. Size changes are carried by scale about the element's centre (the default
 * `transform-origin`). A flip that interrupts a running one starts from where the element is on
 * screen with its velocity carried over, so a second reorder mid-flight turns smoothly and ends
 * at the newest layout. Elements that were not connected before (entering the virtual window)
 * or are gone after are not animated (MC-27). Under reduced motion it only runs `mutate`.
 *
 * `mutate` must apply the change synchronously: wrap a React update in `flushSync`.
 */
import { animateStyle, type Styled, stopTransform } from './animate';
import { reducedMotion } from './reduced-motion';
import type { Spring, SpringName } from './springs';

/** An element whose box moved and resized by less than this, and was at rest, stays put. */
const STILL = 1e-3;

/**
 * Applies `mutate` and animates `elements` from where they were to where it put them, on
 * `spring` (default `smooth`, the *reflow* token). Resolves when every element is at rest or
 * has been taken over by a later flip.
 */
export async function flip(
  elements: Iterable<Styled>,
  mutate: () => void,
  o: { readonly spring?: SpringName | Spring } = {},
): Promise<void> {
  const els = [...elements].filter((el) => el.isConnected);
  const first = els.map((el) => el.getBoundingClientRect());
  const prior = els.map(stopTransform);
  mutate();
  if (reducedMotion()) return;
  // Every read before the first write, so the second layout is computed once.
  const last = els.map((el) => el.getBoundingClientRect());
  const starts: (() => Promise<void>)[] = [];
  els.forEach((el, i) => {
    const f = first[i] as DOMRect;
    const l = last[i] as DOMRect;
    const sx = f.width / l.width;
    const sy = f.height / l.height;
    // Not laid out before or after (or gone): nothing to animate from or to.
    if (!el.isConnected || !(sx * sy > 0 && sx * sy < Infinity)) return;
    const [, , psx = 1, psy = 1] = prior[i]?.value ?? [];
    const [vx = 0, vy = 0, vsx = 0, vsy = 0] = prior[i]?.velocity ?? [];
    const dx = f.x - l.x + (f.width - l.width) / 2;
    const dy = f.y - l.y + (f.height - l.height) / 2;
    // On screen the box keeps its centre velocity, and its size velocity (layout size × scale
    // velocity) carries over to the new layout size.
    const velocity = [vx, vy, (vsx * sx) / psx, (vsy * sy) / psy];
    if (![dx, dy, sx - 1, sy - 1, ...velocity].some((n) => Math.abs(n) > STILL)) return;
    starts.push(
      () =>
        animateStyle(el, 'transform', [dx, dy, sx, sy], [0, 0, 1, 1], {
          spring: o.spring ?? 'smooth',
          velocity,
        }).finished,
    );
  });
  await Promise.all(starts.map((start) => start()));
}
