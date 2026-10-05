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
  rotatePages,
  type Workspace,
} from '@pdf-editor/document-model';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  editSignature,
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

    const page = opened.documents[id]?.pages[0]?.id ?? '';
    const rotated = rotatePages(opened, [page], 90);
    expect(isInFile(rotated, id)).toBe(false);
    // Undo returns the same document object: in the file again, with no bookkeeping.
    expect(isInFile(opened, id)).toBe(true);
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
    const page = opened.documents[id]?.pages[0]?.id ?? '';
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
    const page = opened.documents[id]?.pages[0]?.id ?? '';
    const written = rotatePages(opened, [page], 90);
    const later = rotatePages(written, [page], 90);
    markSaved(id, { handleKept: true }, { workspace: written, entryAt: 2 });
    expect(isInFile(later, id)).toBe(false);
  });

  it('a document that appears changed (a combine, images, a restored edit) has no mark', () => {
    const opened = withSource(createWorkspace(), 'report.pdf');
    const id = only(opened);
    const page = opened.documents[id]?.pages[0]?.id ?? '';
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
    const page = two.documents[b]?.pages[0]?.id ?? '';
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
