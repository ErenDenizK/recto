/**
 * Mounts New signature (S7) on first use (quality-bar Q-11: sheets load on first use), as
 * `settings/SettingsHost.tsx` does for Settings: the sheet's code stays out of the entry chunk
 * until it first opens, then stays mounted so it can animate out and in again.
 */
import { lazy, Suspense } from 'react';

import { useSheetOpen, useSheetStore } from '../ui/sheet';
import { NEW_SIGNATURE_SHEET_ID } from './new-signature';

const NewSignatureSheet = lazy(() => import('./NewSignatureSheet'));

let requested = useSheetStore.getState().open?.id === NEW_SIGNATURE_SHEET_ID;
useSheetStore.subscribe((state) => {
  if (state.open?.id === NEW_SIGNATURE_SHEET_ID) requested = true;
});

export function NewSignatureHost() {
  // Re-renders when New signature opens; `requested` then holds.
  const open = useSheetOpen(NEW_SIGNATURE_SHEET_ID);
  if (!open && !requested) return null;
  return (
    <Suspense fallback={null}>
      <NewSignatureSheet />
    </Suspense>
  );
}
