/**
 * Mounts the scan sheet (`ScanSheet.tsx`) in the shell once it first opens, so its code, the
 * camera plumbing and the worker stay out of the initial chunks (PRC-11, Q-11). It stays mounted
 * afterwards, so the sheet plays its exit.
 */
import { createSheetHost } from '../ui/sheet-host';
import { setScanOpen, useScanOpen } from './scan-flag';

export const ScanSheetHost = createSheetHost(
  () => import('./ScanSheet').then((module) => ({ default: module.ScanSheet })),
  useScanOpen,
  () => setScanOpen(false),
);
