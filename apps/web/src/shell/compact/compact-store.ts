/**
 * The compact edition's UI state (ADR-0033 §2.3): which place shows (the Library or the
 * reader), whether the reader's chrome is hidden, Find, the open sheet, the zoom, and the
 * Library's opening state and one-line errors.
 *
 * The document itself lives in the shared workspace store (one document at a time on a
 * phone); this store holds only what the compact chrome needs.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { create } from 'zustand';

export type CompactPlace = 'library' | 'reader';
export type CompactSheet = 'pages' | 'contents' | 'goto' | 'info' | 'about';

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
};

export const useCompactStore = create<CompactState>()(() => INITIAL);

/**
 * The top bar steps away while the chrome is hidden or a sheet is open: a sheet is the place
 * then, and on a phone on its side its 92 % detent reaches over the bar's band.
 */
export const topBarAway = (s: CompactState): boolean => s.chromeHidden || s.sheet !== null;

/**
 * The capsule steps away while the chrome is hidden, Find has the top bar, or a sheet is open:
 * it sits under the sheet's lower half, where its dark pill would show through the sheet's
 * glass while the sheet rises (XD-3). The toast stack follows it (`CompactApp`).
 */
export const capsuleAway = (s: CompactState): boolean =>
  s.chromeHidden || s.findOpen || s.sheet !== null;

const set = (patch: Partial<CompactState>) => useCompactStore.setState(patch);

export function showLibrary(): void {
  set({ place: 'library', findOpen: false, sheet: null, menuOpen: false, chromeHidden: false });
}

export function showReader(): void {
  set({ place: 'reader', chromeHidden: false, openError: null });
}

export function setChromeHidden(hidden: boolean): void {
  if (useCompactStore.getState().chromeHidden !== hidden) set({ chromeHidden: hidden });
}

export function toggleChrome(): void {
  set({ chromeHidden: !useCompactStore.getState().chromeHidden });
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

/** Forgets everything (tests). */
export function resetCompactStore(): void {
  useCompactStore.setState(INITIAL);
}
