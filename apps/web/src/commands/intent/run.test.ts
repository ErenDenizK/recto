/**
 * The intent runner (decision PRD-39, PRD-40; spec niyet §2.12, §2.13), Vitest browser mode: a
 * stale key does nothing, a refusing guard runs nothing, a chain of document steps is one
 * history entry that one Undo takes back, an output opens Save a copy set up after the commit,
 * and a failing commit stops the finishing step.
 */
import { deletePages, getActiveDocument, type PageId } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import manyUrl from '../../../../../test/fixtures/many-pages.pdf?url';
import { fixtureFile } from '../../../test/store-harness';
import { saveCopyRequestOf } from '../../export/export-store';
import { useSelectionStore } from '../../state/selection-store';
import { useViewStore } from '../../state/view-store';
import { setLocale } from '../../i18n';
import { registerToolCommands } from '../../tools/tool-commands';
import { resetLockStore, useLockStore } from '../../state/lock-store';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { closeSheet, useSheetStore } from '../../ui/sheet/sheet-store';
import { commandRegistry } from '../registry';
import { gatherIntentContext, workspaceVersion } from './context';
import { parseIntent } from './parse';
import { previewOf } from './preview';
import { runReading } from './run';
import type { Reading } from './types';

const doc = () => {
  const found = getActiveDocument(useWorkspaceStore.getState().workspace);
  if (!found) throw new Error('no document');
  return found;
};

function read(text: string): { reading: Reading; key: string } {
  const result = parseIntent(text, gatherIntentContext());
  if (result.kind !== 'readings') throw new Error(`no reading for ${text}`);
  const reading = result.readings[0];
  return { reading, key: previewOf(reading, gatherIntentContext(), workspaceVersion(), text).key };
}

let dispose: () => void;
beforeEach(async () => {
  setLocale('en');
  resetWorkspace();
  resetLockStore();
  closeSheet();
  await useWorkspaceStore.getState().openFiles([await fixtureFile(manyUrl, 'many.pdf')]);
  dispose = registerToolCommands(commandRegistry);
});
afterEach(() => {
  dispose();
  closeSheet();
});

describe('runReading', () => {
  it('does nothing when the shown key no longer describes the document', async () => {
    const { reading, key } = read('delete 2');
    const before = doc().pages.length;
    expect(await runReading(reading, `${key}x`, 'delete 2')).toBe('stale');
    expect(doc().pages.length).toBe(before);
  });

  it('does nothing when the text moved since the preview', async () => {
    const { reading, key } = read('delete 2');
    expect(await runReading(reading, key, 'delete 3')).toBe('stale');
  });

  it('does nothing when the document changed since the preview was drawn', async () => {
    const { reading, key } = read('delete 2');
    useWorkspaceStore.getState().applyOperation((ws) => ws, 'noop');
    const rotate = read('rotate 1');
    await runReading(rotate.reading, rotate.key, 'rotate 1');
    const before = doc().pages.length;
    expect(await runReading(reading, key, 'delete 2')).toBe('stale');
    expect(doc().pages.length).toBe(before);
  });

  it('refuses on a locked document and changes nothing', async () => {
    const { reading, key } = read('delete 2');
    useLockStore.setState({ locks: { [doc().id]: 'user' } });
    const before = doc().pages.length;
    expect(await runReading(reading, key, 'delete 2')).toBe('refused');
    expect(doc().pages.length).toBe(before);
  });

  it('runs a two-step chain as one history entry and one undo takes both back', async () => {
    const before = doc().pages.length;
    const rotation = doc().pages[1]?.rotation;
    const { reading, key } = read('rotate 2 right and delete 3');
    const undoDepth = useWorkspaceStore.getState().history.past.length;
    expect(await runReading(reading, key, 'rotate 2 right and delete 3')).toBe('ran');
    expect(doc().pages.length).toBe(before - 1);
    expect(doc().pages[1]?.rotation).toBe(((rotation ?? 0) + 90) % 360);
    expect(useWorkspaceStore.getState().history.past.length).toBe(undoDepth + 1);
    useWorkspaceStore.getState().undo();
    expect(doc().pages.length).toBe(before);
    expect(doc().pages[1]?.rotation).toBe(rotation);
  });

  it('acts on the pages it showed, whatever the order does to positions', async () => {
    const ids = doc().pages.map((p) => p.id);
    const text = 'delete 1 and rotate 3';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(doc().pages.map((p) => p.id)).toEqual(ids.slice(1));
    expect(doc().pages.find((p) => p.id === ids[2])?.rotation).not.toBe(0);
  });

  it('reverses a few pages among themselves and leaves the others', async () => {
    const ids = doc().pages.map((p) => p.id);
    const text = 'reverse pages 1-3';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(
      doc()
        .pages.map((p) => p.id)
        .slice(0, 4),
    ).toEqual([ids[2], ids[1], ids[0], ids[3]]);
  });

  it('opens Save a copy set up for an output, after the document steps committed', async () => {
    const text = 'rotate 1 and compress under 2 MB';
    const { reading, key } = read(text);
    const depth = useWorkspaceStore.getState().history.past.length;
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(useWorkspaceStore.getState().history.past.length).toBe(depth + 1);
    const { open } = useSheetStore.getState();
    expect(open?.id).toBe('save-copy');
    expect(saveCopyRequestOf(open)).toEqual({ kind: 'size', targetBytes: 2 * 1024 * 1024 });
  });

  it('opens Images with the type and range, and writes nothing', async () => {
    const text = 'save pages 2-3 as png';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(saveCopyRequestOf(useSheetStore.getState().open)).toEqual({
      kind: 'images',
      type: 'png',
      range: '2-3',
    });
  });

  it('opens Images for every page with an empty range', async () => {
    const { reading, key } = read('jpg olarak kaydet');
    expect(await runReading(reading, key, 'jpg olarak kaydet')).toBe('ran');
    expect(saveCopyRequestOf(useSheetStore.getState().open)).toEqual({
      kind: 'images',
      type: 'jpeg',
      range: '',
    });
  });

  it('stops before the finishing step when the commit changes nothing', async () => {
    const text = 'rotate 1 and compress';
    const { reading, key } = read(text);
    // The operation throws (the page it names is gone), so the store commits nothing.
    const store = useWorkspaceStore.getState();
    const original = store.applyOperation;
    useWorkspaceStore.setState({ applyOperation: () => false });
    try {
      expect(await runReading(reading, key, text)).toBe('refused');
    } finally {
      useWorkspaceStore.setState({ applyOperation: original });
    }
    expect(useSheetStore.getState().open).toBeNull();
  });
});

describe('a finishing step after a chain', () => {
  let extracted: PageId[] | undefined;
  let offs: (() => void)[] = [];
  beforeEach(() => {
    extracted = undefined;
    offs = [
      commandRegistry.register({
        id: 'pages.extract',
        title: 'Extract',
        group: 'test',
        act: null,
        run: () => {
          extracted = [...useSelectionStore.getState().selected];
        },
      }),
      commandRegistry.register({
        id: 'tool.signature',
        title: 'Sign',
        group: 'test',
        act: null,
        run: () => undefined,
      }),
    ];
  });
  afterEach(() => {
    for (const off of offs) off();
  });

  it('extracts the page it showed, not the one now at that position', async () => {
    const ids = doc().pages.map((p) => p.id);
    const text = 'delete 1 and extract 3';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(extracted).toEqual([ids[2]]);
  });

  it('signs the page it showed after a duplicate moved it', async () => {
    const ids = doc().pages.map((p) => p.id);
    const text = 'duplicate 2 and sign page 5';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    const at = doc().pages.findIndex((p) => p.id === ids[4]);
    expect(at).toBe(5);
    expect(useViewStore.getState().navTarget).toBe(at);
  });

  it('opens Images on the pages it showed after a delete moved them', async () => {
    const text = 'delete 1 and save pages 5-6 as png';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(saveCopyRequestOf(useSheetStore.getState().open)).toEqual({
      kind: 'images',
      type: 'png',
      range: '4-5',
    });
  });

  it('keeps "every page" as every page when the chain added one', async () => {
    const text = 'duplicate 2 and save as png';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(saveCopyRequestOf(useSheetStore.getState().open)).toEqual({
      kind: 'images',
      type: 'png',
      range: '',
    });
  });

  it('extracts "all" as every page after the chain, copies included', async () => {
    const text = 'duplicate 3 and extract all';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(extracted).toHaveLength(401);
  });

  it('refuses when the page the finishing step named is gone', async () => {
    const text = 'delete 1 and extract 3';
    const { reading, key } = read(text);
    // The preview is true, but the page is deleted before the finishing step looks for it.
    const doomed = doc().pages[2]?.id;
    const store = useWorkspaceStore.getState();
    const original = store.applyOperation;
    useWorkspaceStore.setState({
      applyOperation: (operation, label, options) =>
        original(
          (ws, ids) => deletePages(operation(ws, ids), doomed ? [doomed] : []),
          label,
          options,
        ),
    });
    try {
      expect(await runReading(reading, key, text)).toBe('refused');
    } finally {
      useWorkspaceStore.setState({ applyOperation: original });
    }
    expect(extracted).toBeUndefined();
  });
});

describe('a chain that moves pages before the step that reads them', () => {
  it('splits at the page it showed, not the one now at that position', async () => {
    const ids = doc().pages.map((p) => p.id);
    const text = 'delete 1 and split at 10';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    const first = getActiveDocument(useWorkspaceStore.getState().workspace);
    expect(first?.pages.map((p) => p.id)).toEqual(ids.slice(1, 9));
  });

  it('numbers every page when an earlier step added one', async () => {
    const text = 'duplicate 3 and add page numbers';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(doc().pages.length).toBe(401);
    expect(doc().furniture?.[0]).not.toHaveProperty('pages');
  });

  it('rotates "all" as every page at that point, copies included', async () => {
    const text = 'duplicate 3 and rotate all';
    const before = doc().pages.map((p) => p.rotation);
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(doc().pages).toHaveLength(401);
    expect(doc().pages.every((p, i) => p.rotation !== 0 || (before[i] ?? 0) !== 0)).toBe(true);
    expect(doc().pages.every((p) => p.rotation !== 0)).toBe(true);
  });

  it('rotates "all" without the pages an earlier step deleted', async () => {
    const text = 'delete 1 and rotate all';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    expect(doc().pages).toHaveLength(399);
    expect(doc().pages.every((p) => p.rotation !== 0)).toBe(true);
  });

  it('reverses every page when an earlier step added one', async () => {
    const ids = doc().pages.map((p) => p.id);
    const text = 'duplicate 3 and reverse';
    const { reading, key } = read(text);
    expect(await runReading(reading, key, text)).toBe('ran');
    const now = doc().pages.map((p) => p.id);
    expect(now).toHaveLength(401);
    expect(now[0]).toBe(ids[399]);
    expect(now.at(-1)).toBe(ids[0]);
    // The copy sat at 4 of 401; whole-document reverse puts it at 398 (index 397).
    expect(now.findIndex((id) => !ids.includes(id))).toBe(397);
  });

  it('opens no tool after a split', async () => {
    for (const text of ['split every 100 and compress', 'split every 100 and save as jpg']) {
      const { reading, key } = read(text);
      const before = Object.keys(useWorkspaceStore.getState().workspace.documents).length;
      expect(await runReading(reading, key, text)).toBe('refused');
      expect(Object.keys(useWorkspaceStore.getState().workspace.documents).length).toBe(before);
      expect(useSheetStore.getState().open).toBeNull();
    }
  });
});
