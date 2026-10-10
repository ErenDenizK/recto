/**
 * *Lift and settle* for a page dragged on the pointer path (language.md §7.3; 06-navigation
 * §2.4, PG5 §7; docs/design/motion-2026-10/pages.md): the preview under the finger is a page
 * picked up off the table, not a flat copy.
 *
 * - **Lift.** The preview rises to 1.04 on `quick` and takes the lifted shadow (`--e4`,
 *   `dnd.module.css`); other selected pages on screen fly in under it, so the stack (two offset
 *   sheets and the count) gathers under the finger.
 * - **Tilt.** It leans into the drag by the pointer's horizontal velocity, at most 3°, about the
 *   grab point, on `quick`, and straightens as the finger slows (the velocity tracker reads 0
 *   after 50 ms still).
 * - **Back.** A drag cancelled, or dropped where nothing lands, flies the preview back to its
 *   cell on `smooth` before it goes; a drop that lands hands over to the cells' reflow, which
 *   starts the pages from the preview's place (`noteDropOrigin`, `flip-cells.tsx`).
 *
 * The finger moves the preview 1:1 (direct manipulation); under reduced motion there is no
 * lift, tilt, gather or flight back, only the preview (§7.5).
 */
import { animate, type Motion } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
import { springToLinear } from '../../motion/springs';
import { EASE } from '../../motion/tokens';
import { velocityTracker } from '../../motion/velocity';
import type { SheetSnapshot } from './cells';

/** The lifted page's scale. */
export const LIFT_SCALE = 1.04;
/** The largest lean, degrees. */
export const MAX_TILT_DEG = 3;
/** Degrees of lean per px/s of horizontal velocity: 3° at 1200 px/s. */
const TILT_PER_VELOCITY = MAX_TILT_DEG / 1200;

/** The lean for a horizontal velocity (px/s): toward the motion, within ±3°. */
export function tiltFor(velocityX: number): number {
  const deg = velocityX * TILT_PER_VELOCITY;
  return Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, deg));
}

export interface Lift {
  /** The finger is at `x`, `y` (client px) at `t` (ms, the event's clock). */
  move(x: number, y: number, t: number): void;
  /** Once a frame while lifted: the lean follows the velocity as it decays. */
  frame(): void;
  /** The preview's page box now (client px), as drawn without the lift. */
  box(): DOMRect;
  /** Flies the preview back to `home` and removes it; resolves when it is gone. */
  back(home: DOMRect): Promise<void>;
  /** Removes the preview at once (a drop the cells take over). */
  remove(): void;
}

/**
 * Lifts `preview` (the fixed container `renderDragPreview` filled), grabbed at `grab` inside the
 * page, with the finger at `x`, `y`. `gather` are the other selected pages on screen.
 */
export function lift(
  preview: HTMLElement,
  grab: { readonly x: number; readonly y: number },
  x: number,
  y: number,
  gather: readonly SheetSnapshot[],
): Lift {
  const page = preview.firstElementChild instanceof HTMLElement ? preview.firstElementChild : null;
  const reduced = reducedMotion();
  const tracker = velocityTracker();
  let at = { x, y };
  const place = () => {
    preview.style.transform = `translate(${Math.round(at.x - grab.x)}px, ${Math.round(at.y - grab.y)}px)`;
  };
  place();
  let pose: Motion<readonly number[]> | null = null;
  if (page && !reduced) {
    page.dataset.lifted = '';
    page.style.transformOrigin = `${grab.x}px ${grab.y}px`;
    const write = ([scale = 1, tilt = 0]: readonly number[]) => {
      page.style.transform = `rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    };
    write([1, 0]);
    pose = animate([1, 0], [LIFT_SCALE, 0], { spring: 'quick', onUpdate: write });
    gatherUnder(gather, page.getBoundingClientRect());
  }
  let tilt = 0;
  const lean = (now: number) => {
    if (!pose) return;
    const next = Math.round(tiltFor(tracker.velocity(now).x) * 10) / 10;
    if (next === tilt) return;
    tilt = next;
    pose.retarget([LIFT_SCALE, tilt]);
  };
  return {
    move(nx, ny, t) {
      at = { x: nx, y: ny };
      tracker.add(t, nx, ny);
      place();
      lean(t);
    },
    frame() {
      lean(performance.now());
    },
    box() {
      // The page's own box, without the lift's scale and lean.
      if (!page) return preview.getBoundingClientRect();
      return new DOMRect(at.x - grab.x, at.y - grab.y, page.offsetWidth, page.offsetHeight);
    },
    back(home) {
      pose?.stop();
      if (reduced || typeof preview.animate !== 'function') {
        preview.remove();
        return Promise.resolve();
      }
      const smooth = springToLinear('smooth');
      const from = preview.style.transform;
      const to = `translate(${home.left}px, ${home.top}px)`;
      const flight = preview.animate([{ transform: from }, { transform: to }], {
        duration: smooth.duration,
        easing: smooth.easing,
        fill: 'forwards',
      });
      page?.animate([{ transform: page.style.transform }, { transform: 'none' }], {
        duration: smooth.duration,
        easing: smooth.easing,
        fill: 'forwards',
      });
      return flight.finished.then(
        () => preview.remove(),
        () => preview.remove(),
      );
    },
    remove() {
      pose?.stop();
      preview.remove();
    },
  };
}

/**
 * The other selected pages fly from their cells to the lifted page and fade into its stack, on
 * `quick`'s curve; copies, so the cells stay where they are (dimmed) until the drop.
 */
function gatherUnder(shots: readonly SheetSnapshot[], to: DOMRect): void {
  if (shots.length === 0) return;
  const quick = springToLinear('quick');
  for (const shot of shots.slice(0, 12)) {
    const ghost = document.createElement('div');
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${shot.box.left}px`,
      top: `${shot.box.top}px`,
      width: `${shot.box.width}px`,
      height: `${shot.box.height}px`,
      overflow: 'hidden',
      borderRadius: 'var(--radius-page)',
      background: 'var(--page-background)',
      boxShadow: 'var(--e2)',
      zIndex: '999',
      pointerEvents: 'none',
    });
    if (shot.canvas) {
      Object.assign(shot.canvas.style, { display: 'block', width: '100%', height: '100%' });
      ghost.append(shot.canvas);
    }
    document.body.append(ghost);
    const dx = to.left + to.width / 2 - (shot.box.left + shot.box.width / 2);
    const dy = to.top + to.height / 2 - (shot.box.top + shot.box.height / 2);
    const s = to.width / Math.max(1, shot.box.width);
    const move = ghost.animate(
      [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }],
      { duration: quick.duration, easing: quick.easing, fill: 'forwards' },
    );
    ghost.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], {
      duration: quick.duration,
      easing: EASE.out,
      fill: 'forwards',
    });
    const gone = () => ghost.remove();
    move.finished.then(gone, gone);
  }
}
