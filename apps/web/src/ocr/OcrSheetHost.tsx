/**
 * Mounts S10 (`OcrSheet.tsx`) once it is first asked for; its code (and the engine helpers it
 * uses) loads then, outside the entry chunk. tesseract.js loads later still, on the first run.
 * It stays mounted afterwards, so the sheet plays its exit and keeps the form's choices for the
 * session (07-sheets §2.5).
 */
import { lazy, Suspense, useState } from 'react';

import { useOcrStore } from './ocr-store';

const OcrSheet = lazy(() => import('./OcrSheet'));

export function OcrSheetHost() {
  const open = useOcrStore((s) => s.dialog !== null);
  const [asked, setAsked] = useState(open);
  if (open && !asked) setAsked(true);
  if (!asked) return null;
  return (
    <Suspense fallback={null}>
      <OcrSheet />
    </Suspense>
  );
}
