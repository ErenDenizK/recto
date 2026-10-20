/**
 * Plain text as a new document (conversion memo step 2, PRD-19): a `.txt` file becomes a new,
 * unsaved document named `<name>.pdf`, made like the document of an image: its pages are the
 * converted PDF's, it is one history entry (so it counts as changed and closing it asks), and
 * it is not added to Recents. The layout is the engine's (`@pdf-editor/engine/text-to-pdf`,
 * loaded only when a text file is opened).
 *
 * Only files named `*.txt` that were dropped or picked themselves convert: not a `.log`, `.csv`
 * or `.md`, and not the text files inside a dropped folder. Over 2 MB the file is refused.
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
import { toast } from '../ui/Toast/toast';
import { isHiddenName, isPdfFile, type NamedFile } from './file-filters';

/** Accept string for pickers and inputs. */
export const TEXT_ACCEPT = '.txt,text/plain';

export const TEXT_PICKER_TYPES: Readonly<Record<string, string[]>> = { 'text/plain': ['.txt'] };

/** The largest text file that converts (bytes). */
export const TEXT_MAX_BYTES = 2 * 1024 * 1024;

/** A file named `*.txt` (a text/plain type alone is not enough). */
export function isTextFile(file: NamedFile): boolean {
  if (isHiddenName(file.name) || isPdfFile(file)) return false;
  return /\.txt$/i.test(file.name);
}

/** The converted document's name: `notes.txt` → `notes.pdf`. */
export function pdfNameForText(name: string): string {
  return /\.txt$/i.test(name) ? name.replace(/\.txt$/i, '.pdf') : `${name}.pdf`;
}

/** Converts one text file to a PDF file named after it. */
export async function textFileToPdf(file: File): Promise<File> {
  const { textToPdf } = await import('@pdf-editor/engine/text-to-pdf');
  const name = pdfNameForText(file.name);
  const bytes = await textToPdf(new Uint8Array(await file.arrayBuffer()), {
    title: name.replace(/\.pdf$/i, ''),
  });
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}

/** Splits the text files off `files`; the rest keeps its order. */
export function takeTextFiles<T extends File>(
  files: readonly T[],
): { readonly text: T[]; readonly rest: T[] } {
  return {
    text: files.filter(isTextFile),
    rest: files.filter((file) => !isTextFile(file)),
  };
}

const model = () => useWorkspaceStore.getState();

/** One text file as one new document; undefined when it was refused or failed (a toast says so). */
async function openTextFile(file: File): Promise<DocumentId | undefined> {
  if (file.size > TEXT_MAX_BYTES) {
    toast.failure(m.text_to_pdf_too_large({ name: file.name }));
    return undefined;
  }
  let pdf: File;
  try {
    pdf = await textFileToPdf(file);
  } catch {
    toast.failure(m.text_to_pdf_failed({ name: file.name }));
    return undefined;
  }
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
  if (!committed || created === undefined) {
    toast.failure(m.text_to_pdf_failed({ name: file.name }));
    return undefined;
  }
  lockOpened([created]);
  announce(m.announce_opened({ name: title }));
  return created;
}

/** Opens each text file as its own new document, in order. */
export async function openTextFiles(files: readonly File[]): Promise<DocumentId[]> {
  const opened: DocumentId[] = [];
  for (const file of files) {
    const id = await openTextFile(file);
    if (id !== undefined) opened.push(id);
  }
  return opened;
}
