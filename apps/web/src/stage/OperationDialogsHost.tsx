/**
 * Mounts the page-structure sheets and the crop dialog (`OperationDialogs.tsx`) once one first
 * opens (PF-21, quality-bar Q-11: sheets load on first use); their code loads then, outside the
 * editor's initial bundle. They stay mounted afterwards, so a sheet plays its exit. The crop
 * drawing hint stays here, as it shows while the dialog is hidden for drawing. A failed load
 * closes the request, so a pending image-sizing question resolves as cancelled.
 */
import { CropDrawBanner } from '../crop';
import { createSheetHost } from '../ui/sheet-host';
import { closeOperationDialog, useOperationDialogStore } from './operation-dialogs-store';

const Dialogs = createSheetHost(
  () => import('./OperationDialogs'),
  () => useOperationDialogStore((s) => s.dialog !== null),
  closeOperationDialog,
);

export function OperationDialogsHost() {
  return (
    <>
      <Dialogs />
      <CropDrawBanner />
    </>
  );
}
