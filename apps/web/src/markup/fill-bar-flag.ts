/**
 * The Fill & sign bar's flag (R28 tools-visibility prototype, DSN-75): read once per page.
 *
 * - **Flag:** `?fillbar=1` turns it on, `?fillbar=0` off; the choice is kept in `localStorage`
 *   (`pdf-editor:fillbar:v1`), as the margin map's is. Off by default: the Fill & sign door
 *   then opens the shared Markup palette on its Sign set, as before.
 */
const QUERY_PARAM = 'fillbar';
export const FILL_BAR_KEY = 'pdf-editor:fillbar:v1';

/** Pure decision: the address's `?fillbar=1|0`, else the stored choice, else off. */
export function decideFillBar(search: string, stored: string | null): boolean {
  const asked = new URLSearchParams(search).get(QUERY_PARAM);
  return asked === '1' || (asked !== '0' && stored === '1');
}

let enabled: boolean | undefined;

/** Whether the Fill & sign bar is on for this page (the address wins and is remembered). */
export function fillBarEnabled(): boolean {
  if (enabled !== undefined) return enabled;
  const asked = new URLSearchParams(location.search).get(QUERY_PARAM);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(FILL_BAR_KEY);
    if (asked === '1') localStorage.setItem(FILL_BAR_KEY, '1');
    else if (asked === '0') localStorage.removeItem(FILL_BAR_KEY);
  } catch {
    // Storage blocked: the address alone decides.
  }
  enabled = decideFillBar(location.search, stored);
  return enabled;
}

/** Whether the bar replaces the palette: the flag is on and the door is Fill & sign's. */
export function fillBarShows(door: 'draw' | 'sign'): boolean {
  return door === 'sign' && fillBarEnabled();
}

/** Forgets the decision (tests). */
export function resetFillBarFlag(): void {
  enabled = undefined;
}
