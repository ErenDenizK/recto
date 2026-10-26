/**
 * The copy cache of the compact ⋯ menu (`compact-actions.ts`; design/phone-2026-10/README.md
 * §6, code-audit §3 "Bug to fix before editing ships"): a copy is keyed on the document and its
 * content edits, so an annotation added, undone or redone after the copy was prepared makes a
 * new copy, and Share never hands out a stale one.
 */
import type { VirtualDocument, Workspace } from '@pdf-editor/document-model';
import { PDFDocument } from '@cantoo/pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';

import { useToastStore } from '../../ui/Toast/toast-store';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { createAnnotations } from '../../annotations/actions';
import { undoStep } from '../../history/actions';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { fixtureFile } from '../../../test/store-harness';
import {
  copyKey,
  openDocument,
  openPdf,
  prepareCopy,
  sameCopy,
  shareOrDownload,
} from './compact-actions';
import { resetCompactStore } from './compact-store';

/** The /Annots entries of a copy's first page. */
async function annotsOnFirstPage(file: File): Promise<number> {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  return pdf.getPage(0).node.Annots()?.size() ?? 0;
}

describe('the copy key', () => {
  const doc = { id: 'd' } as unknown as VirtualDocument;
  const ws = (engineEdits: Workspace['engineEdits']) => ({ engineEdits }) as unknown as Workspace;

  it('holds while the document and its edits are the same objects', () => {
    const edits: Workspace['engineEdits'] = [];
    expect(sameCopy(copyKey(doc, ws(edits)), copyKey(doc, ws(edits)))).toBe(true);
  });

  it('breaks on a new edit list (an edit, undo or redo) or a new document object', () => {
    const before: Workspace['engineEdits'] = [];
    const after = [...before];
    expect(sameCopy(copyKey(doc, ws(before)), copyKey(doc, ws(after)))).toBe(false);
    const other = { ...doc };
    expect(sameCopy(copyKey(doc, ws(before)), copyKey(other, ws(before)))).toBe(false);
  });
});

describe('prepareCopy', () => {
  beforeEach(async () => {
    resetWorkspace();
    resetCompactStore();
    expect(await openPdf(await fixtureFile(simpleUrl, 'simple-text.pdf'))).toBe(true);
  });

  it('reuses the copy until an edit, then makes a copy with the edit; undo makes another', async () => {
    const doc = openDocument();
    if (!doc) throw new Error('no document');
    const first = prepareCopy(doc);
    expect(prepareCopy(doc)).toBe(first);
    const pristine = await first;

    const page = doc.pages[0];
    if (page?.ref.kind !== 'source') throw new Error('no source page');
    const created = await createAnnotations(
      { source: page.ref.source, pageIndex: 0, pageId: page.id, position: 1 },
      [
        {
          kind: 'square',
          pageIndex: 0,
          rect: { x: 100, y: 500, width: 120, height: 60 },
          color: '#E5484D',
          opacity: 1,
          strokeWidth: 2,
        },
      ],
    );
    expect(created).toHaveLength(1);
    // The document object is the same; only its edits changed.
    expect(openDocument()).toBe(doc);

    const edited = prepareCopy(doc);
    expect(edited).not.toBe(first);
    expect(prepareCopy(doc)).toBe(edited);
    const withSquare = await edited;
    expect(await annotsOnFirstPage(pristine)).toBe(0);
    expect(await annotsOnFirstPage(withSquare)).toBe(1);

    const editsWithSquare = useWorkspaceStore.getState().workspace.engineEdits;
    expect(undoStep()).toBe(true);
    expect(useWorkspaceStore.getState().workspace.engineEdits).not.toBe(editsWithSquare);
    const undone = prepareCopy(doc);
    expect(undone).not.toBe(edited);
    await expect(undone).resolves.toBeInstanceOf(File);
  });
});

describe('Save a copy', () => {
  beforeEach(async () => {
    resetWorkspace();
    resetCompactStore();
    expect(await openPdf(await fixtureFile(simpleUrl, 'simple-text.pdf'))).toBe(true);
  });

  it("says the copy was downloaded, in the full edition's words and toast key", async () => {
    URL.createObjectURL = () => 'blob:copy';
    await shareOrDownload('download');
    const saved = useToastStore.getState().shown.find((t) => t.testId === 'save-copy-toast');
    expect(saved?.text).toMatch(/^Downloaded simple-text\.pdf · /);
  });
});
