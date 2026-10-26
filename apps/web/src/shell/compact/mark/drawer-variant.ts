/**
 * Which tool drawer the phone shows (EDN-16): the floating tile drawer of the brief
 * (`design/phone-2026-10/README.md` §3, `ToolDrawer.tsx`), the default, or the owner's list
 * variant of 2026-10-11 (`ToolList.tsx`: one row per tool, a second tap opens its options under
 * it), to compare on an iPhone before one is chosen.
 *
 * - **`?drawer=list`** picks the list and **`?drawer=tiles`** the default; the choice is kept
 *   for the tab's session (`sessionStorage`), so a reload without the parameter keeps it, as
 *   `?edition` does (`shell/frame/edition.ts`). Storage that throws (a private window, blocked
 *   site data) only drops the keeping.
 * - Read once, when the editing chunk first asks.
 */
import { labsStored } from '../../../labs/stored';

export type DrawerVariant = 'tiles' | 'list';

export const DRAWER_QUERY_PARAM = 'drawer';
/** Session storage key of a `?drawer` choice (this tab only). */
export const DRAWER_SESSION_KEY = 'pdf-editor:drawer:v1';

const isVariant = (value: string | null | undefined): value is DrawerVariant =>
  value === 'tiles' || value === 'list';

/** The variant for a query string and what the session kept: the query wins, then the session. */
export function decideDrawerVariant(search: string, stored: string | null): DrawerVariant {
  const asked = new URLSearchParams(search).get(DRAWER_QUERY_PARAM);
  if (isVariant(asked)) return asked;
  return isVariant(stored) ? stored : 'tiles';
}

let chosen: DrawerVariant | undefined;

/** The variant of this tab, read once from the location and the session (and kept there). */
export function drawerVariant(): DrawerVariant {
  if (chosen !== undefined) return chosen;
  let storage: Storage | undefined;
  let stored: string | null;
  try {
    storage = window.sessionStorage;
    stored = storage.getItem(DRAWER_SESSION_KEY);
  } catch {
    stored = null;
  }
  const search = window.location.search;
  chosen = decideDrawerVariant(search, labsStored('drawer', stored));
  if (isVariant(new URLSearchParams(search).get(DRAWER_QUERY_PARAM))) {
    try {
      storage?.setItem(DRAWER_SESSION_KEY, chosen);
    } catch {
      // Not kept: this load still shows the asked variant.
    }
  }
  return chosen;
}
