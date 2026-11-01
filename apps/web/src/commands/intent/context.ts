/**
 * What the intent bar reads from the open document (decision PRD-39; spec niyet §2.12, §2.13):
 * the facts the parser needs (`gatherIntentContext`) and the workspace version that tells the
 * runner the document changed since a preview was drawn (`workspaceVersion`). The only module
 * of `commands/intent/` besides `preview.ts` and `run.ts` that reads stores; the parser never
 * does.
 */
import { getActiveDocument, type PageId, walkOutline } from '@pdf-editor/document-model';

import { useRecentsStore } from '../../files/recents';
import { getEdition } from '../../shell/frame/edition';
import { officeEnabled } from '../../office/flag';
import { loadSavedSignatures, useSavedSignatures } from '../../signatures/saved-signatures';
import { targetPages } from '../../stage/arrange-data';
import { useSelectionStore, visibleSelection } from '../../state/selection-store';
import { stageView, useUiStore } from '../../state/ui-store';
import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import type { IntentContext } from './types';

let version = 0;

// Every committed workspace (an edit, an Undo from a toast, a tab switch) is a new version, so a
// preview drawn before it can never run after it (§2.13).
useWorkspaceStore.subscribe((state, previous) => {
  if (state.workspace !== previous.workspace) version += 1;
});

/** The workspace version now: it changes whenever the workspace does. */
export function workspaceVersion(): number {
  return version;
}

/** 1-based positions, ascending, of the pages the page commands would act on now (S10). */
function selectedPositions(): number[] {
  const ws = useWorkspaceStore.getState().workspace;
  const doc = getActiveDocument(ws);
  if (!doc) return [];
  const ui = useUiStore.getState();
  const stage = stageView(ui);
  let ids: readonly PageId[] = [];
  if (stage === 'grid') ids = targetPages();
  else if (stage === 'page') {
    const { selected, navigatorDocument } = useSelectionStore.getState();
    const shown = navigatorDocument === null ? undefined : ws.documents[navigatorDocument];
    ids = visibleSelection(selected, shown);
  }
  if (ids.length === 0) return [];
  const index = new Map(doc.pages.map((page, i) => [page.id, i + 1]));
  return ids
    .flatMap((id) => {
      const position = index.get(id);
      return position === undefined ? [] : [position];
    })
    .sort((a, b) => a - b);
}

/** The facts the parser reads, taken from the stores now. */
export function gatherIntentContext(): IntentContext {
  const ws = useWorkspaceStore.getState().workspace;
  const doc = getActiveDocument(ws);
  const headings: { title: string; page: number }[] = [];
  if (doc) {
    const index = new Map(doc.pages.map((page, i) => [page.id, i + 1]));
    walkOutline(doc.outline, (node) => {
      const title = node.title.trim();
      const target =
        node.destination?.kind === 'page' ? index.get(node.destination.page) : undefined;
      if (title !== '' && target !== undefined) headings.push({ title, page: target });
    });
  }
  // Shared by every call: the first read of the saved signatures, so the row can say whether one
  // is ready to place.
  void loadSavedSignatures();
  const edition = getEdition();
  return {
    pageCount: doc?.pages.length ?? 0,
    currentPage: useViewStore.getState().currentPage + 1,
    selectedPages: selectedPositions(),
    headings,
    recents: useRecentsStore.getState().entries.map((e) => ({ id: e.id, name: e.name })),
    savedSignatures: useSavedSignatures.getState().signatures.length,
    officeEnabled: officeEnabled() && edition !== 'compact',
    edition,
  };
}
