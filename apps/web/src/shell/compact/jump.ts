/**
 * The sheets' jump (ADR-0033 §2.3): a jump closes its sheet and lands the page under the top
 * bar. Shared by the Pages sheet and the sheets that load on demand (`CompactMoreSheets`).
 */
import type { Rect, VirtualDocument } from '@pdf-editor/document-model';

import { m } from '../../i18n';
import { useViewStore } from '../../state/view-store';
import { announce } from '../announcer';
import { closeSheet } from './compact-store';

/** Jumps to a page (under the top bar), closes the sheet and says where it went. */
export function jumpTo(
  doc: VirtualDocument,
  index: number,
  reveal?: { readonly reveal?: Rect },
): void {
  const page = doc.pages[index];
  if (!page) return;
  closeSheet();
  useViewStore.getState().scrollToPage(page.id, reveal);
  announce(m.cell_label({ position: index + 1, count: doc.pages.length }));
}
