/**
 * A signature field loads the editing chunk, then opens Sign (EDN-14, EDN-21): editing begins,
 * Sign is armed and the drawer is open; the fields' chunk itself does not import the editor.
 */
import type { FormField } from '@pdf-editor/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCompactStore } from '../../compact-store';

const mark = vi.hoisted(() => ({ enterEditing: vi.fn(), armTool: vi.fn() }));

vi.mock('../../mark-host', () => ({
  loadMark: () => Promise.resolve(mark),
  registerCompactOverlay: () => () => undefined,
}));

vi.mock('../../../../viewer/input-state', () => ({ canChangeActive: () => true }));

import { pressField } from './fill-session';

const signature = { kind: 'signature', name: 's' } as unknown as FormField;
const here = { pageId: 'p', name: 's' } as never;

describe('a signature field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCompactStore.setState({ editing: false, drawerOpen: false });
  });

  it('loads the editor, enters editing, arms Sign and opens the drawer', async () => {
    pressField(here, signature, undefined, { x: 0, y: 0 }, () => Promise.resolve());
    await vi.waitFor(() => expect(mark.armTool).toHaveBeenCalledWith('sign'));
    expect(mark.enterEditing).toHaveBeenCalledOnce();
    expect(useCompactStore.getState().drawerOpen).toBe(true);
  });
});
