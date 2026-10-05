/**
 * Where Save a copy lives in the shell (components/07-sheets.md §4; quality-bar Q-11 "sheets
 * load on first use"): the sheet's code, the compress worker and the converters load the first
 * time `openSaveCopy` opens it. The last document stays mounted while the sheet animates
 * closed, and its draft stays in `sheet-store` for the session.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { lazy, Suspense } from 'react';

import { useRetained } from '../ui/use-retained';
import { useSheetOpen } from '../ui/sheet/sheet-store';
import { SAVE_COPY_SHEET } from './export-store';

const SaveCopySheet = lazy(() => import('./SaveCopySheet'));

export function SaveCopyHost() {
  const open = useSheetOpen(SAVE_COPY_SHEET);
  const [shown] = useRetained(open);
  if (!shown?.docId) return null;
  const documentId = shown.docId as DocumentId;
  return (
    <Suspense fallback={null}>
      <SaveCopySheet
        key={documentId}
        documentId={documentId}
        open={open !== null && open.docId === shown.docId}
        preset={shown.preset}
        opening={open}
      />
    </Suspense>
  );
}
