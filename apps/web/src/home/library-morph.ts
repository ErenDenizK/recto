/**
 * The entry points of Library ⇄ document (`library-transition.ts`, motion-2026-10
 * library-capsule.md §1), whose code and styles are not part of the editor's first load
 * (PLAN.md §2.3 V1-P2). The Library preloads it as it mounts (`LibraryGrid`), so a card opens
 * at once; should it still be on its way, the view change waits for it (one task), and without
 * it (offline before the precache filled) the view simply changes.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { lazyModule } from '../motion/lazy';
import { homeFlagEnabled, OPEN_LIGHT_FLAG } from './home-flags';

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
 * The phone's open behind `?open=light` (DSN-64): a paper sheet grows out of the tapped Library
 * `row` into the reader's page and the light answers; without the flag, `open` alone.
 */
export function openRowMorph(row: HTMLElement | null, open: () => void): void {
  if (!homeFlagEnabled(OPEN_LIGHT_FLAG)) {
    open();
    return;
  }
  libraryTransition.run((module) => module.openRowMorph(row, open), open);
}
