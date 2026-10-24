/**
 * The Library's flags, read like the Office flag (`office/flag.ts`): `?open=page` (Epic 3,
 * 3a: opening one file from the Library goes to its page, until board question 1 is answered)
 * `?open=light` (R26 concept 2, DSN-64), `?home=search` (3d: Recents search and sort, until the design
 * director has seen it) and `?home=continue` (3b, 3c and R26 concept 4: the Continue card, progress on
 * the cards and exact resume, DSN-66).
 * Each flag has its own word; `?open=0` and `?home=0` turn it off again. The choice is kept in
 * `localStorage`; when storage is unavailable it lasts as long as the address carries it.
 */
export interface HomeFlag {
  readonly param: string;
  readonly on: string;
  readonly key: string;
}

export const OPEN_PAGE_FLAG: HomeFlag = {
  param: 'open',
  on: 'page',
  key: 'pdf-editor:open-page:v1',
};
/** R26 concept 2, DSN-64: the open moment (`library-transition.ts` `openInLight`). */
export const OPEN_LIGHT_FLAG: HomeFlag = {
  param: 'open',
  on: 'light',
  key: 'pdf-editor:open-light:v1',
};
export const HOME_SEARCH_FLAG: HomeFlag = {
  param: 'home',
  on: 'search',
  key: 'pdf-editor:home-search:v1',
};

export const HOME_CONTINUE_FLAG: HomeFlag = {
  param: 'home',
  on: 'continue',
  key: 'pdf-editor:home-continue:v1',
};

/** Pure decision: the address's `?param=on|0`, else the stored choice, else off. */
export function decideHomeFlag(flag: HomeFlag, search: string, stored: string | null): boolean {
  const value = new URLSearchParams(search).get(flag.param);
  if (value === flag.on) return true;
  if (value === '0') return false;
  return stored === '1';
}

/** Whether `flag` is on in this browser; the address wins and is remembered. */
export function homeFlagEnabled(flag: HomeFlag): boolean {
  const value = new URLSearchParams(location.search).get(flag.param);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(flag.key);
    if (value === flag.on) localStorage.setItem(flag.key, '1');
    else if (value === '0') localStorage.removeItem(flag.key);
  } catch {
    // Storage blocked: the address alone decides.
  }
  return decideHomeFlag(flag, location.search, stored);
}
