/**
 * Library ⇄ document (`02-library` L1 §7; language.md §7.3 *view change*; motion-2026-10
 * `library-capsule.md` §1): opening a card, its first page grows into the page of the reader;
 * going back to the Library, the page shrinks back into its card.
 *
 * - **A shared element.** One View Transition through `motion/`'s `viewTransition` (240 ms on the
 *   view change's spring, cut there), in which the card's sheet and the reader's page share
 *   `library-sheet`, named just before the old view is captured and just after React has drawn
 *   the new one, as the Pages grid names its page and cell (`grid-transition.ts`). A side
 *   without its element on screen (a card scrolled away, a page not laid out) leaves the pair
 *   unnamed: the view then only cross-fades, never morphs from a wrong place.
 * - **One image travels.** A View Transition captures the new view as soon as React has drawn
 *   it, before a page's canvas has rendered (rendering waits while the update runs), so the new
 *   side's image would be a blank sheet. The old image alone travels (`library-transition.css`):
 *   the card's bitmap grows to the page's box and hands over to the live page as it lands, and
 *   back, the page's bitmap shrinks into the card's.
 * - **Without View Transitions** (Firefox before 144) a clone does it: `flipSheet` lays a copy
 *   of the leaving sheet, its bitmap copied, over the new view and moves it to the arriving
 *   element's box on `smooth`, by transform, fading as it lands; the arriving element shows
 *   under it.
 *
 * Reduced motion keeps the transition but strips every name (`styles/motion.css`): a root
 * cross-fade cut at 150 ms; the clone is not used.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { animateStyle } from '../motion/animate';
import { reducedMotion } from '../motion/reduced-motion';
import { VT_MS } from '../motion/tokens';
import { viewTransition } from '../motion/view-transition';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { ghostOf } from './card-motion';
import './library-transition.css';

/** The shared element's name on both sides. */
export const LIBRARY_SHEET = 'library-sheet';
/** Set on `<html>` while the view change runs: `open` or `back`. */
const ATTRIBUTE = 'data-vt-library';
/** Counts view changes, so one that ends does not take the styles of the next. */
let changes = 0;

function inView(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return (
    box.width > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < window.innerHeight &&
    box.left < window.innerWidth
  );
}

/** A card's sheet (its first page), if it is drawn and on screen. */
export function cardSheet(id: DocumentId): HTMLElement | null {
  const sheet = document.querySelector<HTMLElement>(
    `[role="option"][data-document-id="${CSS.escape(id)}"] [data-library-sheet]`,
  );
  return sheet && inView(sheet) ? sheet : null;
}

/**
 * The reader's page the card becomes: the first page when it is on screen, else the current
 * page (a document opens where it was left), if it is laid out and on screen.
 */
export function readerPage(): HTMLElement | null {
  const pages = [
    ...document.querySelectorAll<HTMLElement>('[data-read-viewport] [data-page-index]'),
  ];
  const first = pages.find((page) => page.dataset.pageIndex === '0');
  if (first && inView(first)) return first;
  const current = String(useViewStore.getState().currentPage);
  const page = pages.find((p) => p.dataset.pageIndex === current);
  return page && inView(page) ? page : null;
}

function name(element: HTMLElement | null): void {
  if (element) element.style.viewTransitionName = LIBRARY_SHEET;
}

function unname(elements: readonly (HTMLElement | null)[]): void {
  for (const element of elements) {
    if (element?.style.viewTransitionName === LIBRARY_SHEET) element.style.viewTransitionName = '';
  }
}

/**
 * The fallback where View Transitions are missing: a clone of `from` (captured before the
 * update) flies from its box to `to`'s on `smooth`, over the new view, and fades as it lands.
 */
export function flipSheet(clone: HTMLElement, from: DOMRect, to: HTMLElement): void {
  const end = to.getBoundingClientRect();
  if (end.width === 0 || from.width === 0) return;
  clone.style.cssText =
    `position:fixed;left:${end.left}px;top:${end.top}px;width:${end.width}px;` +
    `height:${end.height}px;margin:0;z-index:10;pointer-events:none;transform-origin:0 0;`;
  // The clone is drawn at the arriving box, its bitmap stretched to it; it starts at the
  // leaving box by transform and settles to none.
  for (const canvas of clone.querySelectorAll('canvas')) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
  document.body.append(clone);
  const sx = from.width / end.width;
  const sy = from.height / end.height;
  const move = animateStyle(
    clone,
    'transform',
    [from.left - end.left, from.top - end.top, sx, sy],
    [0, 0, 1, 1],
    {
      spring: 'smooth',
    },
  );
  const fade = clone.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], {
    duration: VT_MS * 1.5,
    fill: 'forwards',
  });
  void move.finished.then(() => fade.finished).finally(() => clone.remove());
}

/**
 * Runs `apply` as the Library's view change, with `leaving` named in the old view and what
 * `arriving` returns named in the new one.
 */
function change(
  direction: 'open' | 'back',
  leaving: HTMLElement | null,
  apply: () => void,
  arriving: () => HTMLElement | null,
): void {
  const root = document.documentElement;
  const generation = ++changes;
  const reduced = reducedMotion();
  if (typeof document.startViewTransition !== 'function') {
    // The clone's way: copy the leaving sheet before the update takes it away.
    const from = leaving?.getBoundingClientRect();
    const clone = leaving && !reduced ? ghostOf(leaving) : null;
    apply();
    requestAnimationFrame(() => {
      const to = arriving();
      if (clone && from && to) flipSheet(clone, from, to);
    });
    return;
  }
  name(leaving);
  root.setAttribute(ATTRIBUTE, direction);
  let arrived: HTMLElement | null = null;
  void viewTransition(
    async () => {
      apply();
      // The updates its effects scheduled synchronously settle before the new view is read.
      await Promise.resolve();
      arrived = arriving();
      // Half a pair would fly in from the root's corner: both sides, or neither.
      if (leaving && arrived) name(arrived);
      else unname([leaving]);
    },
    {
      name: `library-${direction}`,
      finished: () => {
        unname([leaving, arrived]);
        if (generation === changes) root.removeAttribute(ATTRIBUTE);
      },
    },
  ).catch(() => undefined);
}

/** Opens a card: its first page grows into the reader's page (module header). */
export function openCardMorph(id: DocumentId, open: (id: DocumentId) => void): void {
  change('open', cardSheet(id), () => open(id), readerPage);
}

/** Back to the Library: the page shrinks into the active document's card (module header). */
export function backToLibraryMorph(show: () => void): void {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  change('back', readerPage(), show, () => (id === undefined ? null : cardSheet(id)));
}
