/**
 * UI state (redesign spec §7, flows §2.4): panels, where the shell is (the Library, a
 * document or Compare), each document's surface and Markup state, zoom, grid cell size,
 * overlays, recents. Document content (including the active tab) is not here; see
 * `workspace-store.ts`.
 *
 * M8's global `viewMode`, per-document `documentMode` and `lastView` are gone: Compare is a
 * destination, the page view or the light table is the document's `surface`, and M8's Edit
 * is the document's `markup`; whether a document may change is the change guard's
 * (`state/guard.ts`).
 *
 * Panel layout is persisted to localStorage (`ui:v3`, see `safe-storage.ts`); everything
 * else is per session.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { create } from 'zustand';

import { readJson, writeJson } from './safe-storage';
import { useWorkspaceStore } from './workspace-store';

/**
 * Where the shell is (redesign spec §7; flows §2.1; ADR-0031 item 10): `home`, the Library
 * (today's Home: the open files as cards, experience-redesign §3, without a mode control);
 * `document`, the active document on its `surface`; `compare`, the Compare place (spec
 * recognize-and-compare §2.2), which M8 held as a view mode.
 */
export type Destination = 'home' | 'document' | 'compare';
/**
 * What a document shows (flows §2.1, ADR-0029 §2.5): `page`, the page view; `grid`, the Pages
 * grid (today's light table, Arrange). Replaces M8's `'read' | 'arrange'` and `lastView`.
 */
export type Surface = 'page' | 'grid';
/** The Markup palette's set (flows §4.3): the drawing tools, or Fill & sign's. */
export type PaletteSet = 'draw' | 'sign';
/**
 * One document's UI (redesign spec §7, flows §2.4). `surface` is kept in the session
 * snapshot. `markup` is whether Markup is open (the input rules, `viewer/hit-order.ts`, and the
 * change guard read it). `paletteSet` is the last door into Markup, for the session.
 */
export interface DocumentUi {
  readonly surface: Surface;
  readonly markup: boolean;
  readonly paletteSet: PaletteSet;
}
/** A document with no entry: its page, Markup closed, the drawing set. */
export const DEFAULT_DOCUMENT_UI: DocumentUi = {
  surface: 'page',
  markup: false,
  paletteSet: 'draw',
};
/** What the stage shows: the Library, Compare, or the active document's surface. */
export type StageView = 'home' | 'compare' | Surface;
/**
 * What the Pages grid shows (`components/06-navigation.md` PG2; flows §2.4): the active
 * document's pages, or every open document as sections in tab order. Kept per device. Replaces
 * M8's `arrangePinned` and `arrangeHidden` ("Hide from Arrange").
 */
export type GridScope = 'document' | 'all';
/**
 * The sidebar's sections (`components/06-navigation.md` N1): Pages (thumbnails or Contents),
 * Find, Review. M8's Files tab is gone (the Library and the tabs list the open files). `changes`
 * is Compare's Changes list, which the sidebar's slot holds in Compare until the Compare place
 * (CP5, D2-6) docks its own; never offered as a section, never persisted.
 */
export type LeftPanelView = 'pages' | 'find' | 'review' | 'changes';
/**
 * Views of the seven-tab rail (`ui:v1`). Still accepted when the state is set (commands
 * written against them keep working) and mapped by `navigatorTarget`; never stored.
 */
export type LegacyLeftPanelView = 'outline' | 'search' | 'comments' | 'redactions' | 'forms';
/**
 * What the Pages section shows: thumbnails, or the outline, labelled Contents (spec X27; the
 * stored value keeps M8's name). Remembered.
 */
export type PagesView = 'thumbnails' | 'bookmarks';
/**
 * The Review section's filter chips (06-navigation N5): All · Comments · Marks · Fields, and
 * Words to check once OCR has run on the document (spec X33). Remembered.
 */
export type ReviewFilter = 'all' | 'comments' | 'redactions' | 'fields' | 'words';
/** The floating sidebar's width (spec 06.18): 280 by default, 240–400, kept per device. */
export const LEFT_PANEL_WIDTH = { min: 240, max: 400, default: 280 } as const;

/** Discrete zoom steps, as in most viewers. 1 = 100%. */
export const ZOOM_LEVELS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
] as const;
export const MIN_ZOOM = ZOOM_LEVELS[0];
/** Light-table cell widths (spec §1): S, M, L, XL, XXL. */
export const ARRANGE_SIZES = [
  { label: 'S', width: 96 },
  { label: 'M', width: 144 },
  { label: 'L', width: 200 },
  { label: 'XL', width: 280 },
  { label: 'XXL', width: 400 },
] as const;
const DEFAULT_ARRANGE_SIZE = 1;
/** The grid's scope and cell size until the person picks (PG2: This document, Medium). */
export const DEFAULT_GRID = { scope: 'document', size: DEFAULT_ARRANGE_SIZE } as const;
/** Read mode keeps zoom fitted to the stage while a fit mode is on. */
export type FitMode = 'width' | 'page';
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 5;
const MAX_RECENTS = 5;
/**
 * Panel layout (redesign spec §7, X26): `ui:v3`, in §7's shape (`StoredLayout`). `ui:v2`
 * (experience-redesign §9) and, before it, `ui:v1` are migrated into it once.
 */
export const LAYOUT_STORAGE_KEY = 'pdf-editor:ui:v3';
/** M8's panel layout, read once when `ui:v3` is missing. */
export const V2_LAYOUT_STORAGE_KEY = 'pdf-editor:ui:v2';
/** The seven-tab rail's layout, read once when neither `ui:v3` nor `ui:v2` is there. */
export const LEGACY_LAYOUT_STORAGE_KEY = 'pdf-editor:ui:v1';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nextZoomLevel(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_LEVELS.find((z) => z > current + 1e-3) ?? MAX_ZOOM;
  return [...ZOOM_LEVELS].reverse().find((z) => z < current - 1e-3) ?? MIN_ZOOM;
}

export interface PersistedLayout {
  leftPanelOpen: boolean;
  leftPanelView: LeftPanelView;
  pagesView: PagesView;
  reviewFilter: ReviewFilter;
  leftPanelWidth: number;
}

/**
 * The sidebar is closed by default on every size (06-navigation N1, F§6.1) and remembered per
 * device (this device's `localStorage`) once the person changes it; so is its width.
 */
export const DEFAULT_LAYOUT: PersistedLayout = {
  leftPanelOpen: false,
  leftPanelView: 'pages',
  pagesView: 'thumbnails',
  reviewFilter: 'all',
  leftPanelWidth: LEFT_PANEL_WIDTH.default,
};

/** M8's `files` is no longer a section: a stored `files` reads as Pages. */
const STORED_VIEWS: readonly LeftPanelView[] = ['pages', 'find', 'review'];
const LEGACY_VIEWS: readonly LegacyLeftPanelView[] = [
  'outline',
  'search',
  'comments',
  'redactions',
  'forms',
];
const REVIEW_FILTERS: readonly ReviewFilter[] = [
  'all',
  'comments',
  'redactions',
  'fields',
  'words',
];

export function isLegacyView(view: unknown): view is LegacyLeftPanelView {
  return LEGACY_VIEWS.includes(view as LegacyLeftPanelView);
}

/** Where a view lives in the navigator: its tab, and the Pages view or Review filter. */
export function navigatorTarget(
  view: LeftPanelView | LegacyLeftPanelView,
): Pick<PersistedLayout, 'leftPanelView'> &
  Partial<Pick<PersistedLayout, 'pagesView' | 'reviewFilter'>> {
  switch (view) {
    case 'outline':
      return { leftPanelView: 'pages', pagesView: 'bookmarks' };
    case 'search':
      return { leftPanelView: 'find' };
    case 'comments':
      return { leftPanelView: 'review', reviewFilter: 'comments' };
    case 'redactions':
      return { leftPanelView: 'review', reviewFilter: 'redactions' };
    case 'forms':
      return { leftPanelView: 'review', reviewFilter: 'fields' };
    default:
      return { leftPanelView: view };
  }
}

/**
 * Whether the navigator shows `view` now. A Review filter counts as shown under "All"
 * too, where its rows are listed; Bookmarks only in the Pages tab's Bookmarks view.
 */
export function isNavigatorShowing(
  state: Pick<UiState, 'leftPanelOpen' | 'leftPanelView' | 'pagesView' | 'reviewFilter'>,
  view: LeftPanelView | LegacyLeftPanelView,
): boolean {
  if (!state.leftPanelOpen) return false;
  const target = navigatorTarget(view);
  if (state.leftPanelView !== target.leftPanelView) return false;
  if (target.pagesView !== undefined && state.pagesView !== target.pagesView) return false;
  if (target.reviewFilter !== undefined) {
    return state.reviewFilter === 'all' || state.reviewFilter === target.reviewFilter;
  }
  return true;
}

const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
const width = (x: unknown, range: { min: number; max: number; default: number }) =>
  typeof x === 'number' && Number.isFinite(x) ? clamp(x, range.min, range.max) : range.default;

/**
 * `ui:v3` as stored (redesign spec §7): the sidebar as one record, the Pages view and the
 * Review filter. A stored value the sidebar no longer knows (M8's `files`) falls back to Pages,
 * field by field; M8's `inspector` record, written until D2-9 removed the inspector, is ignored.
 */
export interface StoredLayout {
  readonly sidebar: {
    /**
     * Written only when it differs from the default (`toStoredLayout`), so a layout that
     * never chose leaves the sidebar to whatever the default is when it is read (06.17).
     */
    readonly open?: boolean;
    readonly section: Exclude<LeftPanelView, 'changes'>;
    readonly width: number;
  };
  readonly pagesView: PagesView;
  readonly reviewFilter: ReviewFilter;
  /**
   * The Pages grid's scope and cell size (PG2, per device). Written only when either differs
   * from `DEFAULT_GRID`, so a layout stored before the grid had them reads as the default.
   */
  readonly grid?: { readonly scope: GridScope; readonly size: number };
}

/** The Pages grid's per-device choices (PG2): scope and cell size (an `ARRANGE_SIZES` index). */
export interface GridPrefs {
  readonly gridScope: GridScope;
  readonly arrangeSize: number;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

const storedView = (x: unknown): LeftPanelView =>
  STORED_VIEWS.includes(x as LeftPanelView) ? (x as LeftPanelView) : DEFAULT_LAYOUT.leftPanelView;
const storedPagesView = (x: unknown): PagesView => (x === 'bookmarks' ? 'bookmarks' : 'thumbnails');
const storedFilter = (x: unknown): ReviewFilter =>
  REVIEW_FILTERS.includes(x as ReviewFilter) ? (x as ReviewFilter) : DEFAULT_LAYOUT.reviewFilter;

/** Validates `ui:v3` field by field; anything unexpected falls back to defaults. */
export function parseLayout(value: unknown): PersistedLayout {
  const v = record(value);
  if (v === undefined) return DEFAULT_LAYOUT;
  const sidebar = record(v.sidebar) ?? {};
  return {
    leftPanelOpen: bool(sidebar.open, DEFAULT_LAYOUT.leftPanelOpen),
    leftPanelView: storedView(sidebar.section),
    pagesView: storedPagesView(v.pagesView),
    reviewFilter: storedFilter(v.reviewFilter),
    leftPanelWidth: width(sidebar.width, LEFT_PANEL_WIDTH),
  };
}

/**
 * The layout as `ui:v3` stores it. The sidebar's open state is left out while it equals the
 * default: M8 opened the navigator for everyone, and M9 starts the sidebar closed for
 * everyone once (06.17), which then needs only the default to change.
 */
export function toStoredLayout(layout: PersistedLayout & Partial<GridPrefs>): StoredLayout {
  const section = layout.leftPanelView === 'changes' ? 'pages' : layout.leftPanelView;
  const scope = layout.gridScope ?? DEFAULT_GRID.scope;
  const size = layout.arrangeSize ?? DEFAULT_GRID.size;
  return {
    ...(scope === DEFAULT_GRID.scope && size === DEFAULT_GRID.size
      ? {}
      : { grid: { scope, size } }),
    sidebar: {
      ...(layout.leftPanelOpen === DEFAULT_LAYOUT.leftPanelOpen
        ? {}
        : { open: layout.leftPanelOpen }),
      section,
      width: layout.leftPanelWidth,
    },
    pagesView: layout.pagesView,
    reviewFilter: layout.reviewFilter,
  };
}

/** The grid's scope and size from a stored `ui:v3`, field by field (defaults otherwise). */
export function parseGridPrefs(value: unknown): GridPrefs {
  const grid = record(record(value)?.grid) ?? {};
  const size = grid.size;
  return {
    gridScope: grid.scope === 'all' ? 'all' : DEFAULT_GRID.scope,
    arrangeSize:
      typeof size === 'number' && Number.isInteger(size)
        ? clamp(size, 0, ARRANGE_SIZES.length - 1)
        : DEFAULT_GRID.size,
  };
}

/** Validates `ui:v2` field by field, as M8 read it. */
export function parseLayoutV2(value: unknown): PersistedLayout {
  const v = record(value);
  if (v === undefined) return DEFAULT_LAYOUT;
  return {
    leftPanelOpen: bool(v.leftPanelOpen, DEFAULT_LAYOUT.leftPanelOpen),
    leftPanelView: storedView(v.leftPanelView),
    pagesView: storedPagesView(v.pagesView),
    reviewFilter: storedFilter(v.reviewFilter),
    leftPanelWidth: width(v.leftPanelWidth, LEFT_PANEL_WIDTH),
  };
}

/**
 * `ui:v2` → `ui:v3` (redesign spec §7): the navigator's tab becomes the sidebar's section and
 * its width the sidebar's; the Pages view and the Review filter carry over (the inspector does
 * not: D2-9 removed it).
 * Whether the navigator was open is not migrated (06.17): v2 stored it open for everyone who
 * never closed it, so its value says little about a choice, and the sidebar starts at its
 * default once.
 */
export function migrateLayoutV2(v2: unknown): PersistedLayout {
  return { ...parseLayoutV2(v2), leftPanelOpen: DEFAULT_LAYOUT.leftPanelOpen };
}

/**
 * `ui:v1` → `ui:v2`: the old view maps to its tab (outline → Pages with Bookmarks on;
 * search → Find; comments, redactions, forms → Review with that filter); widths and the
 * navigator's open state carry over. v1's inspector fields are not read (D2-9 removed it).
 */
export function migrateLayout(v1: unknown): PersistedLayout {
  const v = record(v1);
  if (v === undefined) return DEFAULT_LAYOUT;
  const view = v.leftPanelView;
  const target =
    isLegacyView(view) || view === 'pages'
      ? navigatorTarget(view)
      : { leftPanelView: DEFAULT_LAYOUT.leftPanelView };
  return {
    ...DEFAULT_LAYOUT,
    ...target,
    leftPanelOpen: bool(v.leftPanelOpen, DEFAULT_LAYOUT.leftPanelOpen),
    leftPanelWidth: width(v.leftPanelWidth, LEFT_PANEL_WIDTH),
  };
}

/**
 * Reads `ui:v3`, or migrates `ui:v2` (else `ui:v1`, through v2) once: the result is written,
 * so the older record is not read again. The older records stay where they are.
 */
export function loadLayout(): PersistedLayout {
  const stored = readJson(LAYOUT_STORAGE_KEY);
  if (stored !== undefined) return parseLayout(stored);
  const v2 = readJson(V2_LAYOUT_STORAGE_KEY);
  const v1 = v2 === undefined ? readJson(LEGACY_LAYOUT_STORAGE_KEY) : undefined;
  if (v2 === undefined && v1 === undefined) return DEFAULT_LAYOUT;
  const layout = migrateLayoutV2(v2 !== undefined ? v2 : migrateLayout(v1));
  writeJson(LAYOUT_STORAGE_KEY, toStoredLayout(layout));
  return layout;
}

/** The grid's stored scope and size (`ui:v3`'s `grid`), or the defaults. */
export function loadGridPrefs(): GridPrefs {
  return parseGridPrefs(readJson(LAYOUT_STORAGE_KEY));
}

const activeDocumentId = () => useWorkspaceStore.getState().workspace.activeDocument;

/** A document's UI; a document without an entry is on its page with Markup closed. */
export function documentUi(
  state: Pick<UiState, 'docUi'>,
  id: DocumentId | null | undefined,
): DocumentUi {
  return (id != null ? state.docUi[id] : undefined) ?? DEFAULT_DOCUMENT_UI;
}

/**
 * `docUi` with `patch` applied to `id`'s entry; the same object when nothing changes, so
 * subscribers see no new state.
 */
export function withDocumentUi(
  docUi: UiState['docUi'],
  id: DocumentId,
  patch: Partial<DocumentUi>,
): UiState['docUi'] {
  const current = docUi[id] ?? DEFAULT_DOCUMENT_UI;
  const next = { ...current, ...patch };
  if (
    docUi[id] !== undefined &&
    next.surface === current.surface &&
    next.markup === current.markup &&
    next.paletteSet === current.paletteSet
  ) {
    return docUi;
  }
  return { ...docUi, [id]: next };
}

/** The surface of `id` (the active document by default): its page unless set to the grid. */
export function surfaceOf(
  state: Pick<UiState, 'docUi'>,
  id: DocumentId | null | undefined = activeDocumentId(),
): Surface {
  return documentUi(state, id).surface;
}

/**
 * What the stage shows: the Library, Compare, or the surface of `id` (the active document
 * by default). Selectors that must follow the active tab use `useStageView`.
 */
export function stageView(
  state: Pick<UiState, 'destination' | 'docUi'>,
  id: DocumentId | null | undefined = activeDocumentId(),
): StageView {
  return state.destination === 'document' ? surfaceOf(state, id) : state.destination;
}

/**
 * Whether the page view shows (flows §2.4's `isPageView()`): `destination === 'document'`
 * and the active document's `surface === 'page'`. False on the Library and in Compare.
 */
export function isPageView(
  state: Pick<UiState, 'destination' | 'docUi'>,
  id: DocumentId | null | undefined = activeDocumentId(),
): boolean {
  return stageView(state, id) === 'page';
}

/** Whether Markup is open for `id`; false for no document. */
export function isMarkupOpen(
  state: Pick<UiState, 'docUi'>,
  id: DocumentId | null | undefined,
): boolean {
  return documentUi(state, id).markup;
}

export interface UiState extends PersistedLayout {
  /** The Library, a document or Compare (flows §2.1). Session (the snapshot keeps it). */
  destination: Destination;
  /**
   * Each document's surface and Markup state (redesign spec §7). Session (the snapshot keeps
   * the surface, and in D1-1 the Markup state as M8 kept Edit); a document without an entry
   * has `DEFAULT_DOCUMENT_UI`. Entries of closed documents stay, so undoing a close brings
   * the document back as it was; readers ignore them. The page view and Markup share the
   * page, so opening or closing Markup never moves it.
   */
  docUi: Readonly<Record<DocumentId, DocumentUi>>;
  zoom: number;
  /** While set, the stage keeps zoom fitted (to width or whole page) as it resizes. */
  fitMode: FitMode | null;
  /** Index into ARRANGE_SIZES: the Pages grid's cell size (PG2), kept per device. */
  arrangeSize: number;
  /** What the Pages grid shows (PG2), kept per device. */
  gridScope: GridScope;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  /** Command ids, most recent first. In memory only. */
  recents: readonly string[];
  /** Pages grid sections shown collapsed (header only) in All open (PG3). Session only. */
  arrangeCollapsed: readonly DocumentId[];
  /**
   * What a Combine made each new document from (PG6): the sources' titles, in order, for the
   * grid header's "Sources: …" line. Session only, never in the snapshot.
   */
  combinedFrom: Readonly<Record<DocumentId, readonly string[]>>;
  /** A document title being edited in place: in its tab or its light-table section. */
  renaming: { readonly documentId: DocumentId; readonly surface: 'tab' | 'section' } | null;
  /**
   * The selected cards on Home, in the order they were selected (experience-redesign §3).
   * Session only; ids of closed documents are ignored by readers (`home/home-model.ts`).
   */
  homeSelection: readonly DocumentId[];
  /** Where a Shift range on Home starts: the last card clicked or toggled. */
  homeAnchor: DocumentId | null;

  toggleLeftPanel: () => void;
  /** Opens the left panel on a view; selecting the open view again collapses it. */
  showLeftPanelView: (view: LeftPanelView) => void;
  /** Opens the navigator on a view (a legacy view opens its tab, Pages view or filter). */
  showNavigator: (view: LeftPanelView | LegacyLeftPanelView) => void;
  setPagesView: (view: PagesView) => void;
  setReviewFilter: (filter: ReviewFilter) => void;
  setLeftPanelWidth: (width: number) => void;
  /**
   * Shows a document on `surface` (`id`, the active document by default), leaving the
   * Library or Compare. With no document only the destination changes.
   */
  showSurface: (surface: Surface, id?: DocumentId) => void;
  /** Shows the Compare place (`4`, Compare with…). */
  showCompare: () => void;
  /** Shows the Library (`0`, the app glyph, "Show Home"); every document keeps its surface. */
  showHome: () => void;
  /** Leaves the Library for a document on its surface (its page the first time). */
  showDocument: (id: DocumentId) => void;
  /** Opens Markup for `id` (M8's Edit), on `set` (the last set when not given). */
  openMarkup: (id: DocumentId, set?: PaletteSet) => void;
  /** Closes Markup for `id` (M8's Read). */
  closeMarkup: (id: DocumentId) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Fit width. */
  zoomFit: () => void;
  zoomFitPage: () => void;
  zoomActual: () => void;
  /** Used by the stage while a fit mode is on; does not clear it. */
  applyFitZoom: (zoom: number) => void;
  setArrangeSize: (index: number) => void;
  /** Steps the light-table cell size; returns false at the ends. */
  stepArrangeSize: (direction: 1 | -1) => boolean;
  setPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  pushRecent: (commandId: string) => void;
  /** The Pages grid's scope (PG2): this document, or every open one as sections. */
  setGridScope: (scope: GridScope) => void;
  /** Records what a Combine made `id` from (PG6's "Sources:" line). */
  setCombinedFrom: (id: DocumentId, titles: readonly string[]) => void;
  setArrangeCollapsed: (id: DocumentId, collapsed: boolean) => void;
  setRenaming: (renaming: UiState['renaming']) => void;
  /** Replaces the Home selection; `anchor` defaults to the last selected card. */
  setHomeSelection: (selection: readonly DocumentId[], anchor?: DocumentId | null) => void;
}

const store = create<UiState>()((set, get) => ({
  ...loadLayout(),
  ...loadGridPrefs(),
  destination: 'document',
  docUi: {},
  zoom: 1,
  fitMode: 'width',
  paletteOpen: false,
  shortcutsOpen: false,
  recents: [],
  arrangeCollapsed: [],
  combinedFrom: {},
  renaming: null,
  homeSelection: [],
  homeAnchor: null,

  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  showLeftPanelView: (view) =>
    set((s) =>
      s.leftPanelOpen && s.leftPanelView === view
        ? { leftPanelOpen: false }
        : { leftPanelOpen: true, leftPanelView: view },
    ),
  showNavigator: (view) => set({ leftPanelOpen: true, ...navigatorTarget(view) }),
  setPagesView: (pagesView) => set({ pagesView }),
  setReviewFilter: (reviewFilter) => set({ reviewFilter }),
  setLeftPanelWidth: (width) =>
    set({ leftPanelWidth: clamp(Math.round(width), LEFT_PANEL_WIDTH.min, LEFT_PANEL_WIDTH.max) }),
  showSurface: (surface, id = activeDocumentId()) =>
    set((s) => ({
      destination: 'document',
      docUi: id === undefined ? s.docUi : withDocumentUi(s.docUi, id, { surface }),
    })),
  showCompare: () => set({ destination: 'compare' }),
  showHome: () => set({ destination: 'home' }),
  showDocument: () => set({ destination: 'document' }),
  openMarkup: (id, paletteSet) =>
    set((s) => {
      const docUi = withDocumentUi(s.docUi, id, {
        markup: true,
        ...(paletteSet === undefined ? {} : { paletteSet }),
      });
      return docUi === s.docUi ? s : { docUi };
    }),
  closeMarkup: (id) =>
    set((s) => {
      const docUi = withDocumentUi(s.docUi, id, { markup: false });
      return docUi === s.docUi ? s : { docUi };
    }),
  setZoom: (zoom) => set({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM), fitMode: null }),
  zoomIn: () => set((s) => ({ zoom: nextZoomLevel(s.zoom, 1), fitMode: null })),
  zoomOut: () => set((s) => ({ zoom: nextZoomLevel(s.zoom, -1), fitMode: null })),
  zoomFit: () => set({ fitMode: 'width' }),
  zoomFitPage: () => set({ fitMode: 'page' }),
  zoomActual: () => set({ zoom: 1, fitMode: null }),
  applyFitZoom: (zoom) => set({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }),
  setArrangeSize: (index) =>
    set({ arrangeSize: clamp(Math.round(index), 0, ARRANGE_SIZES.length - 1) }),
  stepArrangeSize: (direction) => {
    const next = get().arrangeSize + direction;
    if (next < 0 || next >= ARRANGE_SIZES.length) return false;
    set({ arrangeSize: next });
    return true;
  },
  setPaletteOpen: (paletteOpen) =>
    set(paletteOpen ? { paletteOpen, shortcutsOpen: false } : { paletteOpen }),
  setShortcutsOpen: (shortcutsOpen) =>
    set(shortcutsOpen ? { shortcutsOpen, paletteOpen: false } : { shortcutsOpen }),
  pushRecent: (id) =>
    set((s) => ({ recents: [id, ...s.recents.filter((r) => r !== id)].slice(0, MAX_RECENTS) })),
  setGridScope: (gridScope) => set((s) => (s.gridScope === gridScope ? s : { gridScope })),
  setCombinedFrom: (id, titles) =>
    set((s) => ({ combinedFrom: { ...s.combinedFrom, [id]: [...titles] } })),
  setRenaming: (renaming) => set({ renaming }),
  setHomeSelection: (selection, anchor) =>
    set({
      homeSelection: [...new Set(selection)],
      homeAnchor: anchor === undefined ? (selection[selection.length - 1] ?? null) : anchor,
    }),
  setArrangeCollapsed: (id, collapsed) =>
    set((s) => {
      if (s.arrangeCollapsed.includes(id) === collapsed) return s;
      return {
        arrangeCollapsed: collapsed
          ? [...s.arrangeCollapsed, id]
          : s.arrangeCollapsed.filter((c) => c !== id),
      };
    }),
}));

/** A state patch that may name a view of the seven-tab rail (`LegacyLeftPanelView`). */
export type UiStatePatch = Partial<Omit<UiState, 'leftPanelView'>> & {
  leftPanelView?: LeftPanelView | LegacyLeftPanelView;
};

function withNavigatorTarget<T extends UiStatePatch>(patch: T): Partial<UiState> {
  const view = patch.leftPanelView;
  return isLegacyView(view) ? { ...patch, ...navigatorTarget(view) } : (patch as Partial<UiState>);
}

// Callers written for the seven-tab rail set `leftPanelView: 'comments'` and the like;
// the patch is mapped to the navigator's tab and filter before it reaches the state.
const setState = store.setState;
store.setState = (partial: UiStatePatch | ((state: UiState) => UiStatePatch), replace?: boolean) =>
  replace === true
    ? setState(partial as UiState, true)
    : setState(
        typeof partial === 'function'
          ? (state) => withNavigatorTarget(partial(state))
          : withNavigatorTarget(partial),
      );

export const useUiStore = store as typeof store & {
  setState: (partial: UiStatePatch | ((state: UiState) => UiStatePatch)) => void;
};

// Persist layout changes only; the comparison avoids a write on every zoom or keystroke.
useUiStore.subscribe((state, previous) => {
  if (
    state.leftPanelOpen !== previous.leftPanelOpen ||
    state.leftPanelView !== previous.leftPanelView ||
    state.pagesView !== previous.pagesView ||
    state.reviewFilter !== previous.reviewFilter ||
    state.leftPanelWidth !== previous.leftPanelWidth ||
    state.gridScope !== previous.gridScope ||
    state.arrangeSize !== previous.arrangeSize
  ) {
    writeJson(LAYOUT_STORAGE_KEY, toStoredLayout(state));
  }
});

/**
 * M8's view was one for every document, so a tab switch kept what the stage showed. The
 * surface is per document now; until the Pages grid gives the surface its own rules (D2),
 * the document that becomes active in a document's view takes the surface the stage shows,
 * as M8 did. On the Library and in Compare nothing carries over.
 */
useWorkspaceStore.subscribe((state, previous) => {
  const next = state.workspace.activeDocument;
  const before = previous.workspace.activeDocument;
  if (next === before || next === undefined || before === undefined) return;
  const ui = useUiStore.getState();
  if (ui.destination !== 'document') return;
  const docUi = withDocumentUi(ui.docUi, next, { surface: surfaceOf(ui, before) });
  if (docUi !== ui.docUi) useUiStore.setState({ docUi });
});

/** What the stage shows, following both the destination and the active tab. */
export function useStageView(): StageView {
  const id = useWorkspaceStore((s) => s.workspace.activeDocument);
  return useUiStore((s) => stageView(s, id));
}

/**
 * Whether Markup is open for the active document: the Markup state of the tool bar and the
 * Esc ladder (flows §3.1). Whether the document may change is the change guard's question
 * (`state/guard.ts`, `canChange(id, act)`), which replaced M8's `canEdit` (D1-5).
 */
export function isMarkupOpenActive(): boolean {
  return isMarkupOpen(useUiStore.getState(), activeDocumentId());
}

/** `isMarkupOpenActive` for components. */
export function useMarkupOpen(): boolean {
  const id = useWorkspaceStore((s) => s.workspace.activeDocument);
  return useUiStore((s) => isMarkupOpen(s, id));
}
