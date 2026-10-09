/**
 * Lock enforced in `commit()` (ADR-0030 §2.5–§2.7; redesign spec §7, X11, X12; PLAN D1-3),
 * through the real workspace store, edit runner and engine: every act family is refused on a
 * locked document whatever asked, the engine's bytes stay as they were, closing and undoing a
 * close keep the lock, Undo and Redo still move, and a copy of the locked file is the file.
 */
import {
  addFormField,
  type BlobId,
  type DocumentId,
  type EngineEdit,
  getActiveDocument,
  historyEntries,
  type ImageOverlay,
  mergeDocuments,
  newFormField,
  renameDocument,
  setDocumentFurniture,
  setMetadata,
  setPageCropBox,
  setPageOverlays,
  type SourceId,
} from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import signedUrl from '../../../../test/fixtures/signed-approval.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { createAnnotations, deleteAnnotations } from '../annotations/actions';
import { resetAnnotationStore } from '../annotations/annotation-store';
import {
  appliedEditIds,
  readAnnotations,
  resetEditRunner,
  whenIdle,
} from '../annotations/edit-runner';
import { prepareExport } from '../export/export-service';
import { type LockRefusal, onLockRefusal } from './lock-check';
import { resetLockStore, useLockStore } from './lock-store';
import { resetSavedMarks } from './saved-store';
import { resetWorkspace, useWorkspaceStore } from './workspace-store';

const model = () => useWorkspaceStore.getState();
const entries = () => historyEntries(model().history).length;

interface Opened {
  readonly id: DocumentId;
  readonly source: SourceId;
}

async function open(url: string, name: string): Promise<Opened> {
  const report = await model().openFiles([await fixtureFile(url, name)]);
  const id = report.opened[0]?.documentId;
  const first = id === undefined ? undefined : model().workspace.documents[id]?.pages[0]?.ref;
  if (id === undefined || first?.kind !== 'source') throw new Error(`${name} did not open`);
  return { id, source: first.source };
}

const doc = (id: DocumentId) => {
  const found = model().workspace.documents[id];
  if (!found) throw new Error(`no document ${id}`);
  return found;
};
const pageIds = (id: DocumentId) => doc(id).pages.map((page) => page.id);

let edits = 0;
const edit = (source: SourceId, kind: EngineEdit['kind'], pageIndex = 0): EngineEdit => ({
  id: `lock-test-${++edits}`,
  source,
  pageIndex,
  kind,
  payload: {},
});

describe('Lock in commit()', () => {
  let refusals: LockRefusal[] = [];
  let stop: () => void = () => undefined;

  beforeEach(() => {
    resetWorkspace();
    resetEditRunner();
    resetAnnotationStore();
    resetLockStore();
    resetSavedMarks();
    refusals = [];
    stop = onLockRefusal((refusal) => refusals.push(refusal));
    // Development logs every refusal with its stack; the tests count them instead.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    stop();
    vi.restoreAllMocks();
    await whenIdle();
    resetWorkspace();
    resetLockStore();
  });

  /** Asserts that `act` committed nothing: same document object, same edits, same history. */
  function expectRefused(id: DocumentId, act: () => boolean): void {
    const before = { doc: doc(id), edits: model().workspace.engineEdits, entries: entries() };
    const reported = refusals.length;
    expect(act()).toBe(false);
    expect(doc(id)).toBe(before.doc);
    expect(model().workspace.engineEdits).toBe(before.edits);
    expect(entries()).toBe(before.entries);
    expect(refusals.length).toBe(reported + 1);
    expect(refusals.at(-1)?.change.documentId).toBe(id);
  }

  it('refuses every `pages` act: move, rotate, delete, duplicate, crop', async () => {
    const { id } = await open(simpleUrl, 'simple.pdf');
    model().duplicatePages([pageIds(id)[0] as never]);
    useLockStore.getState().lock(id, 'user');
    const [first, second] = pageIds(id) as [never, never];
    expectRefused(id, () => model().rotatePages([first], 90));
    expectRefused(id, () => model().movePages([second], { document: id, index: 0 }));
    expectRefused(id, () => model().deletePages([first]));
    expectRefused(id, () => model().duplicatePages([first]));
    expectRefused(id, () =>
      model().applyOperation(
        (ws) => setPageCropBox(ws, first, { x: 10, y: 10, width: 200, height: 200 }),
        'Crop',
      ),
    );
  });

  it('refuses every `document` act: rename, metadata, furniture, OCR, Apply redactions', async () => {
    const { id, source } = await open(simpleUrl, 'simple.pdf');
    useLockStore.getState().lock(id, 'default');
    const watermark: ImageOverlay = {
      kind: 'image',
      layer: 'over',
      blob: 'watermark' as BlobId,
      anchor: 'center',
      offset: { x: 0, y: 0 },
      scale: 0.5,
      opacity: 0.3,
      role: 'watermark',
    };
    expectRefused(id, () => model().applyOperation((ws) => renameDocument(ws, id, 'B'), 'Rename'));
    expectRefused(id, () =>
      model().applyOperation((ws) => setMetadata(ws, id, { author: 'Someone' }), 'Info'),
    );
    expectRefused(id, () =>
      model().applyOperation((ws) => setDocumentFurniture(ws, id, [watermark]), 'Watermark'),
    );
    expectRefused(id, () => model().applyEngineEdit(edit(source, 'ocr.apply'), 'OCR'));
    expectRefused(id, () => model().applyEngineEdit(edit(source, 'redaction.apply'), 'Apply'));
  });

  it('refuses `targeted`, `freehand`, `place` and `text` edits recorded on its pages', async () => {
    const { id, source } = await open(simpleUrl, 'simple.pdf');
    useLockStore.getState().lock(id, 'signed');
    const page = pageIds(id)[0] as never;
    const image: ImageOverlay = {
      kind: 'image',
      layer: 'over',
      blob: 'photo' as BlobId,
      anchor: 'center',
      offset: { x: 0, y: 0 },
      scale: 1,
      opacity: 1,
    };
    // targeted: restyle an annotation, fill a field, mark a selection for redaction.
    expectRefused(id, () => model().applyEngineEdit(edit(source, 'annotation.update'), 'Style'));
    expectRefused(id, () => model().applyEngineEdit(edit(source, 'form.set-value'), 'Fill'));
    expectRefused(id, () => model().applyEngineEdit(edit(source, 'redaction.mark'), 'Mark'));
    // freehand: a pen stroke; place: a note, an image, a field (X34).
    expectRefused(id, () => model().applyEngineEdit(edit(source, 'annotation.create'), 'Pen'));
    expectRefused(id, () =>
      model().applyOperation((ws) => setPageOverlays(ws, [page], [image]), 'Image'),
    );
    const field = newFormField('text', 'f1' as never, 'Text1', [
      { page, rect: { x: 72, y: 600, width: 120, height: 20 } },
    ]);
    expectRefused(id, () => model().applyOperation((ws) => addFormField(ws, id, field), 'Field'));
    // text: a line and a paragraph edit; image objects too.
    expectRefused(id, () => model().applyEngineEdit(edit(source, 'text.edit'), 'Edit text'));
    expectRefused(id, () =>
      model().applyEngineEdit(edit(source, 'text.editParagraph'), 'Edit paragraph'),
    );
    expectRefused(id, () => model().applyEngineEdit(edit(source, 'image.transform'), 'Move'));
  });

  it('runs no edit in the engine for a locked page and reverts what the action ran (ADR-0030 §2.6)', async () => {
    const { id, source } = await open(simpleUrl, 'simple.pdf');
    const target = { source, pageIndex: 0, pageId: pageIds(id)[0] as never, position: 1 };
    const kept = await createAnnotations(target, [
      {
        kind: 'free-text',
        pageIndex: 0,
        rect: { x: 72, y: 500, width: 200, height: 20 },
        text: 'Before the lock',
        fontSize: 12,
        textColor: '#000000',
      },
    ]);
    const keptId = kept?.[0]?.id;
    if (keptId === undefined) throw new Error('not created');
    const applied = appliedEditIds(source);
    useLockStore.getState().lock(id, 'user');
    const before = entries();
    // freehand (a stroke) and place (a note) …
    expect(
      await createAnnotations(target, [
        {
          kind: 'ink',
          pageIndex: 0,
          paths: [
            [
              { x: 100, y: 400 },
              { x: 200, y: 450 },
            ],
          ],
          rect: { x: 99, y: 399, width: 102, height: 52 },
          strokeWidth: 2,
          color: '#E53935',
        },
      ]),
    ).toBeUndefined();
    // … and targeted (delete the note made before the lock).
    expect(await deleteAnnotations(target, [keptId])).toBeUndefined();
    expect(entries()).toBe(before);
    expect(appliedEditIds(source)).toEqual(applied);
    const left = await readAnnotations(source, 0);
    expect(left.map((a) => a.id)).toEqual([keptId]);
    expect(refusals.length).toBeGreaterThanOrEqual(2);
  });

  it('closing a locked document is no change to it, and undoing the close brings it back locked (X12)', async () => {
    const a = await open(simpleUrl, 'a.pdf');
    const b = await open(simpleUrl, 'b.pdf');
    // Its annotations go with its source when it closes, which is no change either.
    expect(model().applyEngineEdit(edit(a.source, 'annotation.create'), 'Note')).toBe(true);
    useLockStore.getState().lock(a.id, 'user');
    // Opening, activating and reordering other documents are no changes to it either.
    model().setActive(b.id);
    expect(model().reorderDocuments(b.id, 0)).toBe(true);
    model().closeDocument(a.id);
    expect(model().workspace.documents[a.id]).toBeUndefined();
    expect(model().workspace.engineEdits).toEqual([]);
    model().undo();
    expect(model().workspace.documents[a.id]).toBeDefined();
    expect(model().workspace.engineEdits).toHaveLength(1);
    expect(useLockStore.getState().locks[a.id]).toBe('user');
    expect(model().rotatePages(pageIds(a.id), 90)).toBe(false);
    expect(refusals).toHaveLength(1);
  });

  it('Undo and Redo still move while locked (ADR-0030 §2.7)', async () => {
    const { id } = await open(simpleUrl, 'simple.pdf');
    expect(model().rotatePages(pageIds(id), 90)).toBe(true);
    const rotated = doc(id);
    useLockStore.getState().lock(id, 'user');
    expect(model().undo()).toBeDefined();
    expect(doc(id)).not.toBe(rotated);
    expect(model().redo()).toBeDefined();
    expect(doc(id)).toBe(rotated);
    expect(refusals).toHaveLength(0);
  });

  it('a combined document keeps its page structure but no engine edit on a page it shares with a locked input (X11)', async () => {
    const a = await open(simpleUrl, 'report.pdf');
    const b = await open(simpleUrl, 'other.pdf');
    expect(
      model().applyOperation(
        (ws, ids) =>
          mergeDocuments(ws, { documentIds: [a.id, b.id], title: 'Both', keepSources: true }, ids),
        'Combine',
      ),
    ).toBe(true);
    const combined = getActiveDocument(model().workspace)?.id;
    if (combined === undefined || combined === a.id || combined === b.id)
      throw new Error('no combine');
    useLockStore.getState().lock(a.id, 'user');
    expect(model().rotatePages(pageIds(combined), 90)).toBe(true);
    // An annotation on a page of report.pdf, through the combined document, is refused …
    expect(model().applyEngineEdit(edit(a.source, 'annotation.create'), 'Note')).toBe(false);
    const refusal = refusals.at(-1)?.change;
    expect(refusal).toMatchObject({ kind: 'page', documentId: a.id, source: a.source });
    // … one on a page of other.pdf is not.
    expect(model().applyEngineEdit(edit(b.source, 'annotation.create'), 'Note')).toBe(true);
  });

  it('a copy of a locked file is the file, byte for byte, after every act was refused (V1-F12)', async () => {
    const original = await (await fetch(signedUrl)).arrayBuffer();
    const { id, source } = await open(signedUrl, 'signed-approval.pdf');
    useLockStore.getState().lock(id, 'signed');
    expect(model().rotatePages(pageIds(id), 90)).toBe(false);
    expect(model().applyOperation((ws) => renameDocument(ws, id, 'x'), 'Rename')).toBe(false);
    const target = { source, pageIndex: 0, pageId: pageIds(id)[0] as never, position: 1 };
    expect(
      await createAnnotations(target, [
        {
          kind: 'free-text',
          pageIndex: 0,
          rect: { x: 72, y: 500, width: 200, height: 20 },
          text: 'Refused',
          fontSize: 12,
          textColor: '#000000',
        },
      ]),
    ).toBeUndefined();
    const result = await prepareExport(id);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.verification.ok).toBe(true);
    expect(new Uint8Array(result.value.bytes)).toEqual(new Uint8Array(original));
    expect(result.value.signaturesRemoved).toBeUndefined();
  });
});
