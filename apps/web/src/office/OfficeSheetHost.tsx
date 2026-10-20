/**
 * Mounts the Office conversion sheet (`OfficeSheet.tsx`) once an Office file first arrives;
 * its code (the flow, the download manager and the converter host) loads then, outside the
 * editor's initial chunks (PRC-11). It stays mounted afterwards, so the sheet plays its exit.
 */
import { lazy, Suspense, useState } from 'react';

import { useOfficeStore } from './office-store';

const OfficeSheet = lazy(() => import('./OfficeSheet'));

export function OfficeSheetHost() {
  const open = useOfficeStore((s) => s.files !== null);
  const [asked, setAsked] = useState(open);
  if (open && !asked) setAsked(true);
  if (!asked) return null;
  return (
    <Suspense fallback={null}>
      <OfficeSheet />
    </Suspense>
  );
}
