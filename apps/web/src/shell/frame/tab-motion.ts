/**
 * The tabs' motion (01-frame F4; language.md §7.3 *reflow*, *select*; owner feedback 2026-10-09
 * G6, "animation!!" on the tab):
 *
 * - **The selection slides.** The active tab's fill (`data-tab-fill`) is one shared element in
 *   effect: when another tab becomes active its fill starts where the last one was drawn (its
 *   place and width, a fill in flight included, with its velocity) and moves to its own on
 *   `smooth`, by `transform` and its own `width` (a fill has no label, so nothing is scaled,
 *   Q-8). At rest the fill has no inline style (Q-2).
 * - **A new tab grows in.** Its own width moves from 0 to its resting width on `smooth`, its
 *   contents held at their resting width and fading in; the tabs after it, "N more" and + move
 *   by layout, and the leading piece follows (`data-tab-motion` tells `springWidth()` to hold).
 * - **A closed tab collapses.** It stays drawn, `inert` and hidden from assistive technology,
 *   its width moving to 0 on `quick` while it fades out in `--duration-fast`, so its neighbours
 *   slide into the gap; then it goes (`onLeft`).
 * - **Reduced motion** (§7.5): no slide, no growth and no collapse; the fills cross-fade
 *   (TopStrip.module.css) and a tab comes and goes at once.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { type RefObject, useLayoutEffect, useRef } from 'react';

import { animateStyle, type Motion } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
import { duration, EASE } from '../../motion/tokens';

/** A closed tab still drawn while it collapses, after the tab it followed (null: first). */
export interface LeavingTab<T> {
  readonly item: T;
  readonly after: DocumentId | null;
}

/** Marks a tab that moves its own width (a tab growing in or collapsing). */
export const TAB_MOTION = 'data-tab-motion';

/**
 * The tabs to draw: the visible ones with the leaving ones put back after the tab they
 * followed (or first, when that one has gone too), each flagged.
 */
export function withLeaving<T extends { readonly id: DocumentId }>(
  visible: readonly T[],
  leaving: readonly LeavingTab<T>[],
): { readonly item: T; readonly leaving: boolean }[] {
  const out = visible.map((item) => ({ item, leaving: false }));
  for (const gone of leaving) {
    if (visible.some((t) => t.id === gone.item.id)) continue;
    const at = gone.after === null ? -1 : out.findIndex((t) => t.item.id === gone.after);
    out.splice(at + 1, 0, { item: gone.item, leaving: true });
  }
  return out;
}

/**
 * The tabs that closed between `before` and `after` (gone from the documents, not moved into
 * "N more"), each with the tab it followed in `before`.
 */
export function closedTabs<T extends { readonly id: DocumentId }>(
  before: readonly T[],
  after: readonly T[],
  documents: readonly { readonly id: DocumentId }[],
): LeavingTab<T>[] {
  const open = new Set(documents.map((d) => d.id));
  const shown = new Set(after.map((t) => t.id));
  return before.flatMap((item, i) =>
    open.has(item.id) || shown.has(item.id)
      ? []
      : [{ item, after: i > 0 ? (before[i - 1]?.id ?? null) : null }],
  );
}

interface FillRun {
  readonly el: HTMLElement;
  readonly move: Motion<readonly number[]>;
  readonly width: Motion;
}

/** A box in the tab list's own coordinates (its scroll included). */
interface Place {
  readonly left: number;
  readonly width: number;
}

const placeOf = (el: Element, list: HTMLElement): Place => {
  const box = el.getBoundingClientRect();
  return {
    left: box.left - list.getBoundingClientRect().left + list.scrollLeft,
    width: box.width,
  };
};

/**
 * Runs the tabs' motion after every commit of `DocumentTabs`: the fill's slide when the
 * selection changes, new tabs growing in, closed ones collapsing (`onLeft` once one is gone,
 * called from a later frame, so it must not depend on the render it came from: a state update
 * by function).
 */
export function useTabMotion(
  listRef: RefObject<HTMLElement | null>,
  selected: DocumentId | null,
  onLeft: (id: DocumentId) => void,
): void {
  const last = useRef<{ selected: DocumentId | null; fill: Place | null; ids: Set<string> }>({
    selected: null,
    fill: null,
    ids: new Set(),
  });
  const run = useRef<FillRun | null>(null);
  const leaving = useRef(new WeakSet<Element>());

  useLayoutEffect(() => {
    const list = listRef.current;
    const was = last.current;
    if (!list) {
      last.current = { selected, fill: null, ids: new Set() };
      return;
    }
    const reduced = reducedMotion();
    const wraps = [...list.querySelectorAll<HTMLElement>('[data-tab-id]')];
    const ids = new Set(
      wraps.filter((w) => !w.hasAttribute('data-leaving')).map((w) => w.dataset.tabId ?? ''),
    );

    // Every read before the first write.
    const fill = list.querySelector<HTMLElement>('[data-selected] > [data-tab-fill]');
    const prior = run.current;
    const changed = selected !== was.selected;
    // Where the fill rests now: unread while a slide is in flight on it, or while its tab grows
    // in (then it rests where it was read as the tab came in).
    const moving = fill?.parentElement?.hasAttribute(TAB_MOTION) ?? false;
    const fillAt = fill && !moving && (changed || !prior) ? placeOf(fill, list) : null;
    // Where the last fill was drawn: in flight, where it is; at rest, its tab's place now (a tab
    // before it may have changed) at the width it had while selected.
    const oldFill =
      changed && !prior && was.selected !== null
        ? list.querySelector<HTMLElement>(
            `[data-tab-id="${CSS.escape(was.selected)}"]:not([data-leaving]) > [data-tab-fill]`,
          )
        : null;
    const oldAt = oldFill ? placeOf(oldFill, list) : null;
    const fromDrawn =
      prior && changed
        ? placeOf(prior.el, list)
        : oldAt
          ? {
              left: oldAt.left,
              width: was.fill && was.fill.width > 0 ? was.fill.width : oldAt.width,
            }
          : null;
    const entering =
      was.ids.size > 0 && !reduced
        ? wraps.filter(
            (w) =>
              !w.hasAttribute('data-leaving') &&
              !was.ids.has(w.dataset.tabId ?? '') &&
              !w.hasAttribute(TAB_MOTION),
          )
        : [];
    const enteringWidths = entering.map((w) => w.getBoundingClientRect().width);
    const closing = wraps.filter((w) => w.hasAttribute('data-leaving') && !leaving.current.has(w));
    const closingWidths = closing.map((w) => w.getBoundingClientRect().width);

    // The fill's slide (not into a tab that grows in: its fill comes in with it). `rest` is
    // where the fill rests, for the next one.
    const rest = fillAt ?? (fill ? was.fill : null);
    const growing = fill !== null && entering.some((wrap) => wrap.contains(fill));
    if (fill && changed && !reduced && !growing) {
      const from = fromDrawn ?? was.fill;
      let velocity: [number, number] = [0, 0];
      if (prior) {
        velocity = [prior.move.velocity[0] ?? 0, prior.width.velocity];
        prior.move.stop();
        prior.width.stop();
        prior.el.style.removeProperty('transform');
        prior.el.style.removeProperty('width');
        run.current = null;
      }
      const to = fillAt ?? placeOf(fill, list);
      if (
        from &&
        from.width > 0 &&
        Math.abs(from.left - to.left) + Math.abs(from.width - to.width) > 0.5
      ) {
        const move = animateStyle(fill, 'transform', [from.left - to.left, 0], [0, 0], {
          spring: 'smooth',
          velocity: [velocity[0], 0],
        });
        const width = animateStyle(fill, 'width', from.width, to.width, {
          spring: 'smooth',
          velocity: velocity[1],
        });
        const current: FillRun = { el: fill, move, width };
        run.current = current;
        void Promise.all([move.finished, width.finished]).then(() => {
          if (run.current === current) run.current = null;
        });
      }
    } else if (prior && (reduced || (changed && growing))) {
      prior.move.stop();
      prior.width.stop();
      prior.el.style.removeProperty('transform');
      prior.el.style.removeProperty('width');
      run.current = null;
    }

    // New tabs grow in.
    entering.forEach((wrap, i) => {
      const width = enteringWidths[i] ?? 0;
      const tab = wrap.querySelector<HTMLElement>('[role="tab"]');
      if (width <= 0) return;
      wrap.setAttribute(TAB_MOTION, '');
      tab?.style.setProperty('width', `${width}px`);
      tab?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration('base'),
        easing: EASE.out,
        fill: 'backwards',
      });
      const grow = animateStyle(wrap, 'width', 0, width, { spring: 'smooth' });
      void grow.finished.then(() => {
        wrap.removeAttribute(TAB_MOTION);
        tab?.style.removeProperty('width');
      });
    });

    // Closed tabs collapse, then go.
    closing.forEach((wrap, i) => {
      leaving.current.add(wrap);
      const id = wrap.dataset.tabId as DocumentId;
      const width = closingWidths[i] ?? 0;
      if (reduced || width <= 0) {
        onLeft(id);
        return;
      }
      wrap.setAttribute(TAB_MOTION, '');
      const content = wrap.firstElementChild as HTMLElement | null;
      content?.style.setProperty('width', `${width}px`);
      content?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: duration('fast'),
        easing: EASE.exit,
        fill: 'forwards',
      });
      const collapse = animateStyle(wrap, 'width', width, 0, { spring: 'quick', keep: true });
      void collapse.finished.then(() => onLeft(id));
    });

    last.current = { selected, fill: rest, ids };
  });
}
