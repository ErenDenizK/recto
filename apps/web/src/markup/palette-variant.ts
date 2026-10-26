/**
 * Which Markup palette shows (epic R25-7, board question 3; `design/markup-groups-2026-10.md`):
 * today's row (`03-markup` MK-2), the default, or one of two layouts to try before one is chosen.
 *
 * - **`?palette=groups`**: four labelled groups (Draw · Comment · Fill & sign · Change page),
 *   one open at a time, its tools in place (`task-groups.ts`).
 * - **`?palette=labels`**: today's row with a short label beside each tool, folding by width
 *   (the memo's layout B, a mock kept for the comparison).
 * - **`?palette=row`** goes back to the default.
 *
 * The choice is kept in `localStorage` (as `office/flag.ts`), so a reload or a later visit on the
 * same device keeps it; when storage is unavailable it lasts as long as the address carries it.
 * Read once per page.
 */
import { labsStored } from '../labs/stored';

export type PaletteVariant = 'row' | 'groups' | 'labels';

export const PALETTE_QUERY_PARAM = 'palette';
export const PALETTE_VARIANT_KEY = 'pdf-editor:palette:v1';

const isVariant = (value: string | null | undefined): value is PaletteVariant =>
  value === 'row' || value === 'groups' || value === 'labels';

/** Pure decision: the address's `?palette=…`, else the stored choice, else the row. */
export function decidePaletteVariant(search: string, stored: string | null): PaletteVariant {
  const asked = new URLSearchParams(search).get(PALETTE_QUERY_PARAM);
  if (isVariant(asked)) return asked;
  return isVariant(stored) ? stored : 'row';
}

let chosen: PaletteVariant | undefined;

/** The palette of this page, read once from the address and storage (and kept there). */
export function paletteVariant(): PaletteVariant {
  if (chosen !== undefined) return chosen;
  const asked = new URLSearchParams(location.search).get(PALETTE_QUERY_PARAM);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(PALETTE_VARIANT_KEY);
    if (asked === 'row') localStorage.removeItem(PALETTE_VARIANT_KEY);
    else if (isVariant(asked)) localStorage.setItem(PALETTE_VARIANT_KEY, asked);
  } catch {
    // Storage blocked (a private window, site data off): the address alone decides.
  }
  chosen = decidePaletteVariant(location.search, labsStored('palette', stored));
  return chosen;
}

/** Forgets the decision (tests). */
export function resetPaletteVariant(): void {
  chosen = undefined;
}
