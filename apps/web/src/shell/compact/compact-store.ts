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
import type { PageId, Rect, VirtualDocument } from '@pdf-editor/document-model';
import type { NoteAnnotation } from '@pdf-editor/engine';
import { create } from 'zustand';

import type { OverviewColumns } from './overview-gesture';

export type CompactPlace = 'library' | 'reader';
/** The scrim sheets (DSN-53): Settings holds About as a row; `note` shows `CompactState.note`. */
export type CompactSheet = 'contents' | 'goto' | 'info' | 'settings' | 'note';

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

/**
 * A request to the reader to show a region of a page at a zoom (MOB-1: the field being filled,
 * its text at 16 px at least): `band` lands it under the top bar, near the top of the band the
 * keyboard leaves; `stay` keeps it where it is on screen (the zoom back after Done).
 */
export interface ZoomRequest {
  readonly pageId: PageId;
  /** The region in the page's unrotated user space, points. */
  readonly rect: Rect;
  /** Relative to fit width; clamped by the reader. */
  readonly zoom: number;
  readonly place: 'band' | 'stay';
}

export interface CompactState {
  readonly place: CompactPlace;
  /** The top bar and the capsule are hidden (a tap or a scroll down); `inert` while so. */
  readonly chromeHidden: boolean;
  /** The top bar is the Find field. */
  readonly findOpen: boolean;
  readonly sheet: CompactSheet | null;
  /**
   * How many scrim sheets (`CompactSheet`: the store's `sheet`, Password, New signature) are
   * open; the toast stack steps aside while any is (DSN-56).
   */
  readonly scrimSheets: number;
  /** The note the `note` sheet shows (a tap on its target, `NoteLayer.tsx`). */
  readonly note: NoteAnnotation | null;
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
   * The single capsule's tray is open above it (EDN-24, behind Labs `phone-capsule`). Only the
   * new capsule reads it; begin and end of editing and the Library close it, typing leaves it.
   */
  readonly trayOpen: boolean;
  /**
   * A text box is open for typing: the island steps away and the keyboard's Done takes its
   * place (README §4; `mark/TextLayer.tsx`).
   */
  readonly typing: boolean;
  /**
   * Find's field has the keyboard on a phone on its side (DSN-44): the bar riding on the
   * keyboard would reach the title row, so the top steps away until the keyboard goes.
   */
  readonly findOverTop: boolean;
  /** The reader's next zoom to a region (`requestZoom`); a new object each time. */
  readonly zoomRequest: ZoomRequest | null;
  readonly overview: OverviewPhase;
  /**
   * The overview's columns (2 · 3 · 4) the person pinched to, kept for the session; null until
   * then, when the document's length decides (`overviewColumns`, MOB-7).
   */
  readonly overviewColumns: OverviewColumns | null;
  /** The page the overview's morph is anchored on: the page read when it opened. */
  readonly overviewAnchor: number;
  /**
   * The Text view shows over the reader (PRD-36, EDN-26, behind Labs `text-view`): the reader is
   * hidden and inert and the view has its own bar in the capsule's place. Set only once the
   * view's chunk and data are here (`textview-host.tsx`).
   */
  readonly textView: boolean;
}

const INITIAL: CompactState = {
  place: 'library',
  chromeHidden: false,
  findOpen: false,
  sheet: null,
  scrimSheets: 0,
  note: null,
  menuOpen: false,
  zoom: 1,
  opening: false,
  openError: null,
  openedDocument: null,
  editing: false,
  tool: null,
  lastTool: 'pen',
  drawerOpen: false,
  trayOpen: false,
  typing: false,
  findOverTop: false,
  zoomRequest: null,
  overview: 'closed',
  overviewColumns: null,
  overviewAnchor: 0,
  textView: false,
};

export const useCompactStore = create<CompactState>()(() => INITIAL);

/**
 * The top bar steps away while the chrome is hidden or a sheet is open: a sheet is the place
 * then, and on a phone on its side its 92 % detent reaches over the bar's band. On its side it
 * also steps away while Find's field has the keyboard (`findOverTop`, DSN-44).
 */
export const topBarAway = (s: CompactState): boolean =>
  s.chromeHidden || s.sheet !== null || s.overview !== 'closed' || s.findOverTop;

/**
 * The capsule steps away while the chrome is hidden, Find has the top bar, or a sheet is open:
 * it sits under the sheet's lower half, where its dark pill would show through the sheet's
 * glass while the sheet rises (XD-3). While a text box takes typing it steps away for the
 * keyboard's Done. The toast stack follows it (`CompactApp`). Both step away while the page overview
 * shows or moves (MOB-2): it has its own bar. The capsule also steps away under the Text view
 * (PRD-36), which has its own bar; the top stays.
 */
export const capsuleAway = (s: CompactState): boolean =>
  s.chromeHidden ||
  s.findOpen ||
  s.sheet !== null ||
  s.typing ||
  s.overview !== 'closed' ||
  s.textView;

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
    trayOpen: false,
    typing: false,
    findOverTop: false,
    overview: 'closed',
    textView: false,
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

let opener: HTMLElement | null = null;

/**
 * What a sheet gives focus back to (DSN-53): the control that opened it; a menu row's menu goes
 * as the sheet opens, so its trigger.
 */
export const sheetOpener = (): HTMLElement | null => opener;

export function openSheet(sheet: CompactSheet, note: NoteAnnotation | null = null): void {
  const active = document.activeElement;
  opener =
    active instanceof HTMLElement && active.closest('[role="menu"]')
      ? document.querySelector<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"]')
      : active instanceof HTMLElement && active !== document.body
        ? active
        : null;
  set({ sheet, note, menuOpen: false, chromeHidden: false });
}

/** A scrim sheet opened (1) or closed (−1): `CompactSheet` counts itself (DSN-56). */
export function countScrimSheet(delta: 1 | -1): void {
  useCompactStore.setState((s) => ({ scrimSheets: Math.max(0, s.scrimSheets + delta) }));
}

export function closeSheet(): void {
  set({ sheet: null });
}

export function openFind(): void {
  set({ findOpen: true, sheet: null, menuOpen: false, chromeHidden: false });
}

export function closeFind(): void {
  set({ findOpen: false, findOverTop: false });
}

/** Find's field has (or no longer has) the keyboard on a phone on its side (DSN-44). */
export function setFindOverTop(findOverTop: boolean): void {
  if (useCompactStore.getState().findOverTop !== findOverTop) set({ findOverTop });
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
    trayOpen: false,
    findOpen: false,
    sheet: null,
    menuOpen: false,
    chromeHidden: false,
  });
}

/** Back to reading; the last tool is kept for the next entry. */
export function endEditing(): void {
  set({ editing: false, tool: null, drawerOpen: false, trayOpen: false, typing: false });
}

/** The armed tool (null: the chip is off); a tool is remembered for the next entry. */
export function setCompactTool(tool: CompactTool | null): void {
  set(tool === null ? { tool } : { tool, lastTool: tool });
}

export function setDrawerOpen(drawerOpen: boolean): void {
  if (useCompactStore.getState().drawerOpen !== drawerOpen) set({ drawerOpen });
}

/** Opens or closes the single capsule's tray (EDN-24). */
export function setTrayOpen(trayOpen: boolean): void {
  if (useCompactStore.getState().trayOpen !== trayOpen) set({ trayOpen });
}

/** A text box opened or closed for typing; the drawer closes for it. */
export function setTyping(typing: boolean): void {
  if (useCompactStore.getState().typing !== typing) {
    set(typing ? { typing, drawerOpen: false } : { typing });
  }
}

/** Asks the reader to show `request.rect` at `request.zoom` (`CompactReader`). */
export function requestZoom(request: ZoomRequest): void {
  set({ zoomRequest: { ...request } });
}

/** The overview's phase, and the page its morph is anchored on when one is given. */
export function setOverview(overview: OverviewPhase, anchor?: number): void {
  set(anchor === undefined ? { overview } : { overview, overviewAnchor: anchor });
}

/** The Text view shows (its data is here) or is gone (PRD-36). */
export function setTextView(textView: boolean): void {
  if (useCompactStore.getState().textView !== textView) set({ textView });
}

export function setOverviewColumns(overviewColumns: OverviewColumns): void {
  if (useCompactStore.getState().overviewColumns !== overviewColumns) set({ overviewColumns });
}

/** Forgets everything (tests). */
export function resetCompactStore(): void {
  useCompactStore.setState(INITIAL);
}
