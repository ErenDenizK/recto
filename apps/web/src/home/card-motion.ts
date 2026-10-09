/**
 * The Library cards' own motion (`02-library` L5 §7; language.md §7.3 *reflow*, *popup*;
 * motion-2026-10 `library-capsule.md` §2): what the grid does when its order changes.
 *
 * - **A card that arrives** (files opened or dropped, a close undone) grows in at its slot:
 *   from 12 px above at 90 % and transparent, to rest on `smooth`, as if it fell into place.
 *   Under reduced motion only its fade runs (the motion core keeps opacity, ≤ 150 ms).
 * - **A card that leaves** (Close, Delete) shrinks out where it was: a clone of it, its page
 *   bitmap copied, lies in the grid's ghost layer under the cards, scales to 86 % toward its
 *   centre and fades on `--duration-base` `--ease-exit`, then is removed. The clone is never
 *   focusable, named or found by a card query (no role, no id), and takes no pointer.
 * - **The others make way** by FLIP, translate only (a card never resizes in the grid), on
 *   `smooth` from where each is drawn, a move in flight carrying its velocity (Q-10). They pass
 *   over a leaving card's clone, never under it.
 *
 * The snapshot must be read before React changes the DOM, which only a class component's
 * `getSnapshotBeforeUpdate` can do (`LibraryGrid`'s `CardMotionBoundary`, the capsule's way).
 * Nothing is left on a card at rest (Q-2): `animateStyle` removes what it wrote.
 */
import { animateStyle, stopTransform } from '../motion/animate';
import { reducedMotion } from '../motion/reduced-motion';
import { duration, EASE } from '../motion/tokens';

/** How far above its slot an arriving card starts (px) and at what scale. */
export const ARRIVE_RISE_PX = 12;
export const ARRIVE_SCALE = 0.9;
/** The scale a leaving card shrinks to, toward its centre. */
export const LEAVE_SCALE = 0.86;
/** Moves smaller than this (CSS px) are not animated. */
const STILL = 0.5;

const CARD = '[role="option"][data-document-id]';

/** What the grid looked like just before a change of order. */
export interface GridSnapshot {
  /** Each card's box as drawn (a move in flight included), by document id. */
  readonly boxes: ReadonlyMap<string, DOMRect>;
  /** Clones of the cards that are about to leave, placed where they are in the grid. */
  readonly ghosts: readonly HTMLElement[];
}

/** The cards of `grid` by document id. */
function cardsOf(grid: HTMLElement): Map<string, HTMLElement> {
  const cards = new Map<string, HTMLElement>();
  for (const card of grid.querySelectorAll<HTMLElement>(CARD)) {
    const id = card.getAttribute('data-document-id');
    if (id !== null) cards.set(id, card);
  }
  return cards;
}

/** The card's ○ (`LibraryCard`'s `CardCheck`), left out of a copy. */
const CHECK_TEST_ID = 'library-card-check';

/**
 * A copy of `card` to shrink out in its place: inert, nameless, without its ○, its canvases'
 * bitmaps copied (a cloned canvas is blank), at the card's layout box in the grid's coordinates.
 */
export function ghostOf(card: HTMLElement): HTMLElement {
  const ghost = card.cloneNode(true) as HTMLElement;
  const from = card.querySelectorAll('canvas');
  ghost.querySelectorAll('canvas').forEach((canvas, i) => {
    const source = from[i];
    if (!source || source.width === 0 || source.height === 0) return;
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext('2d')?.drawImage(source, 0, 0);
  });
  // The check badge is the card's state, not its look: the copy leaves as the page alone.
  for (const check of ghost.querySelectorAll(`[data-testid="${CHECK_TEST_ID}"]`)) check.remove();
  for (const el of [ghost, ...ghost.querySelectorAll('*')]) {
    for (const name of [
      'id',
      'role',
      'tabindex',
      'data-document-id',
      'data-testid',
      'aria-label',
    ]) {
      el.removeAttribute(name);
    }
  }
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.removeAttribute('data-selected');
  ghost.style.cssText =
    `position:absolute;left:${card.offsetLeft}px;top:${card.offsetTop}px;` +
    `width:${card.offsetWidth}px;height:${card.offsetHeight}px;margin:0;pointer-events:none;`;
  return ghost;
}

/** Reads the grid before a change from `before` to `after` (document ids in card order). */
export function snapshotGrid(
  grid: HTMLElement,
  before: readonly string[],
  after: readonly string[],
): GridSnapshot {
  const cards = cardsOf(grid);
  const boxes = new Map<string, DOMRect>();
  for (const [id, card] of cards) boxes.set(id, card.getBoundingClientRect());
  const staying = new Set(after);
  const ghosts = reducedMotion()
    ? []
    : before
        .filter((id) => !staying.has(id))
        .map((id) => cards.get(id))
        .filter((card): card is HTMLElement => card !== undefined)
        .map(ghostOf);
  return { boxes, ghosts };
}

/**
 * Plays the change: leaving clones shrink out in `layer`, arriving cards grow in, the rest
 * slide from where they were drawn.
 */
export function playGrid(grid: HTMLElement, layer: HTMLElement | null, snapshot: GridSnapshot) {
  const cards = cardsOf(grid);
  const reduced = reducedMotion();
  // Every read before the first write (flip.ts's rule): stop moves in flight, then measure.
  const priors = new Map([...cards].map(([id, card]) => [id, stopTransform(card)]));
  const lasts = new Map([...cards].map(([id, card]) => [id, card.getBoundingClientRect()]));

  for (const ghost of snapshot.ghosts) {
    if (!layer) break;
    layer.append(ghost);
    const exit = ghost.animate(
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: `scale(${LEAVE_SCALE})` },
      ],
      { duration: duration('base'), easing: EASE.exit, fill: 'forwards' },
    );
    exit.onfinish = exit.oncancel = () => ghost.remove();
  }

  for (const [id, card] of cards) {
    const first = snapshot.boxes.get(id);
    const last = lasts.get(id);
    if (!last) continue;
    if (!first) {
      // Arriving: it falls into its slot; reduced motion keeps the fade alone (§7.5).
      if (!reduced) {
        animateStyle(card, 'transform', [0, -ARRIVE_RISE_PX, ARRIVE_SCALE], [0, 0, 1], {
          spring: 'smooth',
        });
      }
      animateStyle(card, 'opacity', 0, 1, { spring: 'quick' });
      continue;
    }
    if (reduced) continue;
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const [vx = 0, vy = 0] = priors.get(id)?.velocity ?? [];
    if (Math.abs(dx) < STILL && Math.abs(dy) < STILL && Math.abs(vx) + Math.abs(vy) < STILL) {
      continue;
    }
    animateStyle(card, 'transform', [dx, dy], [0, 0], { spring: 'smooth', velocity: [vx, vy] });
  }
}
