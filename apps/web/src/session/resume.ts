/**
 * Where each document was left (R26 concept 4, DSN-66; Epic 3 lanes 3b and 3c): the page, the
 * zoom and the scroll offset, kept per open document so the Library's Continue card and its
 * cards can say "page 4 of 8" and one tap can land on the same pixel row (within ±2 px).
 *
 * Nothing here has a storage key of its own. The point lives in memory (`useResumeStore`) and
 * rides in the session snapshot (`DocumentPlace.resume`, ADR-0032 §2.4): a reload restores it
 * with the document, and a closed document's kept record carries it into Recents.
 *
 * This file is the store alone, small enough for the editor's first load; the DOM half, which
 * reads and restores the scroll, is `resume-view.ts`, loaded only behind `?home=continue`.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { create } from 'zustand';

import type { FitMode } from '../state/ui-store';

/** What the session snapshot keeps beside the page (`DocumentPlace.resume`). */
export interface ResumeDetail {
  readonly zoom: number;
  readonly fit: FitMode | null;
  /** CSS px the viewport's top lies below the page's top (negative: above it). */
  readonly offset: number;
}

/** A document's resting place. `page` is 0-based; `total` its page count when captured. */
export interface ResumePoint extends ResumeDetail {
  readonly page: number;
  readonly total: number;
  readonly at: number;
}

interface ResumeState {
  readonly points: Readonly<Record<string, ResumePoint>>;
  /** The document read last. */
  readonly last: DocumentId | null;
}

const INITIAL: ResumeState = { points: {}, last: null };

export const useResumeStore = create<ResumeState>()(() => INITIAL);

/** Forgets everything (tests). */
export function resetResumeStore(): void {
  useResumeStore.setState(INITIAL);
}

/** Records `point` for `id`; `last` follows unless `quiet` (a restore seeds without it). */
export function setResume(id: DocumentId, point: ResumePoint, options?: { quiet?: boolean }): void {
  useResumeStore.setState((s) => {
    const known = s.points[id];
    const quiet = options?.quiet === true;
    const last = quiet ? s.last : id;
    const same =
      known?.page === point.page &&
      known.total === point.total &&
      known.zoom === point.zoom &&
      known.fit === point.fit &&
      known.offset === point.offset;
    if (same) return last === s.last ? s : { ...s, last };
    return { points: { ...s.points, [id]: point }, last };
  });
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

/** Fraction of the document read when the page `page` (0-based) is reached, 0..1. */
export function progressOf(point: Pick<ResumePoint, 'page' | 'total'>): number {
  return point.total <= 0 ? 0 : Math.min(1, (point.page + 1) / point.total);
}
