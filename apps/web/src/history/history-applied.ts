/**
 * `recto:history-applied` (docs/design/motion-2026-10/frame.md §6): after ↶, ↷ or a kept
 * History scrubber jump has brought the change into view, the window receives this event with
 * what the step touched, so the lane that draws an object can flash it, and the user sees
 * exactly what changed.
 *
 * - **When:** once per undo, redo or kept jump in the active document, after the page is laid
 *   out and its scroll has landed (`reveal.ts`), never for the scrubber's live preview.
 * - **Detail** (`HistoryAppliedDetail`): the direction, the document, the pages and the
 *   annotations (strokes included: ink is an annotation) the step added, removed or changed.
 *   Ids are the ones the DOM carries (`data-page-id`, `data-annotation-id`). A removed object
 *   is listed too; it is simply not on the page to flash.
 * - **Cancelable:** a lane that draws its own highlight calls `preventDefault()` on the event,
 *   and the default flash (`flashChanged()`: each listed annotation found on the page, else
 *   the page's ring) does not run. One flash per step, never two.
 * - Reduced motion: the default flash holds still (opacity only, as `ringFlash`); a listener
 *   reads `reducedMotion()` itself.
 */
import type {
  DocumentId,
  EngineEdit,
  HistoryStepKind,
  PageId,
  Workspace,
} from '@pdf-editor/document-model';

import { duration, EASE, RING_FLASH, reducedMotion, ringFlash } from '../motion';

/** The event's name. */
export const HISTORY_APPLIED = 'recto:history-applied';

/** What a history step touched, as the event carries it. */
export interface HistoryAppliedDetail {
  /** ↶ (or a jump back), ↷ (or a jump forward). */
  readonly direction: 'undo' | 'redo';
  readonly documentId: DocumentId;
  /** The step's kind (`HistoryEntryMeta.kind`), when known. */
  readonly kind?: HistoryStepKind | undefined;
  /** The page the step points at first (the one brought into view), then any other it changed. */
  readonly pageIds: readonly PageId[];
  /** Annotations (strokes included) the step created, changed or removed. */
  readonly annotationIds: readonly string[];
}

declare global {
  interface WindowEventMap {
    [HISTORY_APPLIED]: CustomEvent<HistoryAppliedDetail>;
  }
}

/** The annotation an engine edit is about (as `editAnnotationId` in annotations/edit-runner). */
function annotationOf(edit: EngineEdit): string | undefined {
  const payload = edit.payload as
    | { annotation?: { id?: unknown }; annotationId?: unknown }
    | null
    | undefined;
  const id = payload?.annotation?.id ?? payload?.annotationId;
  return typeof id === 'string' ? id : undefined;
}

/**
 * What changed in document `id` between `before` and `after` (either order): its pages that
 * are new, gone or changed (rotated, cropped), and the annotations of the engine edits one
 * side has and the other has not. `first` leads the pages.
 */
export function changedBetween(
  before: Workspace,
  after: Workspace,
  id: DocumentId,
  first?: PageId,
): { readonly pageIds: PageId[]; readonly annotationIds: string[] } {
  const was = before.documents[id]?.pages ?? [];
  const now = after.documents[id]?.pages ?? [];
  const wasById = new Map(was.map((p) => [p.id, p]));
  const nowIds = new Set(now.map((p) => p.id));
  const pages = new Set<PageId>(first === undefined ? [] : [first]);
  for (const page of now) if (wasById.get(page.id) !== page) pages.add(page.id);
  for (const page of was) if (!nowIds.has(page.id)) pages.add(page.id);
  const sources = new Set(
    [...was, ...now].flatMap((p) => (p.ref.kind === 'source' ? [p.ref.source] : [])),
  );
  const ids = (edits: readonly EngineEdit[]) =>
    new Set(edits.filter((e) => sources.has(e.source)).map((e) => e.id));
  const a = ids(before.engineEdits);
  const b = ids(after.engineEdits);
  const annotations = new Set<string>();
  for (const edit of [...before.engineEdits, ...after.engineEdits]) {
    if (a.has(edit.id) === b.has(edit.id)) continue;
    const annotation = annotationOf(edit);
    if (annotation !== undefined) annotations.add(annotation);
  }
  return { pageIds: [...pages], annotationIds: [...annotations] };
}

/**
 * Dispatches `recto:history-applied` with `detail`. Returns false when a listener took the
 * flash over (`preventDefault()`).
 */
export function dispatchHistoryApplied(detail: HistoryAppliedDetail): boolean {
  if (typeof window === 'undefined') return true;
  return window.dispatchEvent(new CustomEvent(HISTORY_APPLIED, { detail, cancelable: true }));
}

/**
 * The default flash (frame.md §6): a tint in the page's selection blue over each listed
 * annotation found inside `page`, in, held and out on the undo reveal's 500 ms (`RING_FLASH`);
 * with none found (a removed object, a page step), the page's ring. Opacity only, so reduced
 * motion keeps it (held still, then gone). Nothing is left behind (Q-2).
 */
export function flashChanged(page: HTMLElement, annotationIds: readonly string[]): void {
  const found = annotationIds.flatMap((id) => [
    ...page.querySelectorAll(`[data-annotation-id="${CSS.escape(id)}"]`),
  ]);
  if (found.length === 0 || typeof page.animate !== 'function') {
    ringFlash(page, 'select');
    return;
  }
  const origin = page.getBoundingClientRect();
  const { inMs, holdMs, totalMs } = RING_FLASH;
  for (const el of found) {
    const box = el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    const tint = page.ownerDocument.createElement('div');
    tint.setAttribute('aria-hidden', 'true');
    tint.dataset.historyFlash = '';
    const pad = 3;
    Object.assign(tint.style, {
      position: 'absolute',
      left: `${box.left - origin.left - pad}px`,
      top: `${box.top - origin.top - pad}px`,
      width: `${box.width + 2 * pad}px`,
      height: `${box.height + 2 * pad}px`,
      borderRadius: '4px',
      background: 'color-mix(in srgb, var(--select, Highlight) 22%, transparent)',
      boxShadow: '0 0 0 2px var(--select, Highlight)',
      pointerEvents: 'none',
      zIndex: '5',
      opacity: '0',
    });
    page.append(tint);
    const frames = reducedMotion()
      ? [{ opacity: 1 }, { opacity: 1 }]
      : [
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: inMs / totalMs },
          { opacity: 1, offset: (inMs + holdMs) / totalMs },
          { opacity: 0, offset: 1 },
        ];
    const flash = tint.animate(frames, {
      duration: reducedMotion() ? Math.max(totalMs, duration('base')) : totalMs,
      easing: reducedMotion() ? 'linear' : EASE.out,
    });
    const remove = () => tint.remove();
    void flash.finished.then(remove, remove);
  }
}
