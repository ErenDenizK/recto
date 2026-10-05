/**
 * The saved mark (spec redesign X13; ADR-0032 §5.2): a pristine document is in its file, a
 * change takes it out, a verified save puts it back, undo and redo move the answer with the
 * history, a document that appears changed has no mark, and the origin Revert reopens.
 */
import {
  addSource,
  closeDocument,
  createSequentialIdGenerator,
  createWorkspace,
  type DocumentId,
  type EngineEdit,
  type PageId,
  renameDocument,
  rotatePages,
  type SourceId,
  splitDocument,
  type Workspace,
} from '@pdf-editor/document-model';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  adoptFileFacts,
  editSignature,
  fileFactsOf,
  fileIsAsOpened,
  isInFile,
  markSaved,
  matchesMark,
  observeDocuments,
  originOf,
  pushOrigin,
  resetSavedMarks,
  useSavedStore,
} from './saved-store';

const ids = createSequentialIdGenerator('saved');

function withSource(ws: Workspace, name: string, pageCount = 2): Workspace {
  return addSource(
    ws,
    {
      name,
      byteLength: 4,
      pageCount,
      pages: Array.from({ length: pageCount }, () => ({
        size: { width: 612, height: 792 },
        rotation: 0,
      })),
      fingerprint: name,
      flags: {
        encrypted: false,
        repaired: false,
        hasAcroForm: false,
        hasXfa: false,
        hasSignatures: false,
        tagged: false,
        linearized: false,
      },
      metadata: { policy: 'inherit-first-source' },
      outline: [],
    },
    ids,
  ).workspace;
}

function only(ws: Workspace): DocumentId {
  const id = ws.documentOrder[ws.documentOrder.length - 1];
  if (id === undefined) throw new Error('no document');
  return id;
}

function annotationEdit(ws: Workspace, id: DocumentId, editId: string): Workspace {
  const page = ws.documents[id]?.pages[0];
  if (page?.ref.kind !== 'source') throw new Error('no source page');
  const edit: EngineEdit = {
    id: editId,
    source: page.ref.source,
    pageIndex: 0,
    kind: 'annotation.create',
    payload: {},
  };
  return { ...ws, engineEdits: [...ws.engineEdits, edit] };
}

describe('saved mark', () => {
  beforeEach(() => resetSavedMarks());

  it('a document opened as its file is in its file; a change takes it out', () => {
    const opened = withSource(createWorkspace(), 'report.pdf');
    const id = only(opened);
    observeDocuments(opened, 1);
    expect(isInFile(opened, id)).toBe(true);
    expect(useSavedStore.getState().marks[id]?.handleKept).toBe(false);
    expect(useSavedStore.getState().marks[id]?.entryAt).toBe(1);

    const page = opened.documents[id]?.pages[0]?.id ?? ('' as PageId);
    const rotated = rotatePages(opened, [page], 90);
    expect(isInFile(rotated, id)).toBe(false);
    // Undo returns the same document object: in the file again, with no bookkeeping.
    expect(isInFile(opened, id)).toBe(true);
  });

  it('a rename changes no byte Save writes: still in the file', () => {
    const opened = withSource(createWorkspace(), 'report.pdf');
    const id = only(opened);
    observeDocuments(opened, 1);
    expect(isInFile(renameDocument(opened, id, 'Quarterly report'), id)).toBe(true);
  });

  it('engine edits (annotations) count as changes to the document', () => {
    const opened = withSource(createWorkspace(), 'report.pdf');
    const id = only(opened);
    observeDocuments(opened, 1);
    const annotated = annotationEdit(opened, id, 'e1');
    expect(editSignature(annotated, annotated.documents[id]!)).toBe('e1');
    expect(isInFile(annotated, id)).toBe(false);
  });

  it('a verified save puts the present state in the file; undo past it shows the change', () => {
    const opened = withSource(createWorkspace(), 'report.pdf');
    const id = only(opened);
    observeDocuments(opened, 1);
    const page = opened.documents[id]?.pages[0]?.id ?? ('' as PageId);
    const rotated = rotatePages(opened, [page], 90);
    markSaved(id, { handleKept: true }, { workspace: rotated, entryAt: 2 });
    expect(isInFile(rotated, id)).toBe(true);
    expect(useSavedStore.getState().marks[id]).toMatchObject({ entryAt: 2, handleKept: true });
    // The file now holds the rotation: the opened state is a change against it.
    expect(isInFile(opened, id)).toBe(false);
    // Redo back to the saved entry: in the file again.
    expect(isInFile(rotated, id)).toBe(true);
  });

  it('a change made while the save ran stays out of the file', () => {
    const opened = withSource(createWorkspace(), 'report.pdf');
    const id = only(opened);
    observeDocuments(opened, 1);
    const page = opened.documents[id]?.pages[0]?.id ?? ('' as PageId);
    const written = rotatePages(opened, [page], 90);
    const later = rotatePages(written, [page], 90);
    markSaved(id, { handleKept: true }, { workspace: written, entryAt: 2 });
    expect(isInFile(later, id)).toBe(false);
  });

  it('a document that appears changed (a combine, images, a restored edit) has no mark', () => {
    const opened = withSource(createWorkspace(), 'report.pdf');
    const id = only(opened);
    const page = opened.documents[id]?.pages[0]?.id ?? ('' as PageId);
    const restored = rotatePages(opened, [page], 90);
    observeDocuments(restored, 5);
    expect(useSavedStore.getState().marks[id]).toBeUndefined();
    expect(isInFile(restored, id)).toBe(false);
    // Seen once: becoming pristine later (an undo) does not invent a mark.
    observeDocuments(opened, 6);
    expect(isInFile(opened, id)).toBe(false);
  });

  it('marks are per document; closing one leaves the other', () => {
    const one = withSource(createWorkspace(), 'a.pdf');
    const two = withSource(one, 'b.pdf');
    const a = one.documentOrder[0] as DocumentId;
    const b = only(two);
    observeDocuments(two, 1);
    expect(isInFile(two, a)).toBe(true);
    expect(isInFile(two, b)).toBe(true);
    const page = two.documents[b]?.pages[0]?.id ?? ('' as PageId);
    const changed = rotatePages(two, [page], 90);
    expect(isInFile(changed, a)).toBe(true);
    expect(isInFile(changed, b)).toBe(false);
    expect(isInFile(closeDocument(changed, b), b)).toBe(false);
  });

  it('an unknown document or a missing mark is not in a file', () => {
    const ws = withSource(createWorkspace(), 'report.pdf');
    expect(matchesMark(ws, 'nope' as DocumentId, undefined)).toBe(false);
    expect(isInFile(ws, only(ws), {})).toBe(false);
  });

  it("a split part is never its source's file: no origin, so Save never writes over it", () => {
    const opened = withSource(createWorkspace(), 'report.pdf', 3);
    const id = only(opened);
    observeDocuments(opened, 1);
    const source = originOf(opened, id);
    expect(source).toBeDefined();
    // Every N pages: the parts replace the document; each shows only report.pdf's pages.
    const split = splitDocument(opened, id, { mode: 'every', n: 1 }, ids);
    observeDocuments(split, 2);
    for (const part of split.documentOrder) expect(originOf(split, part)).toBeUndefined();
    // Ranges with pages left over: the document keeps its id and its file; the part has none.
    resetSavedMarks();
    observeDocuments(opened, 1);
    const ranged = splitDocument(opened, id, { mode: 'ranges', ranges: [[0, 0]] }, ids);
    observeDocuments(ranged, 2);
    expect(originOf(ranged, id)).toBe(source);
    const part = ranged.documentOrder.find((d) => d !== id) as DocumentId;
    expect(originOf(ranged, part)).toBeUndefined();
  });

  it('a pristine copy of a source another document shows is not the file either', () => {
    const opened = withSource(createWorkspace(), 'report.pdf', 2);
    const id = only(opened);
    observeDocuments(opened, 1);
    // All pages extracted into a new document: pristine, but report.pdf's tab shows them too.
    const doc = opened.documents[id]!;
    const copyId = 'saved-copy' as DocumentId;
    const copied: Workspace = {
      ...opened,
      documents: { ...opened.documents, [copyId]: { ...doc, id: copyId } },
      documentOrder: [...opened.documentOrder, copyId],
    };
    observeDocuments(copied, 2);
    expect(originOf(copied, id)).toBeDefined();
    expect(originOf(copied, copyId)).toBeUndefined();
    // It has no file yet, so nothing of it is "in its file" (Save is Save as, not "Saved").
    expect(isInFile(copied, id)).toBe(true);
    expect(isInFile(copied, copyId)).toBe(false);
  });

  it('a restored document takes back its file facts; an older snapshot leaves them unknown', () => {
    const opened = withSource(createWorkspace(), 'report.pdf');
    const id = only(opened);
    const source = Object.keys(opened.sources)[0] as SourceId;
    observeDocuments(opened, 1);
    expect(fileFactsOf(id)).toEqual({ origins: [source], writtenOver: false });
    markSaved(id, { handleKept: true }, { workspace: opened, entryAt: 2 });
    expect(fileFactsOf(id)).toEqual({ origins: [source], writtenOver: true });

    // A reload: the restore sees the pristine document, then its place's facts come back.
    resetSavedMarks();
    observeDocuments(opened, 1);
    expect(isInFile(opened, id)).toBe(true);
    adoptFileFacts(id, { origins: [source], writtenOver: true });
    expect(fileIsAsOpened(id)).toBe(false);
    // The file holds the saved changes, not the opened bytes.
    expect(isInFile(opened, id)).toBe(false);

    // A copy of pages another document showed kept no origin: it restores alone and pristine,
    // and still is no file's, so nothing of it is in a file.
    resetSavedMarks();
    observeDocuments(opened, 1);
    adoptFileFacts(id, { origins: [], writtenOver: false });
    expect(originOf(opened, id)).toBeUndefined();
    expect(fileIsAsOpened(id)).toBe(true);
    expect(isInFile(opened, id)).toBe(false);

    // The file, as opened, never written over: in its file, as before the reload.
    resetSavedMarks();
    observeDocuments(opened, 1);
    adoptFileFacts(id, { origins: [source], writtenOver: false });
    expect(originOf(opened, id)).toBe(source);
    expect(fileIsAsOpened(id)).toBe(true);
    expect(isInFile(opened, id)).toBe(true);

    // A snapshot from before the facts were kept: the origin seen stays, the file is unknown.
    resetSavedMarks();
    observeDocuments(opened, 1);
    adoptFileFacts(id, {});
    expect(originOf(opened, id)).toBe(source);
    expect(fileIsAsOpened(id)).toBe(false);
    expect(isInFile(opened, id)).toBe(true);
  });

  it('remembers the source a document came from; the newest one present wins', () => {
    const opened = withSource(createWorkspace(), 'report.pdf');
    const id = only(opened);
    observeDocuments(opened, 1);
    const first = opened.documents[id]?.pages[0]?.ref;
    if (first?.kind !== 'source') throw new Error('no source');
    expect(originOf(opened, id)).toBe(first.source);
    const reverted = withSource(opened, 'report.pdf');
    const newSource = Object.keys(reverted.sources).find((s) => s !== first.source);
    if (newSource === undefined) throw new Error('no second source');
    pushOrigin(id, newSource as never);
    expect(originOf(reverted, id)).toBe(newSource);
    // Undo of the revert: the new source is gone from the workspace, the old one answers.
    expect(originOf(opened, id)).toBe(first.source);
  });
});
