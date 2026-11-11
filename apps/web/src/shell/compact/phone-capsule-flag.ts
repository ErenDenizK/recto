/**
 * The phone's single capsule flag (EDN-24, EDN-29, DSN-82): the one-capsule bottom bar is the
 * default; `?phonebar=0` brings the shipped drawer and capsule back for this page load (kept one
 * wave, EDN-29) and `?phonebar=1` is the default spelled out. Nothing is stored here, and the
 * Labs toggle (`phone-capsule`) no longer decides: it goes with the closing step.
 * Read once per page, as `top-variant.ts` does, so the bar never swaps under the reader.
 */
export const PHONE_CAPSULE_PARAM = 'phonebar';

/** Whether the single capsule shows for a query string: on unless the address says `0`. */
export function decidePhoneCapsule(search: string): boolean {
  return new URLSearchParams(search).get(PHONE_CAPSULE_PARAM) !== '0';
}

let chosen: boolean | undefined;

/** Whether this page shows the single capsule, read once from the location. */
export function phoneCapsule(): boolean {
  chosen ??= decidePhoneCapsule(window.location.search);
  return chosen;
}

/** Tests: forget the value read. */
export function resetPhoneCapsule(): void {
  chosen = undefined;
}
