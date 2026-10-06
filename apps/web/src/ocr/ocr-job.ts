/**
 * The OCR run as a background job (`08-feedback` FB5; spec recognize-and-compare §1.5; spec
 * redesign D0-5): while a run works, its progress shows in S10 (`OcrSheet.tsx`) when that is open on
 * the run's document (in place), else as the progress capsule in the toast stack, with Cancel,
 * and a click on the capsule opens the sheet again; a run that ends away from the sheet says so
 * in a toast with Review (spec X33, D2-9). It replaces the status bar's OCR text
 * (`OcrStatus`, removed).
 *
 * "Recognizing text: 3 of 12 pages", or, when the document changed under the run, "Recognizing
 * a changed page again: 0 of 1"; the language download and the preparation are indeterminate.
 */
import { type JobHandle, startJob } from '../jobs/job-store';
import { m } from '../i18n';
import { toast } from '../ui/Toast/toast';
import { pageProgress } from './labels';
import { showWordsToCheck } from './ocr-review';
import { cancelOcrRun, type OcrRun, openOcrDialog, useOcrStore } from './ocr-store';

type Running = Extract<OcrRun, { kind: 'running' }>;

/** The capsule's label for a running run. */
export function ocrJobLabel(run: Running): string {
  return run.phase === 'recheck'
    ? m.ocr_status_recheck(pageProgress(run))
    : m.ocr_status(pageProgress(run));
}

/** 0–100 while pages are being recognised, else unknown. */
function progressOf(run: Running): number | null {
  if ((run.phase !== 'recognize' && run.phase !== 'recheck') || run.total <= 0) return null;
  return (run.done / run.total) * 100;
}

/**
 * A run that finished away from S10: "2 pages recognized · 14 words to check" with Review,
 * which opens the sidebar's Review on Words to check (S10 §4, spec X33). With the sheet open on
 * the run's document its own result says it, so no toast.
 */
function toastDone(run: Extract<OcrRun, { kind: 'done' }>): void {
  const { dialog } = useOcrStore.getState();
  if (dialog !== null && dialog.view === 'run' && dialog.documentId === run.documentId) return;
  const { pages, lowConfidence } = run.result;
  toast.action(
    m.ocr_done_toast({ count: pages }),
    { label: m.ocr_review(), run: showWordsToCheck },
    {
      documentId: run.documentId,
      detail: lowConfidence > 0 ? m.ocr_done_toast_words({ count: lowConfidence }) : undefined,
      testId: 'ocr-done-toast',
    },
  );
}

/** Mirrors the OCR run into the job store while installed; returns the stop function. */
export function watchOcrJob(): () => void {
  let job: JobHandle | undefined;
  let was: OcrRun['kind'] = useOcrStore.getState().run.kind;
  const sync = () => {
    const { run, dialog } = useOcrStore.getState();
    const before = was;
    was = run.kind;
    if (run.kind !== 'running') {
      job?.finish();
      job = undefined;
      if (before === 'running' && run.kind === 'done') toastDone(run);
      return;
    }
    const inPlace =
      dialog !== null && dialog.view === 'run' && dialog.documentId === run.documentId;
    if (job === undefined) {
      const documentId = run.documentId;
      job = startJob({
        label: ocrJobLabel(run),
        progress: progressOf(run),
        documentId,
        cancel: cancelOcrRun,
        open: () => openOcrDialog(documentId),
        inPlace,
      });
      return;
    }
    job.update({ label: ocrJobLabel(run), progress: progressOf(run) });
    job.setInPlace(inPlace);
  };
  sync();
  const unsubscribe = useOcrStore.subscribe(sync);
  return () => {
    unsubscribe();
    job?.finish();
  };
}
