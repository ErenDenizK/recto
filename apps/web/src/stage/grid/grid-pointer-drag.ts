/**
 * Touch and pen drags in the Pages grid (`components/06-navigation.md` §2.4, PG5; flows.md §7.1;
 * spec 06.11): the gesture core's pointer path (`dnd/pointer-drag.ts`, spec X5) on the grid's
 * table, beside the mouse's native drag (`dnd/page-drag.ts`).
 *
 * - **Lift.** A finger lifts a page after a 450 ms hold within 10 px, then movement, so a finger
 *   that moves first scrolls the grid; a pen after 4 px. The mouse never takes this path.
 * - **Hold released in place** (touch): selects the page, starting selection mode, or toggles
 *   it in that mode (PG4 §6, owner feedback F4: the Photos model, where a tap opens). The
 *   release's click is swallowed (`attachPointerDrag`), so it does not toggle back.
 * - **What moves:** the page under the finger, or the selection when it holds that page;
 *   lifting never selects. The guard asks `canChange(id, 'pages')` at the lift: a locked
 *   document lifts nothing, says why, and shows the Lock notice at the cell (§2.3 Locked).
 * - **Feedback:** the source cells dim (`data-dragging`), a preview (the thumbnail, up to two
 *   offset sheets and a count) follows the finger, lifted to 1.04 and leaning into the drag
 *   (`lift.ts`), with the other selected pages gathering under it, the 2 px gap bar shows where it lands (the
 *   same `DropHighlight` the mouse drives), the edges scroll by depth, and a collapsed section
 *   opens after 600 ms; an Android haptic on lift and drop (L§8).
 * - **Drop:** the pages settle from the preview's place into their slots (`noteDropOrigin`);
 *   a cancel, or a drop where nothing lands, flies the preview back to its cell. One move
 *   (`transferPages`), one undo step, announced; a move into another document
 *   also gets the Undo toast (06.24). A second finger (a pinch wins), `pointercancel` or Esc
 *   cancel. Touch has no tab drop (no tabs on compact; Move to ▾ instead).
 */
import type { DocumentId, PageId } from '@pdf-editor/document-model';

import { setDragSession, setDropHighlight } from '../../dnd/drag-store';
import { transferPages } from '../../dnd/drop';
import {
  type ArrangeLayout,
  edgeScrollSpeed,
  gapAt,
  type GridMetrics,
  sectionAtY,
} from '../../dnd/geometry';
import { pagesForDrag, renderDragPreview } from '../../dnd/page-drag';
import { attachPointerDrag } from '../../dnd/pointer-drag';
import { m } from '../../i18n';
import { announce } from '../../shell/announcer';
import { changeRefusal, refusalReason } from '../../state/guard';
import { selectionSnapshot, toggleSelection, useSelectionStore } from '../../state/selection-store';
import { useUiStore } from '../../state/ui-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { toast } from '../../ui/Toast/toast';
import type { ShownSection } from '../arrange-data';
import { playCells } from './flip-cells';
import { noteDropOrigin, type SheetSnapshot, snapshotSheets } from './cell-motion';
import { showGridLockNotice } from './grid-lock-notice';
import { type Lift, lift } from './lift';

const EXPAND_DELAY_MS = 600;

export interface GridDragState {
  readonly layout: ArrangeLayout<DocumentId>;
  readonly metrics: GridMetrics;
  readonly sections: readonly ShownSection[];
}

/** The haptic of a lift and a drop (FB13): Android only, when the haptics setting is on. */
function haptic(): void {
  if (document.documentElement.dataset.haptics !== 'on') return;
  navigator.vibrate?.(10);
}

/** Wires the pointer path on the grid's `table` (rows) inside its scroller `viewport`. */
export function attachGridPointerDrag(
  table: HTMLElement,
  viewport: HTMLElement,
  state: () => GridDragState,
): () => void {
  let drag: {
    pageIds: PageId[];
    lift: Lift;
    /** The lifted cell's box and its page's box at the lift (client px). */
    cell: DOMRect;
    sheet: DOMRect;
    target: { document: DocumentId; index: number } | null;
    pointer: { x: number; y: number };
    frame: number;
    hoverSection: DocumentId | null;
    hoverTimer: number | undefined;
  } | null = null;

  const cellOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element
      ? target.closest<HTMLElement>('[role="gridcell"][data-page-id]')
      : null;

  /** Where a drop at a client point lands: a gap in an open section, or a section's end. */
  const targetAt = (x: number, y: number) => {
    const { layout, metrics } = state();
    const box = table.getBoundingClientRect();
    const section = sectionAtY(layout, y - box.top);
    if (!section) return null;
    if (section.collapsed) {
      return { highlight: { kind: 'section' as const, section: section.id }, index: section.count };
    }
    const gap = gapAt(metrics, section.count, x - box.left, y - box.top - section.gridTop);
    return {
      highlight: {
        kind: 'gap' as const,
        section: section.id,
        gap,
        duplicate: false,
        files: false,
      },
      index: gap.index,
    };
  };

  const update = (x: number, y: number) => {
    if (!drag) return;
    drag.pointer = { x, y };
    drag.lift.move(x, y, performance.now());
    const found = targetAt(x, y);
    drag.target = found ? { document: found.highlight.section, index: found.index } : null;
    setDropHighlight(found?.highlight ?? null);
    // A collapsed section under the finger opens after 600 ms.
    const collapsed = found?.highlight.kind === 'section' ? found.highlight.section : null;
    if (collapsed !== drag.hoverSection) {
      window.clearTimeout(drag.hoverTimer);
      drag.hoverSection = collapsed;
      if (collapsed !== null) {
        drag.hoverTimer = window.setTimeout(() => {
          useUiStore.getState().setArrangeCollapsed(collapsed, false);
        }, EXPAND_DELAY_MS);
      }
    }
  };

  // Edge auto-scroll by depth (48 px zones, `edgeScrollSpeed`), while the finger rests.
  const tick = () => {
    if (!drag) return;
    const box = viewport.getBoundingClientRect();
    const speed = edgeScrollSpeed(drag.pointer.y, box.top, box.bottom);
    if (speed !== 0) {
      viewport.scrollTop += speed;
      update(drag.pointer.x, drag.pointer.y);
    }
    drag.lift.frame();
    drag.frame = requestAnimationFrame(tick);
  };

  /** Ends the drag; the preview flies back to its cell unless `landed`. */
  const finish = (landed = false) => {
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    window.clearTimeout(drag.hoverTimer);
    if (landed) drag.lift.remove();
    else void drag.lift.back(drag.sheet);
    drag = null;
    setDropHighlight(null);
    setDragSession(null);
  };

  const removeDrag = attachPointerDrag(table, {
    shouldStart: (e) => e.pointerType !== 'mouse' && cellOf(e.target) !== null,
    onHold: () => haptic(),
    onHoldRelease: (e) => {
      const cell = cellOf(e.target);
      const id = cell?.dataset.pageId as PageId | undefined;
      if (id === undefined) return;
      const next = toggleSelection(selectionSnapshot(), id);
      useSelectionStore.getState().apply(next);
      announce(m.status_selected({ count: next.selected.size }));
    },
    onLift: (e, start) => {
      const cell = cellOf(start.target);
      const id = cell?.dataset.pageId as PageId | undefined;
      const documentId = cell?.dataset.documentId as DocumentId | undefined;
      if (!cell || id === undefined || documentId === undefined) return false;
      const refusal = changeRefusal(documentId, 'pages');
      if (refusal) {
        const reason = refusalReason(refusal);
        announce(reason);
        showGridLockNotice(cell, reason);
        return false;
      }
      const pageIds = pagesForDrag(id);
      const sheet = cell.querySelector<HTMLElement>('[data-thumb]');
      const rect = (sheet ?? cell).getBoundingClientRect();
      const preview = document.createElement('div');
      preview.setAttribute('aria-hidden', 'true');
      preview.dataset.testid = 'grid-drag-preview';
      Object.assign(preview.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '1000',
        pointerEvents: 'none',
      });
      renderDragPreview(preview, sheet, pageIds.length);
      document.body.append(preview);
      // The other selected pages on screen gather under the finger (lift.ts).
      const others: SheetSnapshot[] = snapshotSheets(pageIds.filter((page) => page !== id));
      const grab = { x: start.clientX - rect.left, y: start.clientY - rect.top };
      drag = {
        pageIds,
        lift: lift(preview, grab, e.clientX, e.clientY, others),
        cell: cell.getBoundingClientRect(),
        sheet: rect,
        target: null,
        pointer: { x: e.clientX, y: e.clientY },
        frame: requestAnimationFrame(tick),
        hoverSection: null,
        hoverTimer: undefined,
      };
      setDragSession({ kind: 'pages', pageIds: new Set(pageIds) });
      update(e.clientX, e.clientY);
      haptic();
      announce(m.thumb_announce_lift({ count: pageIds.length }));
      return true;
    },
    onMove: (e) => update(e.clientX, e.clientY),
    onDrop: (e) => {
      if (!drag) return;
      update(e.clientX, e.clientY);
      const { pageIds, target } = drag;
      // The pages settle from where the preview is: the lifted cell's box, moved as its page was.
      const page = drag.lift.box();
      const origin = new DOMRect(
        drag.cell.left + page.left - drag.sheet.left,
        drag.cell.top + page.top - drag.sheet.top,
        drag.cell.width,
        drag.cell.height,
      );
      finish(target !== null);
      if (!target) return;
      const ws = useWorkspaceStore.getState().workspace;
      const from = pageIds
        .map((id) =>
          ws.documentOrder.find((doc) => ws.documents[doc]?.pages.some((p) => p.id === id)),
        )
        .find((doc) => doc !== undefined);
      const refusal = changeRefusal(target.document, 'pages');
      if (refusal) {
        announce(refusalReason(refusal));
        return;
      }
      noteDropOrigin(pageIds, origin);
      const result = transferPages({ pageIds, target, duplicate: false, select: false });
      // Dropped where it was: nothing reflows, so the pages settle back from the preview here.
      if (result === undefined) {
        playCells(table, new Map());
        return;
      }
      haptic();
      if (from !== undefined && from !== target.document) {
        const title = useWorkspaceStore.getState().workspace.documents[target.document]?.title;
        toast.undo(m.grid_moved_to_toast({ count: pageIds.length, title: title ?? '' }), {
          documentId: target.document,
          spoken: false,
        });
      }
    },
    onCancel: () => finish(),
  });
  return () => {
    finish(true);
    removeDrag();
  };
}
