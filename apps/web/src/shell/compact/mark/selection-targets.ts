/**
 * The page targets a selection's Highlight needs while reading (`design/phone-2026-10/README.md`
 * §4: "Highlight and Copy work even outside editing"). `selection-markup.ts` maps the selection
 * onto pages through the mounted annotation layers (`layer-registry.ts`), which the phone mounts
 * only while editing (`registerCompactOverlay`). Reading, the pages in the DOM stand in for them
 * for the length of one Highlight: each page's overlay box, its frame (as `CompactPage` gives its
 * layers, `pageFrame`) and its target, removed again when the act is done, so no annotation
 * layer (and none of its weight) mounts for a highlight.
 */
import { type PageId, pageTotalRotation } from '@pdf-editor/document-model';

import { mountedLayers } from '../../../annotations/layer-registry';
import { displaySize } from '../../../pages/page-geometry';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { pageFrame } from '../../../viewer/page-frame';

/** The compact reader's pages in the DOM that have no mounted layer: their stand-ins, added. */
function addReadingTargets(root: ParentNode): PageId[] {
  const { workspace } = useWorkspaceStore.getState();
  const docId = workspace.activeDocument;
  const doc = docId === undefined ? undefined : workspace.documents[docId];
  if (!doc) return [];
  const added: PageId[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('[data-page-id]')) {
    const pageId = el.dataset.pageId as PageId | undefined;
    if (pageId === undefined || mountedLayers.has(pageId)) continue;
    const index = doc.pages.findIndex((p) => p.id === pageId);
    const page = doc.pages[index];
    if (page?.ref.kind !== 'source') continue;
    const element = el.querySelector<HTMLElement>('[data-page-overlays]') ?? el;
    const sizePt = displaySize(workspace, page);
    const width = element.getBoundingClientRect().width;
    if (width <= 0) continue;
    mountedLayers.set(pageId, {
      element,
      frame: pageFrame({
        sourceId: page.ref.source,
        sourceIndex: page.ref.index,
        sizePt,
        rotation: pageTotalRotation(workspace, page),
        cssScale: width / sizePt.width,
        page,
      }),
      target: { source: page.ref.source, pageIndex: page.ref.index, pageId, position: index + 1 },
    });
    added.push(pageId);
  }
  return added;
}

/**
 * Runs `act` with every page in `root` registered as a layer target: the mounted annotation
 * layers while editing, stand-ins while reading. The stand-ins go when `act` settles.
 */
export async function withPageTargets<T>(
  act: () => Promise<T>,
  root: ParentNode = document,
): Promise<T> {
  const added = addReadingTargets(root);
  const mine = new Map(added.map((id) => [id, mountedLayers.get(id)]));
  try {
    return await act();
  } finally {
    // A layer that mounted meanwhile (editing began) keeps its own entry.
    for (const [id, entry] of mine) {
      if (mountedLayers.get(id) === entry) mountedLayers.delete(id);
    }
  }
}
