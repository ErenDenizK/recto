/**
 * The intent runner (decision PRD-39, PRD-40; spec niyet §2.12, §2.13), Vitest browser mode: a
 * stale key does nothing, a refusing guard runs nothing, a chain of document steps is one
 * history entry that one Undo takes back, an output opens Save a copy set up after the commit,
 * and a failing commit stops the finishing step.
 */
import { getActiveDocument } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import manyUrl from '../../../../../test/fixtures/many-pages.pdf?url';
import { fixtureFile } from '../../../test/store-harness';
import { saveCopyRequestOf } from '../../export/export-store';
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
    const text = 'move 1 to the start and compress';
    const parsed = parseIntent(text, gatherIntentContext());
    if (parsed.kind !== 'readings') throw new Error('no reading');
    const reading = parsed.readings[0];
    const key = previewOf(reading, gatherIntentContext(), workspaceVersion(), text).key;
    expect(await runReading(reading, key, text)).toBe('refused');
    expect(useSheetStore.getState().open).toBeNull();
  });
});
