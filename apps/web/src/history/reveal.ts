/**
 * Undo reveal (01-frame F3 §6, F1 §6; ADR-0032 §2.8; flows.md §5.3): after ↶, ↷ or a kept
 * scrubber jump, the page the step changed is brought into view and flashes a ring once.
 *
 * - Only for a step in the active document: a step in another document is announced with
 *   its name and the tabs stay as they are (no tab switch, F3 §6).
 * - The page scrolls only when it is not in view already (the smallest move; the page view's
 *   scroll requests keep it inside the unobscured rectangle). The free rectangle of the
 *   redesigned frame (`revealInFree`) replaces this when the D2 shell lands.
 * - The ring is one Web Animations run on the page's outline in `--select` (the page's
 *   selection blue, spec D0-1), so nothing is left on the element and nothing runs after it
 *   (quality-bar Q-2, Q-10: idle at rest). Reduced motion keeps the flash, which only changes
 *   colour, and shortens it.
 */
import type { HistoryEntryMeta, PageId, Workspace } from '@pdf-editor/document-model';

import { reducedMotion } from '../motion';

import { isPageView, useUiStore } from '../state/ui-store';
import { distanceFromView, useViewStore } from '../state/view-store';

/** How long the ring shows (ms): in, hold, out. */
export const REVEAL_FLASH_MS = 900;
const REVEAL_FLASH_REDUCED_MS = 400;
/** How many frames to wait for a scrolled-to page to be laid out before giving up. */
const MAX_WAIT_FRAMES = 30;

/** The page index (0-based) the step points at in `workspace`, if it is the active document. */
export function revealTarget(
  meta: HistoryEntryMeta | undefined,
  workspace: Workspace,
): { readonly index: number; readonly pageId: PageId } | undefined {
  if (meta?.documentId === undefined || meta.page === undefined) return undefined;
  if (meta.documentId !== workspace.activeDocument) return undefined;
  const pages = workspace.documents[meta.documentId]?.pages ?? [];
  if (pages.length === 0) return undefined;
  const index = Math.min(meta.page, pages.length) - 1;
  const page = pages[index];
  return page === undefined ? undefined : { index, pageId: page.id };
}

/** Flashes the ring on `element` once. */
export function flashRing(element: HTMLElement): Animation | undefined {
  if (typeof element.animate !== 'function') return undefined;
  const ring = getComputedStyle(document.documentElement).getPropertyValue('--select').trim();
  const color = ring === '' ? 'Highlight' : ring;
  const clear = 'rgb(0 0 0 / 0)';
  const frame = (outlineColor: string) => ({
    outlineColor,
    outlineStyle: 'solid',
    outlineWidth: '3px',
    outlineOffset: '3px',
  });
  return element.animate([frame(clear), frame(color), frame(color), frame(clear)], {
    duration: reducedMotion() ? REVEAL_FLASH_REDUCED_MS : REVEAL_FLASH_MS,
    easing: 'ease-out',
  });
}

function pageElement(pageId: PageId): HTMLElement | null {
  // The stage (`STAGE_ID` in shell/frame/ids.ts).
  const stage = document.getElementById('stage') ?? document;
  return stage.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(pageId)}"]`);
}

/**
 * Reveals the step `meta` describes in `workspace` (the workspace now shown): scrolls its page
 * into view if needed, then flashes it. Resolves once the flash started, or without one.
 */
export async function revealStep(
  meta: HistoryEntryMeta | undefined,
  workspace: Workspace,
): Promise<void> {
  const target = revealTarget(meta, workspace);
  if (target === undefined) return;
  const ui = useUiStore.getState();
  if (ui.destination === 'home') return;
  if (isPageView(ui)) {
    const view = useViewStore.getState();
    if (distanceFromView(target.index, view.visibleRange) > 0) {
      view.scrollToPage(target.pageId);
    }
  }
  for (let frame = 0; frame < MAX_WAIT_FRAMES; frame++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const element = pageElement(target.pageId);
    if (element) {
      // Two frames after it exists, so the scroll has landed and the ring is seen.
      if (frame > 0 || !isPageView(ui)) {
        flashRing(element);
        return;
      }
    }
  }
}
