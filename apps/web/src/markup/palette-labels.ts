/**
 * The Markup palette's labels that bloom (R26 wow concept 6, DSN-71; a prototype behind
 * `?labels=1`): the capsule briefly grows by a label line, each icon shows its name, then it
 * settles back to icons only. Touch has no hover tooltips, so on a tablet the ~20 unlabelled
 * icons were guesswork; this borrows height for a moment instead of width (DSN-59).
 *
 * - **Flag**: `?labels=1` on, `?labels=0` off, kept in `localStorage` (`pdf-editor:labels:v1`,
 *   as `office/flag.ts` and `palette-variant.ts`); off by default. Read once per page.
 * - **When**: on the first open of Markup and when the person reaches for the palette, during
 *   the first two sessions only; after that only on a press and hold. A session is a page load
 *   that opened the palette with the flag on, counted in `pdf-editor:labels-sessions:v1`.
 *
 * This file is the small, eager part (the palette reads the flag); the bloom itself is
 * `PaletteBloom.tsx`, loaded only when the flag is on.
 */

export const LABELS_QUERY_PARAM = 'labels';
export const LABELS_FLAG_KEY = 'pdf-editor:labels:v1';
export const LABELS_SESSIONS_KEY = 'pdf-editor:labels-sessions:v1';

/** Sessions that bloom by themselves; later ones need a press and hold. */
export const AUTO_SESSIONS = 2;
/** How long a press is held before it asks for the labels (a touch hold is 500 ms elsewhere). */
export const HOLD_MS = 650;
/** How long the labels stay up before the capsule settles. */
export const SHOWN_MS = 2600;
/** How long the labels fade before the capsule shrinks back. */
export const FADE_MS = 200;
/** An automatic bloom for a reach is not repeated sooner than this. */
export const REACH_QUIET_MS = 20_000;

/** Pure decision: the address's `?labels=1|0`, else the stored choice, else off. */
export function decideLabelsFlag(search: string, stored: string | null): boolean {
  const value = new URLSearchParams(search).get(LABELS_QUERY_PARAM);
  if (value === '1') return true;
  if (value === '0') return false;
  return stored === '1';
}

/** The session number after this one: the stored count plus one (a bad value counts as none). */
export function nextSessionCount(stored: string | null): number {
  const n = Number.parseInt(stored ?? '', 10);
  return (Number.isFinite(n) && n > 0 ? n : 0) + 1;
}

/** Whether session number `session` (1-based) blooms without being asked. */
export function autoBloomSession(session: number): boolean {
  return session <= AUTO_SESSIONS;
}

let decided: boolean | undefined;

/** Whether the bloom is on in this browser. Read once per page; the address wins. */
export function labelsEnabled(): boolean {
  if (decided !== undefined) return decided;
  const value = new URLSearchParams(location.search).get(LABELS_QUERY_PARAM);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LABELS_FLAG_KEY);
    if (value === '1') localStorage.setItem(LABELS_FLAG_KEY, '1');
    else if (value === '0') localStorage.removeItem(LABELS_FLAG_KEY);
  } catch {
    // Storage blocked: the address alone decides.
  }
  decided = decideLabelsFlag(location.search, stored);
  return decided;
}

let session: number | undefined;

/** This page's session number, counted once per page load (1 when storage is unavailable). */
export function labelsSession(): number {
  if (session !== undefined) return session;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LABELS_SESSIONS_KEY);
  } catch {
    // Storage blocked.
  }
  session = nextSessionCount(stored);
  try {
    localStorage.setItem(LABELS_SESSIONS_KEY, String(session));
  } catch {
    // Storage blocked.
  }
  return session;
}

/** Forgets the decisions of this page (tests). */
export function resetPaletteLabels(): void {
  decided = undefined;
  session = undefined;
}
