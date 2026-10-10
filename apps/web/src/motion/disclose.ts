/**
 * *Disclosure* (`feedback.ts`'s table; motion-2026-10 forms-compact): a folded sheet section's
 * height spring. Apart from `feedback.ts` so that it loads with the sheets that use it, not
 * with the editor (PLAN.md §2.3 V1-P2).
 */
import { reducedMotion } from './reduced-motion';
import { solve, springs } from './springs';
import { duration, EASE } from './tokens';

/** A running disclosure: its spring segment (progress 0 folded → 1 open) and when it began. */
interface Disclosing {
  readonly run: Animation;
  readonly from: number;
  readonly to: number;
  readonly velocity: number;
  readonly start: number;
}

const disclosures = new WeakMap<Element, Disclosing>();

/**
 * *Disclosure*: a folded section opens (`open` true, just mounted at its natural size) or
 * closes (then `onClosed` unmounts it). Its height and block padding grow together from 0 on
 * the `smooth` spring, so the rows under it are carried down with no jump at either end, and
 * its content fades in over the first three quarters (out over the last on close). A toggle
 * mid-flight reverses from where the section is, with its velocity (Q-10). Height is layout,
 * not compositing: this is for one sheet row at a time, the one place the catalogue moves
 * size inside a sheet. Under reduced motion only the fade runs, within 150 ms. Nothing is
 * left inline at rest; a closed section keeps its last frame until it is unmounted.
 */
export function disclose(element: Element | null, open: boolean, onClosed?: () => void): void {
  if (!(element instanceof HTMLElement) || typeof element.animate !== 'function') {
    if (!open) onClosed?.();
    return;
  }
  const to = open ? 1 : 0;
  let from = open ? 0 : 1;
  let velocity = 0;
  const running = disclosures.get(element);
  if (running) {
    const t = (performance.now() - running.start) / 1000;
    const [x, v] = solve(springs.smooth, running.from - running.to, running.velocity, t);
    from = Math.min(1, Math.max(0, running.to + x));
    velocity = v;
    running.run.cancel();
  }
  const finish = (run: Animation) => {
    if (disclosures.get(element)?.run !== run) return;
    disclosures.delete(element);
    element.style.removeProperty('overflow');
    if (!open) onClosed?.();
  };
  if (reducedMotion()) {
    const run = element.animate([{ opacity: from }, { opacity: to }], {
      duration: duration('base'),
      easing: EASE.out,
      fill: open ? 'none' : 'forwards',
    });
    disclosures.set(element, { run, from, to, velocity: 0, start: performance.now() });
    run.onfinish = () => finish(run);
    return;
  }
  const style = getComputedStyle(element);
  const height = element.offsetHeight;
  const top = parseFloat(style.paddingTop) || 0;
  const bottom = parseFloat(style.paddingBottom) || 0;
  const frames: Keyframe[] = [];
  const px = (n: number) => `${Math.round(Math.max(0, n) * 100) / 100}px`;
  for (let i = 0; ; i++) {
    const [x, v] = solve(springs.smooth, from - to, velocity, i / 120);
    const settled = Math.abs(x) < 1e-3 && Math.abs(v) < 1e-2;
    const p = settled ? to : Math.min(1, Math.max(0, to + x));
    frames.push({
      height: px(height * p),
      minHeight: '0px',
      paddingTop: px(top * p),
      paddingBottom: px(bottom * p),
      opacity: Math.round(Math.min(1, Math.max(0, (p - 0.25) / 0.75)) * 1000) / 1000,
    });
    if (settled) break;
  }
  element.style.overflow = 'clip';
  const run = element.animate(frames, {
    duration: ((frames.length - 1) * 1000) / 120,
    easing: 'linear',
    fill: open ? 'none' : 'forwards',
  });
  disclosures.set(element, { run, from, to, velocity, start: performance.now() });
  run.onfinish = () => finish(run);
}
