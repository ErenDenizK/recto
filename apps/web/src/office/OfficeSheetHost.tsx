/**
 * Mounts the Office conversion sheet (`OfficeSheet.tsx`) once an Office file first arrives;
 * its code (the flow, the download manager and the converter host) loads then, outside the
 * editor's initial chunks (PRC-11). It stays mounted afterwards, so the sheet plays its exit.
 */
import { createSheetHost } from '../ui/sheet-host';
import { closeOffice, useOfficeStore } from './office-store';

export const OfficeSheetHost = createSheetHost(
  () => import('./OfficeSheet'),
  () => useOfficeStore((s) => s.files !== null),
  closeOffice,
);
