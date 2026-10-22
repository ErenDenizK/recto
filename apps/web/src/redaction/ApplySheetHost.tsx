/**
 * Mounts the Apply redactions sheet (S19, `ApplySheet.tsx`) once it first opens (PF-21, quality-bar
 * Q-11: sheets load on first use); its code loads then, outside the editor's initial bundle. The
 * sheet keeps its own mount from its first opening on (`opened`), so the host only waits for it.
 */
import { lazy, Suspense } from 'react';

import { useApplyDialogStore } from './apply-store';

const ApplyRedactionsSheet = lazy(() =>
  import('./ApplySheet').then((module) => ({ default: module.ApplyRedactionsSheet })),
);

export function ApplySheetHost() {
  const opened = useApplyDialogStore((s) => s.opened > 0);
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <ApplyRedactionsSheet />
    </Suspense>
  );
}
