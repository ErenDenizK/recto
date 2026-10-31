/**
 * The one model operation a reading's document steps run as (decision PRD-39; spec niyet §2.9,
 * §2.12). Only the runner needs it, so it lives apart from `plan.ts` (which the preview shares)
 * and loads with `run.ts` in the intent bar's second lazy chunk (§2.19).
 */
import {
  type DocumentId,
  deletePages,
  duplicatePages,
  getDocument,
  type IdGenerator,
  movePages,
  type PageId,
  reversePages,
  rotatePages,
  splitDocument,
  type VirtualDocument,
  type Workspace,
} from '@pdf-editor/document-model';

import {
  applyFurniture,
  defaultPageNumbers,
  defaultWatermark,
  pageNumberOverlay,
  watermarkOverlay,
} from '../../furniture/furniture-model';
import { idsAt, rangeChoiceOf, stepPages } from './plan';
import { splitParts } from './targets';
import type { Step } from './types';

/** Reverses the order of `pageIds` among themselves, every other page staying where it is. */
function reverseAmong(
  ws: Workspace,
  documentId: DocumentId,
  pageIds: readonly PageId[],
): Workspace {
  const current = getDocument(ws, documentId).pages.map((page) => page.id);
  const chosen = new Set(pageIds);
  const slots = current.flatMap((id, i) => (chosen.has(id) ? [i] : []));
  const desired = [...current];
  const reversed = slots.map((slot) => current[slot] as PageId).reverse();
  slots.forEach((slot, i) => {
    desired[slot] = reversed[i] as PageId;
  });
  let next = ws;
  desired.forEach((id, j) => {
    const order = getDocument(next, documentId).pages;
    if (order[j]?.id === id) return;
    next = movePages(next, { pageIds: [id], target: { document: documentId, index: j } });
  });
  return next;
}

/** The page ids a step names, and for `move` the page it lands next to. */
interface Resolved {
  readonly pages: ReadonlyMap<Step, readonly PageId[]>;
  readonly anchors: ReadonlyMap<Step, PageId>;
  /** A split's cut points: the page each new part starts at, as the preview drew them. */
  readonly cuts: ReadonlyMap<Step, readonly PageId[]>;
}

/** The workspace operation of one document step, the pages already resolved to ids. */
function applyStep(
  ws: Workspace,
  documentId: DocumentId,
  step: Step,
  resolved: Resolved,
  ids: IdGenerator,
  parts: (title: string, count: number) => string[],
): Workspace {
  const doc = getDocument(ws, documentId);
  // "All" means every page at this point of the chain, copies made by earlier steps included.
  const pageIds =
    stepPages(step)?.named === 'all'
      ? doc.pages.map((page) => page.id)
      : (resolved.pages.get(step) ?? []);
  switch (step.action) {
    case 'rotate':
      return rotatePages(ws, pageIds, step.turns * 90);
    case 'delete':
      return deletePages(ws, pageIds);
    case 'duplicate':
      return duplicatePages(ws, pageIds, ids);
    case 'move': {
      const order = doc.pages.map((page) => page.id);
      const { to } = step;
      let index: number;
      if (to === 'start') index = 0;
      else if (to === 'end') index = order.length;
      else {
        const anchor = resolved.anchors.get(step);
        const at = anchor === undefined ? -1 : order.indexOf(anchor);
        if (at < 0) throw new Error('The page to move next to is no longer there');
        index = 'before' in to ? at : at + 1;
      }
      return movePages(ws, { pageIds, target: { document: documentId, index } });
    }
    case 'reverse':
      return step.pages.named === 'all'
        ? reversePages(ws, documentId)
        : reverseAmong(ws, documentId, pageIds);
    case 'pageNumbers': {
      const range = rangeChoiceOf(step.pages, doc.pages.length);
      if (range === null) throw new Error('Page numbers need one run of pages');
      const settings = { ...defaultPageNumbers(doc.pages.length), range };
      return applyFurniture(ws, documentId, 'page-numbers', [pageNumberOverlay(settings)]);
    }
    case 'watermark': {
      const range = rangeChoiceOf(step.pages, doc.pages.length);
      if (range === null || step.text === null) throw new Error('Watermark needs text and a run');
      const overlay = watermarkOverlay({
        ...defaultWatermark(doc.pages.length),
        text: step.text,
        range,
      });
      if (overlay === undefined) throw new Error('The watermark is empty');
      return applyFurniture(ws, documentId, 'watermark', [overlay]);
    }
    case 'split': {
      if (step.how === 'choose') throw new Error('Split… opens its dialog; it is not a change');
      // A new part starts at each of these pages (`Step.split.how.at`): the model's at-pages mode.
      // They were found in the previewed document, so earlier steps do not move the cuts.
      const starts = resolved.cuts.get(step) ?? [];
      const present = new Set(doc.pages.map((page) => page.id));
      if (starts.some((id) => !present.has(id))) throw new Error('A page to split at is gone');
      return splitDocument(ws, documentId, { mode: 'at-pages', pageIds: starts }, ids, {
        titles: parts(doc.title, starts.length + 1),
      });
    }
    default:
      return ws;
  }
}

/**
 * The one operation a reading's document steps run as (`applyOperation`'s argument): every step
 * in typed order on the workspace the one before left, so the whole sentence is one history
 * entry. `doc` is the document as the preview drew it; `partTitles` names a split's parts. It
 * throws when `doc` no longer has the pages a step names (the store then commits nothing).
 */
export function composeSteps(
  doc: VirtualDocument,
  steps: readonly Step[],
  partTitles: (title: string, count: number) => string[],
): (ws: Workspace, ids: IdGenerator) => Workspace {
  const resolved = {
    pages: new Map<Step, readonly PageId[]>(),
    anchors: new Map<Step, PageId>(),
    cuts: new Map<Step, readonly PageId[]>(),
  };
  for (const step of steps) {
    if (step.action === 'split' && step.how !== 'choose') {
      const firsts = splitParts(doc.pages.length, step.how)
        .slice(1)
        .map(([first]) => first);
      resolved.cuts.set(step, idsAt(doc, firsts));
    }
    const pages = stepPages(step);
    if (pages !== undefined) resolved.pages.set(step, idsAt(doc, pages.pages));
    if (step.action === 'move' && typeof step.to === 'object') {
      const position = 'before' in step.to ? step.to.before : step.to.after;
      const [anchor] = idsAt(doc, [position]);
      if (anchor !== undefined) resolved.anchors.set(step, anchor);
    }
  }
  return (ws, ids) => {
    let next = ws;
    for (const step of steps) next = applyStep(next, doc.id, step, resolved, ids, partTitles);
    return next;
  };
}
