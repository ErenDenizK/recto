/**
 * The dock's Tools entry flag (R28 tools-visibility prototype, DSN-76): `?tools=1` turns it on
 * for this page load. Off by default, and nothing is stored, so a reload without the address
 * parameter is the shipped dock (PRC-25: visible changes wait behind a flag until the owner
 * tries them on the iPad). The Labs toggle (DSN-82) turns it on when the address says nothing.
 */
import { labsStored } from '../../labs/stored';

export function toolsEntryEnabled(): boolean {
  const asked = new URLSearchParams(location.search).get('tools');
  return asked === null ? labsStored('tools', null) === '1' : asked === '1';
}
