/**
 * Print… (PRD-25; epics-r25 Epic 5; `docs/research/print-2026-10.md`): prints the document as
 * Save a copy would write it (marks, form values and applied redactions in), loaded on demand
 * from `file.print` so none of it is in the first bundle.
 *
 * - **The bytes** are Save a copy's (`buildCopy` in `save-copy-run.ts`), without a password:
 *   assembled, re-opened and checked on this device; a copy that fails its checks is not printed.
 * - **A job** (`jobs/job-store.ts`): "Preparing to print… 40 %" in the toast stack past 400 ms,
 *   Cancel stops at the next step or page. The browser's print dialog is the end of the job.
 * - **The method** (`print-method.ts`): the PDF in a hidden frame where the browser prints PDFs
 *   itself, with its scripts stripped first (`stripScripts`: that viewer runs document
 *   JavaScript, Recto never does); else, or when the frame fails or has not loaded in
 *   `FRAME_LOAD_MS`, the pages rendered at `printDpi` into a print-only sheet and
 *   `window.print()`.
 * - **Cleanup**: the frame and its blob URL go on `afterprint`, when the document closes, or
 *   after `FRAME_KEEP_MS`; the sheet goes `SHEET_KEEP_MS` after `afterprint` or on the next
 *   focus, whichever is first (iOS takes its snapshot after `afterprint`), or when the document
 *   closes. Each print also replaces what the last one left.
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

/** How long the frame may take to load before the pages print instead. */
export const FRAME_LOAD_MS = 15_000;
/** How long the frame stays when no `afterprint` reaches us (the viewer prints in its frame). */
export const FRAME_KEEP_MS = 60_000;
/** How long the sheet stays after `afterprint`, unless the window regains focus first. */
export const SHEET_KEEP_MS = 1_000;

const stopped = () => new CopyError(m.export_error_cancelled(), [], true);

/** What the last print left in the page, and how to take it away. */
let leftover:
  | { readonly elements: readonly Element[]; readonly urls: readonly string[] }
  | undefined;
const disposers: (() => void)[] = [];

function clearLeftover(): void {
  for (const dispose of disposers.splice(0)) dispose();
  if (!leftover) return;
  for (const element of leftover.elements) element.remove();
  for (const url of leftover.urls) URL.revokeObjectURL(url);
  leftover = undefined;
}

/** Clears what this print left when `documentId` closes. */
function clearOnClose(documentId: DocumentId): void {
  disposers.push(
    useWorkspaceStore.subscribe((state) => {
      if (!state.workspace.documents[documentId]) clearLeftover();
    }),
  );
}

function later(ms: number, run: () => void): void {
  const timer = setTimeout(run, ms);
  disposers.push(() => clearTimeout(timer));
}

function listen(target: EventTarget, type: string, run: () => void): void {
  target.addEventListener(type, run, { once: true });
  disposers.push(() => target.removeEventListener(type, run));
}

/**
 * Prints `bytes` through the browser's PDF viewer in a hidden frame. Resolves `false` when the
 * frame has not loaded in time (the pages print instead); throws when it cannot print.
 */
async function printInFrame(bytes: Uint8Array, signal: AbortSignal): Promise<boolean> {
  const { stripScripts } = await import('@pdf-editor/engine');
  const stripped = await stripScripts(bytes);
  if (signal.aborted) throw stopped();
  const url = URL.createObjectURL(
    new Blob([stripped.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
  );
  const frame = document.createElement('iframe');
  frame.className = styles.frame ?? '';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.dataset.print = 'frame';
  leftover = { elements: [frame], urls: [url] };
  const loaded = await new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(false);
    }, FRAME_LOAD_MS);
    const abort = () => {
      clearTimeout(timer);
      reject(stopped());
    };
    signal.addEventListener('abort', abort, { once: true });
    frame.addEventListener(
      'load',
      () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        resolve(true);
      },
      { once: true },
    );
    frame.src = url;
    document.body.append(frame);
  });
  if (!loaded) return false;
  // A frame the policy refused is cross-origin: reading `print` throws, and the pages print.
  const win = frame.contentWindow;
  if (!win) throw new Error('The frame cannot print');
  listen(win, 'afterprint', clearLeftover);
  listen(window, 'afterprint', clearLeftover);
  later(FRAME_KEEP_MS, clearLeftover);
  win.print();
  return true;
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
      if (signal.aborted) throw stopped();
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
  // No paper margin around the pages, only while the sheet is there.
  const page = document.createElement('style');
  page.textContent = '@page { margin: 0 }';
  leftover = { elements: [sheet, page], urls };
  document.head.append(page);
  document.body.append(sheet);
  listen(window, 'afterprint', () => {
    later(SHEET_KEEP_MS, clearLeftover);
    listen(window, 'focus', clearLeftover);
  });
  window.print();
}

/** Prints the document `documentId` as saved with its current edits. */
export async function printDocument(documentId: DocumentId): Promise<void> {
  const doc = useWorkspaceStore.getState().workspace.documents[documentId];
  if (!doc) return;
  clearLeftover();
  clearOnClose(documentId);
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
      // Printed without a password: the viewer would ask for it, and the pages could not open.
      { format: 'pdf', name: doc.title, options: { includeComments: true, security: null } },
      { signal: controller.signal, onProgress: (share) => progress(share * buildShare) },
    );
    if (controller.signal.aborted) throw stopped();
    const bytes = await copy.blob.arrayBuffer();
    if (method === 'frame') {
      try {
        if (await printInFrame(new Uint8Array(bytes), controller.signal)) return;
      } catch (error) {
        if (error instanceof CopyError && error.stopped) throw error;
      }
      clearLeftover();
      clearOnClose(documentId);
    }
    await printPages(bytes, controller.signal, (done, total) => progress(50 + (50 * done) / total));
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
