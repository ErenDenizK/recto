/**
 * The phone's selection bar (`design/phone-2026-10/README.md` §4 "Long-press on text"; code-audit
 * §2 Highlight): one small glass pill over a page text selection, Highlight · Copy, with an
 * Edit text once that tool is live (WP5, EDN-17), which opens the selected paragraph.
 * Its own chunk, loaded on the first selection (`selection-host.tsx`).
 *
 * - **Highlight** marks the selection in the Highlighter preset's tint (as H does on a computer,
 *   `pen/highlighter.ts` `activateHighlighter`) through `selection-markup.ts`, one history entry
 *   per page. Editing, the mounted annotation layers are its targets; reading, the pages stand in
 *   for them (`selection-targets.ts`). A targeted act (ADR-0030): it needs no Markup, only an
 *   unlocked document. Editing, the island's Undo takes it back; reading, where there is no
 *   island, the bar stays a moment as "Highlighted · Undo".
 * - **Copy** puts the assembled page text on the clipboard (`selectionCopyText`, as the full
 *   edition's bar) and pulses the copied lines; the selection stays.
 * - **Never fights the system callout.** iOS and Android draw their own edit menu just above a
 *   selection (below it when there is no room); the bar keeps a callout's band clear between it
 *   and the selected lines, above them, or below them when the top bar is in the way, and never
 *   covers the top bar or the capsule. A press on it keeps the selection
 *   (`preventDefault` on pointerdown), and it follows the selection as the page scrolls.
 */
import {
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { useAnnotationStore } from '../../../annotations/annotation-store';
import { markupFromSelection } from '../../../annotations/selection-markup';
import { undoStep } from '../../../history/actions';
import { m } from '../../../i18n';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { pulseSelection } from '../../../viewer/copy-pulse';
import { selectionCopyText } from '../../../viewer/text-model';
import { announce } from '../../announcer';
import { useCompactStore } from '../compact-store';
import { armTool, enterEditing } from './bridge';
import { editTextAt } from './edit-text';
import { highlighterSlot } from './ink-presets';
import { compactTool, useCompactTools } from './registry';
import styles from './selection-bar.module.css';
import { withPageTargets } from './selection-targets';

/** The system edit menu's band kept clear beside the selection, px (iOS: 44 + its arrow). */
export const CALLOUT_BAND = 56;
/** The gap between the bar and the band, and the bar and the chrome, px. */
const GAP = 8;
/** The side gutter, px. */
const GUTTER = 16;
/** How long the "Highlighted · Undo" offer stays while reading, ms. */
const UNDO_OFFER_MS = 4000;

export interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/**
 * Where the bar goes: centred on the selection's first line, a callout's band above the
 * selection, or below it when that would reach under `limits.top`; always within the limits.
 */
export function placeBar(
  selection: Box,
  firstLine: Box,
  bar: { readonly width: number; readonly height: number },
  limits: Box,
): { readonly x: number; readonly y: number; readonly side: 'above' | 'below' } {
  let y = selection.top - CALLOUT_BAND - GAP - bar.height;
  let side: 'above' | 'below' = 'above';
  if (y < limits.top) {
    y = selection.bottom + CALLOUT_BAND + GAP;
    side = 'below';
  }
  y = Math.max(limits.top, Math.min(y, limits.bottom - bar.height));
  const centre = (firstLine.left + firstLine.right) / 2;
  const x = Math.max(
    limits.left,
    Math.min(centre - bar.width / 2, Math.max(limits.left, limits.right - bar.width)),
  );
  return { x, y, side };
}

function selectionBoxes(): { all: Box; first: Box } | null {
  const selection = globalThis.getSelection?.() ?? null;
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const rects = [...selection.getRangeAt(0).getClientRects()].filter(
    (r) => r.width > 0 && r.height > 0,
  );
  const first = rects[0];
  if (!first) return null;
  const all = {
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
  };
  return { all, first };
}

/**
 * The room between the top bar and the capsule, inside the side gutters. The single capsule's
 * tray and Redo chip (`[data-compact-above-capsule]`, EDN-24) stand above the capsule: the
 * limit is the top of the highest of them.
 */
export function chromeLimits(): Box {
  const visible = (el: Element | null) => {
    if (!(el instanceof HTMLElement) || el.dataset.hidden !== undefined) return null;
    const r = el.getBoundingClientRect();
    return r.height > 0 ? r : null;
  };
  const top = visible(document.querySelector('[data-testid="compact-top-bar"]'));
  const capsule = visible(document.querySelector('[data-testid="compact-capsule"]'));
  return {
    top: (top?.bottom ?? 0) + GAP,
    bottom:
      Math.min(
        capsule?.top ?? window.innerHeight,
        ...[...document.querySelectorAll('[data-compact-above-capsule]')].map(
          (el) => visible(el)?.top ?? window.innerHeight,
        ),
      ) - GAP,
    left: GUTTER,
    right: window.innerWidth - GUTTER,
  };
}

export default function SelectionBar({
  selected,
  onKeep,
}: {
  /** A page text selection is there (not only the undo offer). */
  readonly selected: boolean;
  /** Keeps the bar mounted without a selection (the undo offer). */
  readonly onKeep: (keep: boolean) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [offer, setOffer] = useState(false);
  const [place, setPlace] = useState<{ x: number; y: number; side: string } | null>(null);
  const specs = useCompactTools();
  const editText = specs.get('edit-text');
  const canEditText = editText !== undefined && !editText.soon && editText.arm !== undefined;

  // Placed before paint, and again as the page scrolls or the window changes.
  useLayoutEffect(() => {
    if (!selected) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const measure = () => {
      const bar = barRef.current;
      const boxes = selectionBoxes();
      if (!bar || !boxes) return;
      setPlace(
        placeBar(
          boxes.all,
          boxes.first,
          { width: bar.offsetWidth, height: bar.offsetHeight },
          chromeLimits(),
        ),
      );
    };
    measure();
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    document.addEventListener('selectionchange', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
      document.removeEventListener('selectionchange', update);
    };
  }, [selected]);

  // The undo offer ends by itself; a new selection takes its place.
  useEffect(() => {
    if (!offer) return;
    const timer = window.setTimeout(() => {
      setOffer(false);
      onKeep(false);
    }, UNDO_OFFER_MS);
    return () => window.clearTimeout(timer);
  }, [offer, onKeep]);
  // A new selection (one that arrives after the highlight cleared the old) ends the offer.
  const [wasSelected, setWasSelected] = useState(selected);
  if (wasSelected !== selected) {
    setWasSelected(selected);
    if (selected && offer) setOffer(false);
  }
  useEffect(() => {
    if (selected) onKeep(false);
  }, [selected, onKeep]);

  // A press on the bar keeps the selection (and the focus where it is).
  const keep = (event: PointerEvent) => event.preventDefault();

  const highlight = async () => {
    const editing = useCompactStore.getState().editing;
    const pen = useAnnotationStore.getState().pen;
    const index = highlighterSlot(pen);
    const style = index === undefined ? undefined : { color: pen.presets[index].color, opacity: 1 };
    // Reading, the bar outlives the selection the highlight clears: it offers Undo.
    if (!editing) onKeep(true);
    const reader = document.querySelector('[data-testid="compact-reader"]') ?? document;
    const done = await withPageTargets(() => markupFromSelection('highlight', style), reader);
    if (!done) {
      if (!editing) onKeep(false);
      return;
    }
    announce(m.compact_highlight_done());
    if (!editing) setOffer(true);
  };

  const copy = async () => {
    const selection = globalThis.getSelection?.() ?? null;
    const text = selectionCopyText(selection) ?? selection?.toString() ?? '';
    if (text === '') return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard permission: the system menu's Copy still copies the selection.
      return;
    }
    pulseSelection(selection);
    announce(m.selection_copied());
  };

  // Edit text opens the editor where the selection begins; the keyboard is held in this press
  // (`edit-text.tsx`), and the page selection gives way to the editor's caret.
  const editTextHere = () => {
    const boxes = selectionBoxes();
    globalThis.getSelection?.()?.removeAllRanges();
    if (!boxes) {
      if (!useCompactStore.getState().editing) enterEditing();
      if (compactTool('edit-text')) armTool('edit-text');
      return;
    }
    const { first } = boxes;
    editTextAt({ x: first.left + 1, y: (first.top + first.bottom) / 2 });
  };

  const undo = () => {
    undoStep();
    setOffer(false);
    onKeep(false);
  };

  const style = (
    place ? { left: place.x, top: place.y } : { visibility: 'hidden' }
  ) as CSSProperties;
  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={m.compact_highlight_bar()}
      className={styles.bar}
      style={style}
      data-side={place?.side}
      data-compact-selection-bar=""
      data-compact-chrome=""
      data-annotation-keep=""
      data-testid="compact-selection-bar"
      onPointerDown={keep}
    >
      {offer ? (
        <>
          <span className={styles.status} role="status">
            {m.compact_highlight_done()}
          </span>
          <Button variant="quiet" className={styles.action} onClick={undo}>
            <Icon name="arrow-u-up-left" />
            {m.compact_highlight_undo()}
          </Button>
        </>
      ) : (
        <>
          <Button variant="quiet" className={styles.action} onClick={() => void highlight()}>
            <Icon name="highlighter" />
            {m.compact_highlight_action()}
          </Button>
          <Button variant="quiet" className={styles.action} onClick={() => void copy()}>
            <Icon name="copy" />
            {m.action_copy()}
          </Button>
          {canEditText ? (
            <Button variant="quiet" className={styles.action} onClick={editTextHere}>
              <Icon name="edit-text" />
              {m.compact_highlight_edit_text()}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
