/**
 * Derived data for the Pages grid (`components/06-navigation.md` PG1–PG3), memoized on model
 * identity so selectors return stable references: which documents are shown as sections (the
 * active one in This document, every open one in All open), where each page sits, and which
 * pages are outline targets.
 */
import {
  type DocumentId,
  type PageId,
  type VirtualDocument,
  walkOutline,
  type Workspace,
} from '@pdf-editor/document-model';

import { type GridScope, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';

export interface ShownSection {
  readonly doc: VirtualDocument;
  readonly collapsed: boolean;
  /**
   * Whether the section draws its header (PG3): in All open. In This document the grid
   * header's title stands for it (PG2), so the section has none.
   */
  readonly header: boolean;
}

/** Whether the grid shows every open document: All open, with a second document to show. */
export function showsAllDocuments(ws: Workspace, scope: GridScope): boolean {
  return scope === 'all' && ws.documentOrder.length > 1;
}

/**
 * Sections in tab order (PG3): the active document alone in This document, every open
 * document in All open. Collapsing applies in All open only.
 */
export function shownSections(
  ws: Workspace,
  scope: GridScope,
  collapsed: readonly DocumentId[],
): ShownSection[] {
  const all = showsAllDocuments(ws, scope);
  return ws.documentOrder.flatMap((id): ShownSection[] => {
    const doc = ws.documents[id];
    if (doc === undefined || (!all && id !== ws.activeDocument)) return [];
    return [{ doc, collapsed: all && collapsed.includes(id), header: all }];
  });
}

let last:
  | {
      ws: Workspace;
      scope: GridScope;
      collapsed: readonly DocumentId[];
      value: ShownSection[];
    }
  | undefined;

function cachedSections(
  ws: Workspace,
  scope: GridScope,
  collapsed: readonly DocumentId[],
): ShownSection[] {
  if (last?.ws === ws && last.scope === scope && last.collapsed === collapsed) return last.value;
  const value = shownSections(ws, scope, collapsed);
  // Keep the previous array when nothing shown changed (e.g. an edit in a document not shown).
  const previous = last?.value;
  const same =
    previous?.length === value.length &&
    previous.every(
      (s, i) =>
        s.doc === value[i]?.doc &&
        s.collapsed === value[i].collapsed &&
        s.header === value[i].header,
    );
  const result = same ? previous : value;
  last = { ws, scope, collapsed, value: result };
  return result;
}

export function useShownSections(): ShownSection[] {
  const ws = useWorkspaceStore((s) => s.workspace);
  const scope = useUiStore((s) => s.gridScope);
  const collapsed = useUiStore((s) => s.arrangeCollapsed);
  return cachedSections(ws, scope, collapsed);
}

/** Whether the grid shows `id` as a section now: the active document, others in All open. */
export function shownInGridNow(id: DocumentId): boolean {
  const ws = useWorkspaceStore.getState().workspace;
  if (ws.documents[id] === undefined) return false;
  return id === ws.activeDocument || showsAllDocuments(ws, useUiStore.getState().gridScope);
}

const indexCache = new WeakMap<VirtualDocument, ReadonlyMap<PageId, number>>();

/** Page id → index within the document. */
export function pageIndexes(doc: VirtualDocument): ReadonlyMap<PageId, number> {
  let map = indexCache.get(doc);
  if (map === undefined) {
    map = new Map(doc.pages.map((p, i) => [p.id, i] as const));
    indexCache.set(doc, map);
  }
  return map;
}

const outlineCache = new WeakMap<object, ReadonlySet<PageId>>();

/** Pages that outline nodes of the document point at (bookmark glyph, spec §6). */
export function outlineTargets(doc: VirtualDocument): ReadonlySet<PageId> {
  let set = outlineCache.get(doc.outline);
  if (set === undefined) {
    const targets = new Set<PageId>();
    walkOutline(doc.outline, (node) => {
      if (node.destination?.kind === 'page') targets.add(node.destination.page);
    });
    set = targets;
    outlineCache.set(doc.outline, set);
  }
  return set;
}
