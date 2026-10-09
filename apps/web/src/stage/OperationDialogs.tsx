/**
 * The page-structure sheets (`components/07-sheets.md` S13–S18; spec D2-5) and the crop dialog,
 * hosted once in the app: S13 Split (a tool sheet over the Pages grid), S14 Interleave, S15
 * Combine with open documents, S16 Extract pages, S17 Resize pages and S18 Insert images as
 * pages, each on the Sheet primitive (`ui/sheet`) with its presentation by size class, its draft
 * kept per document for the session, and its guard (07 §1.1). They replace M8's operation
 * dialogs; Merge into… is gone (the Pages grid's All open moves pages between documents, 07
 * §25) and Combine has one outcome, a new document with its sources kept (INV-12).
 *
 * Crop pages (S12) is a task sheet too (`crop/CropDialog.tsx`).
 *
 * `operation-dialogs-store.ts` says which one is open; each sheet stays mounted with the last
 * subject it was opened for, so it can animate closed (the Sheet primitive's exit).
 */
import { useState } from 'react';

import { CropDialog, CropDrawBanner } from '../crop';
import { CombineSheet } from '../pages-sheets/CombineSheet';
import { ExtractSheet } from '../pages-sheets/ExtractSheet';
import { InsertImagesSheet } from '../pages-sheets/InsertImagesSheet';
import { InterleaveSheet } from '../pages-sheets/InterleaveSheet';
import { SplitSheet } from '../pages-sheets/SplitSheet';
import {
  answerImageSizing,
  closeOperationDialog,
  type OperationDialog,
  useOperationDialogStore,
} from './operation-dialogs-store';
import { ResizeDialog } from './ResizeDialog';

type Of<K extends OperationDialog['kind']> = Extract<OperationDialog, { kind: K }>;

/** The last subject each sheet was opened for, so a closing sheet still has one. */
type Last = { readonly [K in OperationDialog['kind']]?: Of<K> };

function useLastOfEach(dialog: OperationDialog | null): Last {
  const [last, setLast] = useState<Last>({});
  if (dialog !== null && last[dialog.kind] !== dialog) setLast({ ...last, [dialog.kind]: dialog });
  return dialog === null ? last : { ...last, [dialog.kind]: dialog };
}

export function OperationDialogs() {
  const dialog = useOperationDialogStore((s) => s.dialog);
  const last = useLastOfEach(dialog);
  const close = () => closeOperationDialog();
  const showing = dialog?.kind;
  const resize = last.resize;
  const images = last['image-size'];
  return (
    <>
      <CropHost dialog={dialog?.kind === 'crop' ? dialog : null} />
      <SplitSheet
        documentId={last.split?.documentId ?? null}
        open={showing === 'split'}
        onClose={close}
      />
      <InterleaveSheet
        documentId={last.interleave?.documentId ?? null}
        open={showing === 'interleave'}
        onClose={close}
      />
      <CombineSheet given={last.combine?.order} open={showing === 'combine'} onClose={close} />
      <ExtractSheet
        pageIds={last.extract?.pageIds ?? []}
        open={showing === 'extract'}
        onClose={close}
      />
      {resize ? (
        <ResizeDialog
          key={`${resize.documentId}:${resize.pageIds.join(',')}`}
          documentId={resize.documentId}
          pageIds={resize.pageIds}
          open={showing === 'resize'}
          onClose={close}
        />
      ) : null}
      {images ? (
        <InsertImagesSheet
          count={images.count}
          largest={images.largest}
          open={showing === 'image-size'}
          onAnswer={answerImageSizing}
          onClose={close}
        />
      ) : null}
    </>
  );
}

/**
 * Crop pages (S12) on the Sheet primitive. Each opening mounts the sheet afresh (its key counts
 * the openings), so it starts from the page's crop or the drawing it resumes, as M8's dialog
 * did; between openings the last subject keeps it mounted while it animates closed.
 */
function CropHost({ dialog }: { readonly dialog: Of<'crop'> | null }) {
  const open = dialog !== null;
  const [last, setLast] = useState<Of<'crop'> | null>(dialog);
  const [opens, setOpens] = useState(open ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (dialog !== null && dialog !== last) setLast(dialog);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpens(opens + 1);
  }
  const shown = dialog ?? last;
  return (
    <>
      {shown === null ? null : (
        <CropDialog
          key={`${shown.documentId}:${opens}`}
          documentId={shown.documentId}
          pageIds={shown.pageIds}
          open={open}
        />
      )}
      <CropDrawBanner />
    </>
  );
}
