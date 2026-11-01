/**
 * The desk's flag (DSN-87, Masa; PRC-25): the new Home on desktop and tablet stays behind Labs'
 * "Desk (new Home)" until the owner says yes. `?desk=1` turns it on for this page load and
 * `?desk=0` off; with no address word the Labs toggle decides (DSN-82). Off, Home is today's
 * Library. On, the Continue card's behaviour is on too (`home-flags.ts`).
 *
 * Tiny and dependency-free: `LibraryView` and `home-flags.ts` read it in the first chunk, and
 * the desk itself loads only when it is on.
 */
import { labsStored } from '../labs/stored';

export function deskEnabled(): boolean {
  const asked = new URLSearchParams(location.search).get('desk');
  return asked === null ? labsStored('desk', null) === '1' : asked === '1';
}
