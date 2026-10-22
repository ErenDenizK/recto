/**
 * The furniture kinds' names and their removal, apart from the sheets (`FurnitureDialogs.tsx`) so
 * the commands can use them without the sheets' code in the initial bundle (PF-21).
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { useWorkspaceStore } from '../state/workspace-store';
import { type FurnitureKind, removeFurniture } from './furniture-model';

export function furnitureName(kind: FurnitureKind): string {
  switch (kind) {
    case 'page-numbers':
      return m.furniture_title_page_numbers();
    case 'header-footer':
      return m.furniture_title_header_footer();
    case 'bates':
      return m.furniture_title_bates();
    case 'watermark':
      return m.furniture_title_watermark();
  }
}

export function removeLabel(kind: FurnitureKind): string {
  switch (kind) {
    case 'page-numbers':
      return m.cmd_remove_page_numbers();
    case 'header-footer':
      return m.cmd_remove_header_footer();
    case 'bates':
      return m.cmd_remove_bates();
    case 'watermark':
      return m.cmd_remove_watermark();
  }
}

/** Removes one kind of furniture from a document as one history entry. */
export function removeFurnitureFrom(documentId: DocumentId, kind: FurnitureKind): boolean {
  const done = useWorkspaceStore
    .getState()
    .applyOperation((ws) => removeFurniture(ws, documentId, kind), removeLabel(kind));
  if (done) announce(m.announce_furniture_removed({ name: furnitureName(kind) }));
  return done;
}
