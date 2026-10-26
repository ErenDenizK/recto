/**
 * The feature flag for on-device Office conversion (ADR-0035 §6), off by default until phase 2:
 * `?office=1` turns it on for this browser and `?office=0` turns it off again. The choice is
 * kept in `localStorage`, so the reload into cross-origin isolation (and later visits) keep
 * it; when storage is unavailable it lasts as long as the address carries it.
 */
import { labsStored } from '../labs/stored';

export const OFFICE_FLAG_PARAM = 'office';
export const OFFICE_FLAG_KEY = 'pdf-editor:office:v1';
/** Session key of the one reload into cross-origin isolation (`isolation.ts`). */
export const OFFICE_RELOAD_KEY = 'pdf-editor:office-reload:v1';

/** Pure decision: the address's `?office=1|0`, else the stored choice, else off. */
export function decideOfficeFlag(search: string, stored: string | null): boolean {
  const value = new URLSearchParams(search).get(OFFICE_FLAG_PARAM);
  if (value === '1') return true;
  if (value === '0') return false;
  return stored === '1';
}

let decided: boolean | undefined;

/** Whether Office conversion is on in this browser. Read once per page; the address wins. */
export function officeEnabled(): boolean {
  if (decided !== undefined) return decided;
  const value = new URLSearchParams(location.search).get(OFFICE_FLAG_PARAM);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(OFFICE_FLAG_KEY);
    if (value === '1') localStorage.setItem(OFFICE_FLAG_KEY, '1');
    else if (value === '0') localStorage.removeItem(OFFICE_FLAG_KEY);
  } catch {
    // Storage blocked (a private window, site data off): the address alone decides.
  }
  decided = decideOfficeFlag(location.search, labsStored('office', stored));
  return decided;
}

/** Forgets the decision (tests). */
export function resetOfficeFlag(): void {
  decided = undefined;
}
