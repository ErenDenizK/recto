/**
 * The phone's single capsule flag (EDN-24, DSN-82): `?phonebar=1` turns the one-capsule bottom
 * bar on for this page load and `?phonebar=0` off; without the parameter the Labs toggle
 * (`phone-capsule`) decides; the default is off, so the shipped bar renders until the owner
 * tries it (PRC-25). Nothing is stored here.
 * Read once per page, as `top-variant.ts` does, so the bar never swaps under the reader.
 */
import { labsStored } from '../../labs/stored';

export const PHONE_CAPSULE_PARAM = 'phonebar';

/** Whether the single capsule shows for a query string and the Labs value: the address wins. */
export function decidePhoneCapsule(search: string, stored: string | null): boolean {
  const asked = new URLSearchParams(search).get(PHONE_CAPSULE_PARAM);
  if (asked === '1') return true;
  if (asked === '0') return false;
  return stored === '1';
}

let chosen: boolean | undefined;

/** Whether this page shows the single capsule, read once from the location and Labs. */
export function phoneCapsule(): boolean {
  chosen ??= decidePhoneCapsule(window.location.search, labsStored('phone-capsule', null));
  return chosen;
}

/** Tests: forget the value read. */
export function resetPhoneCapsule(): void {
  chosen = undefined;
}
