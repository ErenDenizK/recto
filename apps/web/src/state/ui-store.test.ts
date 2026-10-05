import type { DocumentId } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  canEdit,
  DEFAULT_LAYOUT,
  documentModeOf,
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
  RIGHT_PANEL_WIDTH,
  stageView,
  toStoredLayout,
  useUiStore,
  V2_LAYOUT_STORAGE_KEY,
} from './ui-store';

describe('parseLayoutV2 (M8)', () => {
  it('falls back to defaults for garbage', () => {
    for (const value of [undefined, null, 42, 'x', []]) {
      expect(parseLayoutV2(value)).toMatchObject({
        leftPanelOpen: true,
        leftPanelView: 'pages',
        leftPanelWidth: LEFT_PANEL_WIDTH.default,
      });
    }
  });

  it('keeps valid fields, clamps widths, and rejects unknown views', () => {
    expect(
      parseLayoutV2({
        leftPanelOpen: false,
        leftPanelView: 'files',
        pagesView: 'bookmarks',
        reviewFilter: 'fields',
        leftPanelWidth: 10_000,
        rightPanelOpen: true,
        rightPanelWidth: 1,
      }),
    ).toEqual({
      leftPanelOpen: false,
      leftPanelView: 'files',
      pagesView: 'bookmarks',
      reviewFilter: 'fields',
      leftPanelWidth: LEFT_PANEL_WIDTH.max,
      rightPanelOpen: true,
      rightPanelWidth: RIGHT_PANEL_WIDTH.min,
    });
    expect(parseLayoutV2({ leftPanelView: 'bogus' }).leftPanelView).toBe('pages');
    // v1 views are not v2 values; Changes lives only as long as a comparison.
    expect(parseLayoutV2({ leftPanelView: 'outline' }).leftPanelView).toBe('pages');
    expect(parseLayoutV2({ leftPanelView: 'changes' }).leftPanelView).toBe('pages');
    expect(parseLayoutV2({ pagesView: 'x', reviewFilter: 'y' })).toMatchObject({
      pagesView: 'thumbnails',
      reviewFilter: 'all',
    });
  });

  it('keeps the inspector closed by default (experience-redesign decision 4)', () => {
    expect(DEFAULT_LAYOUT.rightPanelOpen).toBe(false);
    expect(parseLayoutV2(undefined).rightPanelOpen).toBe(false);
    expect(parseLayoutV2({}).rightPanelOpen).toBe(false);
  });
});

describe('ui:v3 (redesign spec §7)', () => {
  it('parses field by field: the sidebar record, the views, the inspector', () => {
    expect(
      parseLayout({
        sidebar: { open: false, section: 'files', width: 10_000 },
        pagesView: 'bookmarks',
        reviewFilter: 'fields',
        inspector: { open: true, width: 1 },
      }),
    ).toEqual({
      leftPanelOpen: false,
      leftPanelView: 'files',
      pagesView: 'bookmarks',
      reviewFilter: 'fields',
      leftPanelWidth: LEFT_PANEL_WIDTH.max,
      rightPanelOpen: true,
      rightPanelWidth: RIGHT_PANEL_WIDTH.min,
    });
    for (const value of [undefined, null, 42, 'x', [], {}, { sidebar: 'x', inspector: [] }]) {
      expect(parseLayout(value)).toEqual(DEFAULT_LAYOUT);
    }
    // A v2 record is not a v3 one; Changes lives only as long as a comparison.
    expect(parseLayout({ leftPanelOpen: false, leftPanelView: 'find' })).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout({ sidebar: { section: 'changes' } }).leftPanelView).toBe('pages');
    expect(parseLayout({ sidebar: { section: 'outline' } }).leftPanelView).toBe('pages');
  });

  it('stores the sidebar open state only when it differs from the default (06.17)', () => {
    expect(toStoredLayout(DEFAULT_LAYOUT)).toEqual({
      sidebar: { section: 'pages', width: LEFT_PANEL_WIDTH.default },
      pagesView: 'thumbnails',
      reviewFilter: 'all',
      inspector: { open: false, width: RIGHT_PANEL_WIDTH.default },
    });
    expect(toStoredLayout({ ...DEFAULT_LAYOUT, leftPanelOpen: false }).sidebar).toEqual({
      open: false,
      section: 'pages',
      width: LEFT_PANEL_WIDTH.default,
    });
    // Compare's Changes is never stored.
    expect(toStoredLayout({ ...DEFAULT_LAYOUT, leftPanelView: 'changes' }).sidebar.section).toBe(
      'pages',
    );
    for (const layout of [
      DEFAULT_LAYOUT,
      { ...DEFAULT_LAYOUT, leftPanelOpen: false, leftPanelView: 'review' as const },
      { ...DEFAULT_LAYOUT, pagesView: 'bookmarks' as const, rightPanelOpen: true },
    ]) {
      expect(parseLayout(toStoredLayout(layout))).toEqual(layout);
    }
  });
});

describe('ui:v2 → ui:v3 migration (redesign spec §7, 06.17)', () => {
  const views = ['pages', 'find', 'review', 'files'] as const;
  const pagesViews = ['thumbnails', 'bookmarks'] as const;
  const filters = ['all', 'comments', 'redactions', 'fields'] as const;
  const combinations = views.flatMap((leftPanelView) =>
    pagesViews.flatMap((pagesView) =>
      filters.flatMap((reviewFilter) =>
        [true, false].flatMap((leftPanelOpen) =>
          [true, false].map((rightPanelOpen) => ({
            leftPanelOpen,
            leftPanelView,
            pagesView,
            reviewFilter,
            leftPanelWidth: 300,
            rightPanelOpen,
            rightPanelWidth: 320,
          })),
        ),
      ),
    ),
  );

  it.each(combinations)(
    'maps open $leftPanelOpen on $leftPanelView ($pagesView, $reviewFilter), inspector $rightPanelOpen',
    (v2) => {
      const layout = migrateLayoutV2(v2);
      // Every field carries over except whether the navigator was open (06.17).
      expect(layout).toEqual({ ...v2, leftPanelOpen: DEFAULT_LAYOUT.leftPanelOpen });
      expect(toStoredLayout(layout)).toEqual({
        sidebar: { section: v2.leftPanelView, width: 300 },
        pagesView: v2.pagesView,
        reviewFilter: v2.reviewFilter,
        inspector: { open: v2.rightPanelOpen, width: 320 },
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
      expect(loadLayout()).toEqual({ ...v2, leftPanelOpen: true });
      expect(v3()).toEqual({
        sidebar: { section: 'find', width: 260 },
        pagesView: 'bookmarks',
        reviewFilter: 'comments',
        inspector: { open: true, width: 300 },
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
    ['files', { leftPanelView: 'files', pagesView: 'thumbnails', reviewFilter: 'all' }],
    ['changes', { leftPanelView: 'pages', pagesView: 'thumbnails', reviewFilter: 'all' }],
    ['bogus', { leftPanelView: 'pages', pagesView: 'thumbnails', reviewFilter: 'all' }],
  ])('maps the v1 view %s', (view, expected) => {
    expect(migrateLayout(v1(view))).toEqual({
      ...expected,
      leftPanelOpen: true,
      leftPanelWidth: 300,
      // v1 stored the inspector open for everyone; v2 starts it closed.
      rightPanelOpen: false,
      rightPanelWidth: 320,
    });
  });

  it('carries the navigator state and clamps widths; garbage gives the defaults', () => {
    expect(
      migrateLayout({ leftPanelOpen: false, leftPanelWidth: 1, rightPanelWidth: 10_000 }),
    ).toMatchObject({
      leftPanelOpen: false,
      leftPanelWidth: LEFT_PANEL_WIDTH.min,
      rightPanelWidth: RIGHT_PANEL_WIDTH.max,
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

    it('starts a new install with the defaults, inspector closed', () => {
      expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
      expect(loadLayout().rightPanelOpen).toBe(false);
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
      leftPanelView: 'review' as const,
      reviewFilter: 'all' as const,
    };
    expect(isNavigatorShowing(state, 'redactions')).toBe(true);
    expect(isNavigatorShowing({ ...state, reviewFilter: 'fields' }, 'redactions')).toBe(false);
    expect(isNavigatorShowing({ ...state, leftPanelOpen: false }, 'review')).toBe(false);
    expect(isNavigatorShowing({ ...DEFAULT_LAYOUT }, 'outline')).toBe(false);
    expect(isNavigatorShowing({ ...DEFAULT_LAYOUT, pagesView: 'bookmarks' }, 'outline')).toBe(true);
  });

  it('persists the layout under ui:v3', () => {
    useUiStore.getState().setReviewFilter('fields');
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? 'null')).toMatchObject({
      reviewFilter: 'fields',
    });
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
  });
});

describe('Home, views and document modes (ADR-0019 §1–§2)', () => {
  const a = 'doc-a' as DocumentId;
  const b = 'doc-b' as DocumentId;
  afterEach(() => {
    useUiStore.setState({
      destination: 'document',
      viewMode: 'read',
      documentMode: {},
      lastView: {},
    });
  });

  it('starts on the document view, every document in Read', () => {
    const state = useUiStore.getState();
    expect(state.destination).toBe('document');
    expect(state.viewMode).toBe('read');
    expect(documentModeOf(state, a)).toBe('read');
    expect(documentModeOf(state, null)).toBe('read');
    expect(isPageView(state)).toBe(true);
    expect(stageView(state)).toBe('read');
  });

  it('shows Home without forgetting the view, and leaves it by setting a view', () => {
    useUiStore.getState().setViewMode('arrange');
    useUiStore.getState().showHome();
    let state = useUiStore.getState();
    expect(state.destination).toBe('home');
    expect(state.viewMode).toBe('arrange');
    expect(stageView(state)).toBe('home');
    expect(isPageView(state)).toBe(false);
    // A view set from Home (a command, a panel row) shows that view.
    useUiStore.getState().setViewMode('read');
    state = useUiStore.getState();
    expect(stageView(state)).toBe('read');
    expect(isPageView(state)).toBe(true);
  });

  it('leaves Home for a document in its last view, Read the first time', () => {
    useUiStore.getState().rememberView(a, 'arrange');
    useUiStore.getState().showHome();
    useUiStore.getState().showDocument(a);
    expect(stageView(useUiStore.getState())).toBe('arrange');
    useUiStore.getState().showHome();
    useUiStore.getState().showDocument(b);
    expect(stageView(useUiStore.getState())).toBe('read');
    expect(useUiStore.getState().lastView).toEqual({ [a]: 'arrange' });
  });

  it('keeps Read or Edit per document; the view is shared', () => {
    useUiStore.getState().setDocumentMode(a, 'edit');
    const state = useUiStore.getState();
    expect(documentModeOf(state, a)).toBe('edit');
    expect(documentModeOf(state, b)).toBe('read');
    expect(state.viewMode).toBe('read');
    // Setting the same mode again changes nothing (no new state for subscribers).
    const before = useUiStore.getState().documentMode;
    useUiStore.getState().setDocumentMode(a, 'edit');
    expect(useUiStore.getState().documentMode).toBe(before);
    useUiStore.getState().setDocumentMode(a, 'read');
    expect(documentModeOf(useUiStore.getState(), a)).toBe('read');
  });

  it('never persists the destination, views or modes; a stored stray view is ignored', () => {
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ ...toStoredLayout(DEFAULT_LAYOUT), viewMode: 'home', destination: 'home' }),
    );
    expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
    useUiStore.getState().showHome();
    useUiStore.getState().setDocumentMode(a, 'edit');
    useUiStore.getState().setReviewFilter('comments');
    const stored = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? 'null') as object;
    expect(Object.keys(stored).sort()).toEqual(Object.keys(toStoredLayout(DEFAULT_LAYOUT)).sort());
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    useUiStore.setState({ ...DEFAULT_LAYOUT });
  });

  it('no longer carries the placeholder tool state', () => {
    expect('tool' in useUiStore.getState()).toBe(false);
    expect('setTool' in useUiStore.getState()).toBe(false);
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

describe('canEdit, the Read lock (ADR-0019 §3)', () => {
  const a = 'doc-a' as DocumentId;
  const b = 'doc-b' as DocumentId;
  afterEach(() => {
    useUiStore.setState({ documentMode: {} });
  });

  it('is true only for a document in Edit, and fails closed otherwise', () => {
    expect(canEdit(a)).toBe(false);
    expect(canEdit(null)).toBe(false);
    expect(canEdit(undefined)).toBe(false);
    useUiStore.getState().setDocumentMode(a, 'edit');
    expect(canEdit(a)).toBe(true);
    expect(canEdit(b)).toBe(false);
    useUiStore.getState().setDocumentMode(a, 'read');
    expect(canEdit(a)).toBe(false);
  });

  it('reads a given state, so selectors can use it', () => {
    expect(canEdit(a, { documentMode: { [a]: 'edit' } })).toBe(true);
    expect(canEdit(a, { documentMode: { [b]: 'edit' } })).toBe(false);
  });

  it('is kept through views and Home: the lock belongs to the document', () => {
    useUiStore.getState().setDocumentMode(a, 'edit');
    useUiStore.getState().setViewMode('arrange');
    useUiStore.getState().showHome();
    expect(canEdit(a)).toBe(true);
    useUiStore.setState({ destination: 'document', viewMode: 'read' });
  });
});
