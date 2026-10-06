import type { DocumentId } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useWorkspaceStore } from './workspace-store';
import {
  DEFAULT_DOCUMENT_UI,
  DEFAULT_LAYOUT,
  documentUi,
  isMarkupOpen,
  isMarkupOpenActive,
  isNavigatorShowing,
  isPageView,
  LAYOUT_STORAGE_KEY,
  LEFT_PANEL_WIDTH,
  LEGACY_LAYOUT_STORAGE_KEY,
  loadLayout,
  MAX_ZOOM,
  migrateLayout,
  MIN_ZOOM,
  nextZoomLevel,
  migrateLayoutV2,
  parseLayout,
  parseLayoutV2,
  stageView,
  surfaceOf,
  toStoredLayout,
  useUiStore,
  V2_LAYOUT_STORAGE_KEY,
} from './ui-store';

describe('parseLayoutV2 (M8)', () => {
  it('falls back to defaults for garbage', () => {
    for (const value of [undefined, null, 42, 'x', []]) {
      expect(parseLayoutV2(value)).toMatchObject({
        leftPanelOpen: false,
        leftPanelView: 'pages',
        leftPanelWidth: LEFT_PANEL_WIDTH.default,
      });
    }
  });

  it('keeps valid fields, clamps widths, and rejects unknown views', () => {
    expect(
      parseLayoutV2({
        leftPanelOpen: true,
        leftPanelView: 'review',
        pagesView: 'bookmarks',
        reviewFilter: 'fields',
        leftPanelWidth: 10_000,
        rightPanelOpen: true,
        rightPanelWidth: 1,
      }),
    ).toEqual({
      leftPanelOpen: true,
      leftPanelView: 'review',
      pagesView: 'bookmarks',
      reviewFilter: 'fields',
      leftPanelWidth: LEFT_PANEL_WIDTH.max,
    });
    expect(parseLayoutV2({ leftPanelView: 'bogus' }).leftPanelView).toBe('pages');
    // M8's Files tab is gone (06-navigation N1): the Library lists the open files.
    expect(parseLayoutV2({ leftPanelView: 'files' }).leftPanelView).toBe('pages');
    // v1 views are not v2 values; Changes lives only as long as a comparison.
    expect(parseLayoutV2({ leftPanelView: 'outline' }).leftPanelView).toBe('pages');
    expect(parseLayoutV2({ leftPanelView: 'changes' }).leftPanelView).toBe('pages');
    expect(parseLayoutV2({ pagesView: 'x', reviewFilter: 'y' })).toMatchObject({
      pagesView: 'thumbnails',
      reviewFilter: 'all',
    });
  });

  it('drops M8’s inspector fields: the inspector is gone (spec D2-9)', () => {
    expect(DEFAULT_LAYOUT).not.toHaveProperty('rightPanelOpen');
    expect(parseLayoutV2({ rightPanelOpen: true, rightPanelWidth: 320 })).toEqual(DEFAULT_LAYOUT);
  });
});

describe('ui:v3 (redesign spec §7)', () => {
  it('parses field by field: the sidebar record and the views; the inspector is ignored', () => {
    expect(
      parseLayout({
        sidebar: { open: true, section: 'files', width: 10_000 },
        pagesView: 'bookmarks',
        reviewFilter: 'words',
        inspector: { open: true, width: 1 },
      }),
    ).toEqual({
      leftPanelOpen: true,
      leftPanelView: 'pages',
      pagesView: 'bookmarks',
      reviewFilter: 'words',
      leftPanelWidth: LEFT_PANEL_WIDTH.max,
    });
    for (const value of [undefined, null, 42, 'x', [], {}, { sidebar: 'x', inspector: [] }]) {
      expect(parseLayout(value)).toEqual(DEFAULT_LAYOUT);
    }
    // A v2 record is not a v3 one; Changes lives only as long as a comparison.
    expect(parseLayout({ leftPanelOpen: false, leftPanelView: 'find' })).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout({ sidebar: { section: 'changes' } }).leftPanelView).toBe('pages');
    expect(parseLayout({ sidebar: { section: 'outline' } }).leftPanelView).toBe('pages');
  });

  it('starts the sidebar closed, 280 px wide (06-navigation N1, 06.17, 06.18)', () => {
    expect(DEFAULT_LAYOUT.leftPanelOpen).toBe(false);
    expect(LEFT_PANEL_WIDTH).toEqual({ min: 240, max: 400, default: 280 });
    expect(parseLayout(undefined).leftPanelOpen).toBe(false);
  });

  it('stores the sidebar open state only when it differs from the default (06.17)', () => {
    expect(toStoredLayout(DEFAULT_LAYOUT)).toEqual({
      sidebar: { section: 'pages', width: LEFT_PANEL_WIDTH.default },
      pagesView: 'thumbnails',
      reviewFilter: 'all',
    });
    expect(toStoredLayout({ ...DEFAULT_LAYOUT, leftPanelOpen: true }).sidebar).toEqual({
      open: true,
      section: 'pages',
      width: LEFT_PANEL_WIDTH.default,
    });
    // Compare's Changes is never stored.
    expect(toStoredLayout({ ...DEFAULT_LAYOUT, leftPanelView: 'changes' }).sidebar.section).toBe(
      'pages',
    );
    for (const layout of [
      DEFAULT_LAYOUT,
      { ...DEFAULT_LAYOUT, leftPanelOpen: true, leftPanelView: 'review' as const },
      { ...DEFAULT_LAYOUT, pagesView: 'bookmarks' as const },
    ]) {
      expect(parseLayout(toStoredLayout(layout))).toEqual(layout);
    }
  });
});

describe('ui:v2 → ui:v3 migration (redesign spec §7, 06.17)', () => {
  const views = ['pages', 'find', 'review'] as const;
  const pagesViews = ['thumbnails', 'bookmarks'] as const;
  const filters = ['all', 'comments', 'redactions', 'fields'] as const;
  const combinations = views.flatMap((leftPanelView) =>
    pagesViews.flatMap((pagesView) =>
      filters.flatMap((reviewFilter) =>
        [true, false].map((leftPanelOpen) => ({
          leftPanelOpen,
          leftPanelView,
          pagesView,
          reviewFilter,
          leftPanelWidth: 300,
        })),
      ),
    ),
  );

  it.each(combinations)(
    'maps open $leftPanelOpen on $leftPanelView ($pagesView, $reviewFilter)',
    (v2) => {
      const layout = migrateLayoutV2(v2);
      // Every field carries over except whether the navigator was open (06.17).
      expect(layout).toEqual({ ...v2, leftPanelOpen: DEFAULT_LAYOUT.leftPanelOpen });
      expect(toStoredLayout(layout)).toEqual({
        sidebar: { section: v2.leftPanelView, width: 300 },
        pagesView: v2.pagesView,
        reviewFilter: v2.reviewFilter,
      });
    },
  );

  it('validates v2 as M8 did: unknown views, garbage and widths fall back or clamp', () => {
    expect(migrateLayoutV2({ leftPanelView: 'changes', leftPanelWidth: 1 })).toMatchObject({
      leftPanelView: 'pages',
      leftPanelWidth: LEFT_PANEL_WIDTH.min,
    });
    expect(migrateLayoutV2({ leftPanelView: 'outline', pagesView: 'x' })).toMatchObject({
      leftPanelView: 'pages',
      pagesView: 'thumbnails',
    });
    for (const value of [undefined, null, 42, 'x', []]) {
      expect(migrateLayoutV2(value)).toEqual(DEFAULT_LAYOUT);
    }
  });

  describe('loadLayout', () => {
    const clear = () => {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
      localStorage.removeItem(V2_LAYOUT_STORAGE_KEY);
      localStorage.removeItem(LEGACY_LAYOUT_STORAGE_KEY);
    };
    beforeEach(clear);
    afterEach(clear);
    const v3 = () => JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? 'null') as unknown;

    it('migrates v2 once, writes v3 and leaves v2 alone', () => {
      const v2 = {
        leftPanelOpen: false,
        leftPanelView: 'find',
        pagesView: 'bookmarks',
        reviewFilter: 'comments',
        leftPanelWidth: 260,
        rightPanelOpen: true,
        rightPanelWidth: 300,
      };
      localStorage.setItem(V2_LAYOUT_STORAGE_KEY, JSON.stringify(v2));
      // M8's inspector fields are not carried (spec D2-9).
      const { rightPanelOpen: _open, rightPanelWidth: _width, ...kept } = v2;
      expect(loadLayout()).toEqual({ ...kept, leftPanelOpen: false });
      expect(v3()).toEqual({
        sidebar: { section: 'find', width: 260 },
        pagesView: 'bookmarks',
        reviewFilter: 'comments',
      });
      expect(JSON.parse(localStorage.getItem(V2_LAYOUT_STORAGE_KEY) ?? 'null')).toEqual(v2);
      // A later v2 write (an old tab) does not migrate again.
      localStorage.setItem(
        V2_LAYOUT_STORAGE_KEY,
        JSON.stringify({ ...v2, leftPanelView: 'review' }),
      );
      expect(loadLayout().leftPanelView).toBe('find');
    });

    it('prefers v2 over v1, and migrates v1 through v2 when it is the only record', () => {
      localStorage.setItem(
        LEGACY_LAYOUT_STORAGE_KEY,
        JSON.stringify({ leftPanelOpen: false, leftPanelView: 'outline', leftPanelWidth: 280 }),
      );
      localStorage.setItem(V2_LAYOUT_STORAGE_KEY, JSON.stringify({ leftPanelView: 'review' }));
      expect(loadLayout()).toMatchObject({ leftPanelView: 'review', pagesView: 'thumbnails' });
      clear();
      localStorage.setItem(
        LEGACY_LAYOUT_STORAGE_KEY,
        JSON.stringify({ leftPanelOpen: false, leftPanelView: 'outline', leftPanelWidth: 280 }),
      );
      expect(loadLayout()).toEqual({
        ...DEFAULT_LAYOUT,
        leftPanelView: 'pages',
        pagesView: 'bookmarks',
        leftPanelWidth: 280,
      });
      expect(v3()).toMatchObject({ sidebar: { section: 'pages', width: 280 } });
    });
  });
});

describe('ui:v1 → ui:v2 migration', () => {
  const v1 = (leftPanelView: string) => ({
    leftPanelOpen: true,
    leftPanelView,
    leftPanelWidth: 300,
    rightPanelOpen: true,
    rightPanelWidth: 320,
  });

  it.each([
    ['pages', { leftPanelView: 'pages', pagesView: 'thumbnails', reviewFilter: 'all' }],
    ['outline', { leftPanelView: 'pages', pagesView: 'bookmarks', reviewFilter: 'all' }],
    ['search', { leftPanelView: 'find', pagesView: 'thumbnails', reviewFilter: 'all' }],
    ['comments', { leftPanelView: 'review', pagesView: 'thumbnails', reviewFilter: 'comments' }],
    [
      'redactions',
      { leftPanelView: 'review', pagesView: 'thumbnails', reviewFilter: 'redactions' },
    ],
    ['forms', { leftPanelView: 'review', pagesView: 'thumbnails', reviewFilter: 'fields' }],
    ['files', { leftPanelView: 'pages', pagesView: 'thumbnails', reviewFilter: 'all' }],
    ['changes', { leftPanelView: 'pages', pagesView: 'thumbnails', reviewFilter: 'all' }],
    ['bogus', { leftPanelView: 'pages', pagesView: 'thumbnails', reviewFilter: 'all' }],
  ])('maps the v1 view %s', (view, expected) => {
    expect(migrateLayout(v1(view))).toEqual({
      ...expected,
      leftPanelOpen: true,
      leftPanelWidth: 300,
    });
  });

  it('carries the navigator state and clamps widths; garbage gives the defaults', () => {
    expect(
      migrateLayout({ leftPanelOpen: false, leftPanelWidth: 1, rightPanelWidth: 10_000 }),
    ).toEqual({
      ...DEFAULT_LAYOUT,
      leftPanelOpen: false,
      leftPanelWidth: LEFT_PANEL_WIDTH.min,
    });
    for (const value of [undefined, null, 42, 'x']) {
      expect(migrateLayout(value)).toEqual(DEFAULT_LAYOUT);
    }
  });

  describe('loadLayout', () => {
    const clear = () => {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
      localStorage.removeItem(V2_LAYOUT_STORAGE_KEY);
      localStorage.removeItem(LEGACY_LAYOUT_STORAGE_KEY);
    };
    beforeEach(clear);
    afterEach(clear);

    it('starts a new install with the defaults', () => {
      expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
    });

    it('migrates v1 once and then reads v3', () => {
      localStorage.setItem(LEGACY_LAYOUT_STORAGE_KEY, JSON.stringify(v1('redactions')));
      expect(loadLayout()).toMatchObject({ leftPanelView: 'review', reviewFilter: 'redactions' });
      expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? 'null')).toMatchObject({
        sidebar: { section: 'review' },
        reviewFilter: 'redactions',
      });
      // A later v1 write (an old tab) does not migrate again.
      localStorage.setItem(LEGACY_LAYOUT_STORAGE_KEY, JSON.stringify(v1('outline')));
      expect(loadLayout()).toMatchObject({ leftPanelView: 'review', reviewFilter: 'redactions' });
    });
  });
});

describe('navigator state', () => {
  afterEach(() => {
    useUiStore.setState({ ...DEFAULT_LAYOUT });
  });

  it('maps a v1 view set by a command to its tab and filter', () => {
    useUiStore.setState({ leftPanelOpen: true, leftPanelView: 'comments' });
    expect(useUiStore.getState()).toMatchObject({
      leftPanelView: 'review',
      reviewFilter: 'comments',
    });
    useUiStore.setState(() => ({ leftPanelView: 'outline' }));
    expect(useUiStore.getState()).toMatchObject({ leftPanelView: 'pages', pagesView: 'bookmarks' });
    useUiStore.getState().showNavigator('search');
    expect(useUiStore.getState().leftPanelView).toBe('find');
  });

  it('says whether a view is showing; a filter shows under All too', () => {
    const state = {
      ...DEFAULT_LAYOUT,
      leftPanelOpen: true,
      leftPanelView: 'review' as const,
      reviewFilter: 'all' as const,
    };
    expect(isNavigatorShowing(state, 'redactions')).toBe(true);
    expect(isNavigatorShowing({ ...state, reviewFilter: 'fields' }, 'redactions')).toBe(false);
    expect(isNavigatorShowing({ ...state, leftPanelOpen: false }, 'review')).toBe(false);
    const open = { ...DEFAULT_LAYOUT, leftPanelOpen: true };
    expect(isNavigatorShowing(open, 'outline')).toBe(false);
    expect(isNavigatorShowing({ ...open, pagesView: 'bookmarks' }, 'outline')).toBe(true);
  });

  it('persists the layout under ui:v3', () => {
    useUiStore.getState().setReviewFilter('fields');
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? 'null')).toMatchObject({
      reviewFilter: 'fields',
    });
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
  });
});

describe('destination, surface and Markup (redesign spec §7, flows §2.4)', () => {
  const a = 'doc-a' as DocumentId;
  const b = 'doc-b' as DocumentId;
  const workspace = useWorkspaceStore.getState().workspace;
  // The store starts with no document, so `workspace` has no active one.
  const activate = (id: DocumentId | undefined) =>
    useWorkspaceStore.setState({
      workspace: id === undefined ? workspace : { ...workspace, activeDocument: id },
    });
  afterEach(() => {
    useWorkspaceStore.setState({ workspace });
    useUiStore.setState({ destination: 'document', docUi: {} });
  });

  it('starts on a document, every document on its page with Markup closed', () => {
    const state = useUiStore.getState();
    expect(state.destination).toBe('document');
    expect(state.docUi).toEqual({});
    expect(documentUi(state, a)).toEqual(DEFAULT_DOCUMENT_UI);
    expect(DEFAULT_DOCUMENT_UI).toEqual({ surface: 'page', markup: false, paletteSet: 'draw' });
    expect(isMarkupOpen(state, a)).toBe(false);
    expect(isMarkupOpen(state, null)).toBe(false);
    expect(isPageView(state)).toBe(true);
    expect(stageView(state)).toBe('page');
    expect(stageView(state, a)).toBe('page');
  });

  it('keeps the surface per document; the Library and Compare are destinations', () => {
    useUiStore.getState().showSurface('grid', a);
    let state = useUiStore.getState();
    expect(surfaceOf(state, a)).toBe('grid');
    expect(surfaceOf(state, b)).toBe('page');
    expect(stageView(state, a)).toBe('grid');
    expect(isPageView(state, a)).toBe(false);
    expect(isPageView(state, b)).toBe(true);

    useUiStore.getState().showHome();
    state = useUiStore.getState();
    expect(stageView(state, a)).toBe('home');
    expect(isPageView(state, b)).toBe(false);
    // The surface is kept while the Library shows; leaving it returns to it.
    useUiStore.getState().showDocument(a);
    expect(stageView(useUiStore.getState(), a)).toBe('grid');

    useUiStore.getState().showCompare();
    state = useUiStore.getState();
    expect(state.destination).toBe('compare');
    expect(stageView(state, a)).toBe('compare');
    expect(isPageView(state, b)).toBe(false);
    // A surface set from the Library or Compare (a command, a panel row) shows that surface.
    useUiStore.getState().showSurface('page', a);
    state = useUiStore.getState();
    expect(stageView(state, a)).toBe('page');
    expect(surfaceOf(state, a)).toBe('page');
  });

  it('acts on the active document by default; with none, only the destination changes', () => {
    activate(a);
    useUiStore.getState().showSurface('grid');
    expect(useUiStore.getState().docUi).toEqual({
      [a]: { ...DEFAULT_DOCUMENT_UI, surface: 'grid' },
    });
    expect(stageView(useUiStore.getState())).toBe('grid');
    activate(undefined);
    useUiStore.getState().showHome();
    useUiStore.getState().showSurface('grid');
    expect(useUiStore.getState().destination).toBe('document');
    expect(Object.keys(useUiStore.getState().docUi)).toEqual([a]);
  });

  it('carries the shown surface to the document that becomes active, as M8 did', () => {
    activate(a);
    useUiStore.getState().showSurface('grid');
    activate(b);
    expect(surfaceOf(useUiStore.getState(), b)).toBe('grid');
    expect(stageView(useUiStore.getState())).toBe('grid');
    useUiStore.getState().showSurface('page');
    activate(a);
    expect(surfaceOf(useUiStore.getState(), a)).toBe('page');
    // Not from the Library or Compare: a tab there leaves the document as it was.
    useUiStore.getState().showSurface('grid', b);
    useUiStore.getState().showHome();
    activate(b);
    activate(a);
    expect(surfaceOf(useUiStore.getState(), a)).toBe('page');
    useUiStore.getState().showCompare();
    activate(b);
    expect(surfaceOf(useUiStore.getState(), b)).toBe('grid');
  });

  it('opens and closes Markup per document; the surface is shared with the page view', () => {
    useUiStore.getState().openMarkup(a);
    let state = useUiStore.getState();
    expect(isMarkupOpen(state, a)).toBe(true);
    expect(isMarkupOpen(state, b)).toBe(false);
    expect(documentUi(state, a)).toEqual({ surface: 'page', markup: true, paletteSet: 'draw' });
    // Opening it again changes nothing (no new state for subscribers).
    const before = useUiStore.getState().docUi;
    useUiStore.getState().openMarkup(a);
    expect(useUiStore.getState().docUi).toBe(before);
    // The door names the palette's set; without one the last set stays.
    useUiStore.getState().openMarkup(a, 'sign');
    useUiStore.getState().closeMarkup(a);
    useUiStore.getState().openMarkup(a);
    state = useUiStore.getState();
    expect(documentUi(state, a)).toEqual({ surface: 'page', markup: true, paletteSet: 'sign' });
    useUiStore.getState().closeMarkup(a);
    expect(isMarkupOpen(useUiStore.getState(), a)).toBe(false);
    const closed = useUiStore.getState().docUi;
    useUiStore.getState().closeMarkup(a);
    expect(useUiStore.getState().docUi).toBe(closed);
  });

  it('never persists the destination, surfaces or Markup; a stored stray view is ignored', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        ...toStoredLayout(DEFAULT_LAYOUT),
        viewMode: 'home',
        destination: 'home',
        docUi: { [a]: { surface: 'grid', markup: true } },
      }),
    );
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
    useUiStore.getState().showHome();
    useUiStore.getState().openMarkup(a);
    useUiStore.getState().showSurface('grid', a);
    useUiStore.getState().setReviewFilter('comments');
    const stored = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? 'null') as object;
    expect(Object.keys(stored).sort()).toEqual(Object.keys(toStoredLayout(DEFAULT_LAYOUT)).sort());
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    useUiStore.setState({ ...DEFAULT_LAYOUT });
  });

  it('no longer carries the M8 view and mode state', () => {
    const state = useUiStore.getState();
    for (const gone of [
      'tool',
      'setTool',
      'viewMode',
      'documentMode',
      'lastView',
      'setViewMode',
      'setDocumentMode',
      'rememberView',
    ]) {
      expect(gone in state, gone).toBe(false);
    }
  });
});

describe('nextZoomLevel', () => {
  it('steps through discrete levels and clamps at the ends', () => {
    expect(nextZoomLevel(1, 1)).toBe(1.1);
    expect(nextZoomLevel(1, -1)).toBe(0.9);
    expect(nextZoomLevel(1.03, 1)).toBe(1.1);
    expect(nextZoomLevel(1.03, -1)).toBe(1);
    expect(nextZoomLevel(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(nextZoomLevel(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });
});

describe("the Markup state, which replaced M8's Edit and its shim", () => {
  const a = 'doc-a' as DocumentId;
  const b = 'doc-b' as DocumentId;
  afterEach(() => {
    useUiStore.setState({ docUi: {} });
  });

  it('is true only while Markup is open for the document, and fails closed otherwise', () => {
    expect(isMarkupOpen(useUiStore.getState(), a)).toBe(false);
    expect(isMarkupOpen(useUiStore.getState(), null)).toBe(false);
    expect(isMarkupOpen(useUiStore.getState(), undefined)).toBe(false);
    useUiStore.getState().openMarkup(a);
    expect(isMarkupOpen(useUiStore.getState(), a)).toBe(true);
    expect(isMarkupOpen(useUiStore.getState(), b)).toBe(false);
    useUiStore.getState().closeMarkup(a);
    expect(isMarkupOpen(useUiStore.getState(), a)).toBe(false);
    // The grid and the palette set do not open Markup.
    useUiStore.getState().showSurface('grid', b);
    expect(isMarkupOpen(useUiStore.getState(), b)).toBe(false);
  });

  it('reads a given state, so selectors can use it', () => {
    const open = { ...DEFAULT_DOCUMENT_UI, markup: true };
    expect(isMarkupOpen({ docUi: { [a]: open } }, a)).toBe(true);
    expect(isMarkupOpen({ docUi: { [b]: open } }, a)).toBe(false);
    expect(isMarkupOpen({ docUi: { [a]: DEFAULT_DOCUMENT_UI } }, a)).toBe(false);
  });

  it('is kept through surfaces, the Library and Compare: Markup belongs to the document', () => {
    useUiStore.getState().openMarkup(a);
    useUiStore.getState().showSurface('grid', a);
    useUiStore.getState().showHome();
    expect(isMarkupOpen(useUiStore.getState(), a)).toBe(true);
    useUiStore.getState().showCompare();
    expect(isMarkupOpen(useUiStore.getState(), a)).toBe(true);
    useUiStore.setState({ destination: 'document' });
  });

  it('isMarkupOpenActive follows the active document', () => {
    const ws = useWorkspaceStore.getState();
    const before = ws.workspace;
    useWorkspaceStore.setState({ workspace: { ...before, activeDocument: a } });
    expect(isMarkupOpenActive()).toBe(false);
    useUiStore.getState().openMarkup(a);
    expect(isMarkupOpenActive()).toBe(true);
    useWorkspaceStore.setState({ workspace: { ...before, activeDocument: b } });
    expect(isMarkupOpenActive()).toBe(false);
    useWorkspaceStore.setState({ workspace: before });
  });
});
