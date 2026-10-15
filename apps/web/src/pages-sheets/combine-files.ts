/**
 * Files that are not open, added to S15 Combine (`components/07-sheets.md` §17; MOB-10): the
 * sheet's Add files… and the routes that open it asking for files first (⌘K's Merge files…,
 * and Combine with open documents… while one document is open). The picked files open as
 * tabs, the open documents keep their place, and the picks follow them in the order list,
 * checked, in the order picked. Combine itself is unchanged: one new document, one undo step,
 * its sources kept (INV-12).
 *
 * Kept free of the sheet's component so the commands can reach it without loading the sheet.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { openDocuments } from '../commands/app-commands';
import { pickFiles } from '../files/open-files';
import { openOperationDialog } from '../stage/operation-dialogs-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { draftOf, resetDraft, setDraft } from '../ui/sheet/sheet-store';

export const COMBINE_SHEET = 'combine';

export interface CombineDraft {
  /** Every open document, in the order they will be joined. */
  readonly order: readonly DocumentId[];
  readonly checked: readonly DocumentId[];
  /** The name as typed; null follows the order ("Combined – A + B"). */
  readonly name: string | null;
}

/** The order the sheet starts from: `given` first (the Library's), else the active, then tabs. */
export function initialCombineOrder(
  tabs: readonly DocumentId[],
  active: DocumentId | undefined,
  given: readonly DocumentId[] | undefined,
): { order: DocumentId[]; checked: DocumentId[] } {
  const first = given?.filter((id) => tabs.includes(id)) ?? (active ? [active] : []);
  const order = [...first, ...tabs.filter((id) => !first.includes(id))];
  const checked = given ? first : [...tabs];
  return { order, checked: checked.length > 0 ? checked : [...tabs] };
}

/** `draft` with `added` after every document already listed, each checked (pure). */
export function appendToCombine(draft: CombineDraft, added: readonly DocumentId[]): CombineDraft {
  const fresh = added.filter((id, index) => added.indexOf(id) === index);
  const keep = (ids: readonly DocumentId[]) => ids.filter((id) => !fresh.includes(id));
  return {
    order: [...keep(draft.order), ...fresh],
    checked: [...keep(draft.checked), ...fresh],
    name: draft.name,
  };
}

/**
 * Add files…: asks for PDFs, opens them, and appends them to the sheet's order. The person's
 * document stays active behind the sheet. The picker needs the press's user activation, so
 * nothing is awaited before it. Resolves to the documents added.
 */
export async function addFilesToCombine(): Promise<DocumentId[]> {
  const ws = () => useWorkspaceStore.getState().workspace;
  const active = ws().activeDocument;
  const before = ws().documentOrder;
  const files = await pickFiles('pdf');
  if (files.length === 0) return [];
  const opened = await openDocuments(files);
  const added = opened.filter((id) => ws().documents[id] !== undefined);
  if (added.length === 0) return [];
  if (active !== undefined && ws().documents[active])
    useWorkspaceStore.getState().setActive(active);
  const draft =
    draftOf<CombineDraft>(null, COMBINE_SHEET) ??
    ({ ...initialCombineOrder(before, active, undefined), name: null } satisfies CombineDraft);
  setDraft(null, COMBINE_SHEET, appendToCombine(draft, added));
  return added;
}

/**
 * Opens Combine and asks for files at once (⌘K's Merge files…; Combine with one document
 * open): a fresh order, the open documents first, the picks after them.
 */
export function combineWithPicker(): Promise<DocumentId[]> {
  resetDraft(null, COMBINE_SHEET);
  openOperationDialog({ kind: 'combine' });
  return addFilesToCombine();
}
