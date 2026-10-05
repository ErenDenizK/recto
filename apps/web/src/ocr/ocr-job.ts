/**
 * The OCR run as a background job (`08-feedback` FB5; spec recognize-and-compare §1.5; spec
 * redesign D0-5): while a run works, its progress shows in the OCR dialog when that is open on
 * the run's document (in place), else as the progress capsule in the toast stack, with Cancel,
 * and a click on the capsule opens the dialog again. It replaces the status bar's OCR text
 * (`OcrStatus`, removed).
 *
 * "Recognizing text: 3 of 12 pages", or, when the document changed under the run, "Recognizing
 * a changed page again: 0 of 1"; the language download and the preparation are indeterminate.
 */
import { type JobHandle, startJob } from '../jobs/job-store';
import { m } from '../i18n';
import { pageProgress } from './labels';
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

/** Mirrors the OCR run into the job store while installed; returns the stop function. */
export function watchOcrJob(): () => void {
  let job: JobHandle | undefined;
  const sync = () => {
    const { run, dialog } = useOcrStore.getState();
    if (run.kind !== 'running') {
      job?.finish();
      job = undefined;
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
