/**
 * The list drawer's accordion (EDN-16, `tool-list-state.ts`): a first tap selects, a second
 * opens the row's options, a third folds them; one row open at a time; "Soon" does nothing;
 * the drawer variant's flag (`drawer-variant.ts`); and the close after an arming pulse
 * (`drawer-close.ts`), which waits on the pulse and never shuts a drawer opened since.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { CompactTool } from '../compact-store';
import { setDrawerOpen, useCompactStore } from '../compact-store';
import { closeDrawerAfter } from './drawer-close';
import { decideDrawerVariant } from './drawer-variant';
import { type ListRow, openRow, tapRow } from './tool-list-state';

const row = (id: CompactTool, extra: Partial<ListRow> = {}): ListRow => ({
  id,
  opens: true,
  ...extra,
});

describe('the list drawer’s rows', () => {
  it('a first tap on another row selects it and opens nothing', () => {
    expect(tapRow(row('highlight'), 'pen', null)).toEqual({ arm: 'highlight', open: null });
    expect(tapRow(row('pen'), null, null)).toEqual({ arm: 'pen', open: null });
  });

  it('a tap on the current row expands it, and another collapses it', () => {
    const opened = tapRow(row('pen'), 'pen', null);
    expect(opened).toEqual({ arm: null, open: 'pen' });
    expect(tapRow(row('pen'), 'pen', opened.open)).toEqual({ arm: null, open: null });
  });

  it('only one row is open: selecting another folds the open one', () => {
    const next = tapRow(row('text'), 'pen', 'pen');
    expect(next).toEqual({ arm: 'text', open: null });
    // And the new current row opens on its own second tap, alone.
    expect(tapRow(row('text'), 'text', next.open)).toEqual({ arm: null, open: 'text' });
  });

  it('a row with nothing under it never opens', () => {
    expect(tapRow(row('sign', { opens: false }), 'sign', null)).toEqual({ arm: null, open: null });
  });

  it('a Soon row neither arms nor changes the open row', () => {
    const soon = row('edit-text', { soon: true });
    expect(tapRow(soon, 'pen', 'pen')).toEqual({ arm: null, open: 'pen' });
    expect(tapRow(soon, null, null)).toEqual({ arm: null, open: null });
  });

  it('an open row folds when the tool changes elsewhere', () => {
    expect(openRow('pen', 'pen')).toBe('pen');
    expect(openRow(null, 'pen')).toBeNull();
    expect(openRow('eraser', 'pen')).toBeNull();
  });
});

describe('the drawer variant (?drawer)', () => {
  it('the tiles by default; the query wins over the session, and the session is kept', () => {
    expect(decideDrawerVariant('', null)).toBe('tiles');
    expect(decideDrawerVariant('?sample&drawer=list', null)).toBe('list');
    expect(decideDrawerVariant('', 'list')).toBe('list');
    expect(decideDrawerVariant('?drawer=tiles', 'list')).toBe('tiles');
    expect(decideDrawerVariant('?drawer=bogus', 'nonsense')).toBe('tiles');
  });
});

describe('the close after an arming pulse', () => {
  afterEach(() => setDrawerOpen(false));

  it('waits for the pulse, then closes', async () => {
    setDrawerOpen(true);
    let crest!: () => void;
    closeDrawerAfter(new Promise<void>((resolve) => (crest = resolve)));
    await Promise.resolve();
    expect(useCompactStore.getState().drawerOpen).toBe(true);
    crest();
    await Promise.resolve();
    await Promise.resolve();
    expect(useCompactStore.getState().drawerOpen).toBe(false);
  });

  it('never shuts a drawer that closed and opened again meanwhile', async () => {
    setDrawerOpen(true);
    let crest!: () => void;
    closeDrawerAfter(new Promise<void>((resolve) => (crest = resolve)));
    setDrawerOpen(false);
    setDrawerOpen(true);
    crest();
    await Promise.resolve();
    await Promise.resolve();
    expect(useCompactStore.getState().drawerOpen).toBe(true);
  });
});
