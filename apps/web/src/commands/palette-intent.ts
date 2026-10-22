/**
 * The palette's door to the query parser (Epic 4, R12 E10): what the parser needs from the open
 * document (`gatherQueryContext`), what each intent says it will do before it runs
 * (`describeIntent`), and how it runs (`runIntent`). Nothing here is a second home for a
 * command (DSN-46): a page action selects its resolved pages and then executes the same
 * command the menu and the keys use (`pages.rotateRight`, `pages.delete`…), so its Undo toast,
 * guards and announcements are the command's own.
 */
import { getActiveDocument, walkOutline } from '@pdf-editor/document-model';

import { openRecent } from '../home/home-actions';
import { m } from '../i18n';
import { useRecentsStore } from '../files/recents';
import { useSelectionStore } from '../state/selection-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { goToPageIndex } from '../viewer/navigation';
import { commandRegistry } from './registry';
import type { InvalidReason, PagesAction, QueryContext, QueryIntent } from './query';

/** The facts the parser reads, taken from the stores now. */
export function gatherQueryContext(): QueryContext {
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
  return {
    pageCount: doc?.pages.length ?? 0,
    currentPage: useViewStore.getState().currentPage + 1,
    headings,
    recents: useRecentsStore.getState().entries.map((e) => ({ id: e.id, name: e.name })),
  };
}

/** One row the palette shows for an intent. */
export interface IntentView {
  readonly key: string;
  /** What will happen, in words ("Rotate pages 3–7 right"). */
  readonly label: string;
  /** The quiet text at the row's end ("5 pages", "Page 12"), or why it cannot run. */
  readonly detail: string | undefined;
  readonly runnable: boolean;
}

/** "3-7" as it is read: an en dash. */
const dashed = (pages: string): string => pages.replaceAll('-', '–');

const ROTATE_LABEL = {
  '-1': m.palette_intent_rotate_left,
  '1': m.palette_intent_rotate_right,
  '2': m.palette_intent_rotate_half,
} as const;

const ACTION_LABEL: Record<
  Exclude<PagesAction, 'rotate'>,
  | typeof m.palette_intent_delete
  | typeof m.palette_intent_duplicate
  | typeof m.palette_intent_extract
> = {
  delete: m.palette_intent_delete,
  duplicate: m.palette_intent_duplicate,
  extract: m.palette_intent_extract,
};

function reasonText(reason: InvalidReason, pageCount: number): string {
  switch (reason) {
    case 'no-document':
      return m.palette_intent_no_document();
    case 'out-of-range':
      return m.palette_intent_out_of_range({ count: pageCount });
    case 'reversed-range':
      return m.palette_intent_reversed();
    case 'no-pages':
      return m.palette_intent_no_pages();
    case 'all-pages':
      return m.palette_intent_all_pages();
    case 'ambiguous-count':
      return m.palette_intent_ambiguous();
  }
}

/**
 * The rows an intent shows, best first: one for a jump or an action, one per matching heading or
 * recent file, and a quiet row that cannot run for an invalid one. `query` is what was typed.
 */
export function describeIntent(intent: QueryIntent, query: string): IntentView[] {
  switch (intent.kind) {
    case 'page':
      return [
        {
          key: 'intent-page',
          label: m.palette_intent_go_page({ page: intent.page }),
          detail: undefined,
          runnable: true,
        },
      ];
    case 'pages': {
      const input = { count: intent.pages.length, pages: dashed(intent.pagesLabel) };
      const label =
        intent.action === 'rotate'
          ? ROTATE_LABEL[String(intent.turns ?? 1) as keyof typeof ROTATE_LABEL](input)
          : ACTION_LABEL[intent.action](input);
      return [
        {
          key: 'intent-pages',
          label,
          detail: m.palette_intent_count({ count: intent.pages.length }),
          runnable: true,
        },
      ];
    }
    case 'heading':
      return intent.matches.map((heading, i) => ({
        key: `intent-heading-${i}`,
        label: m.palette_intent_go_heading({ title: heading.title }),
        detail: m.palette_intent_page_n({ page: heading.page }),
        runnable: true,
      }));
    case 'recent':
      return intent.matches.map((entry) => ({
        key: `intent-recent-${entry.id}`,
        label: m.palette_intent_open_recent({ name: entry.name }),
        detail: undefined,
        runnable: true,
      }));
    case 'invalid':
      return [
        {
          key: 'intent-invalid',
          label:
            intent.for === 'page' && intent.page !== undefined
              ? m.palette_intent_go_page({ page: intent.page })
              : query.trim(),
          detail: reasonText(intent.reason, intent.pageCount),
          runnable: false,
        },
      ];
  }
}

/** Runs row `index` of `describeIntent(intent)`. */
export async function runIntent(intent: QueryIntent, index: number): Promise<void> {
  switch (intent.kind) {
    case 'page':
      goToPageIndex(intent.page - 1);
      return;
    case 'heading': {
      const heading = intent.matches[index];
      if (heading) goToPageIndex(heading.page - 1);
      return;
    }
    case 'recent': {
      const match = intent.matches[index];
      const entry = useRecentsStore.getState().entries.find((e) => e.id === match?.id);
      if (entry) await openRecent(entry);
      return;
    }
    case 'pages':
      await runPagesIntent(intent);
      return;
    case 'invalid':
      return;
  }
}

/**
 * Selects the resolved pages and runs the page command on them; a rotation gives the selection
 * back, a delete clears it itself, a duplicate or extract leaves the pages selected. The navigator is named as the document whose selection is visible,
 * so Delete, which acts only on a selection the person can see, takes it (S10).
 */
async function runPagesIntent(intent: Extract<QueryIntent, { kind: 'pages' }>): Promise<void> {
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
  if (!doc) return;
  const ids = intent.pages.flatMap((n) => {
    const page = doc.pages[n - 1];
    return page ? [page.id] : [];
  });
  if (ids.length === 0) return;
  const selection = useSelectionStore.getState();
  const before = {
    selected: selection.selected,
    anchor: selection.anchor,
    focused: selection.focused,
  };
  const navigator = selection.navigatorDocument;
  selection.apply({ selected: new Set(ids), anchor: ids[0] ?? null, focused: ids[0] ?? null });
  selection.setNavigatorDocument(doc.id);
  try {
    // A half turn is two right turns; the command has no other way to turn.
    const times = intent.turns === 2 ? 2 : 1;
    for (let i = 0; i < times; i += 1) await commandRegistry.execute(intent.commandId);
  } finally {
    const now = useSelectionStore.getState();
    now.setNavigatorDocument(navigator);
    // Rotating leaves the selection as it was; the others leave their pages selected.
    if (intent.action === 'rotate') now.apply(before);
  }
}
