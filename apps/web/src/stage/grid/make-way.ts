/**
 * *Make way* (docs/design/motion-2026-10/pages.md; 06-navigation PG5 §7; language.md §7.3
 * *reflow*): while a page is dragged over a gap, the two cells beside the 2 px insertion bar step
 * apart on `smooth`, so the gap opens where the page will land, as on a light table; they close
 * again when the gap moves on or the drag ends. Both drag paths drive it, since both set the
 * drop highlight (`dnd/drag-store.ts`).
 *
 * The nudge is the cell's own transform through `animateStyle`, retargeted from where it is, so
 * a gap that moves along a row ripples smoothly; at the drop the cells' reflow (`flip-cells.tsx`)
 * reads them where they are and carries them on. Nothing is left at rest: a cell that closes
 * again ends at `transform: none`. Under reduced motion nothing moves (the bar says it).
 */
import type { DocumentId, PageId } from '@pdf-editor/document-model';

import { type DropHighlight, useDropHighlight } from '../../dnd/drag-store';
import { animateStyle, type Motion } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';

/** How far each neighbour steps aside (CSS px): the gap opens by twice this. */
export const MAKE_WAY_PX = 10;

interface Sections {
  readonly columns: number;
  readonly pages: (section: DocumentId) => readonly PageId[] | undefined;
}

/** The pages beside a gap highlight, with the side each steps to (−1 left, 1 right). */
export function neighbours(
  highlight: DropHighlight | null,
  sections: Sections,
): [PageId, -1 | 1][] {
  if (highlight?.kind !== 'gap' || highlight.files) return [];
  const pages = sections.pages(highlight.section);
  if (!pages) return [];
  const { row, column } = highlight.gap;
  const at = row * sections.columns + column;
  const out: [PageId, -1 | 1][] = [];
  const left = column > 0 ? pages[at - 1] : undefined;
  const right = column < sections.columns ? pages[at] : undefined;
  if (left !== undefined) out.push([left, -1]);
  if (right !== undefined) out.push([right, 1]);
  return out;
}

/** Wires make-way on the cells under `table`; returns the teardown. */
export function attachMakeWay(table: HTMLElement, sections: () => Sections): () => void {
  const moved = new Map<HTMLElement, Motion<readonly number[]>>();
  const move = (cell: HTMLElement, x: number) => {
    const run = moved.get(cell);
    const from = run?.value ?? [0, 0];
    if ((from[0] ?? 0) === x && run) return;
    const motion = animateStyle(cell, 'transform', from, [x, 0], {
      spring: 'smooth',
      velocity: run?.velocity ?? [0, 0],
      keep: x !== 0,
      onComplete: () => {
        if (x === 0 && moved.get(cell) === motion) moved.delete(cell);
      },
    });
    moved.set(cell, motion);
  };
  const apply = (highlight: DropHighlight | null) => {
    if (reducedMotion()) return;
    const next = new Map<HTMLElement, number>();
    for (const [id, side] of neighbours(highlight, sections())) {
      const cell = table.querySelector<HTMLElement>(
        `[role="gridcell"][data-page-id="${CSS.escape(id)}"]`,
      );
      if (cell && !cell.hasAttribute('data-dragging')) next.set(cell, side * MAKE_WAY_PX);
    }
    for (const cell of moved.keys()) {
      if (!next.has(cell) && cell.isConnected) move(cell, 0);
      else if (!cell.isConnected) moved.delete(cell);
    }
    for (const [cell, x] of next) move(cell, x);
    // The drag is over: the closing cells finish on their own (or the drop's reflow takes them
    // where they are), so none is kept to retarget from a value it no longer has.
    if (highlight === null) moved.clear();
  };
  const unsubscribe = useDropHighlight.subscribe((state, previous) => {
    if (state.highlight !== previous.highlight) apply(state.highlight);
  });
  return () => {
    unsubscribe();
    for (const cell of moved.keys()) {
      if (cell.isConnected) cell.style.removeProperty('transform');
    }
    moved.clear();
  };
}
