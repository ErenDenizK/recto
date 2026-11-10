/**
 * The desk (DSN-87, Masa) is Home (DSN-93): its Labs flag retired, so this always answers yes.
 * It stays for the two callers outside `home/` (the session's restore and the command list) that
 * still ask; the Home code itself no longer does.
 */
export function deskEnabled(): boolean {
  return true;
}
