/**
 * The entry points of Library ⇄ document (`library-transition.ts`, motion-2026-10
 * library-capsule.md §1), whose code and styles are not part of the editor's first load
 * (PLAN.md §2.3 V1-P2). The Library preloads it as it mounts (`LibraryGrid`), so a card opens
 * at once; should it still be on its way, the view change waits for it (one task), and without
 * it (offline before the precache filled) the view simply changes.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { lazyModule } from '../motion/lazy';
import type { OpenSeed } from './library-transition';

export const libraryTransition = lazyModule(() => import('./library-transition'));

/** Opens a card: its first page grows into the reader's page. */
export function openCardMorph(id: DocumentId, open: (id: DocumentId) => void): void {
  libraryTransition.run(
    (module) => module.openCardMorph(id, open),
    () => open(id),
  );
}

/** Back to the Library: the page shrinks into the active document's card. */
export function backToLibraryMorph(show: () => void): void {
  libraryTransition.run((module) => module.backToLibraryMorph(show), show);
}

/**
 * The phone's open (DSN-64): a paper sheet grows out of the tapped Library `row` into the
 * reader's page and the light answers.
 */
export function openRowMorph(row: HTMLElement | null, open: () => void): void {
  libraryTransition.run((module) => module.openRowMorph(row, open), open);
}

// ---------------------------------------------------------------------------
// The desk's presses (DSN-87, `masa.md` §2.7)
// ---------------------------------------------------------------------------

/** The cover a desk press lifts: Continue, a Recent tile, the sample hero (the tile contract). */
const TILE = '[data-desk-tile]';
const CONTINUE_PRESS = '[data-testid="continue-resume"]';
const SAMPLE_PRESS = '[data-testid="home-try-sample"], [data-testid="desk-sample-tile"]';
const SHEET = '[data-library-sheet]';

/** A press older than this is not the one an open belongs to (ms). */
const PRESS_FRESH_MS = 1000;

let pressed: { readonly sheet: HTMLElement; readonly at: number } | null = null;

/** The cover under a press of the desk, if the press opens something. */
function sheetOfPress(target: Element): { sheet: HTMLElement; sample: boolean } | null {
  // The ⋯ button of a tile is a menu, not an open.
  if (target.closest('[data-recent-more]')) return null;
  const sample = target.closest<HTMLElement>(SAMPLE_PRESS);
  if (sample) {
    if (sample.getAttribute('aria-disabled') === 'true') return null;
    const root = sample.closest<HTMLElement>(
      '[data-testid="desk-sample"], [data-testid="desk-sample-tile"]',
    );
    const sheet = root?.querySelector<HTMLElement>(SHEET);
    return sheet ? { sheet, sample: true } : null;
  }
  const resume = target.closest(CONTINUE_PRESS);
  const tile = target.closest<HTMLElement>(TILE);
  const owner = resume ? resume.closest<HTMLElement>('[data-testid="continue-card"]') : tile;
  const sheet = owner?.querySelector<HTMLElement>(SHEET);
  return sheet ? { sheet, sample: false } : null;
}

if (typeof document !== 'undefined') {
  // Captured, so the cover is read before any handler changes the view. A press that opens a
  // document asks for it with `openFromDesk`; the sample's own button has no hook, so its
  // press lifts here and settles when nothing is opening (`liftOpen`, no action).
  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return;
      const hit = sheetOfPress(event.target);
      if (!hit) {
        pressed = null;
        return;
      }
      if (hit.sample) {
        pressed = null;
        libraryTransition.run((module) => module.liftSample(hit.sheet));
        return;
      }
      pressed = { sheet: hit.sheet, at: performance.now() };
    },
    true,
  );
  // The lift starts in the press's own frame when the module is already here.
  const preload = () => void libraryTransition.load().catch(() => undefined);
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(preload);
  else window.setTimeout(preload, 200);
}

/** The cover the last desk press lifts, once (a press is good for one open). */
function takePressed(): HTMLElement | null {
  const press = pressed;
  pressed = null;
  if (!press?.sheet.isConnected) return null;
  return performance.now() - press.at <= PRESS_FRESH_MS ? press.sheet : null;
}

/**
 * Runs an open from the desk with its motion (`masa.md` §2.7). `run` is the open action, called
 * first and synchronously (a permission prompt or the file dialog needs the press's activation);
 * the pressed tile's cover is then lifted and held until the document is ready, then grows into
 * the reader's page, or settles back if the open ends with Home still showing (`liftOpen`).
 * `seed` reads the cover the arriving page first shows. Without a desk press (the command
 * palette, a key, another view) it is `run()` alone.
 */
export function openFromDesk<T>(
  name: string,
  run: () => Promise<T>,
  seed?: () => Promise<OpenSeed | null>,
): Promise<T> {
  const sheet = takePressed();
  const work = run();
  if (sheet) {
    const covered = seed?.();
    libraryTransition.run((module) => module.liftOpen(sheet, work, name, covered));
  }
  return work;
}
