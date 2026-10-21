/**
 * A generated PDF as a new, unsaved document (PRD-19, shared by Text to PDF and the Office
 * conversion): the pages are the PDF's, it is one history entry (so it counts as changed and
 * closing it asks), the source is marked generated (Save reads as a new file) and it is not
 * added to Recents.
 */
import {
  closeDocument,
  type DocumentId,
  documentTitleFromName,
  movePages,
  newEmptyDocument,
} from '@pdf-editor/document-model';

import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { markGeneratedSource } from '../session/snapshot';
import { lockOpened } from '../state/lock-store';
import { addLoadedSource, useWorkspaceStore } from '../state/workspace-store';

const model = () => useWorkspaceStore.getState();

/** Opens `pdf` as a new unsaved document; undefined when it did not load (the caller toasts). */
export async function openGeneratedPdf(pdf: File): Promise<DocumentId | undefined> {
  const title = documentTitleFromName(pdf.name);
  let created: DocumentId | undefined;
  const committed = await model().applyComposed(
    async (lease) => {
      const loaded = await model().loadSources([pdf], lease);
      const [entry] = loaded.loaded;
      // Made here, not read from a file: never "the file" (unsaved, changed from the start).
      if (entry !== undefined) markGeneratedSource(entry.source.id);
      return entry;
    },
    (ws, ids, entry) => {
      if (entry === undefined) return ws;
      const made = newEmptyDocument(ws, ids, { title });
      created = made.documentId;
      const added = addLoadedSource(made.workspace, entry.source, ids);
      const pageIds = added.workspace.documents[added.documentId]?.pages.map((p) => p.id) ?? [];
      const moved = movePages(added.workspace, {
        pageIds,
        target: { document: made.documentId, index: 0 },
      });
      return closeDocument(moved, added.documentId);
    },
    () => m.history_open({ name: title }),
  );
  if (!committed || created === undefined) return undefined;
  lockOpened([created]);
  announce(m.announce_opened({ name: title }));
  return created;
}
