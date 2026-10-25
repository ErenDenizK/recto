/**
 * The glass scroll bar's door (R29 study, GLS-26 amendment; a prototype): the flag, read once per
 * page. Only this file and a few lines of `scroll-thumbs.ts` ship with the editor; option B's
 * ruler and card (`scroll-glass.tsx`) and the reader's section map (`stage/scroll-map.ts`) load
 * the first time it is on.
 *
 * - **Flag:** `?scroll=glass-a` (the glass jog rail; `?scroll=glass` is the same) or
 *   `?scroll=glass-b` (the contents ruler) turns it on, `?scroll=0` off; the choice is kept in
 *   `localStorage` (`pdf-editor:scroll:v1`), as the margin map's is (`margin-map-flag.ts`), so
 *   the owner can pick on the iPad once. Off by default: today's bar is unchanged.
 */
export type ScrollGlassStyle = 'glass-a' | 'glass-b';

const QUERY_PARAM = 'scroll';
const STORAGE_KEY = 'pdf-editor:scroll:v1';

/** A flag value as a style: `null` for anything else (including the off value). */
export function parseScrollStyle(value: string | null): ScrollGlassStyle | null {
  if (value === 'glass-a' || value === 'glass') return 'glass-a';
  return value === 'glass-b' ? 'glass-b' : null;
}

let style: ScrollGlassStyle | null | undefined;

/** The glass style for this page: the address, else the stored choice, else off. */
export function scrollGlassStyle(): ScrollGlassStyle | null {
  if (style !== undefined) return style;
  const asked = new URLSearchParams(location.search).get(QUERY_PARAM);
  const chosen = parseScrollStyle(asked);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
    if (chosen) localStorage.setItem(STORAGE_KEY, chosen);
    else if (asked === '0') localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the address alone decides.
  }
  style = chosen ?? (asked === '0' ? null : parseScrollStyle(stored));
  return style;
}

/** Forgets the cached answer (tests change the address between cases). */
export function resetScrollGlassStyle(): void {
  style = undefined;
}
