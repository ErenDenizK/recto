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
 * - **Opens** its menu (`PagePillMenu.tsx`, mounted by the band) on click, Enter or Space with focus on the first
 *   control; Mod+G opens it with Go to page focused and selected.
 */
import { formatPercent, m } from '../../i18n';
import { useUiStore } from '../../state/ui-store';
import { useViewStore } from '../../state/view-store';
import { useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { Surface } from '../../ui/Surface';
import { documentLabels } from '../../viewer/navigation';
import { openPillMenu, useFrameStore } from './frame-store';
import styles from './PagePill.module.css';

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
  if (!doc) return null;
  const total = doc.pages.length;
  const current = Math.min(currentPage, Math.max(0, total - 1));
  const labels = documentLabels(workspace, doc);
  const { text, name } = pillText(labels[current], current, total, zoom);
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
      style={{ minWidth: `calc(${pillMinChars(total, 4)}ch + 2 * var(--pill-pad))` }}
      onClick={() => openPillMenu('first')}
    >
      {text}
    </Surface>
  );
}
