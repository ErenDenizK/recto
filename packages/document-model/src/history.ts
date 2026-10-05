/**
 * Undo/redo as a persistent stack of workspace snapshots. Snapshots share structure, so
 * keeping many is cheap. Content edits join the same stack through Workspace.engineEdits.
 */
import { DocumentModelError } from './errors';
import type {
  DocumentId,
  History,
  HistoryEntry,
  HistoryEntryMeta,
  SourceId,
  Workspace,
} from './types';

export const DEFAULT_COALESCE_WINDOW_MS = 800;
export const DEFAULT_HISTORY_LIMIT = 200;

export function createHistory(initial: Workspace, label = 'Open', at = 0): History {
  return { past: [], present: { label, at, workspace: initial }, future: [] };
}

export interface PushOptions {
  /** Pushes with the same key within the window replace `present` (drags, sliders). */
  readonly coalesceKey?: string;
  /** Timestamp in ms; defaults to Date.now(). Inject for deterministic tests. */
  readonly now?: number;
  readonly coalesceWindowMs?: number;
  /** Maximum number of undo steps kept. */
  readonly limit?: number;
  /**
   * Where the step happened (X10): the scrubber's rows, the ↶ ↷ tooltips and the undo reveal
   * read it. `historyMetaOf(before, after)` derives it from the change.
   */
  readonly meta?: HistoryEntryMeta;
}

/**
 * Records a new state. Pushing the workspace that is already present is a no-op, so
 * operations that return their input do not create empty undo steps. Any redo branch is
 * discarded.
 */
export function pushHistory(
  history: History,
  workspace: Workspace,
  label: string,
  options: PushOptions = {},
): History {
  if (workspace === history.present.workspace) return history;
  const now = options.now ?? Date.now();
  const windowMs = options.coalesceWindowMs ?? DEFAULT_COALESCE_WINDOW_MS;
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new DocumentModelError(
      'invalid-argument',
      'History limit must be a non-negative integer',
    );
  }
  const entry: HistoryEntry = {
    label,
    at: now,
    workspace,
    ...(options.coalesceKey === undefined ? {} : { coalesceKey: options.coalesceKey }),
    ...(options.meta === undefined ? {} : { meta: options.meta }),
  };

  const { present } = history;
  const coalesce =
    options.coalesceKey !== undefined &&
    present.coalesceKey === options.coalesceKey &&
    history.future.length === 0 &&
    now - present.at >= 0 &&
    now - present.at <= windowMs;
  if (coalesce) return { past: history.past, present: entry, future: [] };

  const past = [...history.past, present];
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    present: entry,
    future: [],
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

export function undo(history: History): History {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}

/** Jumps to entry `index` of `historyEntries(history)` (0 = oldest). */
export function jumpTo(history: History, index: number): History {
  const all = [...history.past, history.present, ...history.future];
  const target = all[index];
  if (!Number.isInteger(index) || target === undefined) {
    throw new DocumentModelError(
      'invalid-index',
      `History index ${index} outside 0…${all.length - 1}`,
    );
  }
  if (index === history.past.length) return history;
  return { past: all.slice(0, index), present: target, future: all.slice(index + 1) };
}

export interface HistoryListItem {
  readonly index: number;
  readonly label: string;
  readonly at: number;
  readonly state: 'past' | 'present' | 'future';
  readonly meta?: HistoryEntryMeta;
}

/** Flat list for a history panel, oldest first. */
export function historyEntries(history: History): HistoryListItem[] {
  const items: HistoryListItem[] = [];
  const add = (entry: HistoryEntry, state: HistoryListItem['state']): void => {
    const item = { index: items.length, label: entry.label, at: entry.at, state };
    items.push(entry.meta === undefined ? item : { ...item, meta: entry.meta });
  };
  for (const entry of history.past) add(entry, 'past');
  add(history.present, 'present');
  for (const entry of history.future) add(entry, 'future');
  return items;
}

export function currentWorkspace(history: History): Workspace {
  return history.present.workspace;
}

// ---------------------------------------------------------------------------
// Step metadata
// ---------------------------------------------------------------------------

/**
 * The document and page showing `source`'s page `pageIndex`: the active document first (a
 * content edit is made where the user is), then the tabs in order.
 */
function locateSourcePage(
  ws: Workspace,
  source: SourceId,
  pageIndex: number,
): Pick<HistoryEntryMeta, 'documentId' | 'page'> {
  const order =
    ws.activeDocument === undefined
      ? ws.documentOrder
      : [ws.activeDocument, ...ws.documentOrder.filter((id) => id !== ws.activeDocument)];
  for (const id of order) {
    const pages = ws.documents[id]?.pages ?? [];
    const index = pages.findIndex(
      (p) => p.ref.kind === 'source' && p.ref.source === source && p.ref.index === pageIndex,
    );
    if (index >= 0) return { documentId: id, page: index + 1 };
  }
  return {};
}

/**
 * Describes the step from `before` to `after` (spec redesign §7, X10): which document it
 * changed, its first changed page and its kind. Content edits are located by the newest
 * engine edit the step added (or merged); model changes by comparing documents by identity,
 * which structural sharing makes exact and cheap. A step that changes several documents is
 * `workspace` and names none; one that changes nothing describable returns `{}`.
 */
export function historyMetaOf(before: Workspace, after: Workspace): HistoryEntryMeta {
  const edit = after.engineEdits[after.engineEdits.length - 1];
  if (edit !== undefined && edit !== before.engineEdits[before.engineEdits.length - 1]) {
    return { ...locateSourcePage(after, edit.source, edit.pageIndex), kind: edit.kind };
  }
  const added = after.documentOrder.filter((id) => before.documents[id] === undefined);
  const removed = before.documentOrder.filter((id) => after.documents[id] === undefined);
  const changed = after.documentOrder.filter((id) => {
    const previous = before.documents[id];
    return previous !== undefined && previous !== after.documents[id];
  });
  const [first] = added;
  if (added.length === 1 && removed.length === 0 && changed.length === 0 && first) {
    const newSource = Object.keys(after.sources).some(
      (id) => before.sources[id as SourceId] === undefined,
    );
    return { documentId: first, kind: newSource ? 'open' : 'workspace' };
  }
  const [gone] = removed;
  if (removed.length === 1 && added.length === 0 && changed.length === 0 && gone) {
    return { documentId: gone, kind: 'close' };
  }
  const [only] = changed;
  if (added.length > 0 || removed.length > 0 || changed.length !== 1 || only === undefined) {
    const reordered =
      added.length + removed.length + changed.length > 0 ||
      before.documentOrder.join() !== after.documentOrder.join();
    return reordered ? { kind: 'workspace' } : {};
  }
  return { documentId: only, ...pageChange(before, after, only) };
}

/** The first page of document `id` that differs, and whether its list or a page changed. */
function pageChange(
  before: Workspace,
  after: Workspace,
  id: DocumentId,
): Pick<HistoryEntryMeta, 'page' | 'kind'> {
  const was = before.documents[id]?.pages ?? [];
  const now = after.documents[id]?.pages ?? [];
  const length = Math.max(was.length, now.length);
  let reshaped = -1;
  for (let i = 0; i < length; i++) {
    if (was[i]?.id !== now[i]?.id) {
      reshaped = i;
      break;
    }
  }
  if (reshaped >= 0) {
    // A deletion at the end points at the page that is now last.
    return now.length === 0
      ? { kind: 'pages' }
      : { kind: 'pages', page: Math.min(reshaped, now.length - 1) + 1 };
  }
  const touched = now.findIndex((page, i) => page !== was[i]);
  return touched >= 0 ? { kind: 'page', page: touched + 1 } : { kind: 'document' };
}
