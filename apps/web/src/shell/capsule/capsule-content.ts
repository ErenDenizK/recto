/**
 * What the capsule shows (spec X1; `components/03-markup.md` MK-1 §2, §6; `01-frame.md` F10 §4):
 * one selector from the document's state to the capsule's shape, so the dock, the Markup
 * palette and the Locked state are three contents of one element rather than three elements.
 *
 * | Shape     | When                                      | Content (owner)                           |
 * |-----------|-------------------------------------------|-------------------------------------------|
 * | `dock`    | Viewing, not locked                       | Pages · Markup · Fill & sign · More (F10) |
 * | `palette` | Markup open, not locked                   | The Markup palette (`03-markup` MK-2)     |
 * | `locked`  | Locked, whatever Markup says              | Pages · Locked · More (F10 §2)            |
 * | `pages`   | The Pages grid; or viewing with pages     | The Pages bar (`04-context` §10, X21;     |
 * |           | selected explicitly in the sidebar        | `stage/grid/PagesBar.tsx`)                |
 *
 * Lock wins: a locked document has no creation state, so Locked replaces Markup and Fill & sign
 * in the dock and, when the lock engages while the palette is open, the palette morphs into it
 * and Markup closes (`watchLockClosesMarkup`, MK-1 §6, `markup_locked_closed`). The Pages bar
 * wins over both in the grid (it has a locked form of its own), and in viewing over the dock;
 * Markup with a sidebar selection keeps the palette (the bar's tier there is later work). The
 * preset strip (MK-15) and the Compare bar (CP) join this union with their packages (D2-3,
 * D2-6); each is a new shape here and a new content in `Dock.tsx`, nothing else.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { m } from '../../i18n';
import { type LockReason, useLockStore } from '../../state/lock-store';
import { useSelectionStore, visibleSelection } from '../../state/selection-store';
import { isMarkupOpen, stageView, useUiStore } from '../../state/ui-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { announce } from '../announcer';

/** The contents of the capsule (MK-1 §2's keyed children that exist so far). */
export type CapsuleShape = 'dock' | 'palette' | 'locked' | 'pages';

/** What the shape depends on, read for one document. */
export interface CapsuleFacts {
  /** Markup is open (`docUi[id].markup`). */
  readonly markup: boolean;
  /** Why the document is locked, or undefined while it is not (`lock-store`). */
  readonly lock: LockReason | undefined;
  /**
   * The Pages bar is asked for (X21): the Pages grid shows, or the page view shows with pages
   * selected explicitly in the sidebar. Absent is false.
   */
  readonly pages?: boolean;
  /** The Pages grid shows (the bar wins over Markup and Lock there). Absent is false. */
  readonly grid?: boolean;
}

/**
 * The shape for `facts`: the Pages bar in the grid; then Locked; then the palette while Markup
 * is open; then the Pages bar for a sidebar selection in viewing; else the dock.
 */
export function capsuleShape(facts: CapsuleFacts): CapsuleShape {
  if (facts.grid === true) return 'pages';
  if (facts.lock !== undefined) return facts.pages === true ? 'pages' : 'locked';
  if (facts.markup) return 'palette';
  return facts.pages === true ? 'pages' : 'dock';
}

/** `capsuleShape` for components: follows Markup and the lock of `id`. */
export function useCapsuleShape(id: DocumentId | null | undefined): CapsuleShape {
  const markup = useUiStore((s) => isMarkupOpen(s, id));
  const lock = useLockStore((s) => (id == null ? undefined : s.locks[id]));
  const grid = useUiStore((s) => stageView(s, id) === 'grid');
  const selected = useSelectionStore((s) => s.selected);
  const shownId = useSelectionStore((s) => s.navigatorDocument);
  const shown = useWorkspaceStore((s) =>
    shownId === null ? undefined : s.workspace.documents[shownId],
  );
  const pages = grid || visibleSelection(selected, shown).length > 0;
  return capsuleShape({ markup, lock, pages, grid });
}

/**
 * Lock engaging while Markup is open closes Markup (MK-1 §6; flows §2.6): the palette morphs
 * into Locked and "Locked. Markup closed." is said once. Every document, not only the active
 * one, so a document locked from its tab menu or the Library does not come back with Markup
 * open once unlocked. Returns the unsubscribe.
 */
export function watchLockClosesMarkup(): () => void {
  return useLockStore.subscribe((state, previous) => {
    if (state.locks === previous.locks) return;
    const ui = useUiStore.getState();
    for (const id of Object.keys(state.locks) as DocumentId[]) {
      if (previous.locks[id] !== undefined || !isMarkupOpen(ui, id)) continue;
      ui.closeMarkup(id);
      announce(m.markup_locked_closed());
    }
  });
}
