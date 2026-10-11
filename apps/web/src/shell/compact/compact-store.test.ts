/**
 * The compact store's editing fields (design/phone-2026-10/README.md §2, §5): entering shows
 * the island and clears Find, the menu and a sheet; the last tool is kept for the next entry;
 * the chrome never hides while editing; the Library ends editing.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  beginEditing,
  capsuleAway,
  endEditing,
  openFind,
  openSheet,
  resetCompactStore,
  setChromeHidden,
  setCompactTool,
  setDrawerOpen,
  showLibrary,
  toggleChrome,
  toolTakesPage,
  useCompactStore,
} from './compact-store';

const state = () => useCompactStore.getState();

describe('editing mode', () => {
  beforeEach(() => resetCompactStore());

  it('starts on Pen, reading', () => {
    expect(state().editing).toBe(false);
    expect(state().tool).toBeNull();
    expect(state().lastTool).toBe('pen');
  });

  it('entering shows the island and closes Find, the menu and a sheet', () => {
    openFind();
    openSheet('pages');
    setChromeHidden(true);
    beginEditing('pen');
    expect(state()).toMatchObject({
      editing: true,
      tool: 'pen',
      findOpen: false,
      sheet: null,
      menuOpen: false,
      chromeHidden: false,
    });
    expect(capsuleAway(state())).toBe(false);
  });

  it('remembers the last tool armed, not the chip turned off', () => {
    beginEditing('pen');
    setCompactTool('highlight');
    setCompactTool(null);
    expect(state().tool).toBeNull();
    expect(state().lastTool).toBe('highlight');
    endEditing();
    expect(state()).toMatchObject({ editing: false, tool: null, lastTool: 'highlight' });
  });

  it('keeps the chrome shown while editing, by scroll or tap', () => {
    beginEditing('pen');
    setChromeHidden(true);
    expect(state().chromeHidden).toBe(false);
    toggleChrome();
    expect(state().chromeHidden).toBe(false);
    endEditing();
    toggleChrome();
    expect(state().chromeHidden).toBe(true);
  });

  it('a tool takes the page only while editing with a tool armed', () => {
    expect(toolTakesPage(state())).toBe(false);
    beginEditing('pen');
    expect(toolTakesPage(state())).toBe(true);
    setCompactTool(null);
    expect(toolTakesPage(state())).toBe(false);
  });

  it('the Library ends editing and closes the drawer', () => {
    beginEditing('pen');
    setDrawerOpen(true);
    showLibrary();
    expect(state()).toMatchObject({ editing: false, tool: null, drawerOpen: false });
  });
});
