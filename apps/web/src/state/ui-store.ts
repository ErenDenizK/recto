/**
 * UI state (redesign spec §7, flows §2.4): panels, where the shell is (the Library, a
 * document or Compare), each document's surface and Markup state, zoom, grid cell size,
 * overlays, recents. Document content (including the active tab) is not here; see
 * `workspace-store.ts`.
 *
 * M8's global `viewMode`, per-document `documentMode` and `lastView` are gone: Compare is a
 * destination, the page view or the light table is the document's `surface`, and M8's Edit
 * is the document's `markup` (`canEdit` reads it until the input rules replace it, D1-5).
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
 * snapshot. `markup` is whether Markup is open: until the input rules land (D1-5) it carries
 * M8's Edit, so `canEdit` reads it and the snapshot keeps it as M8 kept Edit. `paletteSet`
 * is the last door into Markup, for the session.
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
 * The navigator's tabs (experience-redesign §4.1). `changes` is the Compare view's Changes
 * list, shown only in Compare; not persisted (a comparison lives for the session).
 */
export type LeftPanelView = 'pages' | 'find' | 'review' | 'files' | 'changes';
/**
 * Views of the seven-tab rail (`ui:v1`). Still accepted when the state is set (commands
 * written against them keep working) and mapped by `navigatorTarget`; never stored.
 */
export type LegacyLeftPanelView = 'outline' | 'search' | 'comments' | 'redactions' | 'forms';
/** What the Pages tab shows: thumbnails, or the outline ("Bookmarks"). Remembered. */
export type PagesView = 'thumbnails' | 'bookmarks';
/** The Review tab's filter chips (experience-redesign §4.1). Remembered. */
export type ReviewFilter = 'all' | 'comments' | 'redactions' | 'fields';
export const LEFT_PANEL_WIDTH = { min: 200, max: 420, default: 248 } as const;
export const RIGHT_PANEL_WIDTH = { min: 240, max: 440, default: 280 } as const;

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
  /** The inspector: closed until the person opens it; the app never opens it by itself. */
  rightPanelOpen: boolean;
  rightPanelWidth: number;
}

export const DEFAULT_LAYOUT: PersistedLayout = {
  leftPanelOpen: true,
  leftPanelView: 'pages',
  pagesView: 'thumbnails',
  reviewFilter: 'all',
  leftPanelWidth: LEFT_PANEL_WIDTH.default,
  rightPanelOpen: false,
  rightPanelWidth: RIGHT_PANEL_WIDTH.default,
};

const STORED_VIEWS: readonly LeftPanelView[] = ['pages', 'find', 'review', 'files'];
const LEGACY_VIEWS: readonly LegacyLeftPanelView[] = [
  'outline',
  'search',
  'comments',
  'redactions',
  'forms',
];
const REVIEW_FILTERS: readonly ReviewFilter[] = ['all', 'comments', 'redactions', 'fields'];

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
 * Review filter, and M8's inspector until the frame (D2-1) removes it. The sidebar's `files`
 * section is M8's Files tab, read until the sidebar (D2-4) removes it; a stored value it no
 * longer knows then falls back to Pages, field by field.
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
  readonly inspector: { readonly open: boolean; readonly width: number };
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
  const inspector = record(v.inspector) ?? {};
  return {
    leftPanelOpen: bool(sidebar.open, DEFAULT_LAYOUT.leftPanelOpen),
    leftPanelView: storedView(sidebar.section),
    pagesView: storedPagesView(v.pagesView),
    reviewFilter: storedFilter(v.reviewFilter),
    leftPanelWidth: width(sidebar.width, LEFT_PANEL_WIDTH),
    rightPanelOpen: bool(inspector.open, DEFAULT_LAYOUT.rightPanelOpen),
    rightPanelWidth: width(inspector.width, RIGHT_PANEL_WIDTH),
  };
}

/**
 * The layout as `ui:v3` stores it. The sidebar's open state is left out while it equals the
 * default: M8 opened the navigator for everyone, and M9 starts the sidebar closed for
 * everyone once (06.17), which then needs only the default to change.
 */
export function toStoredLayout(layout: PersistedLayout): StoredLayout {
  const section = layout.leftPanelView === 'changes' ? 'pages' : layout.leftPanelView;
  return {
    sidebar: {
      ...(layout.leftPanelOpen === DEFAULT_LAYOUT.leftPanelOpen
        ? {}
        : { open: layout.leftPanelOpen }),
      section,
      width: layout.leftPanelWidth,
    },
    pagesView: layout.pagesView,
    reviewFilter: layout.reviewFilter,
    inspector: { open: layout.rightPanelOpen, width: layout.rightPanelWidth },
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
    rightPanelOpen: bool(v.rightPanelOpen, DEFAULT_LAYOUT.rightPanelOpen),
    rightPanelWidth: width(v.rightPanelWidth, RIGHT_PANEL_WIDTH),
  };
}

/**
 * `ui:v2` → `ui:v3` (redesign spec §7): the navigator's tab becomes the sidebar's section and
 * its width the sidebar's; the Pages view, the Review filter and the inspector carry over.
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
 * navigator's open state carry over. The inspector starts closed (decision 4): v1 stored
 * it open for everyone who never touched it, so its value says nothing about a choice.
 */
export function migrateLayout(v1: unknown): PersistedLayout {
  const v = record(v1);
  if (v === undefined) return DEFAULT_LAYOUT;
  const view = v.leftPanelView;
  const target =
    isLegacyView(view) || view === 'pages' || view === 'files'
      ? navigatorTarget(view)
      : { leftPanelView: DEFAULT_LAYOUT.leftPanelView };
  return {
    ...DEFAULT_LAYOUT,
    ...target,
    leftPanelOpen: bool(v.leftPanelOpen, DEFAULT_LAYOUT.leftPanelOpen),
    leftPanelWidth: width(v.leftPanelWidth, LEFT_PANEL_WIDTH),
    rightPanelWidth: width(v.rightPanelWidth, RIGHT_PANEL_WIDTH),
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

/** Whether Markup is open for `id` (M8's Edit until D1-5); false for no document. */
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
  /** Index into ARRANGE_SIZES. */
  arrangeSize: number;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  /** Command ids, most recent first. In memory only. */
  recents: readonly string[];
  /**
   * Documents pinned into the light table as sections, besides the active one (spec §1).
   * Session only; ids of closed documents are ignored by readers and pruned on unpin.
   */
  arrangePinned: readonly DocumentId[];
  /**
   * Documents hidden from the light table (experience-redesign §8: Arrange shows every open
   * document by default; "Hide from Arrange" takes one out). The active document is always
   * shown. Session only; ids of closed documents are ignored by readers.
   */
  arrangeHidden: readonly DocumentId[];
  /** Light-table sections shown collapsed (header only). Session only. */
  arrangeCollapsed: readonly DocumentId[];
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
  toggleRightPanel: () => void;
  setRightPanelWidth: (width: number) => void;
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
  /**
   * Pins documents into the light table. `alsoKeep` (the active document) is pinned too,
   * so switching tabs later never drops a section the user was looking at.
   */
  pinToArrange: (ids: readonly DocumentId[], alsoKeep?: DocumentId) => void;
  unpinFromArrange: (id: DocumentId) => void;
  /** Takes a document off the light table until it is shown again (`pinToArrange`). */
  hideFromArrange: (id: DocumentId) => void;
  setArrangeCollapsed: (id: DocumentId, collapsed: boolean) => void;
  setRenaming: (renaming: UiState['renaming']) => void;
  /** Replaces the Home selection; `anchor` defaults to the last selected card. */
  setHomeSelection: (selection: readonly DocumentId[], anchor?: DocumentId | null) => void;
}

function withIds(
  list: readonly DocumentId[],
  ids: readonly (DocumentId | undefined)[],
): readonly DocumentId[] {
  const added = ids.filter((id): id is DocumentId => id !== undefined && !list.includes(id));
  return added.length === 0 ? list : [...list, ...new Set(added)];
}

const store = create<UiState>()((set, get) => ({
  ...loadLayout(),
  destination: 'document',
  docUi: {},
  zoom: 1,
  fitMode: 'width',
  arrangeSize: DEFAULT_ARRANGE_SIZE,
  paletteOpen: false,
  shortcutsOpen: false,
  recents: [],
  arrangePinned: [],
  arrangeHidden: [],
  arrangeCollapsed: [],
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
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelWidth: (width) =>
    set({
      rightPanelWidth: clamp(Math.round(width), RIGHT_PANEL_WIDTH.min, RIGHT_PANEL_WIDTH.max),
    }),
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
  pinToArrange: (ids, alsoKeep) =>
    set((s) => {
      const arrangePinned = withIds(s.arrangePinned, [alsoKeep, ...ids]);
      const shown = new Set([alsoKeep, ...ids]);
      const arrangeHidden = s.arrangeHidden.some((id) => shown.has(id))
        ? s.arrangeHidden.filter((id) => !shown.has(id))
        : s.arrangeHidden;
      return arrangePinned === s.arrangePinned && arrangeHidden === s.arrangeHidden
        ? s
        : { arrangePinned, arrangeHidden };
    }),
  unpinFromArrange: (id) =>
    set((s) =>
      s.arrangePinned.includes(id)
        ? { arrangePinned: s.arrangePinned.filter((pinned) => pinned !== id) }
        : s,
    ),
  hideFromArrange: (id) =>
    set((s) =>
      s.arrangeHidden.includes(id)
        ? s
        : {
            arrangeHidden: [...s.arrangeHidden, id],
            arrangePinned: s.arrangePinned.filter((pinned) => pinned !== id),
          },
    ),
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
    state.rightPanelOpen !== previous.rightPanelOpen ||
    state.rightPanelWidth !== previous.rightPanelWidth
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
 * The Read lock (ADR-0019 §3), kept as a shim with M8's meaning until the input rules
 * replace it (D1-5; `canChange` in D1-2): whether `id` may change from the page. True only
 * while Markup is open for the document (M8's Edit, `docUi[id].markup`); an unknown or
 * missing document is locked, so a missed check fails closed. Whole-document operations
 * with their own dialog (Document menu, Arrange) and Undo / Redo do not ask.
 */
export function canEdit(
  id: DocumentId | null | undefined,
  state: Pick<UiState, 'docUi'> = useUiStore.getState(),
): boolean {
  return id != null && state.docUi[id]?.markup === true;
}

/** `canEdit` for the active document. */
export function canEditActive(): boolean {
  return canEdit(activeDocumentId());
}

/** Whether Markup is open for the active document (the page layers and the bar follow it). */
export function useCanEdit(): boolean {
  const id = useWorkspaceStore((s) => s.workspace.activeDocument);
  return useUiStore((s) => canEdit(id, s));
}
