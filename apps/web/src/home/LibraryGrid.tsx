/**
 * The Library's cards (`02-library` L5 §6, §8): a multi-select listbox with a roving tabindex
 * (one Tab stop), in card order = tab order = Combine order (INV-19).
 *
 * | Input | Not selecting | Select mode |
 * |---|---|---|
 * | Click, tap | Opens the document (viewing) | Toggles |
 * | Click on ○ | Checks it, enters Select mode | Toggles |
 * | Shift-click · Mod-click | Range from the anchor · toggle; enters Select mode | Same |
 * | Long press (touch, pen) · right-click · Shift+F10 | Enters Select mode with the card checked | Toggles |
 * | Drag (mouse and pen, 4 px) | Reorders the cards | Same |
 * | Arrows · Home · End | Move focus (grid steps by measured columns) | Same |
 * | Shift+arrows | Extend from the anchor; enters Select mode | Same |
 * | Space | Checks, enters Select mode | Toggles |
 * | Enter | Opens | Opens |
 * | Mod+A | Selects all, enters Select mode | Same |
 * | Alt+Left / Alt+Right | Moves the card one place (WCAG 2.5.7's alternative to dragging) | Same |
 * | F2 | Renames in place (a `document` act: refused with its reason when locked) | Same |
 * | Delete | — | Closes the checked documents |
 * | Esc | — | Clears, then leaves Select mode |
 *
 * Opening, checking, reordering and closing change no document and ask no guard (02.8). A touch
 * drag to reorder (after the 450 ms lift) is not wired yet: on touch, the lift enters Select
 * mode, and Alt+arrows or a mouse reorder.
 */
import type { DocumentId, Workspace } from '@pdf-editor/document-model';
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { currentPlatform } from '../commands/shortcuts';
import { m } from '../i18n';
import { useLongPress } from '../motion/gesture';
import { viewTransition } from '../motion';
import { usePointerCapabilities } from '../shell/frame/input-modality';
import { changeRefusal, refusalReason } from '../state/guard';
import { useLockStore } from '../state/lock-store';
import { matchesMark, useSavedStore } from '../state/saved-store';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast/toast';
import { closeSelected, focusCardSoon, moveCard, openInRead, selectOnHome } from './home-actions';
import {
  clickSelection,
  gapToIndex,
  gridStep,
  type HomeCardData,
  liveSelection,
  rangeBetween,
  toggleSelection,
} from './home-model';
import { LibraryCard } from './LibraryCard';
import styles from './LibraryGrid.module.css';
import { enterSelecting, setSelecting, useSelecting } from './library-store';

/** How far a mouse or pen moves before a press becomes a reorder drag (L5 §6). */
const DRAG_THRESHOLD_PX = 4;
/** A right-click this soon after a long press is that press's echo (Android). */
const LONG_PRESS_ECHO_MS = 700;

interface DragState {
  readonly id: DocumentId;
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  started: boolean;
  gap: number;
}

/** A card opens with the view change's root cross-fade (L1 §7, MC-2). */
export function openCard(id: DocumentId): void {
  void viewTransition(() => openInRead(id), { name: 'library-open' });
}

export function LibraryGrid({
  cards,
  workspace,
}: {
  readonly cards: readonly HomeCardData[];
  readonly workspace: Workspace;
}) {
  const rawSelection = useUiStore((s) => s.homeSelection);
  const anchor = useUiStore((s) => s.homeAnchor);
  const marks = useSavedStore((s) => s.marks);
  const locks = useLockStore((s) => s.locks);
  const selecting = useSelecting();
  const pointers = usePointerCapabilities();
  const coarse = pointers.primary === 'coarse' || pointers.anyCoarse;
  const order = cards.map((c) => c.id);
  const selection = liveSelection(order, rawSelection);
  const [focused, setFocused] = useState<DocumentId | null>(null);
  const [renaming, setRenaming] = useState<DocumentId | null>(null);
  const [drag, setDrag] = useState<{
    readonly id: DocumentId;
    readonly gap: number;
    readonly caret: CaretBox | null;
  } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const longPressAt = useRef(Number.NEGATIVE_INFINITY);
  const gridRef = useRef<HTMLDivElement>(null);

  const tabbable =
    (focused !== null && order.includes(focused) ? focused : undefined) ?? selection[0] ?? order[0];

  const cardElements = (): HTMLElement[] =>
    Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);

  const focusCard = (id: DocumentId) => {
    setFocused(id);
    gridRef.current?.querySelector<HTMLElement>(`[data-document-id="${id}"]`)?.focus();
  };

  /** Cards per row, read from the layout (the grid wraps to the column's width). */
  const columns = (): number => {
    const items = cardElements();
    const top = items[0]?.offsetTop;
    let count = 0;
    for (const item of items) {
      if (item.offsetTop !== top) break;
      count += 1;
    }
    return Math.max(1, count);
  };

  const toggle = (id: DocumentId) => {
    const next = toggleSelection(order, { selection, anchor }, id);
    enterSelecting();
    selectOnHome(next.selection, next.anchor);
  };

  /** Long press, right-click, Shift+F10: Select mode with this card checked, else toggle. */
  const pressSelect = (id: DocumentId) => {
    if (selecting) {
      toggle(id);
      return;
    }
    enterSelecting();
    const next = selection.includes(id) ? selection : [...selection, id];
    selectOnHome(next, id);
  };

  useLongPress(gridRef, {
    shouldStart: (event) => event.target instanceof Element && cardOf(event.target) !== undefined,
    onFire: (event) => {
      const id = event.target instanceof Element ? cardOf(event.target) : undefined;
      if (id === undefined) return;
      longPressAt.current = event.timeStamp;
      pressSelect(id);
      focusCard(id);
    },
  });

  const onCardClick = (event: MouseEvent, id: DocumentId) => {
    event.stopPropagation();
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (renaming === id) return;
    const mod = currentPlatform === 'mac' ? event.metaKey : event.ctrlKey;
    setFocused(id);
    if (event.shiftKey || mod) {
      const next = clickSelection(order, { selection, anchor }, id, {
        shift: event.shiftKey,
        mod,
      });
      enterSelecting();
      selectOnHome(next.selection, next.anchor);
      return;
    }
    if (selecting) {
      toggle(id);
      return;
    }
    openCard(id);
  };

  const onCheck = (event: MouseEvent, id: DocumentId) => {
    event.stopPropagation();
    setFocused(id);
    toggle(id);
  };

  const onContextMenu = (event: MouseEvent, id: DocumentId) => {
    event.preventDefault();
    if (event.timeStamp - longPressAt.current < LONG_PRESS_ECHO_MS) return;
    pressSelect(id);
    focusCard(id);
  };

  // ---- Reorder by dragging (mouse and pen; L5 §6) --------------------------------------

  /** The gap (0 … n) nearest the pointer: before the card under it, or after it. */
  const gapAt = (x: number, y: number): number => {
    const items = cardElements();
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    items.forEach((item, index) => {
      const box = item.getBoundingClientRect();
      const dx = Math.max(box.left - x, 0, x - box.right);
      const dy = Math.max(box.top - y, 0, y - box.bottom);
      const distance = dx * dx + dy * dy * 4;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = x > box.left + box.width / 2 ? index + 1 : index;
      }
    });
    return best;
  };

  const onPointerDown = (event: PointerEvent, id: DocumentId) => {
    if (event.button !== 0 || event.pointerType === 'touch' || renaming === id) return;
    if (event.shiftKey || event.metaKey || event.ctrlKey) return;
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      started: false,
      gap: order.indexOf(id),
    };
  };

  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      const state = dragRef.current;
      if (state?.pointerId !== event.pointerId) return;
      if (!state.started) {
        if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < DRAG_THRESHOLD_PX) {
          return;
        }
        state.started = true;
      }
      event.preventDefault();
      const gap = gapAt(event.clientX, event.clientY);
      state.gap = gap;
      setDrag((current) =>
        current?.id === state.id && current.gap === gap
          ? current
          : { id: state.id, gap, caret: caretBox(cardElements(), gap, gridRef.current) },
      );
    };
    const end = (event: globalThis.PointerEvent, commit: boolean) => {
      const state = dragRef.current;
      if (state?.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (!state.started) return;
      // The release's click must not open the card that was dragged.
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      setDrag(null);
      if (!commit) return;
      const ids = useWorkspaceStore.getState().workspace.documentOrder;
      if (moveCard(state.id, gapToIndex(ids, state.id, state.gap))) focusCardSoon(state.id);
    };
    const onUp = (event: globalThis.PointerEvent) => end(event, true);
    const onCancel = (event: globalThis.PointerEvent) => end(event, false);
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current?.started) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
    };
  });

  // ---- Keys (L5 §6) --------------------------------------------------------------------

  const startRename = (id: DocumentId) => {
    const refusal = changeRefusal(id, 'document');
    if (refusal !== undefined) {
      toast.info(refusalReason(refusal), { key: 'library-rename-refused', documentId: id });
      return;
    }
    setRenaming(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (renaming !== null) return;
    const from =
      event.target instanceof Element
        ? event.target.closest('[data-document-id]')?.getAttribute('data-document-id')
        : undefined;
    const current = order.find((id) => id === from) ?? tabbable;
    if (current === undefined) return;
    const index = order.indexOf(current);
    const mod = currentPlatform === 'mac' ? event.metaKey : event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      enterSelecting();
      selectOnHome(order, current);
      return;
    }
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      if (moveCard(current, index + (event.key === 'ArrowLeft' ? -1 : 1))) focusCardSoon(current);
      return;
    }
    if (mod || event.altKey) return;
    if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault();
      pressSelect(current);
      return;
    }
    const step = gridStep(index, event.key, order.length, columns());
    if (step !== null) {
      event.preventDefault();
      const next = order[step];
      if (next === undefined) return;
      focusCard(next);
      if (event.shiftKey) {
        const start = anchor !== null && order.includes(anchor) ? anchor : current;
        enterSelecting();
        selectOnHome(rangeBetween(order, start, next), start);
      }
      return;
    }
    switch (event.key) {
      case ' ':
        event.preventDefault();
        toggle(current);
        return;
      case 'Enter':
        event.preventDefault();
        openCard(current);
        return;
      case 'F2':
        event.preventDefault();
        startRename(current);
        return;
      case 'ContextMenu':
        event.preventDefault();
        pressSelect(current);
        return;
      case 'Delete':
      case 'Backspace':
        if (!selecting || selection.length === 0) return;
        event.preventDefault();
        closeSelected(selection);
        return;
      case 'Escape':
        if (!selecting) return;
        event.preventDefault();
        event.stopPropagation();
        // The ladder (L1 §6): the checks first, staying in Select mode, then the mode.
        if (selection.length > 0) {
          enterSelecting();
          selectOnHome([], current);
        } else setSelecting(false);
        return;
    }
  };

  // The insertion caret: before the card at the gap, or after the last one.
  const caret = drag?.caret ?? null;

  return (
    // A click between the cards clears the checks (Esc does it from the keyboard).
    <div
      ref={gridRef}
      role="listbox"
      aria-multiselectable="true"
      aria-label={m.home_grid_label()}
      tabIndex={-1}
      className={styles.grid}
      data-dragging={drag !== null || undefined}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget && selection.length > 0) {
          selectOnHome([], null);
        }
      }}
    >
      {cards.map((card) => (
        <LibraryCard
          key={card.id}
          card={card}
          workspace={workspace}
          selected={selection.includes(card.id)}
          selecting={selecting}
          tabbable={card.id === tabbable}
          edited={!matchesMark(workspace, card.id, marks[card.id])}
          lock={locks[card.id]}
          dragging={drag?.id === card.id}
          renaming={renaming === card.id}
          coarse={coarse}
          onClick={(event) => onCardClick(event, card.id)}
          onCheck={(event) => onCheck(event, card.id)}
          onFocus={() => setFocused(card.id)}
          onContextMenu={(event) => onContextMenu(event, card.id)}
          onPointerDown={(event) => onPointerDown(event, card.id)}
          onRenamed={() => {
            setRenaming(null);
            focusCardSoon(card.id);
          }}
        />
      ))}
      {caret ? (
        <span
          className={styles.caret}
          aria-hidden="true"
          style={{ left: caret.left, top: caret.top, height: caret.height }}
        />
      ) : null}
    </div>
  );
}

/** The card id an element belongs to, if it is inside a card. */
function cardOf(element: Element): DocumentId | undefined {
  return (element.closest('[role="option"][data-document-id]')?.getAttribute('data-document-id') ??
    undefined) as DocumentId | undefined;
}

interface CaretBox {
  readonly left: number;
  readonly top: number;
  readonly height: number;
}

/** Where the 2 px insertion caret goes, in the grid's own coordinates. */
function caretBox(
  items: readonly HTMLElement[],
  gap: number,
  grid: HTMLElement | null,
): CaretBox | null {
  if (!grid || items.length === 0) return null;
  const origin = grid.getBoundingClientRect();
  const before = items[gap];
  const after = items[gap - 1];
  const box = (before ?? after)?.getBoundingClientRect();
  if (!box) return null;
  // Half the 16 px gap away from the card it sits beside.
  const x = before ? box.left - 9 : box.right + 7;
  return { left: x - origin.left, top: box.top - origin.top, height: box.height };
}
