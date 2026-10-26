/**
 * Which top the phone reader shows: the **split** top after iOS Preview, the default since the
 * owner chose it (DSN-37; `docs/design/reference/ios-preview-2026-10.md`): Back and ⋯ as glass
 * circles of their own, the title as text over a scroll-edge fade; or the floating glass capsule
 * of DSN-32, kept behind `?top=capsule` (DSN-34).
 *
 * - **`?top=capsule`** picks the capsule top and **`?top=split`** the default; the choice is kept
 *   for the tab's session (`sessionStorage`), so a reload without the parameter keeps it, as
 *   `?drawer` does (`mark/drawer-variant.ts`). Storage that throws (a private window, blocked
 *   site data) only drops the keeping.
 * - Read once, when the reader's top first asks.
 */
import { labsStored } from '../../labs/stored';

export type TopVariant = 'capsule' | 'split';

export const TOP_QUERY_PARAM = 'top';
/** Session storage key of a `?top` choice (this tab only). */
export const TOP_SESSION_KEY = 'pdf-editor:top:v1';

const isVariant = (value: string | null | undefined): value is TopVariant =>
  value === 'capsule' || value === 'split';

/** The variant for a query string and what the session kept: the query wins, then the session. */
export function decideTopVariant(search: string, stored: string | null): TopVariant {
  const asked = new URLSearchParams(search).get(TOP_QUERY_PARAM);
  if (isVariant(asked)) return asked;
  return isVariant(stored) ? stored : 'split';
}

let chosen: TopVariant | undefined;

/** The variant of this tab, read once from the location and the session (and kept there). */
export function topVariant(): TopVariant {
  if (chosen !== undefined) return chosen;
  let storage: Storage | undefined;
  let stored: string | null;
  try {
    storage = window.sessionStorage;
    stored = storage.getItem(TOP_SESSION_KEY);
  } catch {
    stored = null;
  }
  const search = window.location.search;
  chosen = decideTopVariant(search, labsStored('top', stored));
  if (isVariant(new URLSearchParams(search).get(TOP_QUERY_PARAM))) {
    try {
      storage?.setItem(TOP_SESSION_KEY, chosen);
    } catch {
      // Not kept: this load still shows the asked variant.
    }
  }
  return chosen;
}

/** Tests: forget the variant read. */
export function resetTopVariant(): void {
  chosen = undefined;
}
