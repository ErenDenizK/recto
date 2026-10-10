/**
 * The Pages grid's physical motion (docs/design/motion-2026-10/pages.md; language.md §7.3
 * *view change*, *reflow*, *lift and settle*; 06-navigation PG1 §7, PG4 §7, PG5 §7): what the
 * cells do around the moves `flip-cells.tsx` already carries.
 *
 * - **Cascade** (`cascadeIn`, `cascadeOut`): entering the grid the other cells fade and grow in
 *   from the current page outward while the page morphs into its cell (`grid-transition.ts`);
 *   leaving, they go the other way, the farthest first, toward the page. 150 ms in all.
 * - **Ripple** (`rippleSelection`): newly selected cells take their check badge and a small
 *   lift in reading order, so a range runs across the grid instead of appearing at once.
 * - **Leave and arrive** (`shrinkOut`, `growIn`): a deleted page shrinks and fades where it was
 *   while its neighbours close the gap; a page that lands (insert, duplicate, the undo of a
 *   delete) grows in where it lands.
 * - **Settle** (`noteDropOrigin`, `takeDropOrigin`): pages dropped by a drag start their
 *   reflow from where the preview was under the finger, on `fling` (a small overshoot), so a
 *   stack fans out to its slots.
 * - **Fly to a tab** (`snapshotSheets`, `flyToTab`): Extract sends the pages along a short arc
 *   into the new document's tab, which then takes a *receive* bounce.
 *
 * Everything is transform and opacity on Web Animations without `fill` at rest (Q-2), on the
 * spring tokens' curves (`springToLinear`) and the ease tokens. Under reduced motion (§7.5) only
 * opacity moves, within 150 ms, or nothing does.
 */
import type { PageId } from '@pdf-editor/document-model';

import { reducedMotion } from '../../motion/reduced-motion';
import { springToLinear } from '../../motion/springs';
import { duration, EASE, REDUCED_DURATION_MS } from '../../motion/tokens';
import { CELL, inView, type SheetSnapshot } from './cells';

/** The cascade's whole length, first cell to last, ms (brief: at most 150 ms). */
export const CASCADE_MS = 150;
/** One cell's part of it; the rest is the stagger. */
const CASCADE_CELL_MS = 100;
/** The scale cells come in from and go out to in the cascade. */
const CASCADE_SCALE = 0.94;
/** The ripple's step between cells, and its cap for a long range, ms. */
const RIPPLE_STEP_MS = 24;
const RIPPLE_MAX_MS = 150;
/** A deleted page shrinks to this before it is gone; a new page grows from it. */
const LEAVE_SCALE = 0.8;

/** The curve of a zero-bounce spring and of `pop`, once (deterministic, `springs.ts`). */
let curves: { spring: string; pop: { easing: string; duration: number } } | null = null;
function curve() {
  curves ??= { spring: springToLinear('quick').easing, pop: springToLinear('pop') };
  return curves;
}

const centre = (box: DOMRect) => [box.left + box.width / 2, box.top + box.height / 2] as const;

/** The drawn cells on screen, each with its distance from `from` (px); nearest first. */
function cellsAround(from: PageId | null | undefined, root: ParentNode = document) {
  const cells = [...root.querySelectorAll<HTMLElement>(`[data-grid-viewport] ${CELL}`)];
  const boxes = cells.map((cell) => cell.getBoundingClientRect());
  const origin = cells.findIndex((cell) => cell.dataset.pageId === from);
  const [ox, oy] = origin >= 0 ? centre(boxes[origin] as DOMRect) : [0, 0];
  const around = cells
    .map((cell, i) => {
      const box = boxes[i] as DOMRect;
      const [x, y] = centre(box);
      return { cell, box, distance: origin >= 0 ? Math.hypot(x - ox, y - oy) : y * 4 + x };
    })
    .filter(({ cell, box }) => cell.dataset.pageId !== from && inView(box));
  return around.sort((a, b) => a.distance - b.distance);
}

/** Running cascades, so a way out can take back the cells a way in is still bringing. */
const cascades = new Set<Animation>();

function cascade(from: PageId | null | undefined, direction: 'in' | 'out'): Animation[] {
  for (const a of cascades) a.cancel();
  cascades.clear();
  const cells = cellsAround(from);
  if (cells.length === 0 || typeof cells[0]?.cell.animate !== 'function') return [];
  const reduced = reducedMotion();
  const each = reduced ? REDUCED_DURATION_MS.fast : CASCADE_CELL_MS;
  const span = Math.max(1, cells.at(-1)?.distance ?? 1);
  const stagger = reduced ? 0 : CASCADE_MS - each;
  const out = direction === 'out';
  const made: Animation[] = [];
  for (const { cell, distance } of cells) {
    const at = (distance / span) * stagger;
    // Leaving, the farthest go first, so the grid gathers toward the page.
    const delay = Math.round(out ? stagger - at : at);
    const hidden: Keyframe = reduced
      ? { opacity: 0 }
      : { opacity: 0, transform: `scale(${CASCADE_SCALE})` };
    const shown: Keyframe = reduced ? { opacity: 1 } : { opacity: 1, transform: 'none' };
    // The box, not the cell: the cell's own transform is the reflow's (flip-cells.tsx).
    const target = cell.querySelector<HTMLElement>(':scope > div') ?? cell;
    const a = target.animate(out ? [shown, hidden] : [hidden, shown], {
      duration: each,
      delay,
      easing: out ? EASE.exit : curve().spring,
      // In: hidden until its turn. Out: held hidden until the view change takes the grid.
      fill: out ? 'forwards' : 'backwards',
    });
    // The label goes with its page.
    const label = target.nextElementSibling;
    const b =
      label instanceof HTMLElement
        ? label.animate(out ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], {
            duration: each,
            delay,
            easing: out ? EASE.exit : EASE.out,
            fill: out ? 'forwards' : 'backwards',
          })
        : null;
    for (const anim of b ? [a, b] : [a]) {
      cascades.add(anim);
      anim.addEventListener('finish', () => {
        if (!out) cascades.delete(anim);
      });
      made.push(anim);
    }
  }
  return made;
}

/** Entering the grid: the cells around `current` come in from it outward (module header). */
export function cascadeIn(current: PageId | null | undefined): void {
  cascade(current, 'in');
}

/**
 * Leaving the grid toward `current`: the other cells go, the farthest first. Returns the undo
 * for a way out that does not happen after all (the cells come back at once).
 */
export function cascadeOut(current: PageId | null | undefined): () => void {
  const made = cascade(current, 'out');
  return () => {
    for (const a of made) {
      a.cancel();
      cascades.delete(a);
    }
  };
}

/**
 * The ripple of a selection (module header): `ids`, newly selected and in reading order, each
 * take the check badge's pop and a small lift of the page, one after another, so a range runs
 * across the cells. A single page is the same with no wait. Cells not drawn are skipped.
 */
export function rippleSelection(ids: readonly PageId[], root: ParentNode = document): void {
  if (ids.length === 0) return;
  const reduced = reducedMotion();
  const step = Math.min(RIPPLE_STEP_MS, RIPPLE_MAX_MS / Math.max(1, ids.length - 1));
  let rank = 0;
  for (const id of ids) {
    const cell = root.querySelector<HTMLElement>(`${CELL}[data-page-id="${CSS.escape(id)}"]`);
    if (!cell || typeof cell.animate !== 'function' || !inView(cell.getBoundingClientRect())) {
      continue;
    }
    const delay = reduced ? 0 : rank * step;
    rank += 1;
    const badge = cell.querySelector<HTMLElement>('[data-select-toggle]');
    if (reduced) {
      badge?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: REDUCED_DURATION_MS.fast,
        easing: EASE.out,
      });
      continue;
    }
    const { pop } = curve();
    badge?.animate([{ transform: 'scale(0.4)' }, { transform: 'none' }], {
      duration: pop.duration,
      delay,
      easing: pop.easing,
      fill: 'backwards',
    });
    // The page gives a little as its mark lands: the press scale, back on `pop`.
    const sheet = cell.querySelector<HTMLElement>('[data-thumb]');
    sheet?.animate([{ transform: 'scale(0.97)' }, { transform: 'none' }], {
      duration: pop.duration,
      delay,
      easing: pop.easing,
    });
  }
}

/** A page-like element showing `shot`, placed at `box` inside `parent` (fixed or absolute). */
function ghostOf(shot: SheetSnapshot, className?: string): HTMLElement {
  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.dataset.pageGhost = '';
  if (className) ghost.className = className;
  Object.assign(ghost.style, {
    width: `${shot.box.width}px`,
    height: `${shot.box.height}px`,
    overflow: 'hidden',
    borderRadius: 'var(--radius-page)',
    background: 'var(--page-background)',
    boxShadow: 'var(--page-shadow)',
    pointerEvents: 'none',
  });
  if (shot.canvas) {
    Object.assign(shot.canvas.style, { display: 'block', width: '100%', height: '100%' });
    ghost.append(shot.canvas);
  }
  return ghost;
}

/**
 * A deleted page leaves (module header): a copy at its old place in `layer` (the grid's table)
 * shrinks to 0.8 and fades on the exit ease, then is removed. Under reduced motion it fades.
 */
export function shrinkOut(shot: SheetSnapshot, layer: HTMLElement): void {
  if (typeof layer.animate !== 'function') return;
  const ghost = ghostOf(shot);
  const origin = layer.getBoundingClientRect();
  Object.assign(ghost.style, {
    position: 'absolute',
    left: `${shot.box.left - origin.left}px`,
    top: `${shot.box.top - origin.top}px`,
  });
  // First in the layer, so the neighbours closing the gap pass over it, never under it.
  layer.prepend(ghost);
  const frames: Keyframe[] = reducedMotion()
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: `scale(${LEAVE_SCALE})` },
      ];
  const a = ghost.animate(frames, { duration: duration('base'), easing: EASE.exit });
  const done = () => ghost.remove();
  a.finished.then(done, done);
}

/**
 * A page arrives where it lands (module header): its cell grows from 0.8 on `smooth`'s curve
 * while it fades in. Under reduced motion it fades. `delay` staggers a group.
 */
export function growIn(cell: HTMLElement, delay = 0): void {
  if (typeof cell.animate !== 'function') return;
  const box = cell.querySelector<HTMLElement>(':scope > div') ?? cell;
  if (reducedMotion()) {
    box.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: REDUCED_DURATION_MS.fast,
      easing: EASE.out,
    });
    return;
  }
  const smooth = springToLinear('smooth');
  box.animate([{ transform: `scale(${LEAVE_SCALE})` }, { transform: 'none' }], {
    duration: smooth.duration,
    delay,
    easing: smooth.easing,
    fill: 'backwards',
  });
  box.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: duration('base'),
    delay,
    easing: EASE.out,
    fill: 'backwards',
  });
}

/**
 * Extract's feedback (module header): copies of the pages fly from their cells along a short
 * arc into the tab of `documentId`, shrinking to it and fading as they reach it, a little
 * apart; the tab then takes a *receive* bounce on `pop`. The flight is 380 ms, feedback only:
 * the pages have already moved. Under reduced motion the tab's ring flashes and nothing flies.
 */
export function flyToTab(shots: readonly SheetSnapshot[], documentId: string): void {
  // The new tab is drawn on the next frame.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const tab = document.querySelector<HTMLElement>(
        `[data-tab-id="${CSS.escape(documentId)}"]:not([data-leaving])`,
      );
      if (!tab || typeof tab.animate !== 'function') return;
      const to = tab.getBoundingClientRect();
      if (reducedMotion() || shots.length === 0) {
        receive(tab, 0);
        return;
      }
      const flight = 380;
      const stagger = Math.min(30, 120 / Math.max(1, shots.length - 1));
      const flying = shots.slice(0, 8);
      flying.forEach((shot, i) => {
        const ghost = ghostOf(shot);
        Object.assign(ghost.style, {
          position: 'fixed',
          left: `${shot.box.left}px`,
          top: `${shot.box.top}px`,
          zIndex: '1000',
          transformOrigin: 'center',
          boxShadow: 'var(--e3)',
        });
        document.body.append(ghost);
        const [fx, fy] = centre(shot.box);
        const [tx, ty] = centre(to);
        const dx = tx - fx;
        const dy = ty - fy;
        const end = Math.max(0.08, Math.min(1, to.height / shot.box.height));
        // The arc: halfway along, the page is a little above the straight line.
        const lift = Math.min(80, Math.abs(dx) * 0.25 + 24);
        const a = ghost.animate(
          [
            { transform: 'none', opacity: 1 },
            {
              transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(${(1 + end) / 2})`,
              opacity: 1,
              offset: 0.5,
            },
            { transform: `translate(${dx}px, ${dy}px) scale(${end})`, opacity: 0.2 },
          ],
          { duration: flight, delay: i * stagger, easing: EASE.standard, fill: 'both' },
        );
        a.onfinish = () => ghost.remove();
        a.oncancel = () => ghost.remove();
      });
      receive(tab, flight + (flying.length - 1) * stagger - 60);
    }),
  );
}

/**
 * The *receive* bounce of a tab that took pages: up a little and back on `pop`, `after` ms from
 * now (a timer, not an animation delay: the bounce itself settles well inside A-10's 500 ms).
 */
function receive(tab: HTMLElement, after: number): void {
  window.setTimeout(() => {
    if (!tab.isConnected) return;
    if (reducedMotion()) {
      tab.animate([{ opacity: 0.6 }, { opacity: 1 }], {
        duration: REDUCED_DURATION_MS.fast,
        easing: EASE.out,
      });
      return;
    }
    const { pop } = curve();
    tab.animate([{ transform: 'scale(1.08)' }, { transform: 'none' }], {
      duration: pop.duration,
      easing: pop.easing,
    });
  }, after);
}
