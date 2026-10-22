/**
 * Print… (PRD-25; epics-r25 Epic 5; `docs/research/print-2026-10.md`): prints the document as
 * Save a copy would write it (marks, form values and applied redactions in), loaded on demand
 * from `file.print` so none of it is in the first bundle.
 *
 * - **The bytes** are Save a copy's (`buildCopy` in `save-copy-run.ts`): assembled, re-opened
 *   and checked on this device; a copy that fails its checks is not printed.
 * - **A job** (`jobs/job-store.ts`): "Preparing to print… 40 %" in the toast stack past 400 ms,
 *   Cancel stops at the next page. The browser's print dialog is the end of the job.
 * - **The method** (`print-method.ts`): the PDF in a hidden frame where the browser prints PDFs
 *   itself; else, or when the frame cannot print, the pages rendered at `printDpi` into a
 *   print-only sheet and `window.print()`. Each print replaces the previous frame or sheet;
 *   the sheet also leaves on `afterprint`.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { m } from '../i18n';
import { finishJob, startJob } from '../jobs/job-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { openScratch, toolRenderer } from '../tools/engine-access';
import { toast } from '../ui/Toast/toast';
import { choosePrintMethod, printDpi, printEnvironment } from './print-method';
import styles from './print.module.css';
import { buildCopy, CopyError } from './save-copy-run';
import { percentOf } from './save-copy-model';

/** What the last print left in the page (its frame or sheet, and their object URLs). */
let leftover: { readonly element: HTMLElement; readonly urls: readonly string[] } | undefined;

function clearLeftover(): void {
  if (!leftover) return;
  leftover.element.remove();
  for (const url of leftover.urls) URL.revokeObjectURL(url);
  leftover = undefined;
}

/** Prints `blob` through the browser's PDF viewer in a hidden frame; throws if it cannot. */
async function printInFrame(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.className = styles.frame ?? '';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.dataset.print = 'frame';
  leftover = { element: frame, urls: [url] };
  await new Promise<void>((resolve) => {
    frame.addEventListener('load', () => resolve(), { once: true });
    frame.src = url;
    document.body.append(frame);
  });
  // A frame the policy refused is cross-origin: reading `print` throws, and the pages print.
  const win = frame.contentWindow;
  if (!win) throw new Error('The frame cannot print');
  win.print();
}

/** Renders every page of `bytes` into a print-only sheet and opens the print dialog. */
async function printPages(
  bytes: ArrayBuffer,
  signal: AbortSignal,
  onPage: (done: number, total: number) => void,
): Promise<void> {
  const scratch = await openScratch(bytes);
  const sheet = document.createElement('div');
  sheet.className = styles.sheet ?? '';
  sheet.dataset.print = 'pages';
  const urls: string[] = [];
  try {
    const pages = scratch.document.pages;
    const shown = pages.map(({ size, cropBox, rotation }) => {
      const box = cropBox ?? size;
      const quarter = rotation === 90 || rotation === 270;
      return quarter ? { width: box.height, height: box.width } : box;
    });
    const scale = printDpi(shown) / 72;
    const renderer = await toolRenderer();
    const canvas = document.createElement('canvas');
    for (const index of pages.keys()) {
      if (signal.aborted) throw new CopyError(m.export_error_cancelled(), [], true);
      const { bitmap, width, height } = await renderer.renderPage(scratch.id, index, {
        scale,
        background: 'white',
        signal,
      });
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
      bitmap.close();
      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!jpeg) throw new Error('A page could not be drawn');
      const url = URL.createObjectURL(jpeg);
      urls.push(url);
      const image = new Image(width, height);
      image.alt = '';
      image.src = url;
      await image.decode();
      sheet.append(image);
      onPage(index + 1, pages.length);
    }
    canvas.width = 0;
    canvas.height = 0;
  } catch (error) {
    for (const url of urls) URL.revokeObjectURL(url);
    throw error;
  } finally {
    await scratch.close();
  }
  leftover = { element: sheet, urls };
  document.body.append(sheet);
  window.addEventListener('afterprint', clearLeftover, { once: true });
  window.print();
}

/** Prints the document `documentId` as saved with its current edits. */
export async function printDocument(documentId: DocumentId): Promise<void> {
  const doc = useWorkspaceStore.getState().workspace.documents[documentId];
  if (!doc) return;
  clearLeftover();
  const method = choosePrintMethod(printEnvironment());
  // Building the bytes is all of a frame's work and half of the pages'.
  const buildShare = method === 'frame' ? 1 : 0.5;
  const controller = new AbortController();
  const job = startJob({
    label: m.print_working({ percent: 0 }),
    progress: 0,
    documentId,
    cancel: () => controller.abort(),
  });
  const progress = (share: number) =>
    job.update({
      progress: percentOf(share),
      label: m.print_working({ percent: percentOf(share) }),
    });
  try {
    const copy = await buildCopy(
      documentId,
      { format: 'pdf', name: doc.title, options: { includeComments: true } },
      { signal: controller.signal, onProgress: (share) => progress(share * buildShare) },
    );
    if (controller.signal.aborted) throw new CopyError(m.export_error_cancelled(), [], true);
    if (method === 'frame') {
      try {
        await printInFrame(copy.blob);
        return;
      } catch {
        clearLeftover();
      }
    }
    await printPages(await copy.blob.arrayBuffer(), controller.signal, (done, total) =>
      progress(50 + (50 * done) / total),
    );
  } catch (error) {
    clearLeftover();
    if (error instanceof CopyError && error.stopped) return;
    toast.failure(
      m.print_failed({ reason: error instanceof Error ? error.message : String(error) }),
      {
        documentId,
        testId: 'print-failed',
      },
    );
  } finally {
    finishJob(job.id);
  }
}
