/**
 * Dragging a tab to reorder (docs/design/motion-2026-10/frame.md §7; 01-frame F4 §6; the tab
 * menu's Move left / Move right as a gesture). A tab is already draggable (`TabMenu.tsx`, onto
 * the Pages grid); this adds the strip as a place to drop it.
 *
 * - **Lift:** the tab leaves its slot as a lifted copy with a shadow under the pointer (the
 *   drag preview, `renderTabPreview`); its slot stays as a faint place-holder.
 * - **Neighbours slide:** while the pointer is over the tab list, the place-holder moves to
 *   where the tab would land and the tabs between slide over by its width on `--spring-smooth`
 *   (the `translate` property, transitioned: it retargets from where each tab is drawn). Off the
 *   list, everything slides back.
 * - **Drop** on the list: the order changes (`reorderDocuments`, no history: not a change to a
 *   document, X12) and every tab FLIPs from where it was drawn to its new place on `smooth`,
 *   so nothing jumps; "Moved to position 2 of 4" is said, as the tab menu says it.
 * - **Reduced motion:** no sliding (the transition is instant), the order simply changes.
 */
import {
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine';
import type { DocumentId } from '@pdf-editor/document-model';
import { type RefObject, useEffect } from 'react';
import { flushSync } from 'react-dom';

import { isTabDrag } from '../../dnd/page-drag';
import { m } from '../../i18n';
import { flip } from '../../motion/flip';
import { useWorkspaceStore } from '../../state/workspace-store';
import { announce } from '../announcer';

/** Marks the tab being dragged (its place-holder) and the list while a reorder is in flight. */
export const TAB_DRAGGING = 'data-tab-dragging';
export const TABS_REORDERING = 'data-reordering';

/** The visible tabs of `list` (not one collapsing), in order. */
const tabsOf = (list: HTMLElement) => [
  ...list.querySelectorAll<HTMLElement>('[data-tab-id]:not([data-leaving])'),
];

/**
 * Where a tab dragged from `from` lands with the pointer at `x`: the slot whose centre the
 * pointer has passed, among `centres` (the tabs' resting centres, in order).
 */
export function reorderSlot(centres: readonly number[], from: number, x: number): number {
  let slot = 0;
  centres.forEach((centre, i) => {
    if (i !== from && x > centre) slot += 1;
  });
  return slot;
}

/** The `documentOrder` index for `id` dropped at visible `slot` among `visible` (in order). */
export function orderIndex(
  order: readonly DocumentId[],
  visible: readonly DocumentId[],
  id: DocumentId,
  slot: number,
): number {
  const rest = order.filter((other) => other !== id);
  const shown = visible.filter((other) => other !== id);
  const before = shown[slot];
  if (before !== undefined) return rest.indexOf(before);
  const last = shown.at(-1);
  return last === undefined ? rest.length : rest.indexOf(last) + 1;
}

interface Drag {
  readonly id: DocumentId;
  readonly from: number;
  readonly tabs: HTMLElement[];
  readonly centres: number[];
  /** The dragged tab's width with the list's gap: how far a neighbour slides. */
  readonly step: number;
  readonly widths: number[];
  readonly gap: number;
  slot: number;
}

/** Slides the tabs so that the dragged one's slot is `slot` (its own index: none moves). */
function arrange(drag: Drag, slot: number): void {
  drag.slot = slot;
  const { from, tabs, step, widths, gap } = drag;
  const span = (a: number, b: number) =>
    widths.slice(a, b).reduce((sum, width) => sum + width + gap, 0);
  tabs.forEach((tab, i) => {
    let shift = 0;
    if (i === from) shift = slot > from ? span(from + 1, slot + 1) : -span(slot, from);
    else if (slot > from && i > from && i <= slot) shift = -step;
    else if (slot < from && i >= slot && i < from) shift = step;
    tab.style.translate = shift === 0 ? '' : `${shift}px 0`;
  });
}

/** Clears every slide and mark. */
function release(list: HTMLElement, drag: Drag | null): void {
  list.removeAttribute(TABS_REORDERING);
  for (const tab of drag?.tabs ?? []) {
    tab.style.removeProperty('translate');
    tab.removeAttribute(TAB_DRAGGING);
  }
}

/** Makes `listRef`'s tab list a place to drop a dragged tab, which reorders the tabs. */
export function useTabReorder(listRef: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const list = listRef.current;
    if (!list || !enabled) return undefined;
    let drag: Drag | null = null;
    return combine(
      dropTargetForElements({
        element: list,
        canDrop: ({ source }) => isTabDrag(source.data),
      }),
      monitorForElements({
        canMonitor: ({ source }) => isTabDrag(source.data) && list.contains(source.element),
        onDragStart: ({ source }) => {
          if (!isTabDrag(source.data)) return;
          const tabs = tabsOf(list);
          const from = tabs.findIndex((t) => t.dataset.tabId === source.data.documentId);
          if (from < 0) return;
          const boxes = tabs.map((t) => t.getBoundingClientRect());
          const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0;
          drag = {
            id: source.data.documentId,
            from,
            tabs,
            centres: boxes.map((b) => b.left + b.width / 2),
            step: (boxes[from]?.width ?? 0) + gap,
            widths: boxes.map((b) => b.width),
            gap,
            slot: from,
          };
          list.setAttribute(TABS_REORDERING, '');
          tabs[from]?.setAttribute(TAB_DRAGGING, '');
        },
        onDrag: ({ location }) => {
          if (!drag) return;
          // Off the list, everything slides back to where it was.
          const over = location.current.dropTargets.some((t) => t.element === list);
          const slot = over
            ? reorderSlot(drag.centres, drag.from, location.current.input.clientX)
            : drag.from;
          if (slot !== drag.slot) arrange(drag, slot);
        },
        onDrop: ({ location }) => {
          const done = drag;
          drag = null;
          const onList = location.current.dropTargets.some((t) => t.element === list);
          if (!done || !onList || done.slot === done.from) {
            release(list, done);
            return;
          }
          const store = useWorkspaceStore.getState();
          const order = store.workspace.documentOrder;
          const visible = done.tabs.map((t) => t.dataset.tabId as DocumentId);
          const to = orderIndex(order, visible, done.id, done.slot);
          // FLIP from where each tab is drawn (its slide included) to its new place.
          void flip(done.tabs, () => {
            release(list, done);
            flushSync(() => {
              useWorkspaceStore.getState().reorderDocuments(done.id, to);
            });
          });
          const title = store.workspace.documents[done.id]?.title ?? '';
          announce(m.frame_tab_moved({ name: title, position: to + 1, count: order.length }));
        },
      }),
    );
  }, [listRef, enabled]);
}
