/**
 * The phone's way into the camera scan (EDN-22, EDN-23; big move 1, PRD-34): a Scan button in the
 * Library's dock when `?scan=1` is on and the device reports a camera, and the host that loads the
 * phone's scan sheet (`PhoneScanSheet.tsx`) on its first opening. This file is in the phone's
 * first load, so it stays a stub: the flag check, the camera check and one `import()`; the sheet,
 * the camera plumbing, the worker and the warp load only when Scan is pressed (PF-23).
 */
import { useEffect, useState } from 'react';

import { m } from '../../../i18n';
import { openScan, scanEnabled, setScanOpen, useScanOpen } from '../../../scan/scan-flag';
import { Icon } from '../../../ui/Icon';
import { createSheetHost } from '../../../ui/sheet-host';
import controls from '../controls.module.css';

/** Whether the device reports a camera (plan §3 "Visibility"). */
async function hasCamera(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === 'videoinput');
  } catch {
    return false;
  }
}

/** The Library dock's Scan button; nothing without the flag or a camera. */
export function ScanButton() {
  const [camera, setCamera] = useState(false);
  useEffect(() => {
    if (!scanEnabled()) return undefined;
    let gone = false;
    void hasCamera().then((found) => {
      if (!gone) setCamera(found);
    });
    return () => {
      gone = true;
    };
  }, []);
  if (!camera) return null;
  return (
    // The dock's own control, beside Open PDF (`CompactLibrary`); `ui/Button` stays out of the first load.
    // eslint-disable-next-line recto/q9-controls
    <button type="button" className={controls.text} data-testid="compact-scan" onClick={openScan}>
      <Icon name="scan" />
      {m.scan_button()}
    </button>
  );
}

/** Mounts the phone's scan sheet once it first opens; it stays mounted afterwards. */
export const PhoneScanHost = createSheetHost(
  () => import('./PhoneScanSheet').then((module) => ({ default: module.PhoneScanSheet })),
  useScanOpen,
  () => setScanOpen(false),
);
