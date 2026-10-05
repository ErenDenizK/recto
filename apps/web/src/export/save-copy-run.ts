/**
 * Save a copy's work (components/07-sheets.md §4.4, §4.6, §27 issues 6 and 7; ADR-0032 §2 items
 * 3 and 9; flows §5.1): the picker first, then the copy built, checked and written as a job
 * with its progress in the toast stack, then one toast that says where it went.
 *
 * - **Picker first** where File System Access exists: `pickTarget` calls `showSaveFilePicker`
 *   synchronously inside the press (it needs the press's activation), so the person chooses
 *   where before any work. Cancelling it leaves the sheet open and says nothing. Without the
 *   picker the copy downloads; a coarse pointer that can share files shares (`shareCopy`).
 * - **The job** (`jobs/job-store.ts`): "Saving copy… 40 %", Cancel stops at the next safe
 *   point. The copy reflects the document as it was at the press.
 * - **Built and checked on this device.** A PDF goes through the export pipeline, which
 *   re-opens the result in a fresh engine and refuses a copy that does not match (and a
 *   redacted copy that fails its self-check); images and text come from the same document.
 * - **The empty-file rule** (§27.7, spec 07.7): Chromium creates the picked file when the
 *   picker closes. When the copy cannot be written (it failed, failed its check, or was
 *   stopped), the writable is aborted and the empty file is removed where the handle has
 *   `remove()`; otherwise the failure toast says an empty file was left to delete.
 * - **Toasts** (`ui/Toast`): "Saved report-small.pdf · 1.1 MB · verified", with Details when
 *   the summary has lines; "Copy not saved: {reason} · Try again" until dismissed, Try again
 *   reopening the sheet with its draft.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import type { ConvertResult } from '@pdf-editor/engine';

import { type ConvertChoice, convertDocumentPages, outputFile } from '../convert/convert-run';
import { formatBytes } from '../files/file-filters';
import { m } from '../i18n';
import { finishJob, type JobHandle, startJob } from '../jobs/job-store';
import { pagesPhrase, useWorkspaceStore } from '../state/workspace-store';
import { RasterError, type RasterOptions, rasterizeDocument } from '../tools/rasterize';
import { toast } from '../ui/Toast/toast';
import { downloadBlob, removeEmptyFile } from './deliver';
import {
  type CopySummary,
  type CopySummaryItem,
  keepCopySummary,
  openSaveCopy,
} from './export-store';
import { type ExportOptions, prepareExport } from './export-service';
import { exportShare, percentOf } from './save-copy-model';
import { summarizeReport } from './summary';
import { presetName } from '../tools/labels';
import { deltaPercent } from '../tools/compress-math';

// ---------------------------------------------------------------------------
// What to build
// ---------------------------------------------------------------------------

/** The copy as asked at the press: everything needed to build it, nothing read later. */
export type CopyRequest =
  | {
      readonly format: 'pdf';
      readonly name: string;
      readonly options: Omit<ExportOptions, 'signal' | 'onProgress'>;
      /** The size's name for the summary ("Smaller"), when it compresses. */
      readonly sizeLabel?: string | undefined;
    }
  | {
      readonly format: 'images';
      readonly name: string;
      readonly type: string;
      readonly options: RasterOptions;
    }
  | {
      readonly format: 'text';
      /** The stem; the extension follows the result (`.md`, `.txt` or `.zip`). */
      readonly stem: string;
      readonly pages: readonly number[];
      readonly choice: ConvertChoice;
      /** The preview's result for the same choice, when it is ready (no second conversion). */
      readonly ready?: ConvertResult | undefined;
    };

/** A built copy. */
export interface CopyOutput {
  readonly blob: Blob;
  readonly name: string;
  readonly type: string;
  readonly summary: CopySummary;
}

/** A copy that could not be built, with the checks that failed. */
export class CopyError extends Error {
  constructor(
    message: string,
    readonly problems: readonly string[] = [],
    readonly stopped = false,
  ) {
    super(message);
    this.name = 'CopyError';
  }
}

/** The name and type a request's file will have, for the picker (before it is built). */
export function requestFile(request: CopyRequest): {
  readonly name: string;
  readonly type: string;
} {
  if (request.format === 'pdf') return { name: request.name, type: 'application/pdf' };
  if (request.format === 'images') return { name: request.name, type: request.type };
  if (request.ready) {
    const file = outputFile(request.ready, request.stem);
    return { name: file.name, type: file.type };
  }
  const markdown = request.choice.format === 'markdown';
  return {
    name: `${request.stem}.${markdown ? 'md' : 'txt'}`,
    type: markdown ? 'text/markdown' : 'text/plain',
  };
}

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Builds the copy of `documentId` that `request` asks for; rejects with a `CopyError`. */
export async function buildCopy(
  documentId: DocumentId,
  request: CopyRequest,
  control: {
    readonly signal?: AbortSignal | undefined;
    readonly onProgress?: ((share: number) => void) | undefined;
  } = {},
): Promise<CopyOutput> {
  const { signal, onProgress } = control;
  const stopped = () => new CopyError(m.export_error_cancelled(), [], true);
  if (request.format === 'pdf') {
    const result = await prepareExport(documentId, {
      ...request.options,
      ...(signal ? { signal } : {}),
      onProgress: (progress) => onProgress?.(exportShare(progress)),
    });
    if (signal?.aborted) throw stopped();
    if (!result.ok) throw new CopyError(result.error.message);
    const prepared = result.value;
    if (prepared.redaction && !prepared.redaction.report.ok) {
      throw new CopyError(m.export_failed_redaction(), prepared.verification.problems);
    }
    if (!prepared.verification.ok) {
      throw new CopyError(m.export_failed_verification(), prepared.verification.problems);
    }
    const items: CopySummaryItem[] = summarizeReport(
      prepared.report,
      prepared.sourceNotes,
      prepared.outcome,
      {
        ...(prepared.redaction ? { redaction: prepared.redaction } : {}),
        ...(prepared.textEdits ? { textEdits: prepared.textEdits } : {}),
        ...(prepared.ocr ? { ocr: prepared.ocr } : {}),
        ...(prepared.signature ? { signature: prepared.signature } : {}),
        ...(prepared.signaturesRemoved ? { signaturesRemoved: prepared.signaturesRemoved } : {}),
      },
    );
    if (prepared.compression) {
      const { preset, before, after } = prepared.compression;
      items.unshift({
        id: 'compression',
        tone: 'changed',
        text: m.export_compression_delta({
          preset: request.sizeLabel ?? presetName(preset),
          before: formatBytes(before),
          after: formatBytes(after),
          delta: deltaPercent(before, after),
        }),
      });
    }
    return {
      blob: new Blob([prepared.bytes], { type: 'application/pdf' }),
      name: request.name,
      type: 'application/pdf',
      summary: {
        name: request.name,
        size: prepared.bytes.byteLength,
        verified: true,
        seconds: Math.round(prepared.durationMs / 100) / 10,
        items,
      },
    };
  }
  if (request.format === 'images') {
    try {
      const file = await rasterizeDocument(documentId, request.options, {
        ...(signal ? { signal } : {}),
        onProgress: ({ done, total }) => onProgress?.(total > 0 ? (done / total) * 100 : 0),
      });
      return {
        blob: file.blob,
        name: file.name,
        type: file.type,
        summary: {
          name: file.name,
          size: file.blob.size,
          verified: false,
          seconds: null,
          items: [],
        },
      };
    } catch (error) {
      if (signal?.aborted || (error instanceof RasterError && error.code === 'aborted')) {
        throw stopped();
      }
      if (error instanceof RasterError && error.code === 'too-large') {
        throw new CopyError(m.images_too_large({ size: error.message }));
      }
      throw new CopyError(reasonOf(error));
    }
  }
  let result = request.ready;
  if (!result) {
    try {
      result = await convertDocumentPages(documentId, request.pages, request.choice, {
        ...(signal ? { signal } : {}),
        onProgress: (done, total) => onProgress?.(total > 0 ? (done / total) * 100 : 0),
      });
    } catch (error) {
      if (signal?.aborted) throw stopped();
      throw new CopyError(reasonOf(error));
    }
  }
  const file = outputFile(result, request.stem);
  const blob = new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.type });
  return {
    blob,
    name: file.name,
    type: file.type,
    summary: { name: file.name, size: blob.size, verified: false, seconds: null, items: [] },
  };
}

// ---------------------------------------------------------------------------
// Where it goes
// ---------------------------------------------------------------------------

export interface CopyWritable {
  write(data: BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

/** A picked file (`FileSystemFileHandle`); `remove` exists in Chromium only. */
export interface CopyHandle {
  readonly name: string;
  createWritable(): Promise<CopyWritable>;
  remove?: () => Promise<void>;
}

type SavePicker = (options: {
  suggestedName?: string;
  startIn?: CopyHandle | 'documents';
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<CopyHandle>;

export type CopyTarget =
  | { readonly kind: 'file'; readonly handle: CopyHandle }
  | { readonly kind: 'download' };

/** The folder of the last copy, offered next time (memory only, never persisted). */
let lastHandle: CopyHandle | undefined;

/** Forgets the remembered folder (tests). */
export function forgetCopyFolder(): void {
  lastHandle = undefined;
}

const isNamed = (error: unknown, name: string) =>
  error instanceof DOMException && error.name === name;

/**
 * Asks where the copy goes. Call it first thing in the press, before any `await`: the
 * picker opens synchronously inside the press's activation. Resolves to the picked file, to
 * a download where there is no picker (or the browser refused it), or to 'cancelled'.
 */
export function pickTarget(
  file: { readonly name: string; readonly type: string },
  win: Window = window,
): Promise<CopyTarget | 'cancelled'> {
  const picker = (win as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (typeof picker !== 'function') return Promise.resolve({ kind: 'download' });
  const dot = file.name.lastIndexOf('.');
  const extension = dot > 0 ? file.name.slice(dot) : '';
  let picking: Promise<CopyHandle>;
  try {
    picking = picker.call(win, {
      suggestedName: file.name,
      startIn: lastHandle ?? 'documents',
      ...(extension
        ? { types: [{ description: file.name, accept: { [file.type]: [extension] } }] }
        : {}),
    });
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
  return picking.then(
    (handle): CopyTarget => {
      lastHandle = handle;
      return { kind: 'file', handle };
    },
    (error: unknown): CopyTarget | 'cancelled' => {
      if (isNamed(error, 'AbortError')) return 'cancelled';
      // No activation, a cross-origin frame or a blocked folder: download instead.
      if (isNamed(error, 'SecurityError') || isNamed(error, 'NotAllowedError')) {
        return { kind: 'download' };
      }
      throw error;
    },
  );
}

const CHUNK = 4 * 1024 * 1024;

/** Writes the copy to its target in chunks; a failed write is aborted and rethrown. */
export async function writeCopy(target: CopyTarget, output: CopyOutput): Promise<void> {
  if (target.kind === 'download') {
    downloadBlob(output.blob, output.name);
    return;
  }
  const writable = await target.handle.createWritable();
  try {
    const size = output.blob.size;
    for (let offset = 0; offset < size; offset += CHUNK) {
      await writable.write(output.blob.slice(offset, Math.min(size, offset + CHUNK)));
    }
    await writable.close();
  } catch (error) {
    // Discard the partial file rather than leaving a truncated copy behind.
    await writable.abort(error).catch(() => undefined);
    throw error;
  }
}

/** Whether this browser can share a file of `type` (Web Share Level 2). */
export function canShareFiles(nav: Navigator = navigator): boolean {
  if (typeof nav.canShare !== 'function' || typeof nav.share !== 'function') return false;
  try {
    return nav.canShare({ files: [new File([''], 'copy.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

/**
 * Shares a built copy. Call it synchronously inside the press (Web Share needs its
 * activation, §27.6). Resolves false when the person dismissed the share sheet.
 */
export async function shareCopy(output: CopyOutput, nav: Navigator = navigator): Promise<boolean> {
  try {
    await nav.share({
      files: [new File([output.blob], output.name, { type: output.type })],
      title: output.name,
    });
    return true;
  } catch (error) {
    if (isNamed(error, 'AbortError')) return false;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// The job
// ---------------------------------------------------------------------------

/** The toast that says a copy is done, and its Details when the summary has lines. */
export function showCopyDone(
  documentId: DocumentId,
  summary: CopySummary,
  where: 'saved' | 'downloaded' | 'shared',
): void {
  keepCopySummary(documentId, summary);
  const size = formatBytes(summary.size);
  const name = summary.name;
  const text =
    where === 'shared'
      ? m.save_copy_shared({ name })
      : where === 'saved'
        ? summary.verified
          ? m.save_copy_saved_verified({ name, size })
          : m.save_copy_saved({ name, size })
        : summary.verified
          ? m.save_copy_downloaded_verified({ name, size })
          : m.save_copy_downloaded({ name, size });
  toast.success(text, {
    documentId,
    keepOnClose: true,
    testId: 'save-copy-toast',
    ...(summary.items.length > 0
      ? {
          action: {
            label: m.save_copy_details(),
            run: () => {
              if (useWorkspaceStore.getState().workspace.documents[documentId]) {
                openSaveCopy(documentId, 'details');
              }
            },
          },
        }
      : {}),
  });
}

/** The failure toast: "Copy not saved: {reason}", Try again reopening the sheet. */
export function showCopyFailed(documentId: DocumentId, reason: string, detail?: string): void {
  toast.failure(m.save_copy_failed({ reason }), {
    documentId,
    testId: 'save-copy-failed',
    key: `save-copy:${documentId}`,
    ...(detail ? { detail } : {}),
    action: {
      label: m.error_try_again(),
      run: () => {
        if (useWorkspaceStore.getState().workspace.documents[documentId]) openSaveCopy(documentId);
      },
    },
  });
}

/** The label of the job at `share` per cent. */
const jobLabel = (share: number) => m.save_copy_working({ percent: percentOf(share) });

/**
 * Builds, checks and writes the copy as a job (§4.4 Working → Done or Failed). `target` came
 * from `pickTarget` in the press. Resolves to what happened.
 */
export async function runSaveCopy(
  documentId: DocumentId,
  request: CopyRequest,
  target: CopyTarget,
  /**
   * Work before the copy is built: "Apply and save" applies the pending redaction marks
   * (07.10). Resolves to a failure reason, or null to go on.
   */
  before?: () => Promise<string | null>,
): Promise<'done' | 'failed' | 'stopped'> {
  const title = useWorkspaceStore.getState().workspace.documents[documentId]?.title ?? '';
  const controller = new AbortController();
  let job: JobHandle | undefined = startJob({
    label: jobLabel(0),
    progress: 0,
    documentId,
    cancel: () => controller.abort(),
  });
  const end = () => {
    if (job) finishJob(job.id);
    job = undefined;
  };
  let output: CopyOutput;
  try {
    const refused = before ? await before() : null;
    if (refused !== null) throw new CopyError(refused);
    output = await buildCopy(documentId, request, {
      signal: controller.signal,
      onProgress: (share) => job?.update({ progress: share, label: jobLabel(share) }),
    });
    if (controller.signal.aborted) throw new CopyError(m.export_error_cancelled(), [], true);
    if (!useWorkspaceStore.getState().workspace.documents[documentId]) {
      throw new CopyError(m.save_copy_closed({ name: title }));
    }
    job?.update({ progress: 100, label: jobLabel(100) });
    await writeCopy(target, output);
  } catch (error) {
    end();
    const copyError = error instanceof CopyError ? error : null;
    const removed = target.kind === 'file' ? await removeEmptyFile(target.handle) : null;
    const emptyNote =
      removed === null
        ? undefined
        : removed
          ? m.save_copy_empty_removed()
          : m.save_copy_empty_left({ name: target.kind === 'file' ? target.handle.name : '' });
    if (copyError?.stopped) {
      toast.info(m.save_copy_stopped({ name: title }), {
        documentId,
        ...(emptyNote ? { detail: emptyNote } : {}),
      });
      return 'stopped';
    }
    const problems = copyError?.problems ?? [];
    const detail = [...problems, ...(emptyNote ? [emptyNote] : [])].join(' · ');
    showCopyFailed(documentId, reasonOf(error), detail || undefined);
    return 'failed';
  }
  end();
  showCopyDone(documentId, output.summary, target.kind === 'file' ? 'saved' : 'downloaded');
  return 'done';
}

/** The sheet's subtitle: "report.pdf · 12 pages · 2.4 MB" (the size once known). */
export function copySubtitle(name: string, pages: number, size: number | null): string {
  return [name, pagesPhrase(pages), ...(size === null ? [] : [formatBytes(size)])].join(' · ');
}
