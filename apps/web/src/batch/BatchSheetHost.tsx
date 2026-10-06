/**
 * Mounts S21 (`BatchSheet.tsx`) once it is first asked for; its code (and the runner, the
 * recipe editor and the storage) loads then, outside the entry chunk. It stays mounted
 * afterwards so the sheet plays its exit; each opening starts a new flow.
 */
import { lazy, Suspense, useState } from 'react';

import { useBatchStore } from './batch-store';

const BatchSheet = lazy(() => import('./BatchSheet'));

export function BatchSheetHost() {
  const open = useBatchStore((s) => s.open);
  const [asked, setAsked] = useState(open);
  if (open && !asked) setAsked(true);
  if (!asked) return null;
  return (
    <Suspense fallback={null}>
      <BatchSheet />
    </Suspense>
  );
}
