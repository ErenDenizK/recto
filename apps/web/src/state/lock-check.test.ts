/**
 * The rule `commit()` applies (ADR-0030 §2.5; X11, X12), over plain workspaces: which pages an
 * engine edit may change, and which before/after pairs change a locked document.
 */
import {
  addSource,
  closeDocument,
  removeSourceIfUnreferenced,
  createSequentialIdGenerator,
  createWorkspace,
  type DocumentId,
  type EngineEdit,
  mergeDocuments,
  type SourceId,
  type Workspace,
} from '@pdf-editor/document-model';
import { describe, expect, it } from 'vitest';

import { enginePagesOf, lockedChange, lockedEngineEdit } from './lock-check';

const size = { width: 612, height: 792 };

function workspace(): { ws: Workspace; a: DocumentId; b: DocumentId; sa: SourceId; sb: SourceId } {
  const ids = createSequentialIdGenerator('l');
  let ws = createWorkspace();
  const made = ['a.pdf', 'b.pdf'].map((name) => {
    const r = addSource(
      ws,
      {
        name,
        byteLength: 100,
        pageCount: 3,
        pages: [0, 1, 2].map(() => ({ size, rotation: 0 as const })),
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
        metadata: { policy: 'explicit' },
        outline: [],
      },
      ids,
    );
    ws = r.workspace;
    return r;
  });
  const [a, b] = made as [(typeof made)[0], (typeof made)[0]];
  return { ws, a: a.documentId, b: b.documentId, sa: a.sourceId, sb: b.sourceId };
}

const edit = (source: SourceId, kind: EngineEdit['kind'], pageIndex = 1, payload: unknown = {}) =>
  ({ id: `${kind}-${pageIndex}`, source, pageIndex, kind, payload }) as EngineEdit;

describe('lock check', () => {
  it('knows which pages an edit may change', () => {
    const { sa } = workspace();
    expect(enginePagesOf(edit(sa, 'annotation.create'))).toEqual([1]);
    expect(enginePagesOf(edit(sa, 'text.editParagraph'))).toEqual([1]);
    // A field shows its value on every widget; an applied redaction may reach shared XObjects.
    expect(enginePagesOf(edit(sa, 'form.set-value'))).toBeUndefined();
    expect(enginePagesOf(edit(sa, 'redaction.apply'))).toBeUndefined();
    expect(
      enginePagesOf(edit(sa, 'image.remove', 1, { image: { objectPath: [3, 1] } })),
    ).toBeUndefined();
    expect(enginePagesOf(edit(sa, 'image.remove', 1, { image: { objectPath: [3] } }))).toEqual([1]);
    expect(
      enginePagesOf(edit(sa, 'ocr.apply', 0, { pages: [{ pageIndex: 0 }, { pageIndex: 2 }] })),
    ).toEqual([0, 2]);
  });

  it('allows everything while nothing is locked, and changes to other documents', () => {
    const { ws, a, b, sb } = workspace();
    const next = { ...ws, engineEdits: [edit(sb, 'annotation.create')] };
    expect(lockedChange(ws, next, {})).toBeUndefined();
    expect(lockedChange(ws, next, { [a]: 'user' })).toBeUndefined();
    expect(lockedChange(ws, next, { [b]: 'user' })).toMatchObject({ kind: 'page', documentId: b });
  });

  it('compares only documents present before and after (X12)', () => {
    const { ws, a } = workspace();
    expect(lockedChange(ws, closeDocument(ws, a), { [a]: 'user' })).toBeUndefined();
    expect(lockedChange(closeDocument(ws, a), ws, { [a]: 'user' })).toBeUndefined();
  });

  it('lets a locked document with annotations close: its source and edits go with it (X12)', () => {
    const { ws, a, sa } = workspace();
    const annotated = { ...ws, engineEdits: [edit(sa, 'annotation.create')] };
    const closed = removeSourceIfUnreferenced(closeDocument(annotated, a), sa);
    expect(closed.engineEdits).toEqual([]);
    expect(lockedChange(annotated, closed, { [a]: 'user' })).toBeUndefined();
  });

  it('refuses removing a locked page’s edit as well as adding one', () => {
    const { ws, a, sa } = workspace();
    const withEdit = { ...ws, engineEdits: [edit(sa, 'annotation.create')] };
    expect(lockedChange(withEdit, ws, { [a]: 'signed' })).toMatchObject({
      kind: 'page',
      documentId: a,
      reason: 'signed',
      pageIndex: 1,
    });
  });

  it('names the locked input of a shared page, and only for the pages it shows (X11)', () => {
    const { ws, a, b, sa } = workspace();
    const ids = createSequentialIdGenerator('m');
    const merged = mergeDocuments(
      ws,
      { documentIds: [a, b], title: 'Both', keepSources: true },
      ids,
    );
    const locks = { [a]: 'user' } as const;
    expect(lockedEngineEdit(merged, edit(sa, 'annotation.create', 2), locks)).toMatchObject({
      documentId: a,
      source: sa,
      pageIndex: 2,
    });
    // A form value changes every page of its source.
    expect(lockedEngineEdit(merged, edit(sa, 'form.set-value', 9), locks)).toMatchObject({
      documentId: a,
      pageIndex: undefined,
    });
    expect(lockedEngineEdit(merged, edit(sa, 'annotation.create', 9), locks)).toBeUndefined();
  });
});
