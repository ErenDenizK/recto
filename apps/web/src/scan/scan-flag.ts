/**
 * The camera scan's flag (big move 1, plan bm-scan-plan §3 "Flag"; PRD-32, PRC-25): `?scan=1`
 * turns it on for this page load, like `shell/frame/tools-flag.ts`. Off by default and nothing is
 * stored, so a reload without the address parameter is the shipped app. Off, no button, no
 * command and no code loads.
 *
 * This file is in the initial chunk (the Library button and the command read it), so it stays
 * tiny: the sheet, the camera and the worker come in with `import()` when a scan starts.
 */
export function scanEnabled(): boolean {
  return new URLSearchParams(location.search).get('scan') === '1';
}

/** Opens the scan sheet, loading its chunk on the first call (Q-11: sheets load on first use). */
export function openScan(): Promise<void> {
  return import('./mount').then((module) => module.mountScan());
}
