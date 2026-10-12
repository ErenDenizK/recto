/**
 * The list drawer's accordion (EDN-16, `tool-list-state.ts`): a first tap selects, a second
 * opens the row's options, a third folds them; one row open at a time; "Soon" does nothing;
 * the drawer variant's flag (`drawer-variant.ts`); and how both drawers close (`drawer-close.ts`,
 * EDN-18): a press outside goes on to the page only when the armed tool acts there, and never
 * closes from the panel or the island.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { CompactTool } from '../compact-store';
import { setDrawerOpen, useCompactStore } from '../compact-store';
import { closeOnOutsidePress, pressGoesThrough } from './drawer-close';
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

describe('the press outside the drawer (EDN-18)', () => {
  const made: Element[] = [];
  const el = (html: string): HTMLElement => {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    made.push(host);
    return host.firstElementChild as HTMLElement;
  };
  const press = (target: Element) =>
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

  afterEach(() => {
    setDrawerOpen(false);
    for (const host of made.splice(0)) host.remove();
  });

  it('goes on to the page only for a tool whose next step is a tap there', () => {
    expect(pressGoesThrough('text-box')).toBe(true);
    expect(pressGoesThrough('edit-text')).toBe(true);
    expect(pressGoesThrough('signature')).toBe(true);
    expect(pressGoesThrough('ink')).toBe(false);
    expect(pressGoesThrough('eraser')).toBe(false);
    expect(pressGoesThrough('select')).toBe(false);
  });

  it('closes on a press on the page and lets the press reach it', () => {
    const panel = el('<div><button>Pen</button></div>');
    const pageEl = el('<div data-page></div>');
    let reached = false;
    pageEl.addEventListener('pointerdown', (event) => {
      reached = !event.defaultPrevented;
    });
    setDrawerOpen(true);
    const stop = closeOnOutsidePress(() => panel);
    press(pageEl);
    stop();
    expect(useCompactStore.getState().drawerOpen).toBe(false);
    expect(reached).toBe(true);
  });

  it('keeps it open for a press in the panel or on the island (Undo)', () => {
    const panel = el('<div><button>Pen</button></div>');
    const island = el('<div data-testid="compact-capsule"><button>Undo</button></div>');
    setDrawerOpen(true);
    const stop = closeOnOutsidePress(() => panel);
    press(panel.querySelector('button') as Element);
    press(island.querySelector('button') as Element);
    expect(useCompactStore.getState().drawerOpen).toBe(true);
    stop();
    press(document.body);
    expect(useCompactStore.getState().drawerOpen).toBe(true);
  });
});
