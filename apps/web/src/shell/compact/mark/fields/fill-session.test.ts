/**
 * A signature field loads the editing chunk, then opens Sign (EDN-14, EDN-21): editing begins,
 * Sign is armed and the drawer is open; the fields' chunk itself does not import the editor.
 */
import type { FormField } from '@pdf-editor/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCompactStore } from '../../compact-store';

const mark = vi.hoisted(() => ({ enterEditing: vi.fn(), armTool: vi.fn() }));
const input = vi.hoisted(() => ({ canChange: true, load: null as Promise<unknown> | null }));

vi.mock('../../mark-host', () => ({
  loadMark: () => input.load ?? Promise.resolve(mark),
  registerCompactOverlay: () => () => undefined,
}));

vi.mock('../../../../viewer/input-state', () => ({ canChangeActive: () => input.canChange }));

import { pressField } from './fill-session';

const signature = { kind: 'signature', name: 's' } as unknown as FormField;
const here = { pageId: 'p', name: 's' } as never;

describe('a signature field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    input.canChange = true;
    input.load = null;
    // Entering editing sets the flag, as the real chunk does.
    mark.enterEditing.mockImplementation(() => useCompactStore.setState({ editing: true }));
    useCompactStore.setState({ editing: false, drawerOpen: false });
  });

  it('loads the editor, enters editing, arms Sign and opens the drawer', async () => {
    pressField(here, signature, undefined, { x: 0, y: 0 }, () => Promise.resolve());
    await vi.waitFor(() => expect(mark.armTool).toHaveBeenCalledWith('sign'));
    expect(mark.enterEditing).toHaveBeenCalledOnce();
    expect(useCompactStore.getState().drawerOpen).toBe(true);
  });

  it('opens nothing when the reader left the document while the editor loaded', async () => {
    let arrive: (value: typeof mark) => void = () => undefined;
    const pending = new Promise<typeof mark>((resolve) => {
      arrive = resolve;
    });
    input.load = pending;
    pressField(here, signature, undefined, { x: 0, y: 0 }, () => Promise.resolve());
    input.canChange = false;
    arrive(mark);
    await pending;
    await Promise.resolve();
    expect(mark.armTool).not.toHaveBeenCalled();
    expect(useCompactStore.getState().drawerOpen).toBe(false);
  });
});
