/**
 * An eased scroll for a step between hits (docs/design/motion-2026-10 frame.md §3; language.md
 * §7.3 *scroll-to*): Find's Enter and ‹ › glide the page to the next hit on `glide` instead of
 * cutting to it, so the reader keeps their place in the document.
 *
 * - **Far moves** start close: a target more than one and a half views away is jumped to within
 *   half a view first (the pages in between would only blur past), then glided the rest.
 * - **Interruptible:** a new step retargets the running glide from where it is, with its
 *   velocity; the reader's own wheel, touch, pointer or key on the scroller stops it at once.
 * - **`scrollSettled()`** resolves when the glide has landed (or at once with none running), so
 *   the hit's flash comes after the scroll, where it can be seen.
 * - **Reduced motion** (§7.5): the scroll is instant (`animate()` makes the segment instant).
 */
import { animate, type Motion } from '../motion/animate';

interface Glide {
  readonly el: HTMLElement;
  readonly motion: Motion<readonly number[]>;
  readonly off: () => void;
}

let running: Glide | null = null;
let settled: Promise<void> = Promise.resolve();

/** How many views away a target is jumped toward before the glide. */
const FAR_VIEWS = 1.5;

/** Stops the running glide where it is. */
function stop(): void {
  const glide = running;
  if (!glide) return;
  running = null;
  glide.off();
  glide.motion.stop();
}

/** Scrolls `el` to `top` and `left` (px) on `glide`, from where it is or where a glide is. */
export function easedScroll(el: HTMLElement, to: { top: number; left: number }): void {
  const glide = running?.el === el ? running : null;
  if (running && !glide) stop();
  const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
  const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
  const target = [
    Math.min(maxTop, Math.max(0, to.top)),
    Math.min(maxLeft, Math.max(0, to.left)),
  ] as const;
  if (glide) {
    glide.motion.retarget(target);
    return;
  }
  // Far: start half a view short of the target, on its side.
  const far = el.clientHeight * FAR_VIEWS;
  const distance = target[0] - el.scrollTop;
  if (Math.abs(distance) > far) {
    el.scrollTop = target[0] - Math.sign(distance) * (el.clientHeight / 2);
  }
  let resolve: () => void = () => undefined;
  settled = new Promise((r) => (resolve = r));
  const motion = animate([el.scrollTop, el.scrollLeft], target, {
    spring: 'glide',
    onUpdate: ([top = 0, left = 0]) => {
      el.scrollTop = top;
      el.scrollLeft = left;
    },
  });
  // The reader takes over: any of their own input on the scroller ends the glide.
  const events = ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const;
  const takeOver = () => stop();
  for (const type of events) el.addEventListener(type, takeOver, { passive: true });
  const off = () => {
    for (const type of events) el.removeEventListener(type, takeOver);
    resolve();
  };
  const current: Glide = { el, motion, off };
  running = current;
  void motion.finished.then(() => {
    if (running !== current) return;
    running = null;
    off();
  });
}

/** Resolves once the running glide (if any) has landed or been stopped. */
export function scrollSettled(): Promise<void> {
  return settled;
}
