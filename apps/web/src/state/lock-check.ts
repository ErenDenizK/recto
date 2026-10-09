/**
 * Lock enforced where every change passes (ADR-0030 §2.5, §2.6; redesign spec §7, X11, X12;
 * PLAN D1-3). `workspace-store`'s `commit()` asks `lockedChange` with the workspace before and
 * after an operation and refuses the change when a locked document changed, so a site that
 * forgot the guard (`state/guard.ts`) still fails closed. The edit runner asks
 * `lockedEngineEdit` before it posts an edit to the worker, and replays the inverses of what it
 * already ran when the answer, or `commit()`, refuses (`annotations/edit-runner.ts`).
 *
 * A change to a locked document is:
 *
 * - **its object differs** (`documents[id]`; structural sharing makes this a pointer check),
 *   for every document present before and after (X12): closing a locked document, opening or
 *   making another one and reordering tabs are not changes to it, and undoing a close brings it
 *   back locked (the lock outlives the tab, `lock-store`);
 * - **an engine edit added or removed on a source page it shows** (X11). Engine edits are kept
 *   per source page, so after Combine with kept sources an annotation on a page the combined
 *   document shares with a locked input is refused ("This page is shared with locked
 *   report.pdf"); the combined document's page structure stays free. An edit that may change
 *   pages other than its own (a form value, which every widget of the field shows; an applied
 *   redaction; an image inside a Form XObject) counts for every page of its source.
 *
 * Undo, Redo and History jumps never ask (ADR-0030 §2.7). Each refusal is reported to the
 * listeners (`onLockRefusal`; the Unlock popover at the refusing control, D1-4a) and, in
 * development, logged with the stack of the site that asked.
 *
 * Reads `lock-store` only; the workspaces come from the caller, so there is no import cycle.
 */
import {
  type DocumentId,
  documentsSharingSource,
  type EngineEdit,
  sourcePagesShownBy,
  type SourceId,
  type Workspace,
} from '@pdf-editor/document-model';

import { type LockReason, useLockStore } from './lock-store';

/** Why a change to the workspace is refused. */
export type LockedChange =
  /** The locked document itself changed (its pages, outline, metadata, title…). */
  | { readonly kind: 'document'; readonly documentId: DocumentId; readonly reason: LockReason }
  /** An engine edit on a source page the locked document shows (its own, or shared, X11). */
  | {
      readonly kind: 'page';
      readonly documentId: DocumentId;
      readonly reason: LockReason;
      readonly source: SourceId;
      /** The page, or undefined when the edit may change every page of the source. */
      readonly pageIndex: number | undefined;
    };

type Locks = Readonly<Record<DocumentId, LockReason>>;

const currentLocks = (): Locks => useLockStore.getState().locks;

/**
 * The source pages an engine edit may change: its own page for annotations, marks, text edits
 * and an image the page draws itself; the layer's pages for OCR; undefined (every page of the
 * source) for a form value, an applied redaction and an image inside a Form XObject, which
 * other pages may show too.
 */
export function enginePagesOf(edit: EngineEdit): readonly number[] | undefined {
  switch (edit.kind) {
    case 'form.set-value':
    case 'redaction.apply':
      return undefined;
    case 'image.transform':
    case 'image.remove':
    case 'image.replace': {
      const payload = edit.payload as { readonly image?: { readonly objectPath?: unknown } } | null;
      const path = payload?.image?.objectPath;
      return Array.isArray(path) && path.length === 1 ? [edit.pageIndex] : undefined;
    }
    case 'ocr.apply': {
      const payload = edit.payload as { readonly pages?: unknown } | null;
      const pages = new Set([edit.pageIndex]);
      for (const item of Array.isArray(payload?.pages) ? (payload.pages as unknown[]) : []) {
        const pageIndex = (item as { readonly pageIndex?: unknown } | null)?.pageIndex;
        if (Number.isInteger(pageIndex)) pages.add(pageIndex as number);
      }
      return [...pages];
    }
    default:
      return [edit.pageIndex];
  }
}

/** The locked document whose shown pages `edit` would change in `ws`, if any. */
export function lockedEngineEdit(
  ws: Workspace,
  edit: EngineEdit,
  locks: Locks = currentLocks(),
): LockedChange | undefined {
  if (Object.keys(locks).length === 0) return undefined;
  const pages = enginePagesOf(edit);
  for (const pageIndex of pages ?? [undefined]) {
    for (const documentId of documentsSharingSource(ws, edit.source, pageIndex)) {
      const reason = locks[documentId];
      if (reason !== undefined) {
        return { kind: 'page', documentId, reason, source: edit.source, pageIndex };
      }
    }
  }
  return undefined;
}

/** Whether a locked document of `ws` shows any page of `source` (cheap first test). */
function lockedShowsSource(ws: Workspace, source: SourceId, locks: Locks): boolean {
  for (const id of Object.keys(locks) as DocumentId[]) {
    if (ws.documents[id] !== undefined && sourcePagesShownBy(ws, id).has(source)) return true;
  }
  return false;
}

/**
 * Why going from `before` to `after` changes a locked document, or undefined when it does not
 * (see the module comment).
 */
export function lockedChange(
  before: Workspace,
  after: Workspace,
  locks: Locks = currentLocks(),
): LockedChange | undefined {
  const locked = Object.keys(locks) as DocumentId[];
  if (locked.length === 0 || before === after) return undefined;
  for (const id of locked) {
    const was = before.documents[id];
    const now = after.documents[id];
    // Present before and after only (X12): a close, an open or a new document is no change.
    if (was !== undefined && now !== undefined && was !== now) {
      return { kind: 'document', documentId: id, reason: locks[id] as LockReason };
    }
  }
  if (before.engineEdits === after.engineEdits) return undefined;
  const kept = new Set(before.engineEdits);
  const still = new Set(after.engineEdits);
  const changed = [
    ...after.engineEdits.filter((edit) => !kept.has(edit)),
    ...before.engineEdits.filter((edit) => !still.has(edit)),
  ];
  // Against the documents after the change: closing a locked document drops the edits of a
  // source no page shows any more (`removeSourceIfUnreferenced`), which changes nothing shown.
  for (const edit of changed) {
    if (!lockedShowsSource(after, edit.source, locks)) continue;
    const refusal = lockedEngineEdit(after, edit, locks);
    if (refusal !== undefined) return refusal;
  }
  return undefined;
}

/** A refusal as reported: what was refused, and the history label of the change. */
export interface LockRefusal {
  readonly change: LockedChange;
  readonly label: string;
}

type RefusalListener = (refusal: LockRefusal) => void;
const listeners = new Set<RefusalListener>();

/** Listens to refusals (the Unlock popover at the refusing control, D1-4a). */
export function onLockRefusal(listener: RefusalListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reports a refusal: to the listeners and, in development, to the console with the stack of
 * the site that asked (ADR-0030 §2.5), so a control that offered a locked act is found.
 */
export function reportLockRefusal(change: LockedChange, label: string): void {
  if (import.meta.env.DEV) {
    console.warn(
      `Lock refused "${label}" on ${change.documentId} (${change.reason}, ${change.kind})`,
      new Error('refused here').stack,
    );
  }
  for (const listener of listeners) listener({ change, label });
}

/** Raised by the edit runner when an edit asks for a locked page (ADR-0030 §2.6). */
export class LockRefusedError extends Error {
  constructor(
    readonly change: LockedChange,
    /** What asked (the edit's kind), for the report. */
    readonly label: string,
  ) {
    super(`Locked: ${change.documentId}`);
    this.name = 'LockRefusedError';
  }
}
