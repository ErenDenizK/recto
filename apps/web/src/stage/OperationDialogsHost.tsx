/**
 * Mounts the page-structure sheets and the crop dialog (`OperationDialogs.tsx`) once one first
 * opens (PF-21, quality-bar Q-11: sheets load on first use); their code loads then, outside the
 * editor's initial bundle. They stay mounted afterwards, so a sheet plays its exit. The crop
 * drawing hint stays here, as it shows while the dialog is hidden for drawing.
 */
import { lazy, Suspense, useState } from 'react';

import { CropDrawBanner } from '../crop';
import { useOperationDialogStore } from './operation-dialogs-store';

const OperationDialogs = lazy(() => import('./OperationDialogs'));

export function OperationDialogsHost() {
  const open = useOperationDialogStore((s) => s.dialog !== null);
  const [asked, setAsked] = useState(open);
  if (open && !asked) setAsked(true);
  return (
    <>
      {asked ? (
        <Suspense fallback={null}>
          <OperationDialogs />
        </Suspense>
      ) : null}
      <CropDrawBanner />
    </>
  );
}
