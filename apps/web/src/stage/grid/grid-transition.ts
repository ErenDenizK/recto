/**
 * The way into and out of the Pages grid (`components/06-navigation.md` PG1 §6, §7; flows.md
 * §2.1; language.md §7.3 *view change*): one 240 ms View Transition through `motion/`'s
 * `viewTransition`, in which the current page morphs into its cell on the way in and the cell
 * back into its page on the way out, while the rest of the view cross-fades.
 *
 * - **Names.** Only the page and its cell carry `view-transition-name: page-current`, set just
 *   before the transition captures the old view and just after React has drawn the new one
 *   (inside the update callback, which runs in `flushSync`; the grid renders the cell's row at
 *   once, `ArrangeView.tsx`). A side without its element in view (a page scrolled away, a cell
 *   outside the virtual window) is left unnamed: the view then only cross-fades, never morphs
 *   from a wrong place. The names come off once the transition has had its 240 ms.
 * - **No cross-fade of the rest:** the old view stays opaque and the new one fades in over it in
 *   150 ms (`grid-transition.css`, while `<html>` has `data-vt-grid`), so the dock never shows
 *   at half strength beside the Pages bar it morphs into. The capsule is not named (a named
 *   element is captured on its own, where its backdrop blur has nothing to blur, Q-1): its own
 *   *bar morph* runs live in the new view, from the dock's box (spec X21).
 * - **Entry** remembers the page that was current, per document, so Done, Esc and `3` return
 *   to it (the nearest surviving page if it was deleted). Selection clears when the surface
 *   changes (06-navigation §1.1), and the grid's keyboard focus starts on that page's cell.
 * - **Announcements** (PG1 §5): "Pages grid. 12 pages. Page 3." on entry, "Page 7 of 12" on
 *   leaving.
 * - **The way out is prepared** (D4-4): the page view is mounted first, hidden under the grid
 *   (`usePreparedPageView`, `Stage.tsx`), scrolled to the page, and the transition starts once
 *   that page has drawn (a frame after its canvas renders, at most `PREPARE_MS`). Mounting the
 *   page view inside the transition's update held the captured cell on screen for frames
 *   (the update and the new view's first rendering ran before the morph could start), so the
 *   cell sat still, then jumped; now the update only reveals a view that is already drawn.
 *
 * Reduced motion keeps the transition but strips every name (`styles/motion.css`): a root
 * cross-fade cut at 150 ms. Size steps and scope switches never come here (A-10).
 */
import type { DocumentId, PageId } from '@pdf-editor/document-model';
import { useSyncExternalStore } from 'react';

import { m } from '../../i18n';
import { viewTransition } from '../../motion/view-transition';
import { VT_MS } from '../../motion/tokens';
import { announce } from '../../shell/announcer';
import { useSelectionStore } from '../../state/selection-store';
import { stageView, useUiStore } from '../../state/ui-store';
import { useViewStore } from '../../state/view-store';
import { pagesPhrase, useWorkspaceStore } from '../../state/workspace-store';
import { pageIndexes } from '../arrange-data';
import './grid-transition.css';

/** The shared element's name on both sides (PG1 §7). */
export const PAGE_CURRENT = 'page-current';
/** Set on `<html>` while the grid's view change runs (`grid-transition.css`). */
const GRID_ATTRIBUTE = 'data-vt-grid';

/** The page each document showed when its grid opened, and that page's index then. */
const entries = new Map<DocumentId, { readonly page: PageId; readonly index: number }>();
/** The page the grid reveals (centred, focused) as it mounts; taken once. */
let reveal: PageId | null = null;

/** The longest the way out waits for the page view to draw its page before it starts, ms. */
export const PREPARE_MS = 200;
/** The document whose page view is mounted, hidden, while the grid prepares its way out. */
let prepared: DocumentId | null = null;
const preparedListeners = new Set<() => void>();

function setPrepared(id: DocumentId | null): void {
  if (prepared === id) return;
  prepared = id;
  for (const listener of preparedListeners) listener();
}

/** The document whose page view `Stage` mounts hidden under the grid, while the way out prepares. */
export function usePreparedPageView(): DocumentId | null {
  return useSyncExternalStore(
    (listener) => {
      preparedListeners.add(listener);
      return () => preparedListeners.delete(listener);
    },
    () => prepared,
    () => null,
  );
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Resolves once `page`'s canvas in the page view has rendered, or after `PREPARE_MS`. */
async function pageDrawn(page: PageId): Promise<void> {
  const end = performance.now() + PREPARE_MS;
  while (performance.now() < end) {
    const canvas = document.querySelector(
      `[data-read-viewport] [data-page-id="${CSS.escape(page)}"] canvas[data-state="rendered"]`,
    );
    if (canvas) return;
    await nextFrame();
  }
}

/** The page to reveal as the grid mounts, if an entrance asked for one (taken once). */
export function takeGridReveal(): PageId | null {
  const page = reveal;
  reveal = null;
  return page;
}

/** The page the grid of `id` returns to on Done: the entry page, or the one now at its place. */
export function gridReturnPage(id: DocumentId): PageId | undefined {
  const doc = useWorkspaceStore.getState().workspace.documents[id];
  if (!doc || doc.pages.length === 0) return undefined;
  const entry = entries.get(id);
  if (entry && pageIndexes(doc).has(entry.page)) return entry.page;
  const index = Math.min(entry?.index ?? useViewStore.getState().currentPage, doc.pages.length - 1);
  return doc.pages[Math.max(0, index)]?.id;
}

function inView(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return (
    box.width > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < window.innerHeight &&
    box.left < window.innerWidth
  );
}

/** A page of the page view, if it is drawn and on screen. */
function pageElement(id: PageId): HTMLElement | null {
  const element = document.querySelector<HTMLElement>(
    `[data-read-viewport] [data-page-id="${CSS.escape(id)}"]`,
  );
  return element && inView(element) ? element : null;
}

/** A grid cell, if it is drawn. */
export function gridCell(id: PageId): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-grid-viewport] [role="gridcell"][data-page-id="${CSS.escape(id)}"]`,
  );
}

/**
 * A cell's page, if it is drawn and on screen: its bitmap's canvas, not the sheet, whose
 * current ring and selection marks would otherwise scale with the morph.
 */
function cellSheet(id: PageId): HTMLElement | null {
  const sheet = gridCell(id)?.querySelector<HTMLElement>('[data-thumb] canvas') ?? null;
  return sheet && inView(sheet) ? sheet : null;
}

function name(element: HTMLElement | null): void {
  if (element) element.style.viewTransitionName = PAGE_CURRENT;
}

/** Takes the names off once the transition is over (it is cut at `VT_MS`, view-transition.ts). */
function unnameSoon(elements: readonly (HTMLElement | null)[]): void {
  window.setTimeout(() => {
    for (const element of elements) {
      if (element?.style.viewTransitionName === PAGE_CURRENT) element.style.viewTransitionName = '';
    }
  }, VT_MS + 60);
}

/**
 * Runs `apply` as the grid's view change, with `named` named in the old view and what `find`
 * returns named in the new one.
 */
function change(
  direction: 'in' | 'out',
  named: HTMLElement | null,
  apply: () => void,
  find: () => HTMLElement | null,
  after?: () => void,
): void {
  name(named);
  const root = document.documentElement;
  root.setAttribute(GRID_ATTRIBUTE, direction);
  let arrived: HTMLElement | null = null;
  void viewTransition(
    async () => {
      // The store update renders at once (flushSync in viewTransition); the microtask lets the
      // updates its effects scheduled synchronously settle before the new view is read.
      apply();
      await Promise.resolve();
      arrived = find();
      // Name the arriving side only when the leaving side was named too: half a pair would
      // fly in from the root's corner.
      if (named) name(arrived);
      after?.();
    },
    { name: 'grid' },
  )
    .catch(() => undefined)
    .finally(() => {
      // The transition is cut at VT_MS (view-transition.ts); its styles go with it.
      window.setTimeout(() => root.removeAttribute(GRID_ATTRIBUTE), VT_MS + 60);
      unnameSoon([named, arrived]);
    });
}

/**
 * Opens the Pages grid of the active document at `page` (the current page by default), as a
 * *view change* (module header). A grid already showing only moves its focus to `page`.
 */
export function enterGrid(options: { readonly page?: PageId } = {}): void {
  const ui = useUiStore.getState();
  const ws = useWorkspaceStore.getState().workspace;
  const id = ws.activeDocument;
  const doc = id === undefined ? undefined : ws.documents[id];
  if (id === undefined || !doc) return;
  const selection = useSelectionStore.getState();
  if (stageView(ui) === 'grid') {
    if (options.page !== undefined) {
      selection.setFocused(options.page);
      gridCell(options.page)?.focus({ preventScroll: true });
    }
    return;
  }
  const current = doc.pages[Math.min(useViewStore.getState().currentPage, doc.pages.length - 1)];
  const page = options.page ?? current?.id;
  const index = page === undefined ? -1 : (pageIndexes(doc).get(page) ?? -1);
  if (page !== undefined && index >= 0) entries.set(id, { page, index });
  selection.clear();
  if (page !== undefined) selection.setFocused(page);
  reveal = page ?? null;
  const from = page === undefined ? null : pageElement(page);
  change(
    'in',
    from,
    () => useUiStore.getState().showSurface('grid', id),
    () => (page === undefined ? null : cellSheet(page)),
    () => {
      if (page !== undefined) gridCell(page)?.focus({ preventScroll: true });
    },
  );
  announce(
    m.grid_announce_enter({
      pages: pagesPhrase(doc.pages.length),
      page: index >= 0 ? index + 1 : 1,
    }),
  );
}

/**
 * Leaves the grid for the page view at `page` (the page the grid opened at by default; PG1
 * §6): Done, Esc with nothing selected, `3`, `1`, Enter or a double-click on a cell. A page of
 * another section opens on its own tab.
 */
export function leaveGrid(options: { readonly page?: PageId } = {}): void {
  const ui = useUiStore.getState();
  if (stageView(ui) !== 'grid') return;
  const workspace = useWorkspaceStore.getState();
  const ws = workspace.workspace;
  let id = ws.activeDocument;
  if (options.page !== undefined) {
    const owner = ws.documentOrder.find((doc) =>
      ws.documents[doc] ? pageIndexes(ws.documents[doc]).has(options.page as PageId) : false,
    );
    if (owner !== undefined) id = owner;
  }
  if (id === undefined) return;
  const doc = ws.documents[id];
  const page = options.page ?? gridReturnPage(id);
  // A way out already preparing finishes on its own.
  if (prepared !== null) return;
  useSelectionStore.getState().clear();
  // Without View Transitions nothing is held, so nothing is prepared: the view changes at once.
  const prepare = page !== undefined && typeof document.startViewTransition === 'function';
  const out = () =>
    change(
      'out',
      page === undefined ? null : cellSheet(page),
      () => {
        if (useWorkspaceStore.getState().workspace.activeDocument !== id) workspace.setActive(id);
        useUiStore.getState().showSurface('page', id);
        setPrepared(null);
        if (page !== undefined && !prepare) useViewStore.getState().scrollToPage(page);
      },
      () => (page === undefined ? null : pageElement(page)),
    );
  if (!prepare || page === undefined) {
    out();
  } else {
    setPrepared(id);
    void (async () => {
      // The page view mounts (hidden) on the next render; then it scrolls to the page.
      await nextFrame();
      useViewStore.getState().scrollToPage(page);
      await pageDrawn(page);
      await nextFrame();
      // Left meanwhile (another view, the document closed): the hidden view goes.
      if (prepared !== id || stageView(useUiStore.getState()) !== 'grid') {
        setPrepared(null);
        return;
      }
      out();
    })();
  }
  const index = page === undefined || !doc ? -1 : (pageIndexes(doc).get(page) ?? -1);
  if (doc && index >= 0) {
    announce(m.grid_announce_leave({ page: index + 1, count: doc.pages.length }));
  }
}
