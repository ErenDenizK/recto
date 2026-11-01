/**
 * Opening Save a copy (components/07-sheets.md §4.1; spec redesign D0-9): every output that is
 * not Save in place goes through the one sheet, opened for a document with what the opener
 * presets. The sheet itself loads on first use (`SaveCopyHost.tsx`, quality-bar Q-11), so this
 * module stays small: it holds the sheet's id, the openers, and the summary of each
 * document's last copy for the toast's Details (memory only, like the sheet's drafts).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import type { RasterFormat } from '@pdf-editor/engine/client';
import { create } from 'zustand';

import type { SaveReceipt } from './receipt';

import { closeSheet, type OpenSheet, openSheet, useSheetStore } from '../ui/sheet/sheet-store';

/** The sheet's id in `sheet-store` (drafts key on it). */
export const SAVE_COPY_SHEET = 'save-copy';

/**
 * What an opener asks for (§4.1): Compress… opens on Size with Smaller chosen, Export as
 * images… on Images, Export as Markdown… on Text, Save repaired copy on PDF; `details` shows
 * the last copy's summary (the toast's Details).
 */
export type SaveCopyPreset = 'pdf' | 'size' | 'images' | 'text' | 'details';

export function isSaveCopyPreset(value: string | null): value is SaveCopyPreset {
  return (
    value === 'pdf' ||
    value === 'size' ||
    value === 'images' ||
    value === 'text' ||
    value === 'details'
  );
}

/**
 * What the palette asks of Save a copy (PRD-40, spec niyet §2.12): a preset as above, or a preset
 * with the facts a sentence named. `size` carries the byte target of "under 2 MB" (the sheet
 * picks the least lossy Size that meets it once its estimates arrive), `images` the type and
 * the 1-based page range text of the Images section ("" for every page), `text` the format.
 * The sheet only opens set up: it never writes a file by itself.
 */
export type SaveCopyRequest =
  | SaveCopyPreset
  | { readonly kind: 'size'; readonly targetBytes: number }
  | { readonly kind: 'images'; readonly type: RasterFormat; readonly range: string }
  | { readonly kind: 'text'; readonly format: 'markdown' | 'text' };

/** The requests that carry facts, by the sheet request they opened (memory only, like drafts). */
const requests = new WeakMap<OpenSheet, Exclude<SaveCopyRequest, string>>();

/** The request that opened `open`, when it carried facts; null for a plain preset. */
export function saveCopyRequestOf(open: object | null): Exclude<SaveCopyRequest, string> | null {
  return open === null ? null : (requests.get(open as OpenSheet) ?? null);
}

/** Opens Save a copy for `documentId`, replacing any open sheet (its draft stays). */
export function openSaveCopy(documentId: DocumentId, request: SaveCopyRequest | null = null): void {
  const preset = typeof request === 'object' && request !== null ? request.kind : request;
  openSheet(SAVE_COPY_SHEET, { docId: documentId, preset });
  if (typeof request !== 'object' || request === null) return;
  const { open } = useSheetStore.getState();
  if (open) requests.set(open, request);
}

export function closeSaveCopy(): void {
  closeSheet(SAVE_COPY_SHEET);
}

/** The document Save a copy is open for, or null. */
export function saveCopyDocument(): DocumentId | null {
  const { open } = useSheetStore.getState();
  return open?.id === SAVE_COPY_SHEET ? (open.docId as DocumentId | null) : null;
}

/**
 * A sheet opened from inside Save a copy (Strip metadata, Set password, Sign with certificate)
 * replaces it, as every sheet opened from another does (07 §1.1 rule 1), and Save a copy comes
 * back when that sheet is done. Save a copy's leaving for it is not a close: what lives as
 * long as the sheet (the certificate chosen for the copy) stays.
 */
let pushedFor: DocumentId | null = null;
const closedListeners = new Set<(documentId: DocumentId) => void>();

useSheetStore.subscribe((state, previous) => {
  const was = previous.open?.id === SAVE_COPY_SHEET ? previous.open.docId : null;
  const now = state.open?.id === SAVE_COPY_SHEET ? state.open.docId : null;
  if (was === null || was === now || was === pushedFor) return;
  for (const listener of closedListeners) listener(was as DocumentId);
});

/** Calls `listener` with the document whenever Save a copy closes for it. */
export function onSaveCopyClosed(listener: (documentId: DocumentId) => void): () => void {
  closedListeners.add(listener);
  return () => closedListeners.delete(listener);
}

/** A sheet opened from Save a copy for `documentId` is about to replace it. */
export function pushOverSaveCopy(documentId: DocumentId): void {
  pushedFor = documentId;
}

/**
 * The sheet pushed over Save a copy closed: with `back`, Save a copy returns (its draft
 * kept); without (another sheet replaced the pushed one), Save a copy has closed for good.
 */
export function popToSaveCopy(back: boolean): void {
  const documentId = pushedFor;
  pushedFor = null;
  if (documentId === null) return;
  if (back) openSaveCopy(documentId);
  else for (const listener of closedListeners) listener(documentId);
}

/** One line of a copy's summary (`export/summary.ts`), as the Details page lists it. */
export interface CopySummaryItem {
  readonly id: string;
  readonly text: string;
  readonly tone: string;
  readonly details?: readonly string[] | undefined;
}

/** What the last copy of a document was, for Details. */
export interface CopySummary {
  readonly name: string;
  readonly size: number;
  readonly verified: boolean;
  readonly seconds: number | null;
  readonly items: readonly CopySummaryItem[];
  /** What the save receipt proved about a PDF copy's bytes (PLAN.md E13-c), when it could. */
  readonly proof?: SaveReceipt | undefined;
  /** The receipt's line once the copy went somewhere (E13-u, `receipt-text.ts`). */
  readonly receipt?: string | undefined;
}

interface SaveCopyResults {
  readonly results: Readonly<Record<string, CopySummary>>;
}

export const useSaveCopyResults = create<SaveCopyResults>()(() => ({ results: {} }));

export function keepCopySummary(documentId: DocumentId, summary: CopySummary): void {
  useSaveCopyResults.setState((s) => ({ results: { ...s.results, [documentId]: summary } }));
}
