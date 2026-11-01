/**
 * The Text view flag (PRD-36, EDN-26): `?textview=1` turns the phone's Text view on for this
 * page load and `?textview=0` off; without the parameter the Labs toggle (`text-view`) decides;
 * the default is off (PRC-25). Nothing is stored here. Read once per page, as
 * `phone-capsule-flag.ts` does, so the title menu never gains or loses the row under the reader.
 * One of the few pieces of the Text view that are static in the phone session (EDN-26): it
 * imports only `labs/stored`.
 */
import { labsStored } from '../labs/stored';

export const TEXT_VIEW_PARAM = 'textview';

/** Whether the Text view is on for a query string and the Labs value: the address wins. */
export function decideTextView(search: string, stored: string | null): boolean {
  const asked = new URLSearchParams(search).get(TEXT_VIEW_PARAM);
  return (asked === '1' || asked === '0' ? asked : stored) === '1';
}

let chosen: boolean | undefined;

/** Whether this page offers the Text view, read once from the location and Labs. */
export function textViewOn(): boolean {
  chosen ??= decideTextView(window.location.search, labsStored('text-view', null));
  return chosen;
}

/** Tests: forget the value read. */
export function resetTextViewFlag(): void {
  chosen = undefined;
}
