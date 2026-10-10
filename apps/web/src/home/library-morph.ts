/**
 * The entry points of Library ⇄ document (`library-transition.ts`, motion-2026-10
 * library-capsule.md §1), whose code and styles are not part of the editor's first load
 * (PLAN.md §2.3 V1-P2). The Library preloads it as it mounts (`LibraryGrid`), so a card opens
 * at once; should it still be on its way, the view change waits for it (one task), and without
 * it (offline before the precache filled) the view simply changes.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { lazyModule } from '../motion/lazy';

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
