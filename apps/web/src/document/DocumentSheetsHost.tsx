/**
 * Mounts the document-tools sheets (`DocumentSheets.tsx`) once one first opens (PF-21, quality-bar
 * Q-11: sheets load on first use); their code loads then, outside the editor's initial bundle.
 * They stay mounted afterwards, so a sheet plays its exit.
 */
import { lazy, Suspense, useState } from 'react';

import { useDocumentDialogStore } from './document-store';

const DocumentSheets = lazy(() =>
  import('./DocumentSheets').then((module) => ({ default: module.DocumentSheets })),
);

export function DocumentSheetsHost() {
  const open = useDocumentDialogStore((s) => s.dialog !== null);
  const [asked, setAsked] = useState(open);
  if (open && !asked) setAsked(true);
  if (!asked) return null;
  return (
    <Suspense fallback={null}>
      <DocumentSheets />
    </Suspense>
  );
}
