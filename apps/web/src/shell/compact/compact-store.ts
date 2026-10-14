/**
 * The compact edition's UI state (ADR-0033 §2.3): which place shows (the Library or the
 * reader), whether the reader's chrome is hidden, Find, the open sheet, the zoom, the
 * Library's opening state and one-line errors, and phone editing's mode (EDN-7, EDN-8;
 * `design/phone-2026-10/README.md` §2): whether the edit island shows, the tool armed in it,
 * the tool the next entry arms, and whether the tool drawer is open.
 *
 * The page overview (MOB-2) is a place over the reader, not a sheet: `overview` says whether it
 * is closed, moving (its tiles mounted, the reader still showing under the morph) or open (the
 * reader hidden and inert), with its column count and the page the morph is anchored on.
 *
 * Only the fields live here, so the static reader can follow them; what arming a tool does
 * (Markup, the tool store, the page layers) is the lazy `mark/bridge.ts`.
 *
 * The document itself lives in the shared workspace store (one document at a time on a
 * phone); this store holds only what the compact chrome needs.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { create } from 'zustand';

import { DEFAULT_COLUMNS, type OverviewColumns } from './overview-gesture';

export type CompactPlace = 'library' | 'reader';
export type CompactSheet = 'contents' | 'goto' | 'info' | 'about';

/**
 * The page overview (MOB-2): closed; `morph` while a pinch or the morph moves between the
 * reader and the grid (the tiles are mounted, the reader shows under them); `open` at rest.
 */
export type OverviewPhase = 'closed' | 'morph' | 'open';

/**
 * The phone's tools (EDN-8): the five of the drawer's first row, and the Eraser of its quiet
 * row. `none` is the tool chip toggled off: one finger pans and selects (README §2).
 */
export type CompactTool = 'pen' | 'highlight' | 'text' | 'sign' | 'edit-text' | 'eraser';

export interface CompactState {
  readonly place: CompactPlace;
  /** The top bar and the capsule are hidden (a tap or a scroll down); `inert` while so. */
  readonly chromeHidden: boolean;
  /** The top bar is the Find field. */
  readonly findOpen: boolean;
  readonly sheet: CompactSheet | null;
  readonly menuOpen: boolean;
  /** Relative to fit width (`reader-layout.ts`). */
  readonly zoom: number;
  /** A file is being read or opened. */
  readonly opening: boolean;
  /** The Library's one line after a file did not open. */
  readonly openError: string | null;
  /**
   * The document as it was opened. The compact edition never changes it, so while the
   * workspace still holds this very object (and the engine no edits), Download a copy hands
   * out the file's own bytes; a document restored with changes goes through the export.
   */
  readonly openedDocument: VirtualDocument | null;
  /** The edit island shows instead of the reading capsule (README §2 "Editing"). */
  readonly editing: boolean;
  /** The armed tool while editing; null with the chip off (pan and select) or not editing. */
  readonly tool: CompactTool | null;
  /** The tool an entry arms and the chip turns back on: Pen first, then the last one used. */
  readonly lastTool: CompactTool;
  /** The tool drawer is open over the island (README §3). */
  readonly drawerOpen: boolean;
  /**
   * A text box is open for typing: the island steps away and the keyboard's Done takes its
   * place (README §4; `mark/TextLayer.tsx`).
   */
  readonly typing: boolean;
  readonly overview: OverviewPhase;
  /** The overview's columns (2 · 3 · 4), kept for the session. */
  readonly overviewColumns: OverviewColumns;
  /** The page the overview's morph is anchored on: the page read when it opened. */
  readonly overviewAnchor: number;
}

const INITIAL: CompactState = {
  place: 'library',
  chromeHidden: false,
  findOpen: false,
  sheet: null,
  menuOpen: false,
  zoom: 1,
  opening: false,
  openError: null,
  openedDocument: null,
  editing: false,
  tool: null,
  lastTool: 'pen',
  drawerOpen: false,
  typing: false,
  overview: 'closed',
  overviewColumns: DEFAULT_COLUMNS,
  overviewAnchor: 0,
};

export const useCompactStore = create<CompactState>()(() => INITIAL);

/**
 * The top bar steps away while the chrome is hidden or a sheet is open: a sheet is the place
 * then, and on a phone on its side its 92 % detent reaches over the bar's band.
 */
export const topBarAway = (s: CompactState): boolean =>
  s.chromeHidden || s.sheet !== null || s.overview !== 'closed';

/**
 * The capsule steps away while the chrome is hidden, Find has the top bar, or a sheet is open:
 * it sits under the sheet's lower half, where its dark pill would show through the sheet's
 * glass while the sheet rises (XD-3). While a text box takes typing it steps away for the
 * keyboard's Done. The toast stack follows it (`CompactApp`). Both step away while the page overview
 * shows or moves (MOB-2): it has its own bar.
 */
export const capsuleAway = (s: CompactState): boolean =>
  s.chromeHidden || s.findOpen || s.sheet !== null || s.typing || s.overview !== 'closed';

/** A tool takes the page's presses: a stroke or a placement, never a tap (README §5). */
export const toolTakesPage = (s: CompactState): boolean => s.editing && s.tool !== null;

const set = (patch: Partial<CompactState>) => useCompactStore.setState(patch);

export function showLibrary(): void {
  set({
    place: 'library',
    findOpen: false,
    sheet: null,
    menuOpen: false,
    chromeHidden: false,
    editing: false,
    tool: null,
    drawerOpen: false,
    typing: false,
    overview: 'closed',
  });
}

export function showReader(): void {
  set({ place: 'reader', chromeHidden: false, openError: null });
}

/** Hides or shows the chrome; while editing it never hides (README §5). */
export function setChromeHidden(hidden: boolean): void {
  const state = useCompactStore.getState();
  if (hidden && state.editing) return;
  if (state.chromeHidden !== hidden) set({ chromeHidden: hidden });
}

export function toggleChrome(): void {
  setChromeHidden(!useCompactStore.getState().chromeHidden);
}

export function openSheet(sheet: CompactSheet): void {
  set({ sheet, menuOpen: false, chromeHidden: false });
}

export function closeSheet(): void {
  set({ sheet: null });
}

export function openFind(): void {
  set({ findOpen: true, sheet: null, menuOpen: false, chromeHidden: false });
}

export function closeFind(): void {
  set({ findOpen: false });
}

export function setMenuOpen(menuOpen: boolean): void {
  set({ menuOpen, ...(menuOpen ? { chromeHidden: false } : {}) });
}

export function setZoom(zoom: number): void {
  set({ zoom });
}

/**
 * Shows the edit island with `tool` armed (the bridge has armed it). Find, the menu and a
 * sheet close, and the chrome shows: it stays shown while editing (README §5).
 */
export function beginEditing(tool: CompactTool | null): void {
  set({
    editing: true,
    tool,
    ...(tool === null ? {} : { lastTool: tool }),
    drawerOpen: false,
    findOpen: false,
    sheet: null,
    menuOpen: false,
    chromeHidden: false,
  });
}

/** Back to reading; the last tool is kept for the next entry. */
export function endEditing(): void {
  set({ editing: false, tool: null, drawerOpen: false, typing: false });
}

/** The armed tool (null: the chip is off); a tool is remembered for the next entry. */
export function setCompactTool(tool: CompactTool | null): void {
  set(tool === null ? { tool } : { tool, lastTool: tool });
}

export function setDrawerOpen(drawerOpen: boolean): void {
  if (useCompactStore.getState().drawerOpen !== drawerOpen) set({ drawerOpen });
}

/** A text box opened or closed for typing; the drawer closes for it. */
export function setTyping(typing: boolean): void {
  if (useCompactStore.getState().typing !== typing) {
    set(typing ? { typing, drawerOpen: false } : { typing });
  }
}

/** The overview's phase, and the page its morph is anchored on when one is given. */
export function setOverview(overview: OverviewPhase, anchor?: number): void {
  set(anchor === undefined ? { overview } : { overview, overviewAnchor: anchor });
}

export function setOverviewColumns(overviewColumns: OverviewColumns): void {
  if (useCompactStore.getState().overviewColumns !== overviewColumns) set({ overviewColumns });
}

/** Forgets everything (tests). */
export function resetCompactStore(): void {
  useCompactStore.setState(INITIAL);
}
