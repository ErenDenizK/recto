/**
 * The camera scan's flag (big move 1, plan bm-scan-plan §3 "Flag"; PRD-34, PRC-25): `?scan=1`
 * turns it on for this page load, like `shell/frame/tools-flag.ts`. Off by default and nothing is
 * stored, so a reload without the address parameter is the shipped app. Off, no button, no
 * command and no code loads.
 *
 * This file is in the initial chunk (the Library button, the command and `AppShell`'s host read
 * it), so it stays tiny: whether the sheet is open lives here, and the sheet, the camera and the
 * worker load (`ScanSheetHost`, `createSheetHost`) when it first opens.
 */
import { useSyncExternalStore } from 'react';

import { labsStored } from '../labs/stored';

/** On by `?scan=1`, off by `?scan=0`; with no address word, the Labs toggle decides (DSN-82). */
export function scanEnabled(): boolean {
  const asked = new URLSearchParams(location.search).get('scan');
  return asked === null ? labsStored('scan', null) === '1' : asked === '1';
}

let open = false;
const listeners = new Set<() => void>();

export function setScanOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

/** Opens the scan sheet; its host loads the chunk on the first call. */
export function openScan(): void {
  setScanOpen(true);
}

/** Whether the sheet is open now (for code outside React and for tests). */
export const scanOpenNow = () => open;

export function useScanOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
  );
}
