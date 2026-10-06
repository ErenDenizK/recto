/**
 * A document tab as a drop target for pages (`components/01-frame.md` F4 §3, §4, §6;
 * `06-navigation.md` §2.4, PG5; RA-7): pages dragged from the Pages grid with the mouse that
 * hover a tab for 500 ms arm it (a 2 px `--accent-line` ring inside the tab, the label "Move 2
 * pages here" in it, and "Move 2 pages to agreement.pdf" said); dropping then moves them to the
 * end of that document, one `transferPages`, one undo step, with the Undo toast of a move to
 * another document (06.24). A drop before the tab is armed does nothing, so a drag that only
 * passes over the strip never moves pages by accident.
 *
 * Guard: the drop needs `canChange(target, 'pages')` and `canChange(source, 'pages')`; refused,
 * the ring turns neutral, the reason is said and nothing moves (F4 §6). Touch has no tab drop
 * (§2.4: Move to ▾ instead).
 */
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { type DocumentId, findPageLocation, type PageId } from '@pdf-editor/document-model';

import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { changeRefusal, refusalReason } from '../state/guard';
import { useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast/toast';
import { transferPages } from './drop';
import { isPageDrag } from './page-drag';
import './tab-drop.css';

/** How long pages hover a tab before it takes the drop (F4 §4). */
export const TAB_DROP_DELAY_MS = 500;

/** The documents the pages come from. */
function sourcesOf(pageIds: readonly PageId[]): DocumentId[] {
  const ws = useWorkspaceStore.getState().workspace;
  const found = new Set<DocumentId>();
  for (const id of pageIds) {
    const location = findPageLocation(ws, id);
    if (location) found.add(location.document);
  }
  return [...found];
}

/** Why a drop of `pageIds` on `target` is refused, or undefined when it may run. */
export function tabDropRefusal(target: DocumentId, pageIds: readonly PageId[]): string | undefined {
  for (const id of [target, ...sourcesOf(pageIds)]) {
    const refusal = changeRefusal(id, 'pages');
    if (refusal) return refusalReason(refusal);
  }
  return undefined;
}

/** Moves `pageIds` to the end of `target`, with the toast of a move to another document. */
export function dropPagesOnTab(target: DocumentId, pageIds: readonly PageId[]): boolean {
  const ws = useWorkspaceStore.getState().workspace;
  const doc = ws.documents[target];
  if (!doc || pageIds.length === 0) return false;
  const refused = tabDropRefusal(target, pageIds);
  if (refused) {
    announce(refused);
    return false;
  }
  const result = transferPages({
    pageIds,
    target: { document: target, index: doc.pages.length },
    duplicate: false,
    select: false,
  });
  if (result === undefined) return false;
  toast.undo(m.grid_moved_to_toast({ count: pageIds.length, title: doc.title }), {
    documentId: target,
    spoken: false,
  });
  return true;
}

/** Makes `element` (a tab) take page drops for `documentId`; returns the removal. */
export function attachTabDropTarget(element: HTMLElement, documentId: DocumentId): () => void {
  let timer: number | undefined;
  let armed = false;
  const disarm = () => {
    window.clearTimeout(timer);
    timer = undefined;
    armed = false;
    element.removeAttribute('data-tab-drop');
    element.removeAttribute('data-tab-drop-label');
  };
  const remove = dropTargetForElements({
    element,
    getData: () => ({ type: 'tab-target', documentId }),
    canDrop: ({ source }) =>
      isPageDrag(source.data) && !sourcesOf(source.data.pageIds).every((d) => d === documentId),
    onDragEnter: ({ source }) => {
      if (!isPageDrag(source.data)) return;
      const pageIds = source.data.pageIds;
      const title = useWorkspaceStore.getState().workspace.documents[documentId]?.title ?? '';
      element.setAttribute('data-tab-drop', 'hover');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const refused = tabDropRefusal(documentId, pageIds);
        armed = refused === undefined;
        element.setAttribute('data-tab-drop', armed ? 'armed' : 'refused');
        element.setAttribute(
          'data-tab-drop-label',
          refused ?? m.tab_drop_here({ count: pageIds.length }),
        );
        announce(refused ?? m.tab_drop_label({ count: pageIds.length, title }));
      }, TAB_DROP_DELAY_MS);
    },
    onDragLeave: disarm,
    onDrop: ({ source }) => {
      const take = armed;
      disarm();
      if (take && isPageDrag(source.data)) dropPagesOnTab(documentId, source.data.pageIds);
    },
  });
  return () => {
    disarm();
    remove();
  };
}
