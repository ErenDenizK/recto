/**
 * Revert to the opened version… (ADR-0032 §2.2; flows.md §5.1; 07-sheets S1 for the copy and the
 * confirmation; spec redesign D0-8).
 *
 * The bytes a document was opened from never change (sources are immutable, ADR-0005): an
 * in-place save writes a new file but leaves the opened source in the engine and in the
 * snapshot (`session/`), until the snapshot expires. Revert reopens those bytes as a new source
 * and puts its fresh document in place of the old one under the same id, so the tab, its colour
 * and its place stay; the old source leaves the workspace when nothing else shows it (a page
 * combined into another document keeps it, with its edits). It is one history step: "Reverted
 * report.pdf · Undo" brings every change back. After an in-place save the file holds the saved
 * changes, so the reverted document shows ● until it is saved; when nothing was written over
 * the file this session, the reverted document is what the file holds and the ● clears.
 *
 * Available when the document came from one file (`originOf`) and differs from it; else the
 * command is dimmed with "Nothing changed since opening". The guard (`canChange(id,
 * 'document')`, 07-sheets S1 §6) joins with D1.
 */
import {
  type DocumentId,
  documentTitleFromName,
  type History,
  type IdGenerator,
  removeSourceIfUnreferenced,
  type SourceId,
  type Workspace,
} from '@pdf-editor/document-model';
import { getEngineService, type OpenedSource } from '../engine/engine-service';
import { presentError } from '../errors/present';
import { m } from '../i18n';
import { isPristineDocument } from '../session/snapshot';
import {
  editSignature,
  fileIsAsOpened,
  markSaved,
  originOf,
  pushOrigin,
} from '../state/saved-store';
import { addLoadedSource, documentSources, useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast/toast';

export type RevertAvailability =
  | { readonly available: true; readonly source: SourceId }
  | { readonly available: false; readonly reason: string };

/** Whether document `id` can go back to the file it was opened from, and from which source. */
export function revertAvailability(ws: Workspace, id: DocumentId): RevertAvailability {
  const doc = ws.documents[id];
  const source = originOf(ws, id);
  const info = source === undefined ? undefined : ws.sources[source];
  if (doc === undefined || source === undefined || info === undefined) {
    return { available: false, reason: m.revert_unavailable() };
  }
  const first = doc.pages[0]?.ref;
  const asOpened =
    first?.kind === 'source' &&
    first.source === source &&
    isPristineDocument(ws, doc) &&
    doc.title === documentTitleFromName(info.name);
  if (asOpened) return { available: false, reason: m.revert_nothing_changed() };
  return { available: true, source };
}

/**
 * Steps in the history that changed document `id` (its object or its sources' edits), from
 * the oldest entry kept: "Your 3 changes since opening go". 0 when the steps are no longer in
 * the history (a restore keeps the last 20).
 */
export function changesSinceOpening(history: History, id: DocumentId): number {
  const entries = [...history.past, history.present];
  let count = 0;
  for (let i = 1; i < entries.length; i++) {
    const before = entries[i - 1]?.workspace;
    const after = entries[i]?.workspace;
    const a = before?.documents[id];
    const b = after?.documents[id];
    if (!before || !after || a === undefined || b === undefined) continue;
    if (a !== b || editSignature(before, a) !== editSignature(after, b)) count += 1;
  }
  return count;
}

/**
 * The workspace with document `id` replaced by a fresh document of `opened` under the same id
 * and in the same place; the sources it showed leave when nothing else shows them.
 */
export function replaceWithOpened(
  ws: Workspace,
  id: DocumentId,
  opened: OpenedSource,
  ids: IdGenerator,
): Workspace {
  const doc = ws.documents[id];
  if (doc === undefined) throw new Error(`Unknown document ${id}`);
  const before = documentSources(doc);
  const added = addLoadedSource(ws, opened, ids);
  const fresh = added.workspace.documents[added.documentId];
  if (fresh === undefined) throw new Error('The reopened document is missing');
  const { [added.documentId]: _added, ...others } = added.workspace.documents;
  const { activeDocument: _active, ...rest } = added.workspace;
  let next: Workspace = {
    ...rest,
    documents: { ...others, [id]: { ...fresh, id } },
    documentOrder: ws.documentOrder,
    ...(ws.activeDocument === undefined ? {} : { activeDocument: ws.activeDocument }),
  };
  for (const source of before) {
    if (next.sources[source] !== undefined) next = removeSourceIfUnreferenced(next, source);
  }
  return next;
}

/**
 * Reverts document `id` to the opened version as one history step, then shows "Reverted
 * report.pdf · Undo". Resolves to whether it reverted. Never rejects.
 */
export async function revertDocument(id: DocumentId): Promise<boolean> {
  const store = useWorkspaceStore.getState();
  const availability = revertAvailability(store.workspace, id);
  const title = store.workspace.documents[id]?.title ?? '';
  if (!availability.available) return false;
  const source = store.workspace.sources[availability.source];
  if (source === undefined) return false;
  try {
    const bytes = await getEngineService().sourceBytes(availability.source);
    if (!bytes.ok) throw new Error(bytes.error.message);
    let reopened: SourceId | undefined;
    const done = await store.applyComposed(
      async (lease) => {
        const file = new File([bytes.value], source.name, { type: 'application/pdf' });
        const loaded = await useWorkspaceStore.getState().loadSources([file], lease);
        return loaded.loaded[0]?.source;
      },
      (ws, ids, opened) => {
        reopened = opened.id;
        return replaceWithOpened(ws, id, opened, ids);
      },
      m.history_reverted({ name: title }),
    );
    if (!done || reopened === undefined) throw new Error('Nothing was reverted');
    pushOrigin(id, reopened);
    // Nothing was written over the file: the reverted document is what the file holds.
    if (fileIsAsOpened(id)) markSaved(id, { handleKept: false });
    toast.undo(m.revert_done({ name: title }), { documentId: id, testId: 'revert-toast' });
    return true;
  } catch (error) {
    console.warn('Revert failed', error);
    presentError({ kind: 'message', text: m.revert_failed({ name: title }) });
    return false;
  }
}
