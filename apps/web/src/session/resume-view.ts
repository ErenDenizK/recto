/**
 * The DOM half of "where you left off" (R26 concept 4, DSN-66; Epic 3, lane 3c): reads the page
 * view for `resume.ts`'s store and puts it back, to within ±2 px. Loaded only behind
 * `?home=continue` (the session starts it, `resumeDocument` and the phone's reader use it), so
 * the editor's first load carries the store alone.
 *
 * - **Capture** (`captureResume`) reads the page view's own DOM: the page in the middle of the
 *   viewport (`view-store.currentPage`) and how far the viewport's top is below that page's top
 *   (`[data-read-viewport]`, `[data-page-index]`, which both editions mark). It runs when the
 *   reader scrolls or zooms (debounced), and synchronously just before the page view leaves.
 * - **Apply** (`settleResume`) runs after the page view mounted at the remembered zoom: it
 *   asks for the page, then nudges the scroll until the offset matches for four frames in a
 *   row, because rows that were never measured move the page as they mount. A wheel, touch or
 *   key from the reader hands the scroll back at once.
 * - **Zoom** is the full edition's `ui-store` zoom and fit mode; the compact edition has its own
 *   zoom, relative to fit, and registers it with `setResumeZoom` (`shell/compact/`).
 *
 * Known limit: the horizontal offset is not kept; a page wider than the stage opens centred.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { type FitMode, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { type ResumePoint, type ResumeDetail, setResume, useResumeStore } from './resume';

// ---------------------------------------------------------------------------
// Zoom, per edition
// ---------------------------------------------------------------------------

/** How an edition reads and sets its zoom. */
export interface ResumeZoom {
  read(): { readonly zoom: number; readonly fit: FitMode | null };
  write(zoom: number, fit: FitMode | null): void;
}

const fullZoom: ResumeZoom = {
  read: () => {
    const { zoom, fitMode } = useUiStore.getState();
    return { zoom, fit: fitMode };
  },
  write: (zoom, fit) =>
    useUiStore.setState(fit === null ? { zoom, fitMode: null } : { fitMode: fit }),
};

let zoomPort: ResumeZoom = fullZoom;

/** The compact edition's zoom (`shell/compact/compact-resume.ts`). */
export function setResumeZoom(port: ResumeZoom | null): void {
  zoomPort = port ?? fullZoom;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

const VIEWPORT = '[data-read-viewport]';

function viewport(): HTMLElement | null {
  return document.querySelector<HTMLElement>(VIEWPORT);
}

/** How far the viewport's top is below page `page`'s top, or undefined while it is not drawn. */
function offsetOf(page: number): number | undefined {
  const el = viewport();
  const target = el?.querySelector<HTMLElement>(`[data-page-index="${page}"]`);
  if (!el || !target) return undefined;
  return Math.round(el.getBoundingClientRect().top - target.getBoundingClientRect().top);
}

/** The zoom and offset kept for `id`, for the session snapshot (`DocumentPlace.resume`). */
export function resumeDetailOf(id: DocumentId): ResumeDetail | undefined {
  const point = useResumeStore.getState().points[id];
  return point === undefined
    ? undefined
    : { zoom: point.zoom, fit: point.fit, offset: point.offset };
}

/** A restored or reopened document's place, from its snapshot (`DocumentPlace.resume`). */
export function seedResume(
  id: DocumentId,
  place: { readonly page: number; readonly resume?: ResumeDetail },
  total: number,
): void {
  if (place.resume === undefined) return;
  // A page past the end (a snapshot of a longer document) shows as the last page.
  const page = Math.min(Math.max(0, place.page), Math.max(0, total - 1));
  setResume(id, { ...place.resume, page, total, at: Date.now() }, { quiet: true });
}

/**
 * Records where the page view of `id` (the active document) is now. Nothing is recorded while
 * the page view is not mounted, so leaving it never overwrites the place with a blank one; the
 * leaving itself reads it first (`watchResume`: the store is set before React unmounts it).
 */
export function captureResume(id?: DocumentId | null, now: number = Date.now()): void {
  const ws = useWorkspaceStore.getState().workspace;
  const documentId = id ?? ws.activeDocument;
  const doc =
    documentId === null || documentId === undefined ? undefined : ws.documents[documentId];
  if (!doc || doc.pages.length === 0 || viewport() === null) return;
  const page = Math.min(Math.max(0, useViewStore.getState().currentPage), doc.pages.length - 1);
  const offset = offsetOf(page);
  if (offset === undefined) return;
  const { zoom, fit } = zoomPort.read();
  setResume(doc.id, { page, total: doc.pages.length, zoom, fit, offset, at: now });
}

/** The delay between the last scroll or zoom and its capture. */
const CAPTURE_DELAY_MS = 220;

/**
 * Keeps the points up to date while the app runs (started with the session). Returns the stop
 * function.
 */
export function watchResume(onPoints: () => void): () => void {
  // A changed point is a change to keep (`session.ts`).
  const offPoints = useResumeStore.subscribe((state, previous) => {
    if (state.points !== previous.points) onPoints();
  });
  let timer = 0;
  const later = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => captureResume(), CAPTURE_DELAY_MS);
  };
  const onScroll = (event: Event) => {
    if (event.target instanceof Element && event.target.matches(VIEWPORT)) later();
  };
  const onHide = () => {
    if (document.visibilityState === 'hidden') captureResume();
  };
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onHide);
  const offView = useViewStore.subscribe((state, previous) => {
    if (state.currentPage !== previous.currentPage) later();
  });
  // The page view leaves (Home, the grid) or another tab comes: read it before its DOM goes.
  const offUi = useUiStore.subscribe((state, previous) => {
    if (state.zoom !== previous.zoom || state.fitMode !== previous.fitMode) later();
    if (state.destination !== previous.destination && state.destination !== 'document') {
      captureResume(undefined, Date.now());
    }
  });
  const offWorkspace = useWorkspaceStore.subscribe((state, previous) => {
    const left = previous.workspace.activeDocument;
    if (state.workspace.activeDocument !== left) captureResume(left);
  });
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('scroll', onScroll, { capture: true });
    document.removeEventListener('visibilitychange', onHide);
    offView();
    offUi();
    offWorkspace();
    offPoints();
  };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/** Frames the offset must hold for before the scroll is let go. */
const STABLE_FRAMES = 4;
/** About two seconds at 60 Hz: after that the reader keeps what it has. */
const MAX_FRAMES = 120;
const HAND_BACK = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
/** The latest `settleResume` call; an older one stops when it sees a newer one. */
let generation = 0;

/** Sets the zoom a point was left at; call before the page view mounts. */
export function applyResumeZoom(point: ResumeDetail): void {
  zoomPort.write(point.zoom, point.fit);
}

/**
 * After the page view mounted: brings page `point.page` of `id` to the offset it was left at.
 * Safe to call more than once; each call supersedes the one before.
 */
export function settleResume(id: DocumentId, point: ResumePoint): void {
  generation += 1;
  const mine = generation;
  let frames = 0;
  let stable = 0;
  let handedBack = false;
  // The page view is held transparent until the scroll has settled, so the jump is never seen.
  let held: HTMLElement | null = null;
  const release = () => {
    if (held) held.style.opacity = '';
    held = null;
  };
  const hand = () => {
    handedBack = true;
  };
  for (const type of HAND_BACK) window.addEventListener(type, hand, { capture: true, once: true });
  const done = () => {
    release();
    for (const type of HAND_BACK) window.removeEventListener(type, hand, { capture: true });
  };
  const tick = () => {
    if (handedBack || mine !== generation) {
      done();
      return;
    }
    const doc = useWorkspaceStore.getState().workspace.documents[id];
    const el = viewport();
    const index = Math.min(Math.max(0, point.page), Math.max(0, (doc?.pages.length ?? 1) - 1));
    const page = doc?.pages[index];
    if (doc && el && page) {
      if (held !== el) {
        release();
        held = el;
        el.style.opacity = '0';
      }
      const offset = offsetOf(index);
      if (offset === undefined) {
        // The page is not drawn yet: ask the page view for it (it drops the request if unmounted).
        if (frames % 8 === 0) {
          useViewStore.getState().scrollToPage(page.id, { motion: 'instant' });
        }
        stable = 0;
      } else if (Math.abs(point.offset - offset) > 1) {
        el.scrollTop += point.offset - offset;
        stable = 0;
      } else {
        stable += 1;
      }
    }
    frames += 1;
    if (stable >= STABLE_FRAMES || frames > MAX_FRAMES) {
      done();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
