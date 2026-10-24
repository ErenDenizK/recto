/**
 * The dock's Tools entry flag (R28 tools-visibility prototype, DSN-76): `?tools=1` turns it on
 * for this page load. Off by default, and nothing is stored, so a reload without the address
 * parameter is the shipped dock (PRC-25: visible changes wait behind a flag until the owner
 * tries them on the iPad).
 */
export function toolsEntryEnabled(): boolean {
  return new URLSearchParams(location.search).get('tools') === '1';
}
