/**
 * Save in place (ADR-0032 §2.1, §5.1, §5.3; flows.md §5.1, §5.4; 01-frame F7; spec redesign
 * D0-8, 07.10): Save writes the document back into the file it was opened from, where the
 * browser allows it, and checks what it wrote.
 *
 * **Routes** (`planSave`, a pure function the tests drive):
 *
 * - *Nothing new* (the saved mark, `state/saved-store.ts`): nothing is written; Mod+S says
 *   "Everything is in report.pdf" instead of the browser's "Save page as".
 * - *In place* (Chromium with a writable handle for the document): the first save over a file
 *   asks once, "Replace report.pdf?" (`ReplacePopover`), then the browser's write prompt may
 *   follow once per session (`requestPermission({ mode: 'readwrite' })`): 3 presses the first
 *   time, 1 after (J13A). "Don't ask again for this file" keeps the answer on this device.
 * - *Picker* (Chromium without a handle: a combined document, images, a restore): the save
 *   picker opens first, then the new handle is kept for the session, so the next Save is one
 *   press (2 presses; the picker itself asked about replacing).
 * - *Share* (a touch tablet without File System Access but with file sharing, M-36) or
 *   *download* (Firefox, Safari): a new copy, and the toast says where it went and that the
 *   opened file was not changed.
 *
 * **The handle.** Files opened through the Chromium picker or dropped hand out a
 * `FileSystemFileHandle`; `rememberDocumentHandle` keeps it per document for the session (the
 * open path calls it). A document without one (restored, or reopened from a kept snapshot)
 * may use the handle Recents stored for its file, read on the Save press only, never on
 * Chromium 153, whose browser crashes when IndexedDB returns a stored handle (ADR-0032 §5.1,
 * DISCUSSION #32, `files/recents.ts`): there Save takes the picker route and keeps the new
 * handle for the session.
 *
 * **Order of a save** (each question needs the user's press, and the write prompt and the
 * picker need the activation of the latest one): unapplied redaction marks are asked about
 * first (07.10: "2 marks not applied", Apply and save by default, "Save without applying" with
 * the honesty line), then Replace, then the write permission or the picker; only then do the
 * marks apply, the bytes assemble and verify (`prepareExport`: re-parsed, page and annotation
 * checks, the redaction self-check), and the write runs. A write is **verified** by reading the
 * file back through the handle and comparing it byte for byte with what was written; only then
 * the saved mark moves and the toast says "Saved · verified" (with applied marks "Saved · 2
 * areas removed for good · verified").
 *
 * A save runs as a job (`startJob`, FB5): the Save button shows "Saving… 40 %" while it is on
 * screen, else the progress capsule. Mod+S during a save is queued once. Saving writes the
 * document as it is, so it is allowed in Read mode and, later, while locked (ADR-0032 §5.3,
 * spec 0032.3); `commit()` is not involved.
 */
import type { DocumentId, SourceId, VirtualDocument, Workspace } from '@pdf-editor/document-model';
import type { RedactionPlan } from '@pdf-editor/engine';
import { create } from 'zustand';

import { pageKey, useAnnotationStore } from '../annotations/annotation-store';
import { readAnnotations, whenIdle } from '../annotations/edit-runner';
import { presentError } from '../errors/present';
import { deliverPdf, supportsSavePicker } from '../export/deliver';
import { type ExportProgress, prepareExport } from '../export/export-service';
import { openExportDialog } from '../export/export-store';
import { exportFileName } from '../export/filename';
import { m } from '../i18n';
import { type JobHandle, startJob } from '../jobs/job-store';
import {
  applyRedactionPlans,
  appliedAreas,
  DEFAULT_CHOICES,
  planForMarks,
} from '../redaction/apply';
import { isRedactMark, type RedactMark } from '../redaction/marks';
import { announce } from '../shell/announcer';
import { readJson, writeJson } from '../state/safe-storage';
import { captureState, isInFile, markSaved, originOf, useSavedStore } from '../state/saved-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast/toast';
import { recentHandle, storedHandlesReadable, useRecentsStore } from './recents';

// ---------------------------------------------------------------------------
// Handles
// ---------------------------------------------------------------------------

interface WritableLike {
  write(data: BufferSource): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

/** The parts of `FileSystemFileHandle` a save uses (File System Access, Chromium). */
export interface WritableFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableLike>;
  queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export function isWritableHandle(value: unknown): value is WritableFileHandle {
  if (typeof value !== 'object' || value === null) return false;
  const handle = value as Partial<Record<keyof WritableFileHandle, unknown>>;
  return (
    handle.kind === 'file' &&
    typeof handle.name === 'string' &&
    typeof handle.getFile === 'function' &&
    typeof handle.createWritable === 'function'
  );
}

/** The handle each document's file came from, for this session. */
const handles = new Map<DocumentId, WritableFileHandle>();

/** Keeps the handle document `id` was read from (the open path; the save picker). */
export function rememberDocumentHandle(id: DocumentId, handle: unknown): void {
  if (isWritableHandle(handle)) handles.set(id, handle);
}

/** The handle this session keeps for document `id`, if any. */
export function documentHandleOf(id: DocumentId): WritableFileHandle | undefined {
  return handles.get(id);
}

/**
 * The handle Recents stored for the file document `id` was opened from (a restored or reopened
 * document), read now, on the Save press. Never on Chromium 153 (see the module comment).
 */
async function storedHandleFor(
  ws: Workspace,
  id: DocumentId,
): Promise<WritableFileHandle | undefined> {
  const origin = originOf(ws, id);
  const source = origin === undefined ? undefined : ws.sources[origin];
  if (source === undefined) return undefined;
  const entry = useRecentsStore
    .getState()
    .entries.find((e) => e.name === source.name && e.size === source.byteLength);
  if (entry === undefined) return undefined;
  if (entry.handle === undefined && (entry.handleStored !== true || !storedHandlesReadable())) {
    return undefined;
  }
  const handle = await recentHandle(entry);
  return isWritableHandle(handle) ? handle : undefined;
}

// ---------------------------------------------------------------------------
// One Replace question per file, per session
// ---------------------------------------------------------------------------

/** Handles whose Replace question was answered this session (or picked in the save picker). */
const answered = new WeakSet<WritableFileHandle>();
/** File names whose Replace question is never asked again on this device. */
export const DONT_ASK_KEY = 'pdf-editor:save:replace-ok:v1';
const DONT_ASK_LIMIT = 100;

function dontAskNames(): string[] {
  const value = readJson(DONT_ASK_KEY);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function replaceAnswered(handle: WritableFileHandle): boolean {
  return answered.has(handle) || dontAskNames().includes(handle.name);
}

function rememberDontAsk(name: string): void {
  const names = dontAskNames().filter((n) => n !== name);
  writeJson(DONT_ASK_KEY, [name, ...names].slice(0, DONT_ASK_LIMIT));
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export type SaveRoute = 'nothing' | 'in-place' | 'picker' | 'share' | 'download';

/** What a save can use, as seen at the press. */
export interface SaveEnvironment {
  /** Everything is in the file already (the saved mark). */
  readonly inFile: boolean;
  /** A writable handle for the document's file is kept. */
  readonly handle: boolean;
  /** The Replace question was answered for that file (this session, or "Don't ask again"). */
  readonly replaceAnswered: boolean;
  /** `showSaveFilePicker` exists. */
  readonly savePicker: boolean;
  /** The share sheet takes files and the device is a touch tablet (M-36). */
  readonly share: boolean;
}

export interface SavePlan {
  readonly route: SaveRoute;
  /** Ask "Replace report.pdf?" before writing. */
  readonly askReplace: boolean;
}

/** The route of a save (see the module comment). */
export function planSave(env: SaveEnvironment): SavePlan {
  if (env.inFile) return { route: 'nothing', askReplace: false };
  if (env.handle) return { route: 'in-place', askReplace: !env.replaceAnswered };
  if (env.savePicker) return { route: 'picker', askReplace: false };
  return { route: env.share ? 'share' : 'download', askReplace: false };
}

/** Presses a save costs on its route (J13A; flows §8.2), counting the browser's prompt. */
export function pressesFor(plan: SavePlan, permissionGranted: boolean): number {
  switch (plan.route) {
    case 'nothing':
      return 0;
    case 'in-place':
      return 1 + (plan.askReplace ? 1 : 0) + (permissionGranted ? 0 : 1);
    case 'picker':
      return 2;
    case 'share':
      return 2;
    case 'download':
      return 1;
  }
}

function canShareFiles(): boolean {
  const nav = globalThis.navigator as
    | (Navigator & { canShare?: (data: { files: File[] }) => boolean })
    | undefined;
  if (typeof nav?.share !== 'function' || typeof nav.canShare !== 'function') return false;
  if (!globalThis.matchMedia?.('(pointer: coarse)').matches) return false;
  try {
    return nav.canShare({ files: [new File([], 'probe.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Unapplied redaction marks (07.10)
// ---------------------------------------------------------------------------

/** The pending /Redact marks on the pages document `doc` shows, by source. */
export async function pendingMarksOf(
  ws: Workspace,
  doc: VirtualDocument,
): Promise<ReadonlyMap<SourceId, readonly RedactMark[]>> {
  await whenIdle();
  const cached = useAnnotationStore.getState().pages;
  const bySource = new Map<SourceId, Map<string, RedactMark>>();
  const read = new Set<string>();
  for (const page of doc.pages) {
    if (page.ref.kind !== 'source') continue;
    const { source, index } = page.ref;
    const key = pageKey(source, index);
    if (read.has(key) || ws.sources[source] === undefined) continue;
    read.add(key);
    const annotations = cached[key]?.annotations ?? (await readAnnotations(source, index));
    for (const annotation of annotations) {
      if (!isRedactMark(annotation) || annotation.flags?.hidden) continue;
      const marks = bySource.get(source) ?? new Map<string, RedactMark>();
      marks.set(annotation.id, annotation);
      bySource.set(source, marks);
    }
  }
  return new Map([...bySource].map(([source, marks]) => [source, [...marks.values()]]));
}

function countMarks(marks: ReadonlyMap<SourceId, readonly RedactMark[]>): number {
  let count = 0;
  for (const list of marks.values()) count += list.length;
  return count;
}

/**
 * "Apply and save": applies every pending mark of the document with the default choices
 * (black fill, text captured), through the same pipeline, gate and self-check as the
 * Redactions panel. Resolves to the areas removed, or undefined when nothing was applied.
 */
async function applyMarks(
  marks: ReadonlyMap<SourceId, readonly RedactMark[]>,
): Promise<number | undefined> {
  const plans: { source: SourceId; plan: RedactionPlan }[] = [];
  for (const [source, list] of marks) {
    if (list.length > 0) plans.push({ source, plan: planForMarks(list, DEFAULT_CHOICES) });
  }
  const areas = plans.reduce((n, p) => n + p.plan.areas.length, 0);
  const outcome = await applyRedactionPlans(plans, {
    label: m.history_redactions_applied({ count: areas }),
    coalesceKey: `save.apply:${globalThis.crypto.randomUUID()}`,
    captureStrings: true,
  });
  return outcome.kind === 'applied' ? appliedAreas(outcome.sources) : undefined;
}

// ---------------------------------------------------------------------------
// Questions and state
// ---------------------------------------------------------------------------

export type SaveQuestion =
  | { readonly kind: 'marks'; readonly documentId: DocumentId; readonly count: number }
  | { readonly kind: 'replace'; readonly documentId: DocumentId; readonly name: string };

export type SaveAnswer = 'apply' | 'without' | 'replace' | 'copy' | 'cancel';

interface PendingQuestion {
  readonly question: SaveQuestion;
  readonly resolve: (answer: { answer: SaveAnswer; dontAsk: boolean }) => void;
}

interface SaveState {
  /** The question on screen (anchored at Save), if any. */
  readonly pending: PendingQuestion | null;
  /** The job of each document's running save. */
  readonly jobs: Readonly<Record<DocumentId, string>>;
  /** When each document's last verified save finished, while Save shows its check (FB6). */
  readonly verifiedAt: Readonly<Record<DocumentId, number>>;
}

export const useSaveStore = create<SaveState>()(() => ({
  pending: null,
  jobs: {},
  verifiedAt: {},
}));

function ask(question: SaveQuestion): Promise<{ answer: SaveAnswer; dontAsk: boolean }> {
  // A question already open is answered "cancel": one question at a time.
  useSaveStore.getState().pending?.resolve({ answer: 'cancel', dontAsk: false });
  return new Promise((resolve) => {
    useSaveStore.setState({ pending: { question, resolve } });
  });
}

/** The popover's answer to the open question (Esc and outside presses answer "cancel"). */
export function answerSaveQuestion(answer: SaveAnswer, options: { dontAsk?: boolean } = {}): void {
  const pending = useSaveStore.getState().pending;
  if (!pending) return;
  useSaveStore.setState({ pending: null });
  pending.resolve({ answer, dontAsk: options.dontAsk === true });
}

/** Save buttons on screen: a job shows in place while one is (FB5 §4). */
let mountedButtons = 0;
const jobHandles = new Map<DocumentId, JobHandle>();

/** The Save button mounted (true) or left (false): its job moves into it or into the capsule. */
export function setSaveButtonShown(shown: boolean): void {
  mountedButtons = Math.max(0, mountedButtons + (shown ? 1 : -1));
  for (const handle of jobHandles.values()) handle.setInPlace(mountedButtons > 0);
}

/** How long Save shows its check after a verified save (FB6: pop, hold, settle). */
export const VERIFIED_SHOWN_MS = 1600;

/** Save's check and bloom, once per verified save. */
function showVerified(id: DocumentId): void {
  const at = Date.now();
  useSaveStore.setState((s) => ({ verifiedAt: { ...s.verifiedAt, [id]: at } }));
  setTimeout(() => {
    if (useSaveStore.getState().verifiedAt[id] !== at) return;
    useSaveStore.setState((s) => {
      const { [id]: _done, ...verifiedAt } = s.verifiedAt;
      return { verifiedAt };
    });
  }, VERIFIED_SHOWN_MS);
}

/** Documents whose Save was pressed again while saving (Mod+S queued once). */
const queued = new Set<DocumentId>();

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const CHUNK = 4 * 1024 * 1024;

type WriteFailure = 'moved' | 'denied' | 'mismatch' | 'failed';

class SaveWriteError extends Error {
  constructor(readonly reason: WriteFailure) {
    super(reason);
    this.name = 'SaveWriteError';
  }
}

function writeFailure(error: unknown): WriteFailure {
  if (error instanceof SaveWriteError) return error.reason;
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotFoundError') return 'moved';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  return 'failed';
}

function reasonText(reason: WriteFailure): string {
  switch (reason) {
    case 'moved':
      return m.save_reason_moved();
    case 'denied':
      return m.save_reason_denied();
    case 'mismatch':
      return m.save_reason_mismatch();
    case 'failed':
      return m.save_reason_failed();
  }
}

/** Whether two byte arrays are equal. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Asks for write access where the browser has not given it this session. */
async function writePermission(handle: WritableFileHandle): Promise<boolean> {
  try {
    let state = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (state === 'prompt') {
      state = (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
    }
    return state === 'granted';
  } catch {
    return false;
  }
}

/**
 * Writes `bytes` through `handle` (the browser writes a swap file and replaces the file on
 * close, so a failure leaves the old file whole), then reads the file back and compares it
 * byte for byte. Throws `SaveWriteError` on any failure.
 */
export async function writeAndVerify(
  handle: WritableFileHandle,
  bytes: ArrayBuffer,
): Promise<void> {
  const view = new Uint8Array(bytes);
  let writable: WritableLike;
  try {
    writable = await handle.createWritable();
  } catch (error) {
    throw new SaveWriteError(writeFailure(error));
  }
  try {
    for (let offset = 0; offset < view.byteLength; offset += CHUNK) {
      await writable.write(view.subarray(offset, Math.min(view.byteLength, offset + CHUNK)));
    }
    await writable.close();
  } catch (error) {
    await writable.abort(error).catch(() => undefined);
    throw new SaveWriteError(writeFailure(error));
  }
  let back: Uint8Array;
  try {
    back = new Uint8Array(await (await handle.getFile()).arrayBuffer());
  } catch (error) {
    throw new SaveWriteError(writeFailure(error));
  }
  if (!sameBytes(back, view)) throw new SaveWriteError('mismatch');
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  startIn?: 'documents';
  types?: { description: string; accept: Record<string, string[]> }[];
}

type SavePicker = (options: SaveFilePickerOptions) => Promise<unknown>;

async function pickSaveHandle(name: string): Promise<WritableFileHandle | 'cancelled' | undefined> {
  const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (!picker) return undefined;
  try {
    const handle = await picker.call(window, {
      suggestedName: name,
      startIn: 'documents',
      types: [
        { description: m.file_picker_description(), accept: { 'application/pdf': ['.pdf'] } },
      ],
    });
    return isWritableHandle(handle) ? handle : undefined;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    // No activation left, a blocked folder: the download route instead.
    return undefined;
  }
}

/** Hands the bytes to the share sheet; resolves to false when sharing failed (not cancelled). */
async function shareCopy(
  bytes: ArrayBuffer,
  name: string,
): Promise<'shared' | 'cancelled' | false> {
  const file = new File([bytes], name, { type: 'application/pdf' });
  const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } })
    .userActivation;
  // The share sheet needs the press's activation; a long save outlives it: download instead.
  if (activation !== undefined && !activation.isActive) return false;
  try {
    await navigator.share({ files: [file], title: name });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return false;
  }
}

// ---------------------------------------------------------------------------
// The save
// ---------------------------------------------------------------------------

/** The name the file is saved under: the handle's, else one made from the title. */
export function saveNameFor(
  id: DocumentId,
  ws: Workspace = useWorkspaceStore.getState().workspace,
): string {
  const handle = handles.get(id);
  if (handle) return handle.name;
  return exportFileName(ws.documents[id]?.title ?? '');
}

/** Progress of the assembly as the share of a save (the write takes the last 5 %). */
export function saveProgress(progress: ExportProgress): number {
  const share = progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0;
  if (progress.phase === 'reading') return 10 * share;
  if (progress.phase === 'assembling') return 10 + 70 * share;
  if (progress.phase === 'verifying') return 80 + 10 * share;
  return 90 + 5 * share;
}

function saveACopy(id: DocumentId) {
  return { label: m.save_a_copy(), run: () => openExportDialog(id) };
}

function fail(id: DocumentId, name: string, reason: string): void {
  presentError(
    { kind: 'message', text: m.save_failed({ name, reason }), action: saveACopy(id) },
    { key: `save:${id}`, testId: 'save-failure' },
  );
}

export interface SaveOptions {
  /** Pressed again while saving: run once more afterwards (Mod+S queued once). */
  readonly queue?: boolean;
}

/**
 * Saves document `id` (Save, Mod+S, the Document menu). Call it straight from the press: the
 * questions, the write prompt and the picker need its activation. Never rejects.
 */
export async function saveDocument(id: DocumentId, options: SaveOptions = {}): Promise<void> {
  if (useSaveStore.getState().jobs[id] !== undefined) {
    if (options.queue !== false) queued.add(id);
    return;
  }
  const ws = useWorkspaceStore.getState().workspace;
  const doc = ws.documents[id];
  if (doc === undefined || doc.pages.length === 0) return;
  if (isInFile(ws, id)) {
    announce(m.save_everything_in({ name: saveNameFor(id, ws) }));
    return;
  }
  // Marked busy at once, so a second press while the questions are open is queued, not doubled.
  useSaveStore.setState((s) => ({ jobs: { ...s.jobs, [id]: 'asking' } }));
  try {
    await runSave(id, doc);
  } catch (error) {
    console.warn('Save failed', error);
    fail(id, saveNameFor(id), m.save_reason_failed());
  } finally {
    const handle = jobHandles.get(id);
    handle?.finish();
    jobHandles.delete(id);
    useSaveStore.setState((s) => {
      const { [id]: _done, ...jobs } = s.jobs;
      return { jobs };
    });
  }
  if (queued.delete(id)) {
    const now = useWorkspaceStore.getState().workspace;
    // Only a save that needs no further press runs by itself.
    const handle = handles.get(id);
    if (handle && answered.has(handle) && !isInFile(now, id))
      await saveDocument(id, { queue: false });
  }
}

async function runSave(id: DocumentId, doc: VirtualDocument): Promise<void> {
  const ws = useWorkspaceStore.getState().workspace;
  let handle = handles.get(id);
  if (handle === undefined) {
    handle = await storedHandleFor(ws, id);
    if (handle) handles.set(id, handle);
  }

  // 1. Unapplied redaction marks first (07.10).
  const marks = await pendingMarksOf(ws, doc);
  const markCount = countMarks(marks);
  let applyFirst = false;
  if (markCount > 0) {
    const { answer } = await ask({ kind: 'marks', documentId: id, count: markCount });
    if (answer === 'cancel') return;
    applyFirst = answer === 'apply';
  }

  // 2. Where the bytes go.
  const plan = planSave({
    inFile: false,
    handle: handle !== undefined,
    replaceAnswered: handle !== undefined && replaceAnswered(handle),
    savePicker: supportsSavePicker(),
    share: canShareFiles(),
  });
  let name = saveNameFor(id);
  let target: WritableFileHandle | undefined;
  if (plan.route === 'in-place' && handle) {
    if (plan.askReplace) {
      const { answer, dontAsk } = await ask({ kind: 'replace', documentId: id, name: handle.name });
      if (answer === 'copy') {
        openExportDialog(id);
        return;
      }
      if (answer !== 'replace') return;
      answered.add(handle);
      if (dontAsk) rememberDontAsk(handle.name);
    }
    // 3. The browser's write prompt, on the latest press's activation.
    if (!(await writePermission(handle))) {
      fail(id, handle.name, m.save_reason_denied());
      return;
    }
    target = handle;
  } else if (plan.route === 'picker') {
    const picked = await pickSaveHandle(name);
    if (picked === 'cancelled') return;
    if (picked) {
      target = picked;
      name = picked.name;
    }
  }
  const route: SaveRoute = target ? plan.route : plan.route === 'share' ? 'share' : 'download';

  // 4. Apply the marks, then assemble and verify, as one job.
  const job = startJob({
    label: m.save_job({ name }),
    progress: 0,
    documentId: id,
    inPlace: mountedButtons > 0,
  });
  jobHandles.set(id, job);
  useSaveStore.setState((s) => ({ jobs: { ...s.jobs, [id]: job.id } }));
  let removed: number | undefined;
  if (applyFirst) {
    removed = await applyMarks(marks);
    if (removed === undefined) {
      fail(id, name, m.save_reason_marks());
      return;
    }
  }
  const written = captureState();
  const result = await prepareExport(id, {
    onProgress: (progress) => job.update({ progress: saveProgress(progress) }),
  });
  if (!result.ok) {
    presentError(
      {
        kind: 'message',
        text: m.save_failed({ name, reason: result.error.message }),
        action: saveACopy(id),
      },
      { key: `save:${id}`, testId: 'save-failure' },
    );
    return;
  }
  const prepared = result.value;
  if (!prepared.verification.ok || (prepared.redaction && !prepared.redaction.report.ok)) {
    fail(id, name, m.save_reason_unverified());
    return;
  }
  job.update({ progress: 95 });

  // 5. Write and read back, or hand over a copy.
  if (target) {
    try {
      await writeAndVerify(target, prepared.bytes);
    } catch (error) {
      const reason = writeFailure(error);
      // A moved or deleted file: the next Save asks for a place again.
      if (reason === 'moved') handles.delete(id);
      fail(id, name, reasonText(reason));
      return;
    }
    handles.set(id, target);
    answered.add(target);
    markSaved(id, { handleKept: true }, written);
    showVerified(id);
    const text =
      removed !== undefined && removed > 0
        ? m.save_verified_removed({ count: removed })
        : m.save_verified();
    toast.success(text, {
      documentId: id,
      testId: 'save-toast',
      spoken: m.save_announce_verified({ name }),
    });
    return;
  }
  if (route === 'share') {
    const shared = await shareCopy(prepared.bytes, name);
    if (shared === 'cancelled') return;
    if (shared === 'shared') {
      markSaved(id, { handleKept: false }, written);
      toast.info(m.save_shared({ name }), {
        documentId: id,
        detail: m.save_copy_detail(),
        testId: 'save-toast',
      });
      return;
    }
  }
  try {
    await deliverPdf(prepared.bytes, name);
  } catch (error) {
    fail(id, name, reasonText(writeFailure(error)));
    return;
  }
  markSaved(id, { handleKept: false }, written);
  toast.info(m.save_downloaded({ name }), {
    documentId: id,
    detail: m.save_copy_detail(),
    testId: 'save-toast',
  });
}

/** Tests: forget handles, answers, jobs and questions. */
export function resetSave(): void {
  handles.clear();
  queued.clear();
  for (const handle of jobHandles.values()) handle.finish();
  jobHandles.clear();
  useSaveStore.getState().pending?.resolve({ answer: 'cancel', dontAsk: false });
  useSaveStore.setState({ pending: null, jobs: {}, verifiedAt: {} });
}

/** Whether the saved store knows document `id` was written through a kept handle. */
export function savedInPlace(id: DocumentId): boolean {
  return useSavedStore.getState().marks[id]?.handleKept === true;
}
