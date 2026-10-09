/**
 * The page pill (`components/01-frame.md` F11; flows.md §4.6): the persistent, focusable place
 * for page and view, "3 / 12 · 96 %" (with page labels "iii (3 / 12) · 96 %"). It replaces the
 * status bar's page readout and zoom (3.14, 3.15), the layout switch (3.11), the zoom menu
 * (8.6) and the Go to page dialog.
 *
 * - **Where:** an M1 chip, 36 px fine / 44 coarse, at the trailing end of the dock band,
 *   16 px inside the free rectangle and centred on the dock (`DockBand`). It rises 8 px above
 *   a palette or bar that would come within 12 px of it, and steps away in Focus with the dock.
 * - **Text:** always the percentage (spec 01.Q3), tabular, its minimum width set by the digit
 *   count of the page total, so scrolling never changes its width. Not a live region: jumps
 *   announce "Page 7 of 12" themselves.
 * - **Material:** M1 (`Surface`, `mat mat-chip s7 c8`), with the backdrop lens on Chromium
 *   (`styles/material-lens.ts`): a fixed-size chip, the one kind that takes it (X20).
 * - **Moves** (motion-2026-10 frame.md §4): the page number rolls like an odometer and the
 *   percentage cross-fades (`pillParts`, `PillRoll.tsx`).
 * - **Opens** its menu (`PagePillMenu.tsx`, mounted by the band) on click, Enter or Space with focus on the first
 *   control; Mod+G opens it with Go to page focused and selected.
 */
import { type CSSProperties, useLayoutEffect, useRef } from 'react';

import { formatPercent, m } from '../../i18n';
import { useUiStore } from '../../state/ui-store';
import { useViewStore } from '../../state/view-store';
import { useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { Surface } from '../../ui/Surface';
import { snapToWholePixels } from '../../ui/whole-pixels';
import { documentLabels } from '../../viewer/navigation';
import { openPillMenu, useFrameStore } from './frame-store';
import styles from './PagePill.module.css';
import { Fade, Roll } from './PillRoll';

/** The pill's text and name for page `current` (0-based) of `total` at `zoom`. */
export function pillText(
  label: string | undefined,
  current: number,
  total: number,
  zoom: number,
): { readonly text: string; readonly name: string } {
  const percent = formatPercent(zoom);
  if (total === 0) {
    return {
      text: m.frame_pill_text({ page: '–', total: 0, percent }),
      name: m.frame_pill_name({ current: 0, total: 0, percent }),
    };
  }
  const page = current + 1;
  const custom = label !== undefined && label !== String(page);
  return {
    text: custom
      ? m.frame_pill_text_label({ label, page, total, percent })
      : m.frame_pill_text({ page: String(page), total, percent }),
    name: m.frame_pill_name({ current: page, total, percent }),
  };
}

/** One run of the pill's text: plain, the page number (it rolls) or the percentage (it fades). */
export interface PillPart {
  readonly kind: 'text' | 'page' | 'percent';
  readonly value: string;
}

const PAGE_MARK = '\uE000';
const PERCENT_MARK = '\uE001';

/**
 * The pill's text in runs (motion-2026-10 frame.md §4): the message is formatted with marks
 * in place of the page and the percentage, so each locale's order and separators stay its own
 * while those two values move on their own (`PillRoll.tsx`). A custom page label rolls as the
 * page does.
 */
export function pillParts(
  label: string | undefined,
  current: number,
  total: number,
  zoom: number,
): PillPart[] {
  const percent = formatPercent(zoom);
  const page = total === 0 ? '–' : String(current + 1);
  const custom = total > 0 && label !== undefined && label !== page;
  const marked = custom
    ? m.frame_pill_text_label({ label: PAGE_MARK, page, total, percent: PERCENT_MARK })
    : m.frame_pill_text({ page: PAGE_MARK, total, percent: PERCENT_MARK });
  const parts: PillPart[] = [];
  for (const piece of marked.split(new RegExp(`(${PAGE_MARK}|${PERCENT_MARK})`))) {
    if (piece === PAGE_MARK) parts.push({ kind: 'page', value: custom ? (label ?? page) : page });
    else if (piece === PERCENT_MARK) parts.push({ kind: 'percent', value: percent });
    else if (piece !== '') parts.push({ kind: 'text', value: piece });
  }
  return parts;
}

/** Characters the pill keeps room for: the widest page number of the total, both sides. */
export function pillMinChars(total: number, percentChars: number): number {
  const digits = String(Math.max(1, total)).length;
  // "{digits} / {digits} · {percent}": tabular digits are 1 ch each; the two separators with
  // their spaces are about 1 ch each in the UI face.
  return digits * 2 + 2 + percentChars;
}

export function PagePill() {
  const doc = useActiveDocument();
  const workspace = useWorkspaceStore((s) => s.workspace);
  const currentPage = useViewStore((s) => s.currentPage);
  const zoom = useUiStore((s) => s.zoom);
  const open = useFrameStore((s) => s.pillMenu !== null);
  // Held by its trailing edge, the pill's left edge is wherever its text's width puts it
  // (x 1314.69): its width rounds so it rests on whole pixels (Q-2, V2 review item 16).
  const pillRef = useRef<HTMLButtonElement>(null);
  const hasDoc = doc !== undefined;
  useLayoutEffect(() => {
    const el = pillRef.current;
    return el ? snapToWholePixels(el, 'width') : undefined;
  }, [hasDoc]);
  if (!doc) return null;
  const total = doc.pages.length;
  const current = Math.min(currentPage, Math.max(0, total - 1));
  const labels = documentLabels(workspace, doc);
  const { name } = pillText(labels[current], current, total, zoom);
  const parts = pillParts(labels[current], current, total, zoom);
  return (
    <Surface
      as="button"
      tier="chip"
      sigma={7}
      coarse={8}
      lens
      type="button"
      id="page-pill"
      className={styles.pill}
      aria-label={name}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts="Control+G"
      data-region="pill"
      data-band-item=""
      data-testid="page-pill"
      ref={pillRef}
      // The digit-count minimum as a property the stylesheet reads, so the whole-pixel minimum
      // (`snapToWholePixels`, inline) can sit over it and come off again.
      style={
        { '--pill-min': `calc(${pillMinChars(total, 4)}ch + 2 * var(--pill-pad))` } as CSSProperties
      }
      onClick={() => openPillMenu('first')}
    >
      {parts.map((part, i) =>
        part.kind === 'page' ? (
          <Roll key={i} value={part.value} />
        ) : part.kind === 'percent' ? (
          <Fade key={i} value={part.value} />
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </Surface>
  );
}
