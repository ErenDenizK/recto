/**
 * The margin map's door (R26 wow concept 7, DSN-72): the flag, read once per page. Only this
 * file ships with the editor; the map itself (`MarginMap.tsx`) loads the first time it is on.
 *
 * - **Flag:** `?margin=1` turns it on, `?margin=0` off; the choice is kept in `localStorage`
 *   (`pdf-editor:margin:v1`), as the strip's is (`strip/strip-hold.ts`). Off by default.
 */
const QUERY_PARAM = 'margin';
const STORAGE_KEY = 'pdf-editor:margin:v1';

let enabled: boolean | undefined;

/** Whether the margin map is on for this page: the address, else the stored choice, else off. */
export function marginMapEnabled(): boolean {
  if (enabled !== undefined) return enabled;
  const asked = new URLSearchParams(location.search).get(QUERY_PARAM);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
    if (asked === '1') localStorage.setItem(STORAGE_KEY, '1');
    else if (asked === '0') localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the address alone decides.
  }
  enabled = asked === '1' || (asked !== '0' && stored === '1');
  return enabled;
}
