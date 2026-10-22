/**
 * Mounts the Apply redactions sheet (S19, `ApplySheet.tsx`) once it first opens (PF-21, quality-bar
 * Q-11: sheets load on first use); its code loads then, outside the editor's initial bundle. The
 * sheet keeps its own mount from its first opening on (`opened`). A failed load forgets that
 * opening, so the next one asks again.
 */
import { createSheetHost } from '../ui/sheet-host';
import { useApplyDialogStore } from './apply-store';

export const ApplySheetHost = createSheetHost(
  () => import('./ApplySheet').then((module) => ({ default: module.ApplyRedactionsSheet })),
  () => useApplyDialogStore((s) => s.opened > 0),
  () => useApplyDialogStore.setState({ open: false, opened: 0 }),
);
